<%-- Fictional sample page for trying the recipes. --%>
<html>
<head>
  <meta name="layout" content="main"/>
  <asset:javascript src="business/orders.js"/>
</head>
<body>
<ul class="nav nav-tabs">
  <li class="active"><a href="#open" data-toggle="tab">Open</a></li>
  <li><a href="#closed" data-toggle="tab">Closed</a></li>
</ul>

<g:if test="${orders.size() > 0}">
  <button class="btn" data-toggle="modal" data-target="#detail">${orders.size()} orders</button>
  <g:link action="show" data-toggle="tooltip" data-placement="top">Show</g:link>
  <a data-toggle="${kind}" href="#">Dynamic</a>
  <div data-id="${orders[0].id}" data-target="#custom">Custom</div>
</g:if>

<script>
  var url = '${createLink(action: "list")}';
  var count = $('#orders-${tab}').size();
  <g:if test="${canEdit}">
  $('#edit').bind('click', function () {
    $(this).parent().addClass('active');
  });
  </g:if>
  var row = '<a data-dismiss="modal"><g:message code="close"/></a>';
</script>

<script>
  <g:if test="${a}">$('.x').on('click', function () {</g:if>
  });
</script>
</body>
</html>
