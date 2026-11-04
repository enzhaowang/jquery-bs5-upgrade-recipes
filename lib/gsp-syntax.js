// Returns the index after the `}` closing a `${...}` whose body starts at `start`,
// or -1. A regex cannot do this: ${list.collect { it.id }} has nested braces.
function findExprEnd(src, start) {
  let depth = 1;
  let quote = null;
  for (let i = start; i < src.length; i++) {
    const c = src[i];
    if (quote) {
      if (c === '\\') i++;
      else if (c === quote) quote = null;
    } else if (c === '"' || c === "'") {
      quote = c;
    } else if (c === '{') {
      depth++;
    } else if (c === '}' && --depth === 0) {
      return i + 1;
    }
  }
  return -1;
}

// Returns the index after the `>` closing the tag at `start`, or -1. GSP allows tags
// inside tags, e.g. <div <g:if test="${x}">data-toggle="modal"</g:if>>.
function findTagEnd(src, start) {
  let quote = null;
  let depth = 0;
  for (let i = start + 1; i < src.length; i++) {
    if (src.startsWith('${', i)) {
      const end = findExprEnd(src, i + 2);
      if (end < 0) return -1;
      i = end - 1;
    } else if (src.startsWith('<%', i)) {
      const end = src.indexOf('%>', i);
      if (end < 0) return -1;
      i = end + 1;
    } else if (quote) {
      if (src[i] === quote) quote = null;
    } else if (src[i] === '"' || src[i] === "'") {
      quote = src[i];
    } else if (src[i] === '<') {
      depth++;
    } else if (src[i] === '>') {
      if (depth === 0) return i + 1;
      depth--;
    }
  }
  return -1;
}

const lineAt = (text, offset) => text.slice(0, offset).split('\n').length;

module.exports = { findExprEnd, findTagEnd, lineAt };
