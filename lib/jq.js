// jscodeshift has no type information, so receivers are classified by heuristics.
// A false result means "not proven jQuery": callers report it instead of editing.

const AJAX_METHODS = new Set(['ajax', 'get', 'post', 'getJSON', 'getScript']);
const JQXHR_CHAIN = new Set(['done', 'fail', 'always', 'success', 'error', 'complete']);

// May return a plain value depending on the arguments, so the chain stops being provable.
const VALUE_METHODS = new Set([
  'val', 'text', 'html', 'attr', 'prop', 'data', 'css',
  'width', 'height', 'innerWidth', 'innerHeight', 'outerWidth', 'outerHeight',
  'offset', 'position', 'scrollTop', 'scrollLeft',
  'get', 'index', 'is', 'hasClass', 'serialize', 'serializeArray', 'toArray', 'size',
]);

const isDollar = (node) =>
  node && node.type === 'Identifier' && (node.name === '$' || node.name === 'jQuery');

const isFn = (node) =>
  node && (node.type === 'FunctionExpression' || node.type === 'ArrowFunctionExpression');

const isMember = (node) =>
  node && node.type === 'MemberExpression' && !node.computed && node.property.type === 'Identifier';

function bindingInit(name, scope) {
  const owner = scope && scope.lookup(name);
  if (!owner) return null;
  const bindings = owner.getBindings()[name] || [];
  if (bindings.length !== 1) return null;
  const parent = bindings[0].parent && bindings[0].parent.node;
  return parent && parent.type === 'VariableDeclarator' ? parent.init : null;
}

function isJQuery(node, scope, seen = new Set()) {
  if (!node || seen.has(node)) return false;
  seen.add(node);

  if (node.type === 'Identifier') {
    if (isDollar(node)) return false;
    if (node.name.startsWith('$')) return true;
    return isJQuery(bindingInit(node.name, scope), scope, seen);
  }
  if (node.type !== 'CallExpression') return false;
  if (isDollar(node.callee)) return true;
  if (!isMember(node.callee) || VALUE_METHODS.has(node.callee.property.name)) return false;
  return isJQuery(node.callee.object, scope, seen);
}

function isJqXhr(node, scope, seen = new Set()) {
  if (!node || seen.has(node)) return false;
  seen.add(node);

  if (node.type === 'Identifier') return isJqXhr(bindingInit(node.name, scope), scope, seen);
  if (node.type !== 'CallExpression' || !isMember(node.callee)) return false;
  const { object, property } = node.callee;
  if (isDollar(object)) return AJAX_METHODS.has(property.name);
  return JQXHR_CHAIN.has(property.name) && isJqXhr(object, scope, seen);
}

module.exports = { isDollar, isFn, isMember, isJQuery, isJqXhr };
