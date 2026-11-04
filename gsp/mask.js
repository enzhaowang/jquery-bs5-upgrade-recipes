const { findExprEnd } = require('../lib/gsp-syntax');

const TAG = /^(<%--[\s\S]*?--%>|<%[\s\S]*?%>|<\/?[a-zA-Z]+:[\w-]+(?:"[^"]*"|'[^']*'|[^>'"])*>)/;
const newlines = (text) => (text.match(/\n/g) || []).length;

// Hides Groovy so the block parses as JS. Values become identifiers, which also work
// inside strings. Control tags become comments, since they sit between statements.
function mask(src) {
  if (src.includes('__GSP_')) throw new Error('Source already contains a placeholder prefix');

  const tokens = [];
  let out = '';
  const add = (raw, comment) => {
    const id = `__GSP_${tokens.length}__`;
    tokens.push({ id, raw, maskedLine: newlines(out) + 1 });
    return comment ? `/*${id}*/` : id;
  };

  let i = 0;
  while (i < src.length) {
    if (src.startsWith('${', i) && src[i - 1] !== '\\') {
      const end = findExprEnd(src, i + 2);
      if (end < 0) throw new Error('Unclosed ${');
      out += add(src.slice(i, end), false);
      i = end;
      continue;
    }
    // Skips comparisons such as `a<b:c`, where the `<` directly follows a value.
    const tag = src[i] === '<' && !/[\w)\]]/.test(src[i - 1] || '') ? src.slice(i).match(TAG) : null;
    if (tag) {
      const raw = tag[0];
      out += add(raw, !(raw.startsWith('<%=') || raw.endsWith('/>')));
      i += raw.length;
      continue;
    }
    out += src[i++];
  }
  return { code: out, tokens };
}

// Throws unless every placeholder survived exactly once, so a rule that dropped a
// comment can never silently delete a <g:if>. Order is not checked: moving
// .delegate() to .on() swaps arguments on purpose.
function unmask(code, tokens) {
  let output = code;
  for (const { id, raw } of tokens) {
    if (output.split(id).length !== 2) throw new Error(`Placeholder lost or duplicated: ${id}`);
    // A replacer function is required: raw may hold `$'` and other replacement patterns.
    output = output.replace(new RegExp(`(?:/\\*)?${id}(?:\\*/)?`), () => raw);
  }
  return output;
}

// Maps a line in masked code back to the block, as tokens can span several lines.
function originalLine(line, tokens) {
  return tokens
    .filter((t) => t.maskedLine < line)
    .reduce((total, t) => total + newlines(t.raw), line);
}

function restoreSnippet(snippet, tokens) {
  return snippet.replace(/(?:\/\*)?(__GSP_\d+__)(?:\*\/)?/g, (whole, id) => {
    const token = tokens.find((t) => t.id === id);
    return token ? token.raw.replace(/\s+/g, ' ') : whole;
  });
}

module.exports = { mask, unmask, originalLine, restoreSnippet };
