const test = require('node:test');
const assert = require('node:assert/strict');
const { runJs } = require('./helpers');

const cases = [
  ['selector', `$('[data-toggle="tab"]');`, `$('[data-bs-toggle="tab"]');`],
  ['unquoted selector', `$('[data-toggle=modal]');`, `$('[data-bs-toggle=modal]');`],
  ['selector in a larger query', `$('.a [data-dismiss="modal"]');`, `$('.a [data-bs-dismiss="modal"]');`],
  ['attr setter', `$(e).attr('data-toggle', 'tooltip');`, `$(e).attr('data-bs-toggle', 'tooltip');`],
  ['attributes map', `$('<a>', { 'data-toggle': 'modal' });`, `$('<a>', { 'data-bs-toggle': 'modal' });`],
  ['HTML string', `var h = '<a data-toggle="modal" data-target="#m">x</a>';`, `var h = '<a data-bs-toggle="modal" data-bs-target="#m">x</a>';`],
  ['keeps double quotes', `var h = "<a data-toggle='modal'>x</a>";`, `var h = "<a data-bs-toggle='modal'>x</a>";`],
  ['keeps escaped quotes', `var h = "<a data-toggle=\\"modal\\">x</a>";`, `var h = "<a data-bs-toggle=\\"modal\\">x</a>";`],
  ['template literal', 'var h = `<a data-toggle="tab" href="#${id}">x</a>`;', 'var h = `<a data-bs-toggle="tab" href="#${id}">x</a>`;'],
  ['tag continued from an earlier string', `var h = '<a href="' + u + '" data-dismiss="modal">';`, `var h = '<a href="' + u + '" data-bs-dismiss="modal">';`],
  ['nav selector', `$('.nav-tabs li.active a');`, `$('.nav-tabs .nav-link.active');`],
  ['nav selector with child combinators', `$('.nav-pills > li.active > a');`, `$('.nav-pills .nav-link.active');`],
  [
    'tab HTML string',
    `var h = '<li class="active"><a data-toggle="tab" href="#a">A</a></li>';`,
    `var h = '<li class="nav-item"><a data-bs-toggle="tab" href="#a" class="nav-link active">A</a></li>';`,
  ],
  [
    'inactive tab HTML string',
    `var h = '<li><a class="x" data-toggle="tab">B</a></li>';`,
    `var h = '<li class="nav-item"><a class="x nav-link" data-bs-toggle="tab">B</a></li>';`,
  ],
];

for (const [name, input, expected] of cases) {
  test(`converts: ${name}`, () => assert.equal(runJs(input).code, expected));
}

const reportOnly = [
  ['bare attribute selector', `$('[data-toggle]');`],
  ['non-Bootstrap selector value', `$('[data-toggle="my-plugin"]');`],
  ['.data() read', `$(e).data('target');`],
  ['attr getter', `$(e).attr('data-toggle');`],
  ['attr with a dynamic value', `$(e).attr('data-toggle', kind);`],
  ['dynamic value in a concatenated string', `var h = '<a data-toggle="' + kind + '">';`],
  ['instance lookup', `$(e).data('bs.modal');`],
  ['removed stateful button', `$(e).button('loading');`],
  ['.in class', `$(e).hasClass('in');`],
  ['bare li.active', `$('li.active');`],
  ['nav li.active without an anchor', `$('.nav-tabs li.active');`],
  ['setting active on the parent', `$(this).parent().addClass('active');`],
  ['setting active on closest li', `$(this).closest('li').removeClass('active');`],
  ['non-tab li.active HTML', `var h = '<li class="active"><a href="#">x</a></li>';`],
];

for (const [name, input] of reportOnly) {
  test(`reports without changing: ${name}`, () => {
    const result = runJs(input);
    assert.equal(result.code, input);
    assert.ok(result.manual.length >= 1, 'expected a manual finding');
  });
}

const untouched = [
  ['Inspinia side menu', `$('#side-menu li.active');`],
  ['pagination keeps active on li', `$('.pagination li.active');`],
  ['breadcrumb keeps active on li', `$('.breadcrumb li.active');`],
  ['custom data attribute', `var h = '<a data-id="1">x</a>';`],
  ['already migrated markup', `var h = '<a data-bs-toggle="modal" data-bs-target="#m">x</a>';`],
  ['already migrated selector', `$('[data-bs-toggle="tab"]');`],
];

for (const [name, input] of untouched) {
  test(`does not change or report: ${name}`, () => {
    const result = runJs(input);
    assert.equal(result.code, input);
    assert.equal(result.manual.length, 0);
  });
}

test('data-target without a Bootstrap toggle is reported, not renamed', () => {
  const input = `var h = '<a data-target="#x">y</a>';`;
  const result = runJs(input);
  assert.equal(result.code, input);
  assert.equal(result.manual.length, 1);
});

test('is idempotent', () => {
  const input = `$('[data-toggle="tab"]'); $('.nav-tabs li.active a');
var h = '<li class="active"><a data-toggle="tab" data-target="#a">A</a></li>';`;
  const once = runJs(input).code;
  assert.notEqual(once, input);
  assert.equal(runJs(once).code, once);
});

test('keeps tabs and CRLF on string-level edits', () => {
  const input = `function f() {\r\n\tvar a   = 1;\r\n\t$('[data-toggle="tab"]');\r\n}\r\n`;
  const expected = `function f() {\r\n\tvar a   = 1;\r\n\t$('[data-bs-toggle="tab"]');\r\n}\r\n`;
  assert.equal(runJs(input).code, expected);
});
