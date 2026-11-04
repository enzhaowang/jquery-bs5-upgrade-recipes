const { applyJsRules } = require('../lib/apply-js');
const { transformGsp } = require('../gsp/transform-gsp');
const { JS_RULES, HTML_RULES } = require('../transforms');

const rulesNamed = (...names) => JS_RULES.filter((r) => names.includes(r.name));

function runJs(source, ...names) {
  const findings = [];
  const rules = names.length ? rulesNamed(...names) : JS_RULES;
  const { code, error } = applyJsRules(source, 'test.js', rules, findings);
  if (error) throw error;
  return { code, findings, manual: findings.filter((f) => f.status === 'manual') };
}

function runGsp(source) {
  const findings = [];
  const code = transformGsp(source, 'test.gsp', { jsRules: JS_RULES, htmlRules: HTML_RULES, findings });
  return {
    code,
    findings,
    manual: findings.filter((f) => f.status === 'manual'),
    blocks: findings.filter((f) => f.kind === 'block'),
  };
}

module.exports = { runJs, runGsp };
