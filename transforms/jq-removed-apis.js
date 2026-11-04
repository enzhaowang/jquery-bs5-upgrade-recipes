// Scenarios 1 and 2: APIs removed in jQuery 3.0, which fail at runtime on 3.7.1.
const { isDollar, isFn, isMember, isJQuery, isJqXhr } = require('../lib/jq');
const { createReporter, printOptions } = require('../lib/transform-kit');

const RULE = 'jq-removed-apis';
const JQXHR_RENAMES = { success: 'done', error: 'fail', complete: 'always' };
const EVENT_SHORTHANDS = new Set(['load', 'unload', 'error']);

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
    const jq = isJQuery(receiver, path.scope);
    const done = () => { changed++; report.changed(node, RULE, `.${method}()`); };

    if (method === 'size' && args.length === 0) {
      if (!jq) return report.manual(node, RULE, '.size() on an unproven receiver: may be a Map or custom object');
      j(path).replaceWith(j.memberExpression(receiver, j.identifier('length')));
      return done();
    }

    if (method === 'andSelf' && args.length === 0) {
      if (!jq) return report.manual(node, RULE, '.andSelf() on an unproven receiver');
      callee.property.name = 'addBack';
      return done();
    }

    if (JQXHR_RENAMES[method] && isJqXhr(receiver, path.scope)) {
      callee.property.name = JQXHR_RENAMES[method];
      return done();
    }

    if (EVENT_SHORTHANDS.has(method)) {
      if (jq && args.length === 1 && isFn(args[0])) {
        node.arguments = [j.stringLiteral(method), args[0]];
        callee.property.name = 'on';
        return done();
      }
      // .load(url) is the Ajax method and stays. An identifier could be either.
      const ambiguous = args.length === 0 || (args.length === 1 && args[0].type === 'Identifier');
      if (jq && ambiguous) return report.manual(node, RULE, `.${method}() with a non-literal handler or trigger form`);
      if (!jq && args.length === 1 && isFn(args[0])) return report.manual(node, RULE, `.${method}(fn) on an unproven receiver`);
    }

    if ((method === 'success' || method === 'complete') && args.length === 1 && isFn(args[0])) {
      return report.manual(node, RULE, `.${method}(fn): if this is a jqXHR, use ${JQXHR_RENAMES[method]}`);
    }

    if (method === 'on' && args.length >= 1 && args[0].value === 'ready') {
      const isDocument = receiver.type === 'CallExpression' && isDollar(receiver.callee)
        && receiver.arguments.length === 1 && receiver.arguments[0].name === 'document';
      if (isDocument && args.length === 2 && isFn(args[1])) {
        j(path).replaceWith(j.callExpression(receiver.callee, [args[1]]));
        return done();
      }
      return report.manual(node, RULE, '.on("ready") was removed: use $(fn)');
    }
  });

  return changed ? root.toSource(printOptions(file.source, options)) : undefined;
};

module.exports.parser = require('../lib/parser');
