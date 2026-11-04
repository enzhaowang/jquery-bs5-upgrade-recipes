#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { parseArgs } = require('util');
const fg = require('fast-glob');
const { applyJsRules } = require('../lib/apply-js');
const { transformGsp } = require('../gsp/transform-gsp');
const { JS_RULES, HTML_RULES } = require('../transforms');

const USAGE = `Usage: upgrade-recipes --root <project> [options]

  --root <dir>        Project to process (required)
  --config <file>     Targets file (default: config/targets.json in this repo)
  --rules <a,b>       Only run these rules (default: all)
  --report-dir <dir>  Where to write reports (default: ./reports)
  --apply             Write changes. Without it, nothing in the project is modified.
`;

const BOM = '﻿';

// Writing a non-UTF-8 file back as UTF-8 would corrupt it, so those are skipped.
function readUtf8(file) {
  const raw = fs.readFileSync(file);
  const text = raw.toString('utf8');
  return Buffer.from(text, 'utf8').equals(raw) ? text : null;
}

function listFiles(root, target = {}) {
  return fg.sync(target.include || [], {
    cwd: root,
    ignore: target.exclude || [],
    onlyFiles: true,
    followSymbolicLinks: false,
    unique: true,
  }).sort();
}

function processFile(root, relative, rules, findings) {
  const absolute = path.join(root, relative);
  const text = readUtf8(absolute);
  if (text === null) {
    findings.push({ kind: 'finding', file: relative, line: 1, rule: 'file', status: 'manual', message: 'Not valid UTF-8: skipped', snippet: '' });
    return null;
  }
  const hasBom = text.startsWith(BOM);
  const source = hasBom ? text.slice(1) : text;

  let output;
  if (relative.endsWith('.gsp')) {
    output = transformGsp(source, relative, { jsRules: rules.js, htmlRules: rules.html, findings });
  } else {
    const result = applyJsRules(source, relative, rules.js, findings);
    if (result.error) {
      findings.push({ kind: 'finding', file: relative, line: 1, rule: 'file', status: 'parse-failed', message: result.error.message, snippet: '' });
    }
    output = result.code;
  }
  return output === source ? null : { absolute, content: (hasBom ? BOM : '') + output };
}

// Report cells are opened in Excel, where a leading = + - @ would run as a formula.
function csvCell(value) {
  const text = String(value ?? '');
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return `"${safe.replace(/"/g, '""')}"`;
}

function writeReports(dir, findings) {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'findings.json'), `${JSON.stringify(findings, null, 2)}\n`);
  const columns = ['kind', 'file', 'line', 'rule', 'status', 'message', 'snippet'];
  const rows = findings.map((f) => columns.map((c) => csvCell(f[c])).join(','));
  fs.writeFileSync(path.join(dir, 'findings.csv'), `${[columns.join(','), ...rows].join('\n')}\n`);
}

function printSummary(findings, files, changedFiles, apply) {
  console.log(`\nFiles scanned: ${files}, ${apply ? 'changed' : 'would change'}: ${changedFiles}`);

  const counts = {};
  for (const f of findings.filter((x) => x.kind === 'finding')) {
    counts[f.rule] = counts[f.rule] || {};
    counts[f.rule][f.status] = (counts[f.rule][f.status] || 0) + 1;
  }
  console.table(counts);

  const blocks = findings.filter((f) => f.kind === 'block');
  if (blocks.length) {
    const count = (s) => blocks.filter((b) => b.status === s).length;
    const ok = count('changed') + count('unchanged');
    console.log(`GSP script blocks: ${blocks.length}, handled: ${ok} (${Math.round((ok / blocks.length) * 100)}%), `
      + `changed: ${count('changed')}, parse-failed: ${count('parse-failed')}, placeholder-lost: ${count('placeholder-lost')}`);
  }
}

function main() {
  const { values } = parseArgs({
    options: {
      root: { type: 'string' },
      config: { type: 'string', default: path.join(__dirname, '..', 'config', 'targets.json') },
      rules: { type: 'string' },
      'report-dir': { type: 'string', default: 'reports' },
      apply: { type: 'boolean', default: false },
      help: { type: 'boolean', default: false },
    },
  });
  if (values.help || !values.root) {
    console.log(USAGE);
    process.exit(values.help ? 0 : 1);
  }

  const known = [...JS_RULES.map((r) => r.name), ...HTML_RULES];
  const selected = values.rules ? values.rules.split(',').map((s) => s.trim()) : known;
  const unknown = selected.filter((name) => !known.includes(name));
  if (unknown.length) {
    console.error(`Unknown rule(s): ${unknown.join(', ')}\nAvailable: ${[...new Set(known)].join(', ')}`);
    process.exit(1);
  }

  const root = path.resolve(values.root);
  const config = JSON.parse(fs.readFileSync(values.config, 'utf8'));
  const rules = {
    js: JS_RULES.filter((r) => selected.includes(r.name)),
    html: HTML_RULES.filter((r) => selected.includes(r)),
  };

  const files = [...new Set([...listFiles(root, config.js), ...listFiles(root, config.gsp)])];
  if (!files.length) console.warn('No files matched: check the include paths in the targets file.');

  const findings = [];
  const pending = files.map((f) => processFile(root, f, rules, findings)).filter(Boolean);

  if (values.apply) pending.forEach((p) => fs.writeFileSync(p.absolute, p.content));
  for (const p of pending) console.log(`${values.apply ? 'changed' : 'would change'}: ${path.relative(root, p.absolute)}`);

  writeReports(values['report-dir'], findings);
  printSummary(findings, files.length, pending.length, values.apply);
  console.log(`Reports: ${path.join(values['report-dir'], 'findings.csv')}`);
  if (!values.apply) console.log('Dry run: no project files were modified. Add --apply to write.');
}

main();
