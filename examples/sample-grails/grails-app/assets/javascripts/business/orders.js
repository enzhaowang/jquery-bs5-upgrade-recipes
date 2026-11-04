// Fictional sample code for trying the recipes.
$(window).load(function () {
  var $rows = $('#orders tr');
  var total = $rows.size();

  $('.refresh').bind('click', reload);
  $('#orders').delegate('.remove', 'click', removeOrder);

  $('.nav-tabs li.active a').text(total);
  $('[data-toggle="tooltip"]').tooltip();

  var button = '<a class="btn" data-toggle="modal" data-target="#detail">Open</a>';
  var kindButton = '<a data-toggle="' + kind + '">Open</a>';

  $.ajax({ url: '/orders' }).success(render).error(showError);

  var handler = reload.bind(this);
  $(this).closest('li').addClass('active');
  $('.link').data('target');
  $('#side-menu li.active').addClass('open');
});
