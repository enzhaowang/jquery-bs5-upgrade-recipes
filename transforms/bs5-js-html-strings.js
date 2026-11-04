// Scenario 5: HTML built inside JS, as strings, concatenation or template literals.
const { parse, walk, applyEdits, stringEdit } = require('../lib/ast-edits');
const { createReporter } = require('../lib/transform-kit');
const { rewriteHtmlAttrs } = require('../rules/bs5-html');

const RULE = 'bs5-js-html-strings';
const mayHoldAttrs = (text) => /(^|[\s"'<])data-[a-z]/i.test(text);

module.exports = function transform(file, api, options) {
  const report = createReporter(file, api, options);
  const edits = [];

  const apply = (node, text, toEdit) => {
    if (!mayHoldAttrs(text)) return;
    const result = rewriteHtmlAttrs(text, { fragment: true });
    result.notes.forEach((n) => (n.status === 'changed'
      ? report.changed(node, RULE, n.message)
      : report.manual(node, RULE, n.message)));
    if (result.text !== text) edits.push(toEdit(result.text));
  };

  walk(parse(file.source), (node) => {
    if (node.type === 'StringLiteral') {
      apply(node, node.value, (next) => stringEdit(file.source, node, next));
    } else if (node.type === 'TemplateElement') {
      // The raw text is spliced directly, so its escapes survive as written.
      apply(node, node.value.raw, (next) => ({ start: node.start, end: node.end, text: next }));
    }
  });

  return edits.length ? applyEdits(file.source, edits) : undefined;
};
