const { findTagEnd } = require('../lib/gsp-syntax');

const TEMPLATE_TYPE = /^text\/(x-template|html|template|ng-template|x-handlebars(-template)?|x-jquery-tmpl|x-mustache)$/i;
const JS_TYPE = /^(text|application)\/(javascript|ecmascript)$|^module$/i;
const OPENER = /<%--|<!--|<(script|g:javascript|asset:script)\b/gi;

function bodyKind(openTag) {
  if (/\bsrc\s*=/i.test(openTag)) return 'html';
  const type = openTag.match(/\btype\s*=\s*["']([^"']*)["']/i);
  if (!type || JS_TYPE.test(type[1])) return 'js';
  return TEMPLATE_TYPE.test(type[1]) ? 'template' : 'skip';
}

// Splits a GSP by position into html, js, template, comment and skip segments, which
// join back to the exact input. The GSP is never parsed and re-serialized: HTML
// parsers do not understand <g:*> tags and would rewrite the file.
function scanGsp(source) {
  const segments = [];
  let cursor = 0;
  const push = (kind, end) => {
    if (end > cursor) segments.push({ kind, start: cursor, end, text: source.slice(cursor, end) });
    cursor = end;
  };

  OPENER.lastIndex = 0;
  let match;
  while ((match = OPENER.exec(source))) {
    if (match[1]) {
      const openEnd = findTagEnd(source, match.index);
      if (openEnd < 0) continue;
      const openTag = source.slice(match.index, openEnd);
      if (openTag.endsWith('/>')) {
        OPENER.lastIndex = openEnd;
        continue;
      }
      const closer = new RegExp(`</${match[1]}\\s*>`, 'i');
      const closeAt = source.slice(openEnd).search(closer);
      if (closeAt < 0) {
        OPENER.lastIndex = openEnd;
        continue;
      }
      push('html', openEnd);
      push(bodyKind(openTag), openEnd + closeAt);
      OPENER.lastIndex = cursor;
    } else {
      const close = match[0] === '<%--' ? '--%>' : '-->';
      const closeAt = source.indexOf(close, match.index);
      const end = closeAt < 0 ? source.length : closeAt + close.length;
      push('html', match.index);
      push('comment', end);
      OPENER.lastIndex = end;
    }
  }
  push('html', source.length);
  return segments;
}

module.exports = { scanGsp };
