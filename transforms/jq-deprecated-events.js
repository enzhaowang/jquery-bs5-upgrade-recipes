// Scenarios 1 and 2: deprecated in jQuery 3 but still working, so this is cleanup.
const { isDollar, isFn, isMember, isJQuery } = require('../lib/jq');
const { createReporter, printOptions } = require('../lib/transform-kit');

const RULE = 'jq-deprecated-events';
const DATA_SAFE = new Set(['ObjectExpression', 'ArrayExpression', 'NumericLiteral', 'BooleanLiteral', 'NullLiteral']);

// .bind(event, data, fn) -> .on(event, data, fn), unless data could be a string:
// .on() would then read it as a delegation selector.
function bindIsSafe(args) {
  if (args.length === 1) return true;
  if (args.length === 2) return args[1].type !== 'StringLiteral';
  return args.length === 3 && DATA_SAFE.has(args[1].type);
}

module.exports = function transform(file, api, options) {
  const j = api.jscodeshift;
  const root = j(file.source);
  const report = createReporter(file, api, options);
  let changed = 0;

  root.find(j.CallExpression).filter((p) => isMember(p.node.callee)).forEach((path) => {
    const { node } = path;
    const { callee, arguments: args } = node;
    const method = callee.property.name;
    const receiver = callee.object;
    const done = () => { changed++; report.changed(node, RULE, `.${method}()`); };

    if (method === 'parseJSON' && isDollar(receiver)) {
      node.callee = j.memberExpression(j.identifier('JSON'), j.identifier('parse'));
      return done();
    }

    if (!['bind', 'unbind', 'delegate', 'undelegate'].includes(method)) return;

    if (!isJQuery(receiver, path.scope)) {
      // fn.bind(this) is the native Function.prototype.bind: stay silent.
      if (method === 'bind' && !(args[0] && args[0].type === 'StringLiteral')) return;
      return report.manual(node, RULE, `.${method}() on an unproven receiver`);
    }

    if (method === 'bind') {
      if (args.length === 0 || !bindIsSafe(args)) return report.manual(node, RULE, '.bind() data argument may be read as a selector by .on()');
      callee.property.name = 'on';
      return done();
    }

    if (method === 'unbind') {
      callee.property.name = 'off';
      return done();
    }

    if (method === 'delegate') {
      // .delegate(selector, events, [data], fn) -> .on(events, selector, [data], fn)
      if (args.length < 2 || args.length > 4) return report.manual(node, RULE, '.delegate() with an unexpected argument count');
      if (args.length === 3 && !isFn(args[2]) && args[2].type !== 'Identifier') return report.manual(node, RULE, '.delegate() with an unexpected handler');
      node.arguments = [args[1], args[0], ...args.slice(2)];
      callee.property.name = 'on';
      return done();
    }

    // .undelegate(selector, events, [fn]) -> .off(events, selector, [fn]);
    // .undelegate() and .undelegate(namespace) keep their arguments.
    if (args.length >= 2) node.arguments = [args[1], args[0], ...args.slice(2)];
    callee.property.name = 'off';
    return done();
  });

  return changed ? root.toSource(printOptions(file.source, options)) : undefined;
};

module.exports.parser = require('../lib/parser');
