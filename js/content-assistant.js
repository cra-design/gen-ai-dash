//Includes JS common to all of the content assistant tools
$(document).ready(function() {
    // Check if the key parameter exists
    var keyParam = getUrlParameter('key');
    var currentPath = window.location.pathname;
    if (keyParam) {
        var urlParam = getUrlParameter('url');
        //update the hidden input for the key so we can reference it as usual
        $("#api-key").val(keyParam);
        // Hide the input box if the key parameter is present
        $('#api-key-entry').addClass("hidden");
        // You can trigger the next questions or blocks after the key is confirmed here
        $('.after-key-unhide').removeClass("hidden");
        // Get the current URL's query string (e.g., ?key=value&other=param)
        updateLinks('key=' + keyParam); // Passing only the key param here
        if (urlParam && currentPath.includes('page-assistant.html')) {
          //preload the page
          updateIframeFromURL(urlParam);
        }
    }
    $("#api-key-submit-btn").click(function(){
      //validate the key to see if it's legit?
      // Reload the page with the key as a URL parameter
      let key = $("#api-key").val();
      if (!key) {
        $('#api-key-entry-error').removeClass("hidden");
      } else {
        window.location.href = window.location.pathname + '?key=' + encodeURIComponent(key);
      }
    });

    // Show the pop-up when the button is clicked
    $('#changeKeyBtn').on('click', function() {
        $('#keyPopup').removeClass("hidden");
    });
    // Save the new key and update the URL and links
    $('#saveKeyBtn').on('click', function() {
        var newKey = $('#newKeyInput').val().trim();
        if (newKey) {
            // Update the URL with the new key
            var newQueryString = updateUrlParameter('key', newKey);
            // Update all links on the page with the new key
            updateLinks(newQueryString);
            // Hide the pop-up
            $('#keyPopup').addClass("hidden");
            $('#newKeyInput').val('');
        }
    });
    // Cancel and close the pop-up without saving
    $('#cancelKeyBtn').on('click', function() {
        $('#keyPopup').addClass("hidden");
        $('#newKeyInput').val('');
    });




  /*
  $(function () {
  var dropZoneId = "image-drop-upload-area";
  var buttonId = "file-upload-btn";
  var mouseOverClass = "mouse-over";

  var dropZone = $("#" + dropZoneId);
  var ooleft = dropZone.offset().left;
  var ooright = dropZone.outerWidth() + ooleft;
  var ootop = dropZone.offset().top;
  var oobottom = dropZone.outerHeight() + ootop;
  var inputFile = dropZone.find("input");
  document.getElementById(dropZoneId).addEventListener("dragover", function (e) {
  e.preventDefault();
  e.stopPropagation();
  dropZone.addClass(mouseOverClass);
  var x = e.pageX;
  var y = e.pageY;

  if (!(x < ooleft || x > ooright || y < ootop || y > oobottom)) {
    inputFile.offset({ top: y - 15, left: x - 100 });
  } else {
    inputFile.offset({ top: -400, left: -400 });
  }

  }, true);

  if (buttonId != "") {
  var clickZone = $("#" + buttonId);

  var oleft = clickZone.offset().left;
  var oright = clickZone.outerWidth() + oleft;
  var otop = clickZone.offset().top;
  var obottom = clickZone.outerHeight() + otop;

  $("#" + buttonId).mousemove(function (e) {
    var x = e.pageX;
    var y = e.pageY;
    if (!(x < oleft || x > oright || y < otop || y > obottom)) {
      inputFile.offset({ top: y - 15, left: x - 160 });
    } else {
      inputFile.offset({ top: -400, left: -400 });
    }
  });
  }

  document.getElementById(dropZoneId).addEventListener("drop", function (e) {
  $("#" + dropZoneId).removeClass(mouseOverClass);
  }, true);

  })
  */



  //tab interface toggle
  $('.tabs ul li a').on('click', function (e) {
    e.preventDefault();
    $('.tabs ul li a').removeClass('active');
    $(this).addClass('active');
    $('.tab-content').addClass('hidden');
    const target = $(this).data('target');
    $(target).removeClass('hidden');
  });

  //GenAI menu ex-hide
  $('#toggle-btn').click(function() {
      $('.r-navbar').toggleClass('expanded');
      $('#toggle-btn i').toggleClass('fa-angle-left fa-angle-right');
  });


});

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

const isValidUrl = urlString=> {
    try {
        return Boolean(new URL(urlString));
    }
    catch(e){
        return false;
    }
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

function convertHtmlToText(html) {
    // Create a temporary HTML element to parse the HTML content
    var div = document.createElement('div');
    div.innerHTML = html;

    // Replace block-level elements and <br> tags with line breaks
    var textContent = div.textContent || div.innerText;

    // Replace <p>, <div>, <h1>, <h2>, etc. tags with line breaks (\n)
    textContent = textContent.replace(/(<\/p>|<\/div>|<\/h1>|<\/h2>|<\/ul>|<\/ol>|<\/li>)/g, "\n");
    textContent = textContent.replace(/(<br\s*\/?>)/g, "\n");  // Handle <br> tags

    // Normalize extra line breaks (if any)
    textContent = textContent.replace(/\n+/g, "\n").trim();  // Remove excess newlines

    return textContent;
}

function formatHTML(htmlString) {
    // // Create a new DOMParser instance
    // const parser = new DOMParser();
    // // Parse the HTML string into a Document
    // const doc = parser.parseFromString(htmlString, 'text/html');
    // // Serialize the Document back to a string with indentation
    // const formattedHTML = doc.documentElement.outerHTML;
    // Assuming htmlString contains your unformatted HTML
    // Return the formatted HTML
    return html_beautify(htmlString, { indent_size: 2, space_in_empty_paren: true });
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

// Helper function: remove code fences, marker, and ensure the XML is complete.
function ensureCompleteXML(xml) {
  xml = xml.replace(/^```xml\s*/, "").replace(/\s*```$/, "").trim();
  const marker = "[END_OF_XML]";
  const markerIndex = xml.indexOf(marker);
  if (markerIndex !== -1) {
    xml = xml.substring(0, markerIndex).trim();
  }
  if (!xml.endsWith("</w:document>")) {
    if (!xml.includes("</w:body>")) {
      xml += "\n</w:body>";
    }
    xml += "\n</w:document>";
  }
  return xml;
}

//Displays a side-by-side element for comparison and changes both to 50% width, or toggles the 2nd off and eleA back to 100% width
function toggleComparisonElement(eleA, eleB) {
    if (eleB.hasClass('hidden')) {
      // Show the second iframe
      eleB.removeClass('hidden');
      eleA.css('width', '50%');
      eleB.css('width', '50%');
    } else {
      // Hide the second iframe
      eleB.addClass('hidden');
      eleA.css('width', '100%');
    }
}

//For large documents, they may exceed the token limit of the API, so we need to break them down
function estimateTokens(text) {
    // Roughly estimate token count based on word count
    let words = text.match(/\b\w+\b/g) || [];
    return Math.ceil(words.length / 0.75); // Approximate word-to-token ratio
}

function chunkText(text, maxTokens) {
    let words = text.match(/\b\w+\b/g) || [];
    let chunks = [];
    let currentChunk = [];
    let tokenCount = 0;

    words.forEach(word => {
        let wordTokens = Math.ceil(word.length / 4); // Rough estimate of token count per word
        if (tokenCount + wordTokens > maxTokens) {
            chunks.push(currentChunk.join(" "));
            currentChunk = [];
            tokenCount = 0;
        }
        currentChunk.push(word);
        tokenCount += wordTokens;
    });

    if (currentChunk.length > 0) {
        chunks.push(currentChunk.join(" "));
    }

    return chunks;
}

// Function to get URL parameters
function getUrlParameter(name) {
    var results = new RegExp('[?&]' + name + '=([^&#]*)').exec(window.location.href);
    return results ? decodeURIComponent(results[1]) : null;
}

function updateLinks(queryString) {
    $('a[href]').each(function() {
        var href = $(this).attr('href');
        // Check if the link is a relative URL (does not start with http, https, mailto, tel, or #)
        if (!href.match(/^(https?:|mailto:|tel:|#)/)) {
            // Separate the base URL and the anchor (if exists)
            var baseUrl = href.split('#')[0];
            var anchor = href.indexOf('#') !== -1 ? href.split('#')[1] : '';
            // Replace the existing 'key' parameter or add the new 'key' parameter
            baseUrl = baseUrl.replace(/([?&])key=[^&#]*/, '$1' + queryString);
            // If no 'key' parameter exists, append the new 'key' parameter
            if (!baseUrl.match(/([?&])key=[^&#]*/)) {
                // Check if there are already query parameters
                if (baseUrl.indexOf('?') > -1) {
                    baseUrl += '&' + queryString;
                } else {
                    baseUrl += '?' + queryString;
                }
            }
            // Reattach the anchor (if it existed)
            href = baseUrl + (anchor ? '#' + anchor : '');
            $(this).attr('href', href);
        }
    });
}


// Function to update URL without reloading the page
function updateUrlParameter(param, value) {
    var baseUrl = window.location.pathname;
    var urlParams = new URLSearchParams(window.location.search);
    // Update or set the parameter
    urlParams.set(param, value);
    // Construct the new URL
    var newUrl = baseUrl + '?' + urlParams.toString();
    // Update the browser's URL without refreshing
    window.history.replaceState(null, '', newUrl);
    // Return the new query string
    return urlParams.toString();
}

// // Example usage:
// let text = "Your long document content goes here...";
// let maxTokens = 1000; // Adjust token limit as needed
// let chunks = chunkText(text, maxTokens);
//
// console.log(chunks);

function refreshIframe(id, html) {
  // Insert the processed HTML into the iframe
  let iframe = document.getElementById(id);
  if (iframe) {
    let iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
    iframeDoc.open();
    iframeDoc.write(html);
    iframeDoc.close();
    iframeDoc
    // Ensure scripts inside the iframe run
    setTimeout(() => {
      let $iframeBody = $(iframe.contentWindow.document.body);
      $iframeBody
        .find(wb.allSelectors)
        .addClass("wb-init")
        .filter(":not(.wb-init .wb-init)")
        .trigger("timerpoke.wb");
    }, 50);
  } else {
    console.error("Iframe with id " + id + " not found.");
    hideAllSpinners(); // Consolidated UI hiding
  }
}

function hideAllSpinners() {
  $(".spinner").closest('div').addClass("hidden");
}

// Function to create a basic report
function createBasicReport(labelText, formattedText) {
  return $(
    '<div class="generated-report sidebyside-container">' +
      '<h4>' + labelText + '</h4>' +
      '<p>' + formattedText.a + '</p>' +
    '</div>'
  );
}

// Function to create a side-by-side report
function createSideBySideReport(counter, labelText, formattedText, model) {
  const reportIdA = `report-container-A-${counter}`;
  const reportIdB = `report-container-B-${counter}`;
  const toolboxIdA = `report-toolbox-A-${counter}`;
  const toolboxIdB = `report-toolbox-B-${counter}`;
  const titleIdA = `report-A-title-${counter}`;
  const titleIdB = `report-B-title-${counter}`;
  // Conditionally add model info
  const modelInfoA = `<p class="small">${model[0]}</p>`;
  const modelInfoB = model[1] ? `<p class="small">${model[1]}</p>` : `<p class="small">${model[0]}</p>`;


  return $(`
    <div class="sidebyside-wrapper generated-report">
      <div id="${reportIdA}" class="sidebyside-container report-container-A">
        <div id="${toolboxIdA}" class="toolbar">
          <button class="toolbar-button" id="accept-report-a-btn-${counter}" title="Accept A">
            <i class="fa fa-check"></i>
          </button>
        </div>
        <div class="sidebyside-report">
          <h4 id="${titleIdA}">${labelText} (A)</h4>
          <p>${formattedText.a}</p>
          ${modelInfoA}
        </div>
      </div>
      <div id="${reportIdB}" class="sidebyside-container report-container-B">
        <div id="${toolboxIdB}" class="toolbar">
          <button class="toolbar-button" id="accept-report-b-btn-${counter}" title="Accept B">
            <i class="fa fa-check"></i>
          </button>
        </div>
        <div class="sidebyside-report">
          <h4 id="${titleIdB}">${labelText} (B)</h4>
          <p>${formattedText.b}</p>
          ${modelInfoB}
        </div>
      </div>
    </div>
  `);
}

async function handleFileExtraction(file) {
    return new Promise((resolve, reject) => {
        if (!file) {
            reject("No file detected");
            return;
        }
        const fileExtension = file.name.split('.').pop().toLowerCase();
        var reader = new FileReader();
        reader.onload = function (e) {
            var arrayBuffer = e.target.result;
            if (fileExtension === "docx") {
                mammoth.extractRawText({ arrayBuffer: arrayBuffer })
                    .then(result => resolve(result.value))
                    .catch(err => reject(err));
            } else if (fileExtension === "pptx") {
                var pptx = new PptxGenJS();
                pptx.load(arrayBuffer);
                var slidesText = pptx.getSlides().map(slide => slide.getText().join(' ')).join('\n');
                resolve(slidesText);
            } else if (fileExtension === "xlsx") {
                var workbook = XLSX.read(arrayBuffer, { type: "array" });
                var sheet = workbook.Sheets[workbook.SheetNames[0]];
                var excelText = XLSX.utils.sheet_to_csv(sheet);
                resolve(excelText);
            } else {
                reject("Unsupported file type");
            }
        };
        reader.onerror = function () {
            reject("Error reading file.");
        };

        reader.readAsArrayBuffer(file);
    });
}

async function handleFileExtractionToHtml(file) {
    return new Promise((resolve, reject) => {
        if (!file) {
            reject("No file detected");
            return;
        }
        const fileExtension = file.name.split('.').pop().toLowerCase();
        var reader = new FileReader();
        reader.onload = function (e) {
            var arrayBuffer = e.target.result;
            if (fileExtension === "docx") {
                mammoth.convertToHtml({ arrayBuffer: arrayBuffer })
                    .then(result => resolve(result.value))
                    .catch(err => reject(err));
            } else if (fileExtension === "pptx") {
                JSZip.loadAsync(arrayBuffer).then(zip => {
                  let slideTexts = [];
                  let promises = [];

                  zip.forEach((relativePath, file) => {
                      if (relativePath.startsWith("ppt/slides/") && relativePath.endsWith(".xml")) {
                          promises.push(file.async("text").then(xml => {
                              return xml2js.parseStringPromise(xml).then(result => {
                                  let texts = result["p:sld"]["p:cSld"][0]["p:spTree"][0]["p:sp"]
                                      .map(sp => sp["p:txBody"]?.[0]?.["a:p"]?.map(p => p["a:r"]?.map(r => r["a:t"]?.join(' ')).join(' ')).join(' '))
                                      .filter(Boolean)
                                      .join("\n");
                                  slideTexts.push(texts);
                              });
                          }));
                      }
                  });
                  Promise.all(promises).then(() => resolve(slideTexts.join("\n"))).catch(err => reject(err));
                });
            } else if (fileExtension === "xlsx") {
                // Convert XLSX to formatted HTML table
                var workbook = XLSX.read(arrayBuffer, { type: "array" });
                let htmlTables = workbook.SheetNames.map(sheetName =>
                    XLSX.utils.sheet_to_html(workbook.Sheets[sheetName])
                ).join("<br><br>");
                resolve(htmlTables);
            } else {
                reject("Unsupported file type");
            }
        };
        reader.onerror = function () {
            reject("Error reading file.");
        };

        reader.readAsArrayBuffer(file);
    });
}

// Function to handle file extraction
function handleFileExtractionToXML(file, successCallback, errorCallback) {
    if (!file) {
        alert("No file detected");
        errorCallback("No file detected");
        return;
    }
    const fileExtension = file.name.split('.').pop().toLowerCase();
    // Ensure we're processing a .docx file
    if (fileExtension === 'docx') {
        var reader = new FileReader();
        reader.onload = function(e) {
            var arrayBuffer = e.target.result;
            // Use PizZip to read the .docx file
            const zip = new PizZip(arrayBuffer);
            // Extract the main document XML
            const documentXml = zip.file("word/document.xml")?.asText();
            if (documentXml) {
                // console.log("Document XML:", documentXml);
                successCallback(documentXml);  // Pass the extracted XML to the callback
            } else {
                errorCallback("Error: Could not find 'word/document.xml' in the DOCX.");
            }
        };
        reader.readAsArrayBuffer(file);  // Read the file as ArrayBuffer
    } else {
        errorCallback("Error: Unsupported file type. Only DOCX files are supported.");
    }
}

// Function to extract plain text from HTML and replace <br> tags with newline
function extractPlainTextFromHtml(html) {
    // Replace <br>, <br/> and <br /> tags with newline characters in the raw HTML
    var modifiedHtml = html.replace(/<br\s*\/?>/g, '</p><p>'); // Regular expression to match <br>, <br/> and <br />
    // var modifiedHtml = html.replace('<p>', '<p> '); // Regular expression to match <br>, <br/> and <br />

    // Create a temporary div element to use the browser's HTML parsing functionality
    var div = document.createElement('div');
    div.innerHTML = modifiedHtml;  // Set the HTML content (with newlines replacing <br>)

    // Extract the plain text, which now includes newlines
    return div.textContent || div.innerText;  // Browser-specific property for extracting plain text
}
