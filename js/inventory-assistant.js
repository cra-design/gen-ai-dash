// JavaScript Document
$(document).ready(function () {

  $('#create-word-docs-btn').click(async function () {
    try {
      // Prompt the user for a URL
      let url = prompt("Please enter the URL of the page:");
      if (!url) {
        alert("URL is required!");
        return;
      }

      // Fetch the content of the page using $.get()
      let response = await $.get(url);
      console.log("Page content received.");

      // Create a temporary container to parse HTML properly
      let tempDiv = $('<div>').html(response);

      // Extract content from the <main> tag
      let mainContent = tempDiv.find('main').html();

      // If <main> is empty, fallback to <body>
      if (!mainContent || mainContent.trim().length === 0) {
        console.log("No <main> content found, using <body> instead.");
        mainContent = tempDiv.find('body').html();
      }

      // If no content is found at all, show an error message
      if (!mainContent || mainContent.trim().length === 0) {
        console.error("No extractable content found.");
        alert("No content found on this page!");
        return;
      }

      // Extract the second <h1> if available, otherwise use the first, else default
      let h1Tags = tempDiv.find('h1');
      let fileName = h1Tags.length > 1
        ? h1Tags.eq(1).text().trim() // Use the second <h1>
        : h1Tags.first().text().trim(); // Use the first if only one exists

      if (!fileName) {
        fileName = "Webpage_Content"; // Default if no <h1> is found
      }

      // Remove invalid characters for filenames
      fileName = fileName.replace(/[<>:"\/\\|?*]+/g, '');

      // Add the URL at the top of the document, above the main content
      let formattedContent = `
      <p><strong>Source:</strong> <a href="${url}">${url}</a></p>
      ${mainContent}
    `;

      // Structure the content for the Word document
      let docContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <style>
            body { font-family: Arial, sans-serif; }
            a { color: blue; text-decoration: underline; }
            p { font-size: 14px; }
          </style>
        </head>
        <body>${formattedContent}</body>
      </html>
    `;

      // Create a Blob to download as a Word document
      let blob = new Blob(['\ufeff' + docContent], {
        type: 'application/msword'
      });

      // Create a download link
      let link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `${fileName}.doc`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

    } catch (error) {
      console.error("Failed to fetch or process the page:", error);
      alert("Failed to retrieve content. Please check the URL.");
    }
  });


  $('#export-excel').click(function () {
    var wb = XLSX.utils.book_new();
    var ws_data = [];

    // Add header row
    ws_data.push(['URL', 'Page Title', 'Description metadata', 'Keywords metadata']);

    // Loop through each table row
    $('#table-init tbody tr').each(function () {
      var row = [];
      $(this).find('td').each(function (index) {
        var cellText = $(this).text().trim();
        var linkElement = $(this).find('a');

        if (linkElement.length) {
          var hyperlink = linkElement.attr('href');

          // Ensure the hyperlink starts with "http://" or "https://"
          if (!hyperlink.startsWith('http')) {
            hyperlink = 'http://' + hyperlink;
          }

          // Remove "-canada.ca" from the title
          var cleanedTitle = cellText.replace('-canada.ca', '').trim();

          // Add URL to column 1, cleaned title to column 2
          row.push(hyperlink, cleanedTitle);
        } else {
          row.push(cellText);
        }
      });
      ws_data.push(row);
    });

    var ws = XLSX.utils.aoa_to_sheet(ws_data);

    // Adjust column width for better visibility
    ws['!cols'] = [{
      wch: 50
    }, {
      wch: 30
    }, {
      wch: 30
    }, {
      wch: 30
    }];

    XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
    XLSX.writeFile(wb, 'table_data.xlsx');
  });

  $("#reset-btn").click(function () {
    resetHiddenUploadOptions();
    $('#api-key-entry').removeClass("hidden");
    $('#upload-chooser').addClass("hidden");
  });

  /*$("#api-key-submit-btn").click(function () {
    //validate the key to see if it's legit?

    $('#api-key-entry').addClass("hidden");
    $('#upload-chooser').removeClass("hidden");
    $('#url-upload').removeClass("hidden");
  });*/

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

  $("#url-upload-btn").click(function () {
    $('#upload-chooser').addClass("hidden");
    $('#url-upload-input').addClass("hidden");
    $('#url-upload-preview').removeClass("hidden");
    $('#table-init').removeClass("hidden");
    $("#url-frame").addClass("hidden"); //reset iframe hidden
    $("#url-invalid-msg").addClass("hidden");
    $("#canada-ca-msg").addClass("hidden");
    $("#other-site-msg").addClass("hidden");
    //load the iframe with the html preview
    //var bUrlInput = isValidUrl($('#url-input').val());
    //if (bUrlInput == false) { //invalid url
    //unhide URL invalid message
    //$("#url-invalid-msg").removeClass("hidden");
    //$('#url-upload-input').removeClass("hidden");
    //return;
    populateUrlTable();
    /*const urlInput = new URL($('#url-input').val());
    // Currently configuring it to specific github organizations:
    if (urlInput.host == "cra-design.github.io" || urlInput.host == "gc-proto.github.io" || urlInput.host == "test.canada.ca" || urlInput.host == "cra-proto.github.io") { //github links
      $("#url-frame").attr("src", urlInput.href);
      $("#url-frame").removeClass("hidden");
      $("#genai-upload-msg").addClass("hidden");
      $("#genai-task-options").removeClass("hidden");
      parsePageHTML(urlInput.href, function (err, html) {
        if (err) {
          console.error('Failed to fetch the webpage:', err);
          alert('Failed to fetch the webpage. Check the console for details.');
          return;
        }
        // Extract fields from the HTML
        const fields = extractFields(html);
        // Render results to the page
        renderHTMLFields(html, fields);
      });
    } else if (urlInput.host == "www.canada.ca") { //canada.ca link


      //Maybe we can implement a iframe render of the HTML code for the canada.ca pages?


      //unhide Canada.ca not yet supported message
      $("#canada-ca-msg").removeClass("hidden");
      $('#url-upload-input').removeClass("hidden");
    } else { //unsupported site
      //unhide unsupported site message
      $("#other-site-msg").removeClass("hidden");
      $('#url-upload-input').removeClass("hidden");
    }*/
    //do we also want a tab to view the code? Maybe this is where we can make edits or changes with GenAI, then reload in the iframe? Could we do this with some html manipulation in the javascript of the already-loaded iframe? Or would we need to rebuild the page in the script?
  });

  $("#html-upload-btn").click(function () {
    // $("#html-preview").html($("#html-input").html());
    // $("#html-upload-preview").removeClass("hidden");
    $("#html-upload-loading-spinner").removeClass("hidden");
    let extractedHtml = convertTextToHTML($("#html-input").html());
    RefineSyntax(extractedHtml);
  });

  $(document).on("change", "input", async function (event) {
    if (event.target.id == "img-file") {
      $("#image-invalid-msg").addClass("hidden");
      $("#image-multiple-msg").addClass("hidden");
      var fileList = event.target.files;
      if (fileList.length > 0 && fileList != undefined) {
        if (fileList.length > 1) { //uploaded more than 1 picture - could perhaps support this in the future
          $("#image-multiple-msg").removeClass("hidden");
        } else if (fileList[0].type.substring(0, 5) != "image") {
          $("#image-invalid-msg").removeClass("hidden");
        } else {
          //Preview the image
          $("#image-preview").attr("src", URL.createObjectURL(fileList[0]));
          $("#image-upload-preview").removeClass("hidden");
        }
      }
    } else if (event.target.id == "word-file") {
      $("#word-upload-preview").removeClass("hidden");
      $("#word-upload-loading-spinner").removeClass("hidden");
      $("#word-invalid-msg").addClass("hidden");
      $("#word-multiple-msg").addClass("hidden");

      var fileList = event.target.files;
      if (!fileList || fileList.length === 0) return;
      if (fileList.length > 1) {
        $("#word-multiple-msg").removeClass("hidden");
        $("#word-upload-loading-spinner").addClass("hidden");
        return;
      }
      var wordFile = fileList[0];
      var validMimeType = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
      var fileExtension = wordFile.name.split('.').pop().toLowerCase();
      if (wordFile.type !== validMimeType || fileExtension !== 'docx') {
        $("#word-invalid-msg").removeClass("hidden");
        $("#word-upload-loading-spinner").addClass("hidden");
        return;
      }
      var reader = new FileReader();
      reader.onload = async function (event) {
        var arrayBuffer = reader.result;
        try {
          // Extract raw text with Mammoth.js
          let result = await mammoth.convertToHtml({
            arrayBuffer: arrayBuffer
          });
          let extractedHtml = result.value.trim();
          if (!extractedHtml) {
            $("#word-invalid-msg").removeClass("hidden").text("The document is empty or could not be read.");
            $("#word-upload-loading-spinner").addClass("hidden");
            return;
          }
          RefineSyntax(extractedHtml);
        } catch (err) {
          console.error("Error extracting text:", err);
          $("#word-invalid-msg").removeClass("hidden").text("Failed to parse document.");
          $("#word-upload-loading-spinner").addClass("hidden");
          return;
        }
      };
      reader.readAsArrayBuffer(wordFile);
    }
  });

  $("#genai-select-tasks-btn").click(function () {
    $("#genai-task-options").addClass("hidden");
    $("#genai-model-options").removeClass("hidden");
  });

  $("#genai-run-report-btn").click(async function () {
    $("#genai-model-options").addClass("hidden");
    $("#genai-open-report-btn").addClass("hidden"); // Hide report button initially
    $("#loading-indicator").removeClass("hidden"); // Show spinner
    //$("#genai-report-reset-options").removeClass("hidden");
    let selectedTasks = [];
    let model = $('input[name="html-upload-genai-model"]:checked').val();
    let systemGeneral = {
      role: "system",
      content: "You are an expert web editor. Analyze the provided web page content according to the guidelines in the following system prompt to provide actionable recommendations in plain text. Never include code or HTML in your response. The contextual data may include search terms, user feedback or ux test findings to help you understand the pain points or user behaviour your recommendations should address."
    }
    let systemTask = {
      role: "system",
      content: ""
    }
    let userContent = {
      role: "user",
      content: "Web page content: "
    }
    let userData = {
      role: "user",
      content: "Contextual data: "
    }
    let reportContainer = $(".overlay-content");
    reportContainer.find(".generated-report").remove();


    //triage which content to feed to the AI for analysis if free content input
    // if ($('#html-upload-preview').is(':visible')) {
    // userContent.content += $("#html-input").html();
    // } else if ($('#url-upload-preview').is(':visible')) {
    userContent.content += $("#fullHtml").text(); //give it the full page html
    userData.content += "Search terms: " + $("#search-terms-input").text(); //give it any data we have
    userData.content += "Page feedback summary: " + $("#feedback-summary-input").text();
    userData.content += "Heuristic commentary: " + $("#heuristic-commentary-input").text();
    // }

    //Gather selected tasks
    $('input[name="html-upload-genai-analysis"]:checked').each(function () {
      selectedTasks.push({
        id: $(this).attr('id'),
        value: $(this).val()
      });
    });

    //Process each selected task asynchronously
    if (selectedTasks.length > 0) {
      for (const task of selectedTasks) {
        try {
          let fileContent = await $.get(task.value);
          systemTask.content = "Custom instruction: " + fileContent;
          // Create the JSON with the prompt and instructions
          let requestJson = [systemGeneral, systemTask, userContent, userData];

          // Send it to the API
          let ORjson = await getORData(model, requestJson);
          let aiResponse = ORjson.choices[0].message.content;
          let formattedText = formatAIResponse(aiResponse);
          //console.log(formattedText);

          // Find the corresponding label text
          let labelText = $(`label[for='${task.id}']`).text().trim();

          // Create new report section dynamically
          let newReport = $(
            '<div class="generated-report">'
            + '<h4>' + labelText + '</h4>'
            + '<p>' + formattedText + '</p>'
            + '</div>'
          );
          // Append to the report container
          reportContainer.append(newReport);
          $("#genai-open-report-btn").removeClass("hidden"); // Show report button
        } catch (error) {
          console.error(`Error generating report:`, error);
          // $("#html-upload-preview").addClass("hidden");
          $("#html-upload-no-action-error").removeClass("hidden");
        }
      }
    } else {
      // $("#html-upload-preview").addClass("hidden");
      $("#html-upload-no-action-error").removeClass("hidden");
    }

    /*var htmlObject = ;
    if (.length < 1 || fileList == undefined) {
    	$("#html-invalid-msg").removeClass("hidden");
    }
    $("#image-preview").attr("data-src", URL.createObjectURL(htmlObject));
    $("#image-upload-preview").removeClass("hidden");
    */
    $("#loading-indicator").addClass("hidden"); // Hide spinner when done
  });

  $("#genai-open-report-btn").click(function () {
    /* Open when someone clicks on the span element */
    //function openNav() {
    document.getElementById("genai-nav").style.width = "100%";
    //}
  });

  $("#genai-reset-report-btn").click(function () {
    $("#genai-model-options").addClass("hidden");
    $("#genai-task-options").removeClass("hidden");
    $('input[name="html-upload-genai-analysis"]').prop('checked', false);
    $('input[name="html-upload-genai-model"]').prop('checked', false);
  });

  $("#close-report-btn").click(function () {
    /* Open when someone clicks on the span element */
    document.getElementById("genai-nav").style.width = "0%";
  });

  //tab interface - page/code preview for urls

  $('.tabs ul li a').on('click', function (e) {
    e.preventDefault();
    $('.tabs ul li a').removeClass('active');
    $(this).addClass('active');
    $('.tab-content').addClass('hidden');
    const target = $(this).data('target');
    $(target).removeClass('hidden');

  });

}); //close document ready

function extractMetadata(html, url) {
  let parser = new DOMParser();
  let doc = parser.parseFromString(html, 'text/html');

  let title = doc.querySelector('title')?.innerText || url;
  let description = doc.querySelector('meta[name="description"]')?.content || 'No Description';
  let keywords = doc.querySelector('meta[name="keywords"]')?.content || 'No Keywords';

  return {
    title,
    description,
    keywords
  };
}

function populateUrlTable() {
  let lines = [];
  let content = $('#url-input').html();

  content = content.replace(/<div>/g, '\n').replace(/<br>/g, '\n');
  content = content.replace(/<\/div>/g, '');

  lines = content.split('\n').map(line => line.trim()).filter(line => line.length > 0);

  console.log("Lines read:", lines);

  let tbody = $('#table-init tbody');
  tbody.empty();

  let rows = new Array(lines.length).fill(null);

  lines.forEach((line, index) => {
    if (isValidUrl(line)) {
      parsePageHTML(line, function (err, html) {
        let metadata;
        if (err) {
          metadata = {
            title: line,
            description: 'Could not fetch metadata',
            keywords: ''
          };
        } else {
          metadata = extractMetadata(html, line);
        }

        // Remove " - canada.ca" from the title if present
        metadata.title = metadata.title.replace(' - Canada.ca', '');

        rows[index] = `<tr>
                         <td><a href="${line}" target="_blank">${metadata.title}</a></td>
                         <td>${metadata.description}</td>
                         <td>${metadata.keywords}</td>
                       </tr>`;

        if (!rows.includes(null)) {
          tbody.html(rows.join(''));
        }
      });
    } else {
      rows[index] = `<tr>
                       <td>Invalid URL</td>
                       <td>N/A</td>
                       <td>N/A</td>
                     </tr>`;

      if (!rows.includes(null)) {
        tbody.html(rows.join(''));
      }
    }
  });
}

function resetHiddenUploadOptions() {
  $('#url-upload').addClass("hidden");
  $('#url-upload-input').addClass("hidden");
  $('#url-upload-preview').addClass("hidden");
  $('#html-upload').addClass("hidden");
  $('#html-upload-input').addClass("hidden");
  // $('#html-upload-preview').addClass("hidden");
  $("#html-upload-no-action-error").addClass("hidden");
  $('#image-upload').addClass("hidden");
  $('#image-upload-input').addClass("hidden");
  $('#image-upload-preview').addClass("hidden");
  $('#word-upload').addClass("hidden");
  $('#word-upload-input').addClass("hidden");
  $('#word-upload-preview').addClass("hidden");
  $("#genai-upload-msg").removeClass("hidden");
  $("#genai-task-options").addClass("hidden");
  $('input[name="html-upload-genai-analysis"]').prop('checked', false);
  $('input[name="html-upload-genai-model"]').prop('checked', false);
}

async function getORData(model, requestJson) {
  let ORjson;
  console.log(JSON.stringify({
    "model": model,
    "messages": requestJson
  }));
  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + $("#api-key").val(),
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        "model": model,
        "messages": requestJson
      })
    });

    if (!response.ok) {
      throw new Error(`Response status: ${response.status}`);
    }
    ORjson = await response.json();

  } catch (error) {
    console.error("Error fetching from OpenRouter API:", error.message);
    return undefined;
  }
  return ORjson;
}

function parsePageHTML(url, callback) {
  $.ajax({
    url: url,
    method: 'GET',
    success: function (response) {
      callback(null, response);
    },
    error: function (err) {
      callback(err);
    }
  });
}

// Function to extract fields from the HTML
function extractFields(html) {

  const $html = $('<div>').append(html); // Wrap in a parent container

  //const metaTags = $html.find('meta'); // Now `.find()` will catch everything
  //console.log(metaTags);

  // const $html = $(html);
  // console.log($html);
  //
  // const metaTags = $html.find('meta');
  // console.log(metaTags);

  // Extract specific fields
  const h1 = $html.find('h1').first().text().trim() || 'Not Found';
  const metaKeywords = $html.find('meta[name="keywords"]').attr('content') || 'Not Found';
  const metaDescriptionTag = $html.find("meta[name='description']");
  const metaDescription = metaDescriptionTag.length && metaDescriptionTag.attr('content')
    ? metaDescriptionTag.attr('content').trim()
    : 'Not Found';
  // Extract the first <p> after the <h1>
  const introParagraph = $html.find('h1').first().nextAll('p').first().text().trim() || 'Not Found';
  // Extract full body content
  // Extract "doormats" sections into an array
  const doormats = [];
  $html.find('.gc-srvinfo section').each(function () {
    const $section = $(this);
    const link = $section.find('h3 a').attr('href') || 'No link';
    const title = $section.find('h3 a').text().trim() || 'No title';
    const description = $section.find('p').text().trim() || 'No description';
    doormats.push({
      link,
      title,
      description
    });
  });
  // Assign "Not Found" if no doormats were extracted
  const doormatsResult = doormats.length > 0 ? doormats : 'Not Found';
  // Extract all tables as an array
  const tables = [];
  $html.find('table').each(function () {
    const tableHTML = $(this).prop('outerHTML');
    tables.push(tableHTML ? tableHTML.trim() : 'Not Found');
  });
  // Assign "Not Found" if no tables were extracted
  const tablesResult = tables.length > 0 ? tables : 'Not Found';
  // Extract full body content
  const bodyContentRaw = $html.find('body').html(); // Untrimmed content
  const bodyContent = bodyContentRaw ? bodyContentRaw.trim() : 'Not Found'; // Trimmed content


  // Return extracted fields
  return {
    h1,
    metaDescription,
    metaKeywords,
    // introParagraph,
    // doormats: doormatsResult,
    // tables: tablesResult,
    // bodyContent,
  };
}

function formatAIResponse(aiResponse) {
  return aiResponse
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>") // Bold (**text** → <strong>text</strong>)
    .replace(/\*(.*?)\*/g, "<em>$1</em>") // Italics (*text* → <em>text</em>)
    .replace(/\n\s*-\s*(.*?)(?=\n|$)/g, "<li>$1</li>") // Convert "- item" to list items
    .replace(/(<li>.*<\/li>)/g, "<ul>$1</ul>") // Wrap list items in <ul>
    .split("\n") // Split by line breaks
    .filter(line => line.trim() !== "") // Remove empty lines
    .map(line => `<p>${line}</p>`) // Wrap remaining text in <p> tags
    .join(""); // Join everything back together
}

// Function to render the full HTML and extracted fields
function renderHTMLFields(fullHtml, fields) {
  // Display the full HTML in the <pre> tag
  $('#fullHtml code').text(fullHtml);
  Prism.highlightElement(document.querySelector("#fullHtml code"));

  // Display the extracted fields in the table
  const $tableBody = $('#extractedFields');
  $tableBody.empty(); // Clear any previous data

  Object.keys(fields).forEach(field => {
    $tableBody.append(`
                      <tr>
                          <td>${field}</td>
                          <td>${fields[field]}</td>
                      </tr>
                  `);
  });
}

function formatHTML(htmlString) { // Create a new DOMParser instance
  const parser = new DOMParser();
  // Parse the HTML string into a Document
  const doc = parser.parseFromString(htmlString, 'text/html');
  // Serialize the Document back to a string with indentation
  const formattedHTML = doc.documentElement.outerHTML;
  // Return the formatted HTML
  return formattedHTML;
}

function convertTextToHTML(text) {
  // Split the text into paragraphs based on double newlines
  const paragraphs = text.split(/\n\s*\n/);

  // Wrap each paragraph with <p> tags and replace single newlines with <br>
  const htmlParagraphs = paragraphs.map(paragraph => {
    const escapedParagraph = paragraph
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
    const withLineBreaks = escapedParagraph.replace(/\n/g, '<br>');
    return `<p>${withLineBreaks}</p>`;
  });

  // Join all paragraphs into a single string
  return htmlParagraphs.join('');
}

async function RefineSyntax(extractedHtml) {
  // Define the HTML header and footer
  let htmlHeader = `
                <!DOCTYPE html>
                <html lang="en">
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>Preview</title>
                    <link href="https://use.fontawesome.com/releases/v5.8.1/css/all.css" rel="stylesheet">
                </head>
                <body>
                    <main>
            `;
  let htmlFooter = `
                    </main>
                </body>
                </html>
            `;
  let systemWord = {
    role: "system",
    content: "You are an expert in converting plain text into structured, semantic HTML. Only respond with html documents, never with explanations or plain text."
  }
  let userWord = {
    role: "user",
    content: 'Clean up the following conversion from text into HTML ensuring it has good, clean syntax with proper headings, paragraphs, and lists where applicable: ' + htmlHeader + extractedHtml + htmlFooter
  }
  // Create the JSON with the prompt and instructions
  let requestJson = [systemWord, userWord];
  // Send it to the API
  let ORjson = await getORData("google/gemini-2.0-flash-exp:free", requestJson);
  let aiWordResponse = ORjson.choices[0].message.content.trim();
  // Remove leading and trailing backticks
  let newHeader = `
              <link rel="stylesheet" href="https://www.canada.ca/etc/designs/canada/wet-boew/css/wet-boew.min.css"/>
              <link rel="stylesheet" href="https://www.canada.ca/etc/designs/canada/wet-boew/css/theme.css"/>
              <link href="https://test.canada.ca/covid-19-guidance/proto/css/alpha-beta-banner.css" rel="stylesheet">
              <body vocab="http://schema.org/" typeof="WebPage" resource="#wb-webpage">
              <nav>
                <ul id="wb-tphp">
                 <li class="wb-slc"><a class="wb-sl" href="#wb-cont">Skip to main content</a></li>
                 <li class="wb-slc visible-sm visible-md visible-lg"><a class="wb-sl" href="#wb-info">Skip to &#34;About this site&#34;</a></li>
                </ul>
              </nav>
              <header>
                 <div id="wb-bnr" class="container">
                  <div class="row">
                      <section id="wb-lng" class="col-xs-3 col-sm-12 pull-right text-right">
                          <h2 class="wb-inv">Language selection</h2>
                          <ul class="list-inline mrgn-bttm-0">
                              <li>
                                  <a lang="fr" hreflang="fr" href="https://www.canada.ca/fr/agence-revenu/services/a-propos-agence-revenu-canada-arc/plaintes-differends/dispositions-allegement-contribuables.html">
                                    <span class="hidden-xs">Français</span>
                                    <abbr title="Français" class="visible-xs h3 mrgn-tp-sm mrgn-bttm-0 text-uppercase">fr</abbr>
                                  </a>
                              </li>
                          </ul>
                      </section>
                      <div class="brand col-xs-9 col-sm-5 col-md-4" property="publisher" typeof="GovernmentOrganization">
                          <a href="https://www.canada.ca/en.html" property="URL">
                            <img src="https://www.canada.ca/etc/designs/canada/wet-boew/assets/sig-blk-en.svg" alt="Government of Canada" property="logo">
                            <span class="wb-inv"> /
                                <span lang="fr">Gouvernement du Canada</span>
                            </span>
                          </a>
                          <meta property="name" content="Government of Canada">
                          <meta property="areaServed" typeof="Country" content="Canada">
                          <link property="logo" href="https://www.canada.ca/etc/designs/canada/wet-boew/assets/wmms-blk.svg">
                      </div>
                      <section id="wb-srch" class="col-lg-offset-4 col-md-offset-4 col-sm-offset-2 col-xs-12 col-sm-5 col-md-4">
                          <h2>Search</h2>
                          <form action="https://www.canada.ca/en/revenue-agency/search.html" method="get" name="cse-search-box" role="search">
                            <div class="form-group wb-srch-qry">
                                <label for="wb-srch-q" class="wb-inv">Search Canada.ca</label>
                                <input name="cdn" value="canada" type="hidden"/>
                                <input name="st" value="s" type="hidden"/>
                                <input name="num" value="10" type="hidden"/>
                                <input name="langs" value="en" type="hidden"/>
                                <input name="st1rt" value="1" type="hidden"/>
                                <input name="s5bm3ts21rch" value="x" type="hidden"/>
                                <input id="wb-srch-q" list="wb-srch-q-ac" class="wb-srch-q form-control" name="q" type="search" value="" size="34" maxlength="170" placeholder="Search CRA"/>
                                <datalist id="wb-srch-q-ac"></datalist>
                            </div>
                            <div class="form-group submit">
                                <button type="submit" id="wb-srch-sub" class="btn btn-primary btn-small" name="wb-srch-sub">
                                    <span class="glyphicon-search glyphicon"></span>
                                    <span class="wb-inv">Search</span></button>
                            </div>
                          </form>
                      </section>
                    </div>
                  </div><hr/>
                  <div class="container"><div class="row">
                    <div class="col-md-8">
                      <nav class="gcweb-menu" typeof="SiteNavigationElement">
                        <h2 class="wb-inv">Menu</h2>
                        <button type="button" aria-haspopup="true" aria-expanded="false"><span class="wb-inv">Main </span>Menu <span class="expicon glyphicon glyphicon-chevron-down"></span></button>
                        <ul role="menu" aria-orientation="vertical" data-ajax-replace="/content/dam/canada/sitemenu/sitemenu-v2-en.html">
                          <li role="presentation"><a role="menuitem" tabindex="-1" href="https://www.canada.ca/en/services/jobs.html">Jobs and the workplace</a></li>
                          <li role="presentation"><a role="menuitem" tabindex="-1" href="https://www.canada.ca/en/services/immigration-citizenship.html">Immigration and citizenship</a></li>
                          <li role="presentation"><a role="menuitem" tabindex="-1" href="https://travel.gc.ca/">Travel and tourism</a></li>
                          <li role="presentation"><a role="menuitem" tabindex="-1" href="https://www.canada.ca/en/services/business.html">Business and industry</a></li>
                          <li role="presentation"><a role="menuitem" tabindex="-1" href="https://www.canada.ca/en/services/benefits.html">Benefits</a></li>
                          <li role="presentation"><a role="menuitem" tabindex="-1" href="https://www.canada.ca/en/services/health.html">Health</a></li>
                          <li role="presentation"><a role="menuitem" tabindex="-1" href="https://www.canada.ca/en/services/taxes.html">Taxes</a></li>
                          <li role="presentation"><a role="menuitem" tabindex="-1" href="https://www.canada.ca/en/services/environment.html">Environment and natural resources</a></li>
                          <li role="presentation"><a role="menuitem" tabindex="-1" href="https://www.canada.ca/en/services/defence.html">National security and defence</a></li>
                          <li role="presentation"><a role="menuitem" tabindex="-1" href="https://www.canada.ca/en/services/culture.html">Culture, history and sport</a></li>
                          <li role="presentation"><a role="menuitem" tabindex="-1" href="https://www.canada.ca/en/services/policing.html">Policing, justice and emergencies</a></li>
                          <li role="presentation"><a role="menuitem" tabindex="-1" href="https://www.canada.ca/en/services/transport.html">Transport and infrastructure</a></li>
                          <li role="presentation"><a role="menuitem" tabindex="-1" href="http://international.gc.ca/world-monde/index.aspx?lang=eng">Canada and the world</a></li>
                          <li role="presentation"><a role="menuitem" tabindex="-1" href="https://www.canada.ca/en/services/finance.html">Money and finances</a></li>
                          <li role="presentation"><a role="menuitem" tabindex="-1" href="https://www.canada.ca/en/services/science.html">Science and innovation</a></li>
                        </ul>
                      </nav>
                    </div>
                    <div class="col-xs-5 col-xs-offset-7 col-md-offset-0 col-md-4"><section id="wb-so"><h2 class="wb-inv">Sign in</h2><a class="btn btn-primary" href="https://www.canada.ca/en/revenue-agency/services/e-services/cra-login-services.html"><span class="visible-xs">Sign in</span><span class="hidden-xs">CRA sign in</span></a></section></div></div></div>
                    <nav id="wb-bc" property="breadcrumb"><h2 class="wb-inv">You are here:</h2><div class="container"><ol class="breadcrumb">
                      <li><a href='https://www.canada.ca/en.html'>Canada.ca</a></li>
                      <li><a href='https://www.canada.ca/en/revenue-agency.html'>Canada Revenue Agency</a></li>
                      </ol></div>
                    </nav>
                    <main property="mainContentOfPage" resource="#wb-main" typeof="WebPageElement">
                    <div class="container">
            `;
  let newFooter = `</div>
                <div class="container">
                 <div class="pagedetails">
                  <h2 class="wb-inv">Page details</h2>
                  <div class="row">
                   <div class="col-sm-8 col-md-9 col-lg-9">
                    <div class="wb-disable-allow" data-ajax-replace="https://www.canada.ca/etc/designs/canada/wet-boew/assets/feedback/page-feedback-en.html" data-feedback-section="Section" data-feedback-theme="Theme">
                    </div>
                   </div>
                  </div>
                 </div>
                </div>
                <div class="container pagedetails">
                  <dl id="wb-dtmd">
                    <dt>Date modified:</dt>
                    <dd>
                      <time property="dateModified">2020-07-29</time>
                    </dd>
                  </dl>
                </div>
              </main>
              <footer>
               <section id="wb-info">
                <h2 class="wb-inv">About this site</h2>
                  <div class="gc-contextual">
                    <div class="container">
                      <nav>
                        <h3>Canada Revenue Agency (CRA)</h3>
                        <ul class="list-col-xs-1 list-col-sm-2 list-col-md-3"><li><a href="https://www.canada.ca/en/revenue-agency/corporate/contact-information.html">Contact the CRA</a></li><li><a href="https://www.canada.ca/en/revenue-agency/services/update-information-cra.html">Update your information</a></li><li><a href="https://www.canada.ca/en/revenue-agency/corporate/about-canada-revenue-agency-cra.html">About the CRA</a></li></ul>
                      </nav>
                    </div>
                  </div>
                  <div class="gc-main-footer">
                    <div class="container">
                      <nav>
                        <h3>Government of Canada</h3>
                        <ul class="list-col-xs-1 list-col-sm-2 list-col-md-3">
                          <li><a href="https://www.canada.ca/en/contact.html">All contacts</a></li>
                          <li><a href="https://www.canada.ca/en/government/dept.html">Departments and agencies</a></li>
                          <li><a href="https://www.canada.ca/en/government/system.html">About government</a></li>
                        </ul>
                        <h4><span class="wb-inv">Themes and topics</span></h4>
                        <ul class="list-unstyled colcount-sm-2 colcount-md-3"><li><a href="https://www.canada.ca/en/services/jobs.html">Jobs</a></li>
                          <li><a href="https://www.canada.ca/en/services/immigration-citizenship.html">Immigration and citizenship</a></li>
                          <li><a href="https://travel.gc.ca/">Travel and tourism</a></li>
                          <li><a href="https://www.canada.ca/en/services/business.html">Business</a></li>
                          <li><a href="https://www.canada.ca/en/services/benefits.html">Benefits</a></li>
                          <li><a href="https://www.canada.ca/en/services/health.html">Health</a></li>
                          <li><a href="https://www.canada.ca/en/services/taxes.html">Taxes</a></li>
                          <li><a href="https://www.canada.ca/en/services/environment.html">Environment and natural resources</a></li>
                          <li><a href="https://www.canada.ca/en/services/defence.html">National security and defence</a></li>
                          <li><a href="https://www.canada.ca/en/services/culture.html">Culture, history and sport</a></li>
                          <li><a href="https://www.canada.ca/en/services/policing.html">Policing, justice and emergencies</a></li>
                          <li><a href="https://www.canada.ca/en/services/transport.html">Transport and infrastructure</a></li>
                          <li><a href="https://www.international.gc.ca/world-monde/index.aspx?lang=eng">Canada and the world</a></li>
                          <li><a href="https://www.canada.ca/en/services/finance.html">Money and finance</a></li>
                          <li><a href="https://www.canada.ca/en/services/science.html">Science and innovation</a></li>
                          <li><a href="https://www.canada.ca/en/services/indigenous-peoples.html">Indigenous peoples</a></li>
                          <li><a href="https://www.canada.ca/en/services/veterans.html">Veterans and military</a></li>
                          <li><a href="https://www.canada.ca/en/services/youth.html">Youth</a></li></ul>
                      </nav>
                    </div>
                  </div>
                  <div class="gc-sub-footer">
                    <div class="container d-flex align-items-center">
                      <nav>
                        <h3 class="wb-inv">Government of Canada Corporate</h3>
                        <ul>
                          <li><a href="https://www.canada.ca/en/social.html">Social media</a></li>
                          <li><a href="https://www.canada.ca/en/mobile.html">Mobile applications</a></li>
                          <li><a href="https://www.canada.ca/en/government/about.html">About Canada.ca</a></li>
                          <li><a href="https://www.canada.ca/en/transparency/terms.html">Terms and conditions</a></li>
                          <li><a href="https://www.canada.ca/en/revenue-agency/corporate/privacy-notice.html">Privacy</a></li>
                        </ul>
                      </nav>
                      <div class="wtrmrk align-self-end">
                        <img src="https://wet-boew.github.io/themes-dist/GCWeb/GCWeb/assets/wmms-blk.svg" alt="Symbol of the Government of Canada"/>
                      </div>
                    </div>
                  </div>
                </section>
              </footer>
            `;
  let trimmedHtml = aiWordResponse.replace(/^```|```$/g, '');
  trimmedHtml = trimmedHtml.replace(/^html/, '');
  trimmedHtml = trimmedHtml.replace('<main>', newHeader);
  trimmedHtml = trimmedHtml.replace('</main>', newFooter);
  trimmedHtml = trimmedHtml.replace('<h1>', '<h1 property="name" id="wb-cont" dir="ltr">');
  const formattedHTML = formatHTML(trimmedHtml);
  // Insert the processed HTML into the iframe
  let iframe = document.getElementById("url-frame");
  if (iframe) {
    let iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
    iframeDoc.open();
    iframeDoc.write(trimmedHtml);
    iframeDoc.close();
  } else {
    console.error("Iframe with id 'url-frame' not found.");
  }
  // Show the raw HTML markup in the code tab
  $("#fullHtml code").text(formattedHTML);
  // Apply syntax highlighting
  Prism.highlightElement(document.querySelector("#fullHtml code"));
  $("#html-upload").addClass("hidden");
  $("#html-upload-loading-spinner").addClass("hidden");
  $("#word-upload-loading-spinner").addClass("hidden");
  $("#upload-chooser").addClass("hidden");
  $("#word-upload").addClass("hidden");
  $("#word-upload-preview").addClass("hidden");

  $("#url-upload").removeClass("hidden");
  $("#url-upload-preview").removeClass("hidden");
  $("#genai-upload-msg").addClass("hidden");
  $("#genai-task-options").removeClass("hidden");
}
