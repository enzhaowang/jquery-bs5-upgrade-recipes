function createReporter(file, api, options = {}) {
  const lines = file.source.split(/\r?\n/);
  const offset = options.lineOffset || 0;

  const push = (node, rule, status, message) => {
    const line = node && node.loc ? node.loc.start.line : 1;
    const finding = {
      kind: 'finding',
      file: file.path,
      line: line + offset,
      rule,
      status,
      message,
      snippet: (lines[line - 1] || '').trim().slice(0, 160),
    };
    if (options.findings) options.findings.push(finding);
    else if (api && api.report) api.report(`${status} ${rule} L${finding.line}: ${message}`);
  };

  return {
    changed: (node, rule, message = '') => push(node, rule, 'changed', message),
    manual: (node, rule, message) => push(node, rule, 'manual', message),
  };
}

// recast rewrites every line ending on print, so keep the ones the file already uses.
function printOptions(source, options = {}) {
  const single = (source.match(/'/g) || []).length;
  const double = (source.match(/"/g) || []).length;
  return {
    quote: single >= double ? 'single' : 'double',
    lineTerminator: source.includes('\r\n') ? '\r\n' : '\n',
    ...options.printOptions,
  };
}

module.exports = { createReporter, printOptions };
