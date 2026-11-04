// Scenario 3, JS side: once the markup uses data-bs-*, JS that still looks for
// data-* keeps running but silently matches nothing.
const { parse, walk, applyEdits, stringEdit } = require('../lib/ast-edits');
const { createReporter } = require('../lib/transform-kit');
const { TOGGLE_VALUES, DISMISS_VALUES, isDynamic } = require('../rules/bs5-mapping');

const RULE = 'bs5-js-selectors';
const VALUES = { toggle: TOGGLE_VALUES, dismiss: DISMISS_VALUES };
const SELECTOR_RE = /\[data-(toggle|dismiss)\s*([~|^$*]?=)\s*(["']?)([\w-]+)\3\s*\]/g;
const BARE_SELECTOR_RE = /\[data-(toggle|dismiss|target)\s*(?:\]|[~|^$*]?=)/;
const BS_DATA_KEYS = new Set(['toggle', 'dismiss', 'target', 'parent', 'placement', 'backdrop', 'keyboard', 'container', 'trigger', 'content']);
const CLASS_METHODS = new Set(['hasClass', 'addClass', 'removeClass', 'toggleClass']);

const rewriteSelector = (value) =>
  value.replace(SELECTOR_RE, (whole, name, op, quote, val) =>
    (VALUES[name].has(val) ? `[data-bs-${name}${op}${quote}${val}${quote}]` : whole));

function checkCall(node, report) {
  const { callee, arguments: args } = node;
  if (callee.type !== 'MemberExpression' || callee.computed) return;
  const method = callee.property.name;
  const first = args[0] && args[0].type === 'StringLiteral' ? args[0].value : null;

  if (method === 'data' && first === 'bs.modal') report.manual(node, RULE, '.data("bs.modal"): use bootstrap.Modal.getInstance()');
  else if (method === 'data' && BS_DATA_KEYS.has(first)) report.manual(node, RULE, `.data("${first}"): use "bs-${first}" if the markup was renamed`);
  else if (method === 'button' && (first === 'loading' || first === 'reset')) report.manual(node, RULE, `.button("${first}") no longer exists`);
  else if (method === 'affix') report.manual(node, RULE, '.affix() no longer exists');
  else if (CLASS_METHODS.has(method) && first === 'in') report.manual(node, RULE, `.${method}("in"): Bootstrap 5 uses .show`);
}

module.exports = function transform(file, api, options) {
  const report = createReporter(file, api, options);
  const edits = [];

  walk(parse(file.source), (node, parent) => {
    if (node.type === 'CallExpression') {
      checkCall(node, report);
      const method = node.callee.property && node.callee.property.name;
      const [name, value] = node.arguments;
      const attr = name && name.type === 'StringLiteral' && /^data-(toggle|dismiss)$/.exec(name.value);
      if ((method === 'attr' || method === 'removeAttr') && attr) {
        const known = value && value.type === 'StringLiteral' && VALUES[attr[1]].has(value.value);
        if (method === 'attr' && known) {
          edits.push(stringEdit(file.source, name, `data-bs-${attr[1]}`));
          report.changed(node, RULE, `.attr("${name.value}", ...)`);
        } else {
          report.manual(node, RULE, `.${method}("${name.value}"): value unknown, confirm data-bs-${attr[1]}`);
        }
      }
    }

    if (node.type === 'ObjectProperty' && node.key.type === 'StringLiteral') {
      const attr = /^data-(toggle|dismiss)$/.exec(node.key.value);
      if (attr) {
        if (node.value.type === 'StringLiteral' && VALUES[attr[1]].has(node.value.value)) {
          edits.push(stringEdit(file.source, node.key, `data-bs-${attr[1]}`));
          report.changed(node, RULE, `{ "${node.key.value}": ... }`);
        } else {
          report.manual(node, RULE, `{ "${node.key.value}": ... } with a non-Bootstrap or dynamic value`);
        }
      }
    }

    if (node.type === 'StringLiteral' && node.value.includes('[data-') && !node.value.includes('<')) {
      const next = rewriteSelector(node.value);
      if (next !== node.value) {
        edits.push(stringEdit(file.source, node, next));
        report.changed(node, RULE, 'selector');
      }
      if (BARE_SELECTOR_RE.test(next) || isDynamic(next)) {
        report.manual(node, RULE, 'Attribute selector left as is: value is missing, dynamic or not Bootstrap');
      }
    }
  });

  return edits.length ? applyEdits(file.source, edits) : undefined;
};
