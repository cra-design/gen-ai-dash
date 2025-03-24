// JavaScript Document
$(document).ready(function () {


  $(document).on("click", "input[type=radio]", function (event) {
    var target = event.target;
    // var parts = target.name.split("-");
    // var locationNumber = parts[parts.length - 1];
    if (target.name == "upload-option") {
      //Check which radio button it is and which content it's show/hiding
      resetHiddenUploadOptions();
      if (target.id == "live") {
        $('#url-upload').removeClass("hidden");
        $('#url-upload-input').removeClass("hidden");
      } else if (target.id == "prototype") {
        $('#url-upload').removeClass("hidden");
        $('#url-upload-input').removeClass("hidden");
      } else if (target.id == "word") {
        $('#word-upload').removeClass("hidden");
        $('#word-upload-input').removeClass("hidden");
      }
    }
  });

  function readLines() { //Read lines text input box and populate table
    let lines = [];
    let content = $('#url-input').html();

    // Convert <div> and <br> to new lines
    content = content.replace(/<div>/g, '\n').replace(/<br>/g, '\n');
    content = content.replace(/<\/div>/g, '');

    lines = content.split('\n').map(line => line.trim()).filter(line => line.length > 0);

    console.log("Lines read:", lines); // Log the lines to the console
    updateTable(lines); // Update table with URLs
    return lines;
  }

  function updateTable(lines) { //empty table rows and add rows for each input url
    let tbody = $('#table-init tbody');
    tbody.empty(); // Clear existing rows

    lines.forEach(line => {
      let row = `<tr><td>${line}</td><td>Dummy Data</td></tr>`;
      tbody.append(row);
    });
  }

  $('#url-input').on('input', function () {
    let lines = readLines(); // Call function when input changes
  });
});
