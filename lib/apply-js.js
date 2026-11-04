const jscodeshift = require('jscodeshift');
const parser = require('./parser');

const j = jscodeshift.withParser(parser);
const api = { jscodeshift: j, j, stats() {}, report() {} };

// Runs the rules in order. A block that fails to parse stays untouched and keeps no
// partial findings: "changed" must only ever describe an edit that was kept.
function applyJsRules(source, filePath, rules, findings = []) {
  const start = findings.length;
  let code = source;
  try {
    for (const rule of rules) {
      const output = rule.transform({ path: filePath, source: code }, api, { findings });
      if (typeof output === 'string') code = output;
    }
    return { code };
  } catch (error) {
    findings.length = start;
    return { code: source, error };
  }
}

module.exports = { applyJsRules };
