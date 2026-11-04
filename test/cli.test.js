const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync, spawnSync } = require('child_process');

const REPO = path.join(__dirname, '..');
const RUN = path.join(REPO, 'bin', 'run.js');
const SAMPLE = path.join(REPO, 'examples', 'sample-grails');
const CONFIG = path.join(REPO, 'examples', 'targets.json');

function snapshot(dir) {
  const files = {};
  const visit = (current) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) visit(full);
      else files[path.relative(dir, full)] = fs.readFileSync(full).toString('base64');
    }
  };
  visit(dir);
  return files;
}

function sandbox(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'upgrade-recipes-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const root = path.join(dir, 'project');
  fs.cpSync(SAMPLE, root, { recursive: true });
  return { root, reports: path.join(dir, 'reports') };
}

const run = (root, reports, ...extra) =>
  execFileSync('node', [RUN, '--root', root, '--config', CONFIG, '--report-dir', reports, ...extra], { encoding: 'utf8' });

test('dry run changes nothing but writes reports', (t) => {
  const { root, reports } = sandbox(t);
  const before = snapshot(root);
  const output = run(root, reports);
  assert.deepEqual(snapshot(root), before);
  assert.match(output, /Dry run/);
  assert.ok(fs.existsSync(path.join(reports, 'findings.csv')));
});

test('apply only changes files in the targets', (t) => {
  const { root, reports } = sandbox(t);
  const before = snapshot(root);
  run(root, reports, '--apply');
  const after = snapshot(root);
  const changed = Object.keys(after).filter((f) => after[f] !== before[f]).sort();
  assert.deepEqual(changed, [
    path.join('grails-app', 'assets', 'javascripts', 'business', 'orders.js'),
    path.join('grails-app', 'views', 'orders', 'index.gsp'),
  ]);
});

test('a second run has nothing left to change', (t) => {
  const { root, reports } = sandbox(t);
  run(root, reports, '--apply');
  const after = snapshot(root);
  run(root, reports, '--apply');
  assert.deepEqual(snapshot(root), after);
});

test('skips files that are not valid UTF-8, without damaging them', (t) => {
  const { root, reports } = sandbox(t);
  const file = path.join(root, 'grails-app', 'assets', 'javascripts', 'business', 'gbk.js');
  const bytes = Buffer.concat([Buffer.from("$('.a').size(); // "), Buffer.from([0xd6, 0xd0, 0xce, 0xc4])]);
  fs.writeFileSync(file, bytes);
  run(root, reports, '--apply');
  assert.deepEqual(fs.readFileSync(file), bytes);
  assert.match(fs.readFileSync(path.join(reports, 'findings.csv'), 'utf8'), /Not valid UTF-8/);
});

test('keeps a UTF-8 BOM', (t) => {
  const { root, reports } = sandbox(t);
  const file = path.join(root, 'grails-app', 'assets', 'javascripts', 'business', 'bom.js');
  fs.writeFileSync(file, "﻿$('.a').size();\n");
  run(root, reports, '--apply');
  assert.equal(fs.readFileSync(file, 'utf8'), "﻿$('.a').length;\n");
});

test('--rules limits what runs', (t) => {
  const { root, reports } = sandbox(t);
  run(root, reports, '--apply', '--rules', 'jq-removed-apis');
  const js = fs.readFileSync(path.join(root, 'grails-app/assets/javascripts/business/orders.js'), 'utf8');
  assert.match(js, /\.length/);
  assert.match(js, /\.bind\('click'/);
  assert.match(js, /data-toggle/);
});

test('rejects unknown rules and a missing --root', () => {
  const unknown = spawnSync('node', [RUN, '--root', '.', '--rules', 'nope'], { encoding: 'utf8' });
  assert.equal(unknown.status, 1);
  assert.match(unknown.stderr, /Unknown rule/);
  assert.equal(spawnSync('node', [RUN], { encoding: 'utf8' }).status, 1);
});
