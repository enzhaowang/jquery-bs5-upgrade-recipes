const test = require('node:test');
const assert = require('node:assert/strict');
const { runJs } = require('./helpers');

const JQ = ['jq-removed-apis', 'jq-deprecated-events'];
const cases = [
  ['size on $()', "var n = $('.a').size();", "var n = $('.a').length;"],
  ['size through a chain', "$('.a').find('b').size();", "$('.a').find('b').length;"],
  ['size on a $-prefixed variable', 'var n = $rows.size();', 'var n = $rows.length;'],
  ['size on a variable assigned from $()', "var r = $('.a'); r.size();", "var r = $('.a'); r.length;"],
  ['andSelf', "$('.a').andSelf();", "$('.a').addBack();"],
  ['window load', "$(window).load(function () { go(); });", "$(window).on('load', function () { go(); });"],
  ['image error', "$('img').error(function () {});", "$('img').on('error', function () {});"],
  ['unload', "$(window).unload(function () {});", "$(window).on('unload', function () {});"],
  ['jqXHR success', "$.ajax(o).success(fn);", "$.ajax(o).done(fn);"],
  ['jqXHR chain', "$.ajax(o).done(a).error(b).complete(c);", "$.ajax(o).done(a).fail(b).always(c);"],
  ['jqXHR in a variable', "var x = $.post(u); x.success(fn);", "var x = $.post(u); x.done(fn);"],
  ['ready event', "$(document).on('ready', function () {});", "$(function () {});"],
  ['bind', "$('.a').bind('click', fn);", "$('.a').on('click', fn);"],
  ['bind with an object as data', "$('.a').bind('click', { a: 1 }, fn);", "$('.a').on('click', { a: 1 }, fn);"],
  ['unbind', "$('.a').unbind('click');", "$('.a').off('click');"],
  ['unbind all', "$('.a').unbind();", "$('.a').off();"],
  ['delegate swaps arguments', "$('.a').delegate('.b', 'click', fn);", "$('.a').on('click', '.b', fn);"],
  ['delegate with data', "$('.a').delegate('.b', 'click', d, fn);", "$('.a').on('click', '.b', d, fn);"],
  ['delegate with a map', "$('.a').delegate('.b', map);", "$('.a').on(map, '.b');"],
  ['undelegate swaps arguments', "$('.a').undelegate('.b', 'click');", "$('.a').off('click', '.b');"],
  ['undelegate all', "$('.a').undelegate();", "$('.a').off();"],
  ['parseJSON', "var o = $.parseJSON(s);", "var o = JSON.parse(s);"],
];

for (const [name, input, expected] of cases) {
  test(`converts: ${name}`, () => assert.equal(runJs(input, ...JQ).code, expected));
}

const untouched = [
  ['native Function.bind', 'var f = fn.bind(this);'],
  ['Ajax .load(url)', "$('#a').load('/x');"],
  ['Ajax .load(url, fn)', "$('#a').load('/x', function () {});"],
  ['$.ajax success option', '$.ajax({ success: fn, error: fn2 });'],
  ['console.error', "console.error('x');"],
  ['size with arguments', 'q.size(1);'],
  ['size of a value method result', "$('#a').val().size();"],
  ['Map.size()', 'map.size();'],
];

for (const [name, input] of untouched) {
  test(`does not change: ${name}`, () => assert.equal(runJs(input, ...JQ).code, input));
}

test('reports instead of guessing', () => {
  for (const input of [
    'map.size();',
    "other.unbind('click');",
    "$('.a').bind('click', 'str', fn);",
    '$(window).load(handler);',
    'xhr.success(function () {});',
  ]) {
    const result = runJs(input, ...JQ);
    assert.equal(result.code, input, input);
    assert.equal(result.manual.length, 1, input);
  }
});

test('handles nested matches', () => {
  const input = "$(window).load(function () { var n = $('.a').size(); $('.b').bind('click', fn); });";
  const expected = "$(window).on('load', function () { var n = $('.a').length; $('.b').on('click', fn); });";
  assert.equal(runJs(input, ...JQ).code, expected);
});

test('leaves untouched lines alone, including tabs and CRLF', () => {
  const input = "function f() {\r\n\tvar x   =  1 ;\r\n\t$('.a').size();\r\n}\r\n";
  const expected = "function f() {\r\n\tvar x   =  1 ;\r\n\t$('.a').length;\r\n}\r\n";
  assert.equal(runJs(input, ...JQ).code, expected);
});

test('is idempotent', () => {
  const once = runJs("$('.a').size(); $('.a').delegate('.b', 'click', fn);", ...JQ).code;
  assert.equal(runJs(once, ...JQ).code, once);
});
