//Includes JS common to all of the content assistant tools
$(document).ready(function() {
  $('#toggle-btn').click(function() {
      $('.r-navbar').toggleClass('expanded');
      $('#toggle-btn i').toggleClass('fa-angle-left fa-angle-right');
  });
});
