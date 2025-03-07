//JS specifically for the page assistant

$(document).ready(function() {

  // $("#reset-btn").click(function(){
  //   resetHiddenUploadOptions();
  //   $('#api-key-entry').removeClass("hidden");
  //   $('#upload-chooser').addClass("hidden");
  // });

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
    var urlInput = $("#url-input").val().trim();
    // Trim unwanted characters like spaces, parentheses, or extra slashes
    // This regex ensures it starts with http:// or https:// and allows other common URL structures
    // var cleanUrl = cleanUrl.replace(/^(?!http(s)?:\/\/)/, 'https://'); // Ensure it starts with "http://"

    // urlInput = urlInput.replace(/^[^\w]+|[^\w]+$/g, '').replace(/(https?:\/\/)?(www\.)?/i, ''); // trim any unnecessary characters
    updateIframeFromURL(urlInput);
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

  $("#template-options-btn").click(async function() {
    $("#templates-loading-indicator").removeClass("hidden");
    let template = $('input[name="template-options"]:checked');
    //1) Strip header/footer from page code to focus prompt on page content
    let { extractedHtml, metadata, mainClassMatch } = await applySimpleHtmlTemplate($("#fullHtml code").text());
    //2) Send page body code + template code to genAI
    let systemGeneral = { role: "system", content: await $.get("custom-instructions/template/" + template.attr("id").replace("templates-", "") + ".txt") };
    let systemTemplate = { role: "system", content: await $.get(template.val()) };
    let userContent = { role: "user", content: extractedHtml};
    let requestJson = [systemGeneral, systemTemplate, userContent];
    // Send it to the API
    try {
      let aiResponse = await formatORResponse("qwen/qwq-32b:free", requestJson);
      console.log(aiResponse);
      let formattedHtml = formatGenAIHtmlResponse(aiResponse);
      let { extractedHtml: simpleHtml } = await applySimpleHtmlTemplate(formattedHtml);
      extractedHtml = await applyCanadaHtmlTemplate(simpleHtml, metadata, mainClassMatch);
    } catch (err) {
        console.error('Templating error:', err);
        $("#templates-loading-indicator").addClass("hidden");
    }
    //4) make side-by-side accept/deny block in the code - use the fullHtmlCompare and iframeB?
      //Maybe refresh the iframe with the suggested code too?
    refreshIframe("url-frame-2", extractedHtml);
    toggleComparisonElement($('#iframe-container-A'), $('#iframe-container-B'));
    $('#iframe-toolbox-A').removeClass('hidden');
    $('#iframe-toolbox-B').removeClass('hidden');
    //Add comparison code
    $("#fullHtmlCompare code").text(extractedHtml);
    Prism.highlightElement(document.querySelector("#fullHtmlCompare code"));
    toggleComparisonElement($('#fullHtml'), $('#fullHtmlCompare'));
    $("#templates-loading-indicator").addClass("hidden");
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

  // Limit checkbox selection to a maximum of 2
  $(document).on("change", "input[name='html-upload-genai-model']:checkbox", function() {
    var selectedCount = $("input[name='html-upload-genai-model']:checked").length;

    if (selectedCount > 2) {
      // Deselect the last checked box if the limit is exceeded
      this.checked = false;
      alert("You can select a maximum of 2 models.");
    }
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
    // $('input[name="html-upload-genai-model"]:checked').val();
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
      let { extractedHtml, metadata, mainClassMatch } = await applySimpleHtmlTemplate($("#fullHtml code").text()); //strip header/footer for size
      userContent.content += extractedHtml; //give it the full page html minus metadata
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
            if (task.value.startsWith("metadata/")) {
              userContent.content = userContent.content.replace('</head>', `${metadata}</head>`); //add metadata back in for metadata tasks only
            }
            systemTask.content = "Custom instruction: " + fileContent;
            // Create the JSON with the prompt and instructions
            let requestJson = [systemGeneral, systemTask, userContent, userData];
            // Send it to the API
            let formattedText = { a: await formatORResponse(model[0], requestJson), b: "" };
            if ($("#genai-analysis-llm-compare").is(':checked') && model[1]) {
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
              newReport = createSideBySideReport(reportCount, labelText, formattedText, model);
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
      // Grab the report type from the <h4> element within the sidebyside-report
      let reportType = $(this).closest('.sidebyside-container').find('.sidebyside-report h4').text().trim();
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
      // Redirect to Google Form with prefilled data
      const googleFormURL = `https://docs.google.com/forms/d/e/1FAIpQLSe4PKfFCIoQkkxGGyTSda-JzczbM66r42zuQ4Gul38iGQjtpQ/viewform?usp=pp_url` +
                            `&entry.556657873=${encodeURIComponent(reportType)}` +
                            `&entry.1982547367=${model[0]}` +
                            `&entry.946626987=${model[1]}`;
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

    // Extract specific fields
    const h1 = $html.find('h1').first().text().trim() || 'Not Found';
    const metaKeywords = $html.find('meta[name="keywords"]').attr('content') || 'Not Found';
    const metaDescriptionTag = $html.find("meta[name='description']");
    const metaDescription = metaDescriptionTag.length && metaDescriptionTag.attr('content')
        ? metaDescriptionTag.attr('content').trim()
        : 'Not Found';
    // const introParagraph = $html.find('h1').first().nextAll('p').first().text().trim() || 'Not Found';
    //
    // // Extract alerts
    // const alerts = [];
    // $html.find('.alert').each(function () {
    //     const alertHTML = $(this).prop('outerHTML');
    //     alerts.push(alertHTML ? alertHTML.trim() : 'Not Found');
    // });
    // const alertsResult = alerts.length > 0 ? alerts : 'Not Found';
    //
    // // Extract doormats
    // const doormats = [];
    // $html.find('.gc-srvinfo').find('.col-lg-4.col-md-6').each(function () {
    //     const $section = $(this);
    //     const link = $section.find('h3 a').attr('href') || 'No link';
    //     const title = $section.find('h3 a').text().trim() || 'No title';
    //     const description = $section.find('p').text().trim() || 'No description';
    //     doormats.push({ link, title, description });
    // });
    // const doormatsResult = doormats.length > 0 ? doormats : 'Not Found';
    //
    // // Extract tables
    // const tables = [];
    // $html.find('table').each(function () {
    //     const tableHTML = $(this).prop('outerHTML');
    //     tables.push(tableHTML ? tableHTML.trim() : 'Not Found');
    // });
    // const tablesResult = tables.length > 0 ? tables : 'Not Found';
    //
    // // Extract full body content
    // const bodyContentRaw = $html.find('body').html();
    // const bodyContent = bodyContentRaw ? bodyContentRaw.trim() : 'Not Found';
    //
    // // Extract H2 sections
    // const h2Sections = [];
    // $html.find('h2').each(function () {
    //     const $h2 = $(this);
    //     const title = $h2.text().trim();
    //     let $content = $('<div></div>');
    //     let $next = $h2.next();
    //
    //     // Collect all sibling elements until the next <h2> or end of container
    //     while ($next.length && $next.prop('tagName') !== 'H2') {
    //         $content.append($next.clone());
    //         $next = $next.next();
    //     }
    //
    //     // Store the section data
    //     h2Sections.push({
    //         title: title,
    //         content: $content.html().trim()
    //     });
    // });

    // Return extracted fields
    return {
        h1,
        metaDescription,
        metaKeywords,
        // alerts: alertsResult,
        // introParagraph,
        // doormats: doormatsResult,
        // tables: tablesResult,
        // h2Sections // Add this to the return object
        // bodyContent
    };
}


// Function to render the full HTML and extracted fields
function renderHTMLFields(fullHtml, fields) {
    // Display the full HTML in the <pre> tag
    $('#fullHtml code').text(formatHTML(fullHtml));
    Prism.highlightElement(document.querySelector("#fullHtml code"));

    // Display the extracted fields in the table
    const $tableBody = $('#extractedMetadataFields');
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

async function RefineSyntax(html) {
  //Part 1: Get simple templates
  let { extractedHtml, metadata, mainClassMatch } = await applySimpleHtmlTemplate(html);
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
      aiWordResponse = formatGenAIHtmlResponse(ORjson.choices[0].message.content);
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
    extractedHtml = await applyCanadaHtmlTemplate(extractedHtml, metadata, mainClassMatch);
    if (!$('#doc-exact-syntax').is(':checked') && !$("#html").prop("checked")) {
      aiWordResponse = await applyCanadaHtmlTemplate(aiWordResponse, metadata, mainClassMatch);
    }
  }
  let formattedHTML = formatHTML(extractedHtml); //indentation for code block
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

    //ALL METADATA
     // Extract metadata fields from the original extractedHtml (if any)
    const metadataMatches = extractedHtml.match(/<meta[^>]*>|<title[^>]*>.*?<\/title>|<link[^>]*>/g) || [];
    const metadata = metadataMatches.join("\n");

    //SPECIFIC METADATA
    // const titleMatch = extractedHtml.match(/<title[^>]*>.*?<\/title>/);
    // const descriptionMatch = extractedHtml.match(/<meta\s+name=["']description["'][^>]*>/);
    // const keywordsMatch = extractedHtml.match(/<meta\s+name=["']keywords["'][^>]*>/);
    //
    // // Join the matches if they exist, otherwise set to empty string
    // const metadata = [
    //   titleMatch ? titleMatch[0] : '',
    //   descriptionMatch ? descriptionMatch[0] : '',
    //   keywordsMatch ? keywordsMatch[0] : ''
    // ].join("\n");

    // Check if <main> has class="container"
    const mainClassMatch = extractedHtml.match(/<main[^>]*class=["']([^"']*container[^"']*)["'][^>]*>/);
    const mainClass = mainClassMatch ? ` class="${mainClassMatch[1]}"` : '';

    // Remove content before the <h1> tag (if any)
    extractedHtml = extractedHtml.replace(/.*?(<h1[^>]*>.*?<\/h1>)/s, '$1');
    // Remove content after the closing </main> tag
    extractedHtml = extractedHtml.replace(/<\/main>[\s\S]*$/, '');
    // Reconstruct the HTML with the new header and footer
    extractedHtml = htmlHeader + extractedHtml + htmlFooter;
    return { extractedHtml, metadata, mainClassMatch };
  } catch (error) {
    console.error('Error applying simple HTML template:', error);
    hideAllSpinners(); // Consolidated UI hiding
  }
}


//htmlHeader.replace('</head>', `${metadata}</head>`).replace(`<main>`, `<main${mainClass}>`)

async function applyCanadaHtmlTemplate(extractedHtml, metadata = "", mainClassMatch = false) {
  try {
    const [headerResponse2, footerResponse2, dateResponse2] = await Promise.all([
        fetch('html-templates/canada-header-additions.html'),
        fetch('html-templates/canada-footer-additions.html'),
        fetch('html-templates/canada-date-additions.html')
    ]);
    // Check if both fetch operations were successful
    if (!headerResponse2.ok || !footerResponse2.ok || !dateResponse2.ok) {
        throw new Error('Failed to load new header or footer');
    }
    // Retrieve the text content of the responses
    let [newHeader, newFooter, newDate] = await Promise.all([
        headerResponse2.text(),
        footerResponse2.text(),
        dateResponse2.text()
    ]);
    const today = new Date();
    const formattedDate = today.getFullYear() + '-' +
                          String(today.getMonth() + 1).padStart(2, '0') + '-' +
                          String(today.getDate()).padStart(2, '0');
    newDate = newDate.replace("2020-07-29", formattedDate);

    // Check if the extractedHtml already has a date modified section
    const hasDateModifiedSection = /<dl id="wb-dtmd">/.test(extractedHtml);
    if (!hasDateModifiedSection) {
      newFooter = newFooter.replace('</main>', newDate);
    }
    // If the class="container" exists when stripped in simpleHtmlTemplate, use it; otherwise, we'll add the class and the <div class="main">
    if (mainClassMatch) {
      // If class="container" exists, replace the <main> tag in the newHeader file with the class included
      newHeader = newHeader.replace('<main>', '<main property="mainContentOfPage" resource="#wb-main" typeof="WebPageElement" class="container">');
    } else {
      // If no class="container", just add it and include the <div class="main"> below it
      newHeader = newHeader.replace('<main>', '<main property="mainContentOfPage" resource="#wb-main" typeof="WebPageElement"><div class="container">');
    }
    extractedHtml = extractedHtml
      .replace('</head>', `${metadata}</head>`)
      .replace(/<main[^>]*>/, newHeader)
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
  let html = "";
  if (option == "b") {
    //write iframe-2 to iframe + fullHtmlCompare to fullHtml
    let iframeB = $("#url-frame-2")[0].contentDocument || $("#url-frame-2")[0].contentWindow.document;
    refreshIframe("url-frame", iframeB.body.innerHTML);
    // Copy pre content from fullHtmlCompare to fullHtml
    html = $("#fullHtmlCompare code").text();
    $("#fullHtml code").text(html);
    Prism.highlightElement(document.querySelector("#fullHtml code"));
  } else {
    html = $("#fullHtml code").text();
  }
  $('#iframe-toolbox-A, #iframe-toolbox-B').addClass('hidden');
  toggleComparisonElement($('#fullHtml'), $('#fullHtmlCompare'));
  toggleComparisonElement($('#iframe-container-A'), $('#iframe-container-B'));
  // Extract fields from the HTML
  const fields = extractFields(html);
  // Render results to the page
  renderHTMLFields(html, fields);
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
  try {
    let ORjson = await getORData(model, requestJson);
    if (ORjson?.choices?.[0]?.message?.content) {
      let aiResponse = ORjson.choices[0].message.content;
      let formattedText = formatAIResponse(aiResponse);
      return formattedText;
    } else {
      console.error("Unexpected ORjson structure:", ORjson);
      return "Error: Error in response from GenAI model.";
    }
  } catch (error) {
    console.error("Error in formatORResponse:", error);
    return "Error: Unable to generate response.";
  }
}


async function updateIframeFromURL(url) {
  $('#upload-chooser').addClass("hidden");
  $('#url-upload-input').addClass("hidden");
  $('#url-upload-preview').removeClass("hidden");
  $("#url-frame").addClass("hidden"); //reset iframe hidden
  $("#url-invalid-msg").addClass("hidden");
  $("#canada-ca-msg").addClass("hidden");
  $("#other-site-msg").addClass("hidden");
  var bUrlInput = isValidUrl(url);
  if (bUrlInput == false) { //invalid url
    //unhide URL invalid message
    $("#url-invalid-msg").removeClass("hidden");
    $('#url-upload-input').removeClass("hidden");
    return;
  }
  const urlInput = new URL(url);
  // Currently configuring it to specific github organizations:
  if (urlInput.host == "cra-design.github.io" || urlInput.host == "gc-proto.github.io" || urlInput.host == "test.canada.ca" || urlInput.host == "cra-proto.github.io") { //github links
    	// Set the iframe src and handle the error
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
        let { extractedHtml, metadata, mainClassMatch } = await applySimpleHtmlTemplate(html);
        extractedHtml = await applyCanadaHtmlTemplate(extractedHtml, metadata, mainClassMatch);

        // Extract fields from the HTML
        const fields = extractFields(extractedHtml);
        // Render fields and page code
        renderHTMLFields(extractedHtml, fields);
        // Insert the processed HTML into the iframe
        refreshIframe("url-frame", extractedHtml);
    });
  } else { //unsupported site
    //unhide unsupported site message
    $("#other-site-msg").removeClass("hidden");
    $('#url-upload-input').removeClass("hidden");
  }
  //do we also want a tab to view the code? Maybe this is where we can make edits or changes with GenAI, then reload in the iframe? Could we do this with some html manipulation in the javascript of the already-loaded iframe? Or would we need to rebuild the page in the script?
}

// function formatGenAIHtmlResponse(genaiResponse) {
//   formattedHtml = genaiResponse
//     .replace(/^```|```$/g, '')
//     .replace(/^html/, '')
//     .trim();
//   formattedHtml = formatHTML(formattedHtml);
//   return formattedHtml;
// }

function formatGenAIHtmlResponse(genaiResponse) {
  let formattedHtml = genaiResponse;
  // Handle cases where ``` appears inside <p> tags
  formattedHtml = formattedHtml.replace(/<p>```html<\/p>/, '```html\n')
                               .replace(/<p>```<\/p>/, '\n```');
  // Extract content inside triple backticks if they exist
  const match = formattedHtml.match(/```(?:html)?\n([\s\S]*?)\n```/);
  if (match) {
    formattedHtml = match[1]; // Capture only the inner content
  }
  // Trim leading and trailing <p> and </p> tags
  formattedHtml = formattedHtml.replace(/^<p>/, '').replace(/<\/p>$/, '').trim();
  formattedHtml = formatHTML(formattedHtml);
  return formattedHtml;
}
