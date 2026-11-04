const test = require('node:test');
const assert = require('node:assert/strict');
const { runGsp } = require('./helpers');

test('Groovy .size() stays, jQuery .size() changes', () => {
  const input = `<script>
  <g:if test="\${items.size() > 0}">
  var count = $('#list-\${id}').size();
  </g:if>
</script>`;
  const expected = `<script>
  <g:if test="\${items.size() > 0}">
  var count = $('#list-\${id}').length;
  </g:if>
</script>`;
  const result = runGsp(input);
  assert.equal(result.code, expected);
  assert.equal(result.blocks[0].status, 'changed');
});

test('Groovy outside scripts is never edited', () => {
  const input = `<g:if test="\${list.size() > 0 && fn.bind(this)}"><p>\${list.size()}</p></g:if>`;
  assert.equal(runGsp(input).code, input);
});

test('nested braces and quotes in expressions survive', () => {
  const input = `<script>
var ids = \${list.collect { it.id + "}" }};
var msg = '<g:message code="a.b" args="\${[x]}"/>';
$('.a').bind('click', fn);
</script>`;
  const expected = input.replace("bind('click', fn)", "on('click', fn)");
  assert.equal(runGsp(input).code, expected);
});

test('replacement patterns inside Groovy are restored literally', () => {
  const input = `<script>var a = \${x ? "$'" : "$&"}; $('.a').size();</script>`;
  const expected = `<script>var a = \${x ? "$'" : "$&"}; $('.a').length;</script>`;
  assert.equal(runGsp(input).code, expected);
});

test('multi-line scriptlets and control tags survive, with correct line numbers', () => {
  const input = `<div></div>
<script>
<%
  def a = 1
  def b = 2
%>
<g:each in="\${rows}" var="r">
map.size();
</g:each>
</script>`;
  const result = runGsp(input);
  assert.equal(result.code, input);
  assert.equal(result.manual.length, 1);
  assert.equal(result.manual[0].line, 8);
  assert.equal(result.manual[0].snippet, 'map.size();');
});

test('moving delegate arguments keeps placeholders', () => {
  const input = `<script>$('.a').delegate('.\${a}', '\${b}', fn);</script>`;
  const expected = `<script>$('.a').on('\${b}', '.\${a}', fn);</script>`;
  assert.equal(runGsp(input).code, expected);
});

test('a block that cannot parse is left alone and counted', () => {
  const input = `<script>
<g:if test="\${x}">$('a').on('click', function () {</g:if>
$('.b').size();
</script>`;
  const result = runGsp(input);
  assert.equal(result.code, input);
  assert.equal(result.blocks[0].status, 'parse-failed');
  assert.equal(result.findings.filter((f) => f.status === 'changed').length, 0);
});

test('one bad block does not stop the others', () => {
  const input = `<script>function (</script><script>$('.a').size();</script>`;
  const result = runGsp(input);
  assert.equal(result.code, `<script>function (</script><script>$('.a').length;</script>`);
  assert.deepEqual(result.blocks.map((b) => b.status), ['parse-failed', 'changed']);
});

test('converts data attributes on HTML and Grails tags', () => {
  const input = `<button data-toggle="modal" data-target="#m">a</button>
<g:link data-toggle="tooltip" data-placement="top" action="x">b</g:link>
<a data-dismiss="modal">c</a>
<div class="modal fade" data-backdrop="static" data-keyboard="false"></div>
<div class="carousel" data-ride="carousel" data-interval="5000"></div>`;
  const expected = `<button data-bs-toggle="modal" data-bs-target="#m">a</button>
<g:link data-bs-toggle="tooltip" data-bs-placement="top" action="x">b</g:link>
<a data-bs-dismiss="modal">c</a>
<div class="modal fade" data-bs-backdrop="static" data-bs-keyboard="false"></div>
<div class="carousel" data-bs-ride="carousel" data-bs-interval="5000"></div>`;
  assert.equal(runGsp(input).code, expected);
});

test('leaves custom attributes alone', () => {
  const input = `<div data-id="1" data-url="\${u}" data-placement="left" data-keyboard="x"></div>`;
  const result = runGsp(input);
  assert.equal(result.code, input);
  assert.equal(result.manual.length, 0);
});

test('reports dynamic and non-Bootstrap toggles', () => {
  for (const input of [
    `<a data-toggle="\${kind}" data-target="#m">x</a>`,
    `<a data-toggle="my-plugin" data-target="#m">x</a>`,
    `<a data-toggle="buttons">x</a>`,
  ]) {
    const result = runGsp(input);
    assert.equal(result.code, input, input);
    assert.ok(result.manual.length >= 1, input);
  }
});

test('converts and flags attributes inside a conditional tag', () => {
  const input = `<a <g:if test="\${x}">data-toggle="modal"</g:if> href="#">x</a>`;
  const result = runGsp(input);
  assert.equal(result.code, `<a <g:if test="\${x}">data-bs-toggle="modal"</g:if> href="#">x</a>`);
  assert.equal(result.manual.length, 1);
});

test('comparison inside an attribute does not end the tag', () => {
  const input = `<a title="\${a > b}" data-toggle="modal">x</a>`;
  assert.equal(runGsp(input).code, `<a title="\${a > b}" data-bs-toggle="modal">x</a>`);
});

test('moves tab active state in GSP markup', () => {
  const input = `<ul class="nav nav-tabs">
  <li class="active"><a href="#a" data-toggle="tab">A</a></li>
  <li><a href="#b" data-toggle="tab">B</a></li>
</ul>`;
  const expected = `<ul class="nav nav-tabs">
  <li class="nav-item"><a href="#a" data-bs-toggle="tab" class="nav-link active">A</a></li>
  <li class="nav-item"><a href="#b" data-bs-toggle="tab" class="nav-link">B</a></li>
</ul>`;
  assert.equal(runGsp(input).code, expected);
});

test('reports tab items with a dynamic class', () => {
  const input = `<li class="\${on ? 'active' : ''}"><a data-bs-toggle="tab" href="#a">A</a></li>`;
  const result = runGsp(input);
  assert.equal(result.code, input);
  assert.equal(result.manual.length, 1);
});

test('does not move active for pagination', () => {
  const input = `<li class="page-item active"><a class="page-link" href="#">1</a></li>`;
  const result = runGsp(input);
  assert.equal(result.code, input);
  assert.equal(result.manual.length, 0);
});

test('comments stay byte for byte', () => {
  const input = `<%-- <a data-toggle="modal"> --%><!-- <script>$('.a').size();</script> -->`;
  assert.equal(runGsp(input).code, input);
});

test('script types: HTML templates converted, JSON and src skipped', () => {
  const input = `<script type="text/x-template"><a data-toggle="modal">x</a></script>
<script type="application/ld+json">{"data-toggle": "modal"}</script>
<script src="/a.js"></script>
<asset:javascript src="a.js"/>`;
  const expected = input.replace('<a data-toggle', '<a data-bs-toggle');
  const result = runGsp(input);
  assert.equal(result.code, expected);
  assert.equal(result.blocks.length, 0);
});

test('also handles g:javascript and asset:script', () => {
  const input = `<g:javascript>$('.a').size();</g:javascript><asset:script>$('.b').size();</asset:script>`;
  const expected = `<g:javascript>$('.a').length;</g:javascript><asset:script>$('.b').length;</asset:script>`;
  assert.equal(runGsp(input).code, expected);
});

test('flags inline event handlers', () => {
  const input = `<a onclick="$('.a').size()">x</a>`;
  const result = runGsp(input);
  assert.equal(result.code, input);
  assert.equal(result.manual.filter((f) => f.rule === 'gsp-inline-handler').length, 1);
});

test('keeps CRLF line endings', () => {
  const input = `<div>\r\n<script>\r\n\tvar a  = 1;\r\n\t$('.a').size();\r\n</script>\r\n<a data-toggle="modal">x</a>\r\n</div>\r\n`;
  const expected = `<div>\r\n<script>\r\n\tvar a  = 1;\r\n\t$('.a').length;\r\n</script>\r\n<a data-bs-toggle="modal">x</a>\r\n</div>\r\n`;
  assert.equal(runGsp(input).code, expected);
});

test('is idempotent', () => {
  const input = `<ul><li class="active"><a data-toggle="tab" data-target="#a">A</a></li></ul>
<script>$('.a').size(); var h = '<a data-toggle="modal">x</a>'; $('[data-toggle="tab"]');</script>`;
  const once = runGsp(input).code;
  assert.notEqual(once, input);
  assert.equal(runGsp(once).code, once);
});
