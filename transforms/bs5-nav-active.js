// Scenario 4: Bootstrap 5 puts .active on the nav link, not the <li>. Only provable
// Bootstrap navs are edited; a bare li.active could be pagination or the side menu.
const { parse, walk, applyEdits, stringEdit } = require('../lib/ast-edits');
const { createReporter } = require('../lib/transform-kit');
const { moveNavActive } = require('../rules/bs5-html');
const { LI_ACTIVE_UNCHANGED, NAV_CONTAINERS } = require('../rules/bs5-mapping');

const RULE = 'bs5-nav-active';
const NAV_LINK_SELECTOR = new RegExp(`(${NAV_CONTAINERS})\\s*>?\\s*li\\.active\\s*>?\\s*a\\b`, 'g');
const LI_TRAVERSAL = new Set(['parent', 'closest', 'parents']);

function checkActiveToggle(node, report) {
  const { callee, arguments: args } = node;
  if (callee.type !== 'MemberExpression' || callee.computed) return;
  if (!['addClass', 'removeClass', 'toggleClass'].includes(callee.property.name)) return;
  if (!args[0] || args[0].value !== 'active') return;

  const receiver = callee.object;
  const step = receiver.type === 'CallExpression' && receiver.callee.property;
  if (!step || !LI_TRAVERSAL.has(step.name)) return;
  const target = receiver.arguments[0] ? receiver.arguments[0].value : null;
  if (step.name === 'parent' ? target === null || target === 'li' : target === 'li') {
    report.manual(node, RULE, `.${step.name}(...).${callee.property.name}("active"): set it on the .nav-link if this is a Bootstrap nav`);
  }
}

module.exports = function transform(file, api, options) {
  const report = createReporter(file, api, options);
  const edits = [];

  walk(parse(file.source), (node) => {
    if (node.type === 'CallExpression') checkActiveToggle(node, report);
    if (node.type !== 'StringLiteral') return;

    if (node.value.includes('<li')) {
      const result = moveNavActive(node.value);
      result.notes.forEach((n) => (n.status === 'changed'
        ? report.changed(node, RULE, n.message)
        : report.manual(node, RULE, n.message)));
      if (result.text !== node.value) edits.push(stringEdit(file.source, node, result.text));
      return;
    }

    if (!node.value.includes('li.active') || LI_ACTIVE_UNCHANGED.test(node.value)) return;
    const next = node.value.replace(NAV_LINK_SELECTOR, '$1 .nav-link.active');
    if (next !== node.value) {
      edits.push(stringEdit(file.source, node, next));
      report.changed(node, RULE, 'li.active a selector');
    }
    if (next.includes('li.active')) {
      report.manual(node, RULE, 'li.active selector: the match becomes an <a>, so check the code using the result');
    }
  });

  return edits.length ? applyEdits(file.source, edits) : undefined;
};
