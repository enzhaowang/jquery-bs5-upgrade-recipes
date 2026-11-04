const { applyJsRules } = require('../lib/apply-js');
const { lineAt } = require('../lib/gsp-syntax');
const { rewriteHtmlAttrs, moveNavActive } = require('../rules/bs5-html');
const { scanGsp } = require('./scan');
const { mask, unmask, originalLine, restoreSnippet } = require('./mask');

const INLINE_HANDLER = /\bon[a-z]+\s*=\s*(?:"[^"]*(?:\$|jQuery)\([^"]*"|'[^']*(?:\$|jQuery)\([^']*')/gi;

function transformScript(segment, source, filePath, jsRules, findings) {
  const blockLine = lineAt(source, segment.start);
  const block = (status, message = '') => findings.push({
    kind: 'block', file: filePath, line: blockLine, rule: 'gsp-script', status, message, snippet: '',
  });

  let masked;
  try {
    masked = mask(segment.text);
  } catch (error) {
    block('parse-failed', error.message);
    return segment.text;
  }

  const local = [];
  const { code, error } = applyJsRules(masked.code, filePath, jsRules, local);
  if (error) {
    block('parse-failed', error.message);
    return segment.text;
  }

  let restored;
  try {
    restored = unmask(code, masked.tokens);
  } catch (unmaskError) {
    block('placeholder-lost', unmaskError.message);
    return segment.text;
  }

  for (const finding of local) {
    finding.line = originalLine(finding.line, masked.tokens) + blockLine - 1;
    finding.snippet = restoreSnippet(finding.snippet, masked.tokens);
    findings.push(finding);
  }
  block(restored === segment.text ? 'unchanged' : 'changed');
  return restored;
}

function transformHtml(segment, source, filePath, htmlRules, findings) {
  const sourceLines = source.split(/\r?\n/);
  const record = (notes) => {
    for (const note of notes) {
      const line = lineAt(source, segment.start + Math.min(note.offset, segment.text.length));
      findings.push({
        kind: 'finding',
        file: filePath,
        line,
        rule: note.rule,
        status: note.status,
        message: note.message,
        snippet: (sourceLines[line - 1] || '').trim().slice(0, 160),
      });
    }
  };

  let text = segment.text;
  if (htmlRules.includes('bs5-attrs')) {
    const result = rewriteHtmlAttrs(text);
    record(result.notes);
    text = result.text;

    for (const m of segment.text.matchAll(INLINE_HANDLER)) {
      record([{ offset: m.index, rule: 'gsp-inline-handler', status: 'manual', message: 'jQuery in an inline event attribute is not auto-converted' }]);
    }
  }
  if (htmlRules.includes('bs5-nav-active')) {
    const result = moveNavActive(text);
    record(result.notes);
    text = result.text;
  }
  return text;
}

// Comments and non-JS script bodies are kept byte for byte.
function transformGsp(source, filePath, { jsRules, htmlRules, findings }) {
  return scanGsp(source).map((segment) => {
    if (segment.kind === 'js') return transformScript(segment, source, filePath, jsRules, findings);
    if (segment.kind === 'html' || segment.kind === 'template') return transformHtml(segment, source, filePath, htmlRules, findings);
    return segment.text;
  }).join('');
}

module.exports = { transformGsp };
