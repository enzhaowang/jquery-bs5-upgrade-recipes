const { findTagEnd } = require('../lib/gsp-syntax');
const {
  TOGGLE_VALUES, DISMISS_VALUES, TOGGLE_COMPANIONS, STANDALONE, BY_CLASS, isDynamic,
} = require('./bs5-mapping');

const ATTR_RE = /(?<![\w\-[])data-([a-z][\w-]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/gi;

function readAttrs(text) {
  return [...text.matchAll(ATTR_RE)].map((m) => {
    const value = m[2] ?? m[3] ?? m[4];
    // `data-toggle="` with no closing quote: the value is concatenated in from elsewhere.
    const open = value === undefined && /^\s*=/.test(text.slice(m.index + m[0].length));
    return { index: m.index, name: m[1].toLowerCase(), value, open };
  });
}

function shouldRename(attr, ctx) {
  if (attr.name === 'toggle') return ctx.bsToggle;
  if (attr.name === 'dismiss') return DISMISS_VALUES.has(attr.value);
  if (STANDALONE[attr.name]) return STANDALONE[attr.name].test(attr.value ?? '');
  if (ctx.bsToggle && TOGGLE_COMPANIONS.has(attr.name)) return true;
  return ctx.classes.some((c) => BY_CLASS[c] && BY_CLASS[c].has(attr.name));
}

function noteFor(attr) {
  const dynamic = attr.open || isDynamic(attr.value ?? '');
  if (attr.name === 'toggle' || attr.name === 'dismiss') {
    if (dynamic) return `Dynamic data-${attr.name}: decide data-bs-${attr.name} by hand`;
    return `data-${attr.name}="${attr.value}" is not a Bootstrap 5 value: check the owning plugin`;
  }
  if (attr.name === 'target') return 'data-target without a Bootstrap data-toggle: may be custom';
  return null;
}

function rewriteTag(tag, base, notes) {
  const attrs = readAttrs(tag);
  if (!attrs.length) return tag;

  const toggle = attrs.find((a) => a.name === 'toggle');
  const classMatch = tag.match(/\bclass\s*=\s*["']([^"']*)["']/i);
  const ctx = {
    bsToggle: Boolean(toggle && TOGGLE_VALUES.has(toggle.value)),
    classes: classMatch ? classMatch[1].split(/\s+/) : [],
  };

  let output = tag;
  let renamed = 0;
  for (const attr of [...attrs].reverse()) {
    if (shouldRename(attr, ctx)) {
      const at = attr.index + 'data-'.length;
      output = `${output.slice(0, at)}bs-${output.slice(at)}`;
      renamed++;
    } else {
      const message = noteFor(attr);
      if (message) notes.push({ offset: base + attr.index, rule: 'bs5-attrs', status: 'manual', message });
    }
  }
  if (renamed) {
    notes.push({ offset: base, rule: 'bs5-attrs', status: 'changed', message: `${renamed} attribute(s) renamed` });
    if (/<\/?[a-zA-Z]+:/.test(tag.slice(1))) {
      notes.push({ offset: base, rule: 'bs5-attrs', status: 'manual', message: 'Attribute inside a conditional GSP tag: review both branches' });
    }
  }
  return output;
}

// `fragment` is for HTML pieces in JS strings, which may start or end mid-tag.
function rewriteHtmlAttrs(text, { fragment = false } = {}) {
  const notes = [];
  let output = '';
  let cursor = 0;

  const flushGap = (end) => {
    const gap = text.slice(cursor, end);
    output += fragment ? rewriteTag(gap, cursor, notes) : gap;
    cursor = end;
  };

  const tagStart = /<[a-zA-Z]/g;
  let match;
  while ((match = tagStart.exec(text))) {
    let end = findTagEnd(text, match.index);
    if (end < 0) {
      if (!fragment) continue;
      end = text.length;
    }
    flushGap(match.index);
    output += rewriteTag(text.slice(match.index, end), match.index, notes);
    cursor = end;
    tagStart.lastIndex = end;
  }
  flushGap(text.length);
  return { text: output, notes };
}

const addTokens = (attrs, tokens) => {
  const m = attrs.match(/\bclass\s*=\s*(["'])([^"']*)\1/i);
  if (!m) return `${attrs} class="${tokens.join(' ')}"`;
  const merged = [...new Set([...m[2].split(/\s+/).filter(Boolean), ...tokens])].join(' ');
  return attrs.replace(m[0], `class=${m[1]}${merged}${m[1]}`);
};

const dropToken = (attrs, token) =>
  attrs.replace(/\bclass\s*=\s*(["'])([^"']*)\1/i, (_, q, value) => {
    const kept = value.split(/\s+/).filter((t) => t && t !== token).join(' ');
    return `class=${q}${kept}${q}`;
  });

const hasClass = (attrs, token) => {
  const m = attrs.match(/\bclass\s*=\s*(["'])([^"']*)\1/i);
  return Boolean(m && m[2].split(/\s+/).includes(token));
};

// Bootstrap 5 tabs: .active moves from the <li> to the <a>, and both need their nav classes.
function moveNavActive(text) {
  const notes = [];
  const NAV_ITEM = /<li\b([^<>]*)>(\s*)<a\b([^<>]*)>/gi;

  const output = text.replace(NAV_ITEM, (whole, li, gap, a, offset) => {
    if (!/data-(?:bs-)?toggle\s*=\s*["']?(?:tab|pill)\b/i.test(a)) return whole;
    if (isDynamic(li) || /\bclass\s*=\s*["'][^"']*\$\{/.test(a)) {
      notes.push({ offset, rule: 'bs5-nav-active', status: 'manual', message: 'Tab item with dynamic class: move .active to the <a> by hand' });
      return whole;
    }
    if (hasClass(li, 'nav-item') && hasClass(a, 'nav-link')) return whole;

    const active = hasClass(li, 'active');
    const newLi = addTokens(active ? dropToken(li, 'active') : li, ['nav-item']);
    const newA = addTokens(a, active ? ['nav-link', 'active'] : ['nav-link']);
    notes.push({ offset, rule: 'bs5-nav-active', status: 'changed', message: 'Tab item moved to .nav-item/.nav-link' });
    return `<li${newLi}>${gap}<a${newA}>`;
  });

  for (const m of output.matchAll(/<li\b[^<>]*\bclass\s*=\s*["'][^"']*\bactive\b[^"']*["'][^<>]*>/gi)) {
    if (/page-item|breadcrumb-item/.test(m[0]) || isDynamic(m[0])) continue;
    notes.push({ offset: m.index, rule: 'bs5-nav-active', status: 'manual', message: 'li.active of unknown component: move to the <a> only if it is a Bootstrap nav' });
  }
  return { text: output, notes };
}

module.exports = { rewriteHtmlAttrs, moveNavActive };
