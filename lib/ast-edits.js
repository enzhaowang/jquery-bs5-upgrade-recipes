const parser = require('./parser');

// String-level rules splice the original text instead of printing through recast:
// recast cannot keep a literal's quote style, and it parses a tab-expanded copy of
// the source, so its offsets do not line up with the file.
const SKIP_KEYS = new Set(['loc', 'tokens', 'comments', 'extra', 'errors', 'leadingComments', 'trailingComments', 'innerComments']);

function walk(node, visit, parent = null) {
  if (!node || typeof node.type !== 'string') return;
  visit(node, parent);
  for (const key of Object.keys(node)) {
    if (SKIP_KEYS.has(key)) continue;
    const value = node[key];
    if (Array.isArray(value)) value.forEach((child) => walk(child, visit, node));
    else if (value && typeof value === 'object') walk(value, visit, node);
  }
}

function applyEdits(source, edits) {
  return [...edits]
    .sort((a, b) => b.start - a.start)
    .reduce((text, e) => text.slice(0, e.start) + e.text + text.slice(e.end), source);
}

function encodeString(value, quote) {
  const body = value
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t')
    .split(quote)
    .join(`\\${quote}`);
  return quote + body + quote;
}

// Replaces a StringLiteral's value, keeping the quote style it was written with.
function stringEdit(source, node, value) {
  return { start: node.start, end: node.end, text: encodeString(value, source[node.start]) };
}

const parse = (source) => parser.parse(source).program;

module.exports = { parse, walk, applyEdits, stringEdit };
