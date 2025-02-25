//JS specifically for the page assistant

$(document).ready(function() {

  $("#reset-btn").click(function(){
    resetHiddenUploadOptions();
    $('#api-key-entry').removeClass("hidden");
    $('#upload-chooser').addClass("hidden");
  });

  $(document).on("click", "input[type=radio]", function (event) {
    var target = event.target;
    // var parts = target.name.split("-");
    // var locationNumber = parts[parts.length - 1];
    if (target.name == "upload-option") {
      //Check which radio button it is and which content it's show/hiding
      resetHiddenUploadOptions();
      if (target.id == "url") {
        $('#url-upload').removeClass("hidden");
        $('#url-upload-input').removeClass("hidden");
      } else if (target.id == "html") {
        $('#html-upload').removeClass("hidden");
        $('#html-upload-input').removeClass("hidden");
      } else if (target.id == "image") {
        $('#image-upload').removeClass("hidden");
        $('#image-upload-input').removeClass("hidden");
      } else if (target.id == "word") {
        $('#word-upload').removeClass("hidden");
        $('#word-upload-input').removeClass("hidden");
      }
    }
  });

  $("#code-refresh-button").click(function(){
    let rawCode = getRawCodeFromHighlighted($('#fullHtml code'));
    refreshIframe("url-frame", rawCode);
  });

  $("#code-copy-button").click(function(){
    // Select the content of the <code> element
    var codeContent = $('#fullHtml code').text();
    // Create a temporary textarea to hold the code content
    var $tempTextarea = $('<textarea>');
    $('body').append($tempTextarea);
    $tempTextarea.val(codeContent).select();
    // Execute the copy command
    try {
        var successful = document.execCommand('copy');
    } catch (err) {
        console.error('Oops, unable to copy', err);
    }
    // Remove the temporary textarea
    $tempTextarea.remove();
  });
  $('#code-edit-button').click(function() {
      var $code = $('#fullHtml code');
      var isEditable = $code.attr('contenteditable') === 'true';
      if (isEditable) {
          // Disable editing
          $code.attr('contenteditable', 'false');
          $(this).attr('title', 'Edit Code');
          $(this).find('i').removeClass('fa-save').addClass('fa-edit');
      } else {
          // Enable editing
          $code.attr('contenteditable', 'true');
          $(this).attr('title', 'Save Code');
          $(this).find('i').removeClass('fa-edit').addClass('fa-save');
      }
  });

  $("#url-upload-btn").click(async function(){
    $('#upload-chooser').addClass("hidden");
    $('#url-upload-input').addClass("hidden");
    $('#url-upload-preview').removeClass("hidden");
    $("#url-frame").addClass("hidden"); //reset iframe hidden
    $("#url-invalid-msg").addClass("hidden");
    $("#canada-ca-msg").addClass("hidden");
    $("#other-site-msg").addClass("hidden");
    //load the iframe with the html preview
    var bUrlInput = isValidUrl($('#url-input').val());
    if (bUrlInput == false) { //invalid url
      //unhide URL invalid message
      $("#url-invalid-msg").removeClass("hidden");
      $('#url-upload-input').removeClass("hidden");
      return;
    }
    const urlInput = new URL($('#url-input').val());
    // Currently configuring it to specific github organizations:
    if (urlInput.host == "cra-design.github.io" || urlInput.host == "gc-proto.github.io" || urlInput.host == "test.canada.ca" || urlInput.host == "cra-proto.github.io") { //github links
      $("#url-frame").attr("src", urlInput.href);
      $("#url-frame").removeClass("hidden");
      $("#genai-upload-msg").addClass("hidden");
      $("#genai-task-options").removeClass("hidden");
      parsePageHTML(urlInput.href, async function (err, html) {
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
      $("#url-frame").removeClass("hidden");
      $("#genai-upload-msg").addClass("hidden");
      $("#genai-task-options").removeClass("hidden");
      parsePageHTML(urlInput.href, async function (err, html) {
          if (err) {
              console.error('Failed to fetch the webpage:', err);
              alert('Failed to fetch the webpage. Check the console for details.');
              return;
          }
          //Process HTML to replace header/footer
          html = await applySimpleHtmlTemplate(html);
          html = await applyCanadaHtmlTemplate(html);
          // Extract fields from the HTML
          const fields = extractFields(html);
          // Render fields and page code
          renderHTMLFields(html, fields);
          // Insert the processed HTML into the iframe
          refreshIframe("url-frame", html);
      });
    } else { //unsupported site
      //unhide unsupported site message
      $("#other-site-msg").removeClass("hidden");
      $('#url-upload-input').removeClass("hidden");
    }
    //do we also want a tab to view the code? Maybe this is where we can make edits or changes with GenAI, then reload in the iframe? Could we do this with some html manipulation in the javascript of the already-loaded iframe? Or would we need to rebuild the page in the script?
  });

  $("#html-upload-btn").click(function() {
    // $("#html-preview").html($("#html-input").html());
    // $("#html-upload-preview").removeClass("hidden");
    $("#html-upload-loading-spinner").removeClass("hidden");
    let extractedHtml = convertTextToHTML($("#html-input").val());
    RefineSyntax(extractedHtml);
  });


  $(document).on("change", "input", async function (event) {
    // if (event.target.id == "img-file") {
    //   $("#image-invalid-msg").addClass("hidden");
    //   $("#image-multiple-msg").addClass("hidden");
    //   var fileList = event.target.files;
    //   if (fileList.length > 0 && fileList != undefined) {
    //     if (fileList.length > 1) { //uploaded more than 1 picture - could perhaps support this in the future
    //       $("#image-multiple-msg").removeClass("hidden");
    //     } else if (fileList[0].type.substring(0,5) != "image") {
    //       $("#image-invalid-msg").removeClass("hidden");
    //     } else {
    //       //Preview the image
    //       $("#image-preview").attr("src", URL.createObjectURL(fileList[0]));
    //       $("#image-upload-preview").removeClass("hidden");
    //     }
    //   }
    // } else
    if (event.target.id == "word-file") {
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
              let result = await mammoth.convertToHtml({ arrayBuffer: arrayBuffer });
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

  $("#accept-iframe-a-btn").click(function() {
    acceptIframe("a");
  });
  $("#accept-iframe-b-btn").click(function() {
    acceptIframe("b");
  });

  $("#genai-select-tasks-btn").click(function () {
    $("#genai-task-options").addClass("hidden");
    $("#genai-model-options").removeClass("hidden");
    if ($("#genai-analysis-llm-compare").is(':checked') && $('#model-compare-2').hasClass("hidden")) {
      $('#model-compare-1').addClass("hidden");
      $('#model-compare-2').removeClass("hidden");
      toggleRadioCheckbox();
    } else if (!$("#genai-analysis-llm-compare").is(':checked') && $('#model-compare-1').hasClass("hidden")) {
      $('#model-compare-1').removeClass("hidden");
      $('#model-compare-2').addClass("hidden");
      toggleRadioCheckbox();
    }
    $("#genai-reset-report-btn").removeClass("hidden");
  });

  $("#genai-run-report-btn").click(async function () {
    $("#genai-model-options").addClass("hidden");
    $("#genai-open-report-btn").addClass("hidden"); // Hide report button initially
    $("#loading-indicator").removeClass("hidden"); // Show spinner
    //$("#genai-report-reset-options").removeClass("hidden");
    let selectedTasks = [];
    // Get all checked checkboxes and store their values in an array
    const model = $('input[name="html-upload-genai-model"]:checked').map(function() {
      return $(this).val();
    }).get();
    $('input[name="html-upload-genai-model"]:checked').val();
    let systemGeneral = { role: "system", content: "" }
    let systemTask = { role: "system", content: "" }
    let userContent = { role: "user", content: "Web page content: "}
    let userData = { role: "user", content: "Contextual data: " }
    let reportCount = 0; // Counter to ensure unique IDs
    let reportContainer = $(".overlay-content");
    let reportList = $(".report-list");
    let newReportListContainer = $(
      '<ul class="generated-report"></ul>'
    );

    // Append to the report container with unordered list
    reportList.append(newReportListContainer);
    //declare the reportListContainer ul to append list items later
    let reportListContainer = $(".report-list .generated-report");

    //fetching the systemGeneral instructions from file
    try {
      systemGeneral.content = await $.get("custom-instructions/system/no-html-report.txt");
    } catch (error) {
        console.error(`Error getting systemGeneral instructions:`, error);
        $("#html-upload-no-action-error").removeClass("hidden");
    }

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
            let fileContentB = "";
            if (!$("#genai-analysis-llm-compare").is(':checked')) {
              fileContentB = await $.get(task.value.replace('.txt', '-B.txt'));
            }
            systemTask.content = "Custom instruction: " + fileContent;
            // Create the JSON with the prompt and instructions
            let requestJson = [systemGeneral, systemTask, userContent, userData];
            // Send it to the API
            let formattedText = { a: await formatORResponse(model[0], requestJson), b: "" };
            if ($("#genai-analysis-llm-compare").is(':checked')) {
              formattedText.b = await formatORResponse(model[1], requestJson);
            } else if (fileContentB) {
              systemTask.content = "Custom instruction: " + fileContentB;
              requestJson = [systemGeneral, systemTask, userContent, userData];
              formattedText.b = await formatORResponse(model[0], requestJson);
            }
            let labelText = $(`label[for='${task.id}']`).text().trim();
            if (formattedText.b != "") {
              // Side-by-side comparison needed
              reportCount++;
              newReport = createSideBySideReport(reportCount, labelText, formattedText);
            } else {
              // No side-by-side, just show the single report
              newReport = createBasicReport(labelText, formattedText);
            }
            // Append the report to the desired container in your DOM
            $('#report-section').append(newReport);
            let newReportListItem = $('<li>' + labelText + '</li>');
            // Append to the report container
            reportContainer.append(newReport);
            reportListContainer.append(newReportListItem);
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
    $("#loading-indicator").addClass("hidden"); // Hide spinner when done
  });


  $("#genai-open-report-btn").click(function(){
    /* Open when someone clicks on the span element */
    //function openNav() {
      document.getElementById("genai-nav").style.width = "100%";
    //}
  });
  $("#genai-reset-report-btn").click(function(){
    $("#genai-reset-report-btn").addClass("hidden");
    $("#genai-open-report-btn").addClass("hidden");
    $("#genai-model-options").addClass("hidden");
    $("#genai-task-options").removeClass("hidden");
    $('input[name="html-upload-genai-analysis"]').prop('checked', false);
    $('input[name="html-upload-genai-model"]').prop('checked', false);
    let reportContainer = $(".overlay-content");
    reportContainer.find(".generated-report").remove();
    let reportList = $(".report-list");
    reportList.find(".generated-report").remove();
  });
  $("#close-report-btn").click(function(){
    /* Open when someone clicks on the span element */
      document.getElementById("genai-nav").style.width = "0%";
  });

  $(document).on('click', '#genai-nav .toolbar-button', function() {
      const counter = $(this).attr('id').split('-').pop();
      let selectedOption = "";
      // Check which button was clicked
      if ($(this).is(`#accept-report-a-btn-${counter}`)) {
          // Accept A: Remove B and expand A to full width
          $(`#report-container-B-${counter}`).remove();
          $(`#report-toolbox-A-${counter}`).remove();
          $(`#report-container-A-${counter}`).css('width', '100%');
          selectedOption = "A";
      } else if ($(this).is(`#accept-report-b-btn-${counter}`)) {
          // Accept B: Remove A and expand B to full width
          $(`#report-container-A-${counter}`).remove();
          $(`#report-toolbox-B-${counter}`).remove();
          $(`#report-container-B-${counter}`).css('width', '100%');
          selectedOption = "B";
      }
      const model = $('input[name="html-upload-genai-model"]:checked').map(function() {
        return $(this).val();
      }).get();
      // Grab the report type from the <h4> element within the sidebyside-report
      let reportType = $(this).closest('.sidebyside-container').find('h4').text().trim();
      // Redirect to Google Form with prefilled data
      const googleFormURL = `https://docs.google.com/forms/d/e/1FAIpQLSfI_DBkkIXN1SJh0OECZt3HUztsBNzD4sm_jaL7odGbH7Awqg/viewform?usp=pp_url` +
                            `&entry.1414644752=${encodeURIComponent(reportType)}` +
                            `&entry.984404841=${selectedOption}` +
                            `&entry.510997766=${model[0]}` +
                            `&entry.999305171=${model[1]}`;
      window.open(googleFormURL, '_blank');
  });

}); //close document ready

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
    const alerts = [];
    $html.find('.alert').each(function () {
        const alertHTML = $(this).prop('outerHTML');
        alerts.push(alertHTML ? alertHTML.trim() : 'Not Found');
    });
    const doormats = [];
    $html.find('.gc-srvinfo section').each(function () {
        const $section = $(this);
        const link = $section.find('h3 a').attr('href') || 'No link';
        const title = $section.find('h3 a').text().trim() || 'No title';
        const description = $section.find('p').text().trim() || 'No description';
        doormats.push({ link, title, description });
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
        // alerts: alertsResult
        // introParagraph,
        // doormats: doormatsResult,
        // tables: tablesResult,
        // bodyContent,
    };
}

// Function to render the full HTML and extracted fields
function renderHTMLFields(fullHtml, fields) {
    // Display the full HTML in the <pre> tag
    $('#fullHtml code').text(formatHTML(fullHtml));
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

function loadTemplate(filePath, targetSelector) {
    $.get(filePath, function(data) {
        $(targetSelector).html(data);
    }).fail(function() {
        console.error('Error loading the template from ' + filePath);
    });
}

async function RefineSyntax(extractedHtml) {
  //Part 1: Get simple templates
  extractedHtml = await applySimpleHtmlTemplate(extractedHtml);
  let formattedAIHTML = "";
  let aiWordResponse = ""; // Default to extractedHtml in case API isn't used
  if (!$('#doc-exact-syntax').is(':checked') || $("#html").prop("checked")) {
    try {
      // Define the HTML header and footer
      let systemWord = { role: "system", content: "" }
      systemWord.content = await $.get("custom-instructions/system/semantic-html-rewrite.txt");
      let userWord = { role: "user", content: extractedHtml }
      // Create the JSON with the prompt and instructions
      let requestJson = [systemWord, userWord];
      // Send it to the API
      let ORjson = await getORData("google/gemini-2.0-flash-exp:free", requestJson);
      aiWordResponse = ORjson.choices[0].message.content.trim();
    } catch (error) {
      console.error('Error fetching enhanced HTML syntax from GenAI:', error);
      hideAllSpinners();
    }
	  if ($("#html").prop("checked")) {
		//We need to reassign the aiWordResponse to the basic text for content upload, since there is no mammoth version
		extractedHtml = aiWordResponse;
		//From now on, treat #html as the same thing as doc-exact-syntax checked
	  }
  }
  if (!$('#doc-basic-html').is(':checked') && !$('#html-basic-html').is(':checked')) {
    extractedHtml = await applyCanadaHtmlTemplate(extractedHtml);
    if (!$('#doc-exact-syntax').is(':checked') && !$("#html").prop("checked")) {
      aiWordResponse = await applyCanadaHtmlTemplate(aiWordResponse);
    }
  }
  //For Rosa to merge with other trimming function
  let trimmedHtml = extractedHtml
    .replace(/^```|```$/g, '')
    .replace(/^html/, '');
  let formattedHTML = formatHTML(trimmedHtml);
  if (!$('#doc-exact-syntax').is(':checked') && !$("#html").prop("checked")) {
    let trimmedAIHtml = aiWordResponse
      .replace(/^```|```$/g, '')
      .replace(/^html/, '');
    formattedAIHTML = formatHTML(trimmedAIHtml);
  }
  refreshIframe("url-frame", formattedHTML);
  if (!$('#doc-exact-syntax').is(':checked') && !$("#html").prop("checked")) {
    refreshIframe("url-frame-2", formattedAIHTML);
    toggleComparisonElement($('#iframe-container-A'), $('#iframe-container-B'));
    $('#iframe-toolbox-A').removeClass('hidden');
    $('#iframe-toolbox-B').removeClass('hidden');
  }
  // Show the raw HTML markup in the code tab
  $("#fullHtml code").text(formattedHTML);
  // Apply syntax highlighting
  Prism.highlightElement(document.querySelector("#fullHtml code"));
  if (!$('#doc-exact-syntax').is(':checked') && !$("#html").prop("checked")) {
    $("#fullHtmlCompare code").text(formattedAIHTML);
    Prism.highlightElement(document.querySelector("#fullHtmlCompare code"));
    toggleComparisonElement($('#fullHtml'), $('#fullHtmlCompare'));
  }
  //UI visibility updates
  showUIAfterDocUpload();
}

async function applySimpleHtmlTemplate(extractedHtml) {
  try {
    const [headerResponse, footerResponse] = await Promise.all([
        fetch('html-templates/simple-header.html'),
        fetch('html-templates/simple-footer.html')
    ]);
    // Check if both fetch operations were successful
    if (!headerResponse.ok || !footerResponse.ok) {
        throw new Error('Failed to load header or footer');
    }
    // Retrieve the text content of the responses
    const [htmlHeader, htmlFooter] = await Promise.all([
        headerResponse.text(),
        footerResponse.text()
    ]);

    //GRAB ALL METADATA INSTEAD
     // Extract metadata fields from the original extractedHtml (if any)
    // const metadataMatches = extractedHtml.match(/<meta[^>]*>|<title[^>]*>.*?<\/title>|<link[^>]*>/g) || [];
    // const metadata = metadataMatches.join("\n");

    // Extract only <title>, <meta name="description">, and <meta name="keywords">
    const titleMatch = extractedHtml.match(/<title[^>]*>.*?<\/title>/);
    const descriptionMatch = extractedHtml.match(/<meta\s+name=["']description["'][^>]*>/);
    const keywordsMatch = extractedHtml.match(/<meta\s+name=["']keywords["'][^>]*>/);

    // Join the matches if they exist, otherwise set to empty string
    const metadata = [
      titleMatch ? titleMatch[0] : '',
      descriptionMatch ? descriptionMatch[0] : '',
      keywordsMatch ? keywordsMatch[0] : ''
    ].join("\n");

    // Check if <main> has class="container"
    const mainClassMatch = extractedHtml.match(/<main[^>]*class=["']([^"']*container[^"']*)["'][^>]*>/);
    const mainClass = mainClassMatch ? ` class="${mainClassMatch[1]}"` : '';

    // Remove content before the <h1> tag (if any)
    extractedHtml = extractedHtml.replace(/.*?(<h1[^>]*>.*?<\/h1>)/s, '$1');
    // Remove content after the closing </main> tag
    extractedHtml = extractedHtml.replace(/<\/main>[\s\S]*$/, '');
    // Reconstruct the HTML with the new header and footer
    extractedHtml = htmlHeader.replace('</head>', `${metadata}</head>`).replace(`<main>`, `<main${mainClass}>`) + extractedHtml + htmlFooter;
    return extractedHtml;
  } catch (error) {
    console.error('Error applying simple HTML template:', error);
    hideAllSpinners(); // Consolidated UI hiding
  }
}

async function applyCanadaHtmlTemplate(extractedHtml) {
  try {
    const [headerResponse2, footerResponse2] = await Promise.all([
        fetch('html-templates/canada-header-additions.html'),
        fetch('html-templates/canada-footer-additions.html')
    ]);
    // Check if both fetch operations were successful
    if (!headerResponse2.ok || !footerResponse2.ok) {
        throw new Error('Failed to load new header or footer');
    }
    // Retrieve the text content of the responses
    let [newHeader, newFooter] = await Promise.all([
        headerResponse2.text(),
        footerResponse2.text()
    ]);
    // Check if the original HTML <main> tag contains the class "container"
    const mainClassMatch = extractedHtml.match(/<main[^>]*class=["'][^"']*container[^"']*["'][^>]*>/);
    // If the class="container" exists, use it; otherwise, we'll add the class and the <div class="main">
    if (mainClassMatch) {
      // If class="container" exists, replace the <main> tag in the newHeader file with the class included
      newHeader = newHeader.replace('<main>', '<main property="mainContentOfPage" resource="#wb-main" typeof="WebPageElement" class="container">');
    } else {
      // If no class="container", just add it and include the <div class="main"> below it
      newHeader = newHeader.replace('<main>', '<main property="mainContentOfPage" resource="#wb-main" typeof="WebPageElement"><div class="container">');
    }
    console.log(newHeader);
    console.log(extractedHtml.replace(/<main[^>]*/, "hi"));
    extractedHtml = extractedHtml
      .replace(/<main[^>]*/, newHeader)
      .replace('</main>', newFooter)
      .replace('<h1>', '<h1 property="name" id="wb-cont" dir="ltr">')
      .replace('<table>', '<table class="wb-tables table table-striped">');
    return extractedHtml;
  } catch (error) {
    console.error('Error applying Canada.ca HTML template:', error);
    hideAllSpinners(); // Consolidated UI hiding
  }
}

function showUIAfterDocUpload() {
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

function acceptIframe(option) {
  if (option == "b") {
    //write iframe-2 to iframe + fullHtmlCompare to fullHtml
    let iframeB = $("#url-frame-2")[0].contentDocument || $("#url-frame-2")[0].contentWindow.document;
    refreshIframe("url-frame", iframeB.body.innerHTML);

    // Copy pre content from fullHtmlCompare to fullHtml
    let fullHtmlCompareContent = $("#fullHtmlCompare code").text();
    $("#fullHtml code").text(fullHtmlCompareContent);
    Prism.highlightElement(document.querySelector("#fullHtml code"));
  }
  $('#iframe-toolbox-A, #iframe-toolbox-B').addClass('hidden');
  toggleComparisonElement($('#fullHtml'), $('#fullHtmlCompare'));
  toggleComparisonElement($('#iframe-container-A'), $('#iframe-container-B'));
}

function getRawCodeFromHighlighted(codeBlock) {
  // Assuming the code block has the class 'language-*' or similar for syntax highlighting
  let rawCode = codeBlock.text(); // Get the raw code (without syntax highlighting)
  return rawCode;
}

// Function to toggle radio buttons to checkboxes and vice versa
function toggleRadioCheckbox() {
  $("input[name='html-upload-genai-model']").each(function() {
    var $input = $(this);
    var $label = $input.next("label");

    // Check if it's a radio button
    if ($input.attr("type") === "radio") {
      // Convert radio button to checkbox
      var $checkbox = $("<input>", {
        type: "checkbox",
        class: "checkbox-small", // Add the "checkbox-small" class
        id: $input.attr("id"), // Preserve the ID
        name: $input.attr("name"), // Preserve the name
        value: $input.val() // Preserve the value
      });

      // Create a label for the checkbox with the same text
      var $newLabel = $("<label>", {
        class: "label-small", // Add the "label-small" class
        for: $input.attr("id"),
        text: $label.text() // Copy the label text from the radio button
      });

      // Replace the radio button and label with the checkbox and new label
      $input.replaceWith($checkbox);
      $label.replaceWith($newLabel);
    }
    // If it's a checkbox, convert it back to a radio button
    else if ($input.attr("type") === "checkbox") {
      // Create a radio button from the checkbox
      var $radioButton = $("<input>", {
        type: "radio",
        class: "radio-small", // Add the "radio-small" class
        id: $input.attr("id"), // Preserve the ID
        name: $input.attr("name"), // Preserve the name
        value: $input.val() // Preserve the value
      });

      // Create a label for the radio button with the same text
      var $newLabel = $("<label>", {
        for: $input.attr("id"),
        text: $label.text() // Copy the label text from the checkbox
      });

      // Replace the checkbox and label with the radio button and new label
      $input.replaceWith($radioButton);
      $label.replaceWith($newLabel);
    }
  });
}

async function formatORResponse(model, requestJson) {
  let ORjson = await getORData(model, requestJson);
  let aiResponse = ORjson.choices[0].message.content;
  let formattedText = formatAIResponse(aiResponse);
  return formattedText;
}
