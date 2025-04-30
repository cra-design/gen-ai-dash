// js/image-alt.js
// Contains JS common to assistant tools, adapted specifically for image-alt-text.html
// Handles API key submission from URL or input, and provides common helper functions.

$(document).ready(function() {
    // Check if the key parameter exists in the URL
    var keyParam = getUrlParameter('key');
    var currentPath = window.location.pathname; // Keep this for potential future use

    if (keyParam) {
        var urlParam = getUrlParameter('url'); // Keep this, might be useful elsewhere
        // Update the *hidden* input for the key so we can reference it easily later
        $("#api-key").val(keyParam);
        // Also update the *display* input so the user sees the key from the URL
        $("#api-key-display").val(keyParam);
        // Hide the initial key entry box
        $('#api-key-entry').addClass("hidden");
        // Show the main tool area
        $('.after-key-unhide').removeClass("hidden");
        // Update links to carry the key parameter
        updateLinks('key=' + keyParam);

        // Specific logic for page-assistant preload (keep for reference, not active here)
        // if (urlParam && currentPath.includes('page-assistant.html')) {
        //   updateIframeFromURL(urlParam);
        // }
    } else {
        // If no key in URL, ensure the display input is empty (useful if user navigates back)
        $("#api-key-display").val('');
    }

    // Handle initial API Key submission
    $("#api-key-submit-btn").click(function(){
      // *** FIXED LINE: Read from the VISIBLE input field ***
      let key = $("#api-key-display").val().trim(); // Read from the visible input and trim whitespace

      if (!key) {
        // Show error if the input is empty
        $('#api-key-entry-error').removeClass("hidden");
      } else {
        // Hide error message if it was shown
        $('#api-key-entry-error').addClass("hidden");
        // Reload the page with the key as a URL parameter
        window.location.href = window.location.pathname + '?key=' + encodeURIComponent(key);
      }
    });

    // --- Change Key Popup Logic ---
    // Show the pop-up when the button is clicked (Assuming #changeKeyBtn exists)
    $('#changeKeyBtn').on('click', function() {
        // Pre-fill the popup with the current key from the hidden input
        $('#newKeyInput').val($("#api-key").val());
        $('#keyPopup').removeClass("hidden");
    });

    // Save the new key and update the URL and links
    $('#saveKeyBtn').on('click', function() { // Assuming #saveKeyBtn exists
        var newKey = $('#newKeyInput').val().trim(); // Assuming #newKeyInput exists
        if (newKey) {
            // Update the URL with the new key without full reload
            var newQueryString = updateUrlParameter('key', newKey);
            // Update all links on the page with the new key
            updateLinks(newQueryString);
            // Update the hidden API key input value directly
            $("#api-key").val(newKey);
            // Also update the display input if it exists and is visible
            if ($("#api-key-display").length && !$('#api-key-entry').hasClass('hidden')) {
                 $("#api-key-display").val(newKey);
            }
            // Hide the pop-up
            $('#keyPopup').addClass("hidden"); // Assuming #keyPopup exists
            $('#newKeyInput').val(''); // Clear popup input
        } else {
            alert("Please enter a new key."); // Or show error message in popup
        }
    });

    // Cancel and close the pop-up without saving
    $('#cancelKeyBtn').on('click', function() { // Assuming #cancelKeyBtn exists
        $('#keyPopup').addClass("hidden");
        $('#newKeyInput').val(''); // Clear popup input
    });
    // --- End Change Key Popup Logic ---


    // --- Other existing code from content-assistant.js ---

    /* Image Drop/Upload Area Code - Commented out as it wasn't being used
       and conflicts might arise with standard file input. Keep if needed later.
    $(function () {
      var dropZoneId = "image-drop-upload-area";
      // ... (rest of the commented out drag/drop code) ...
    })
    */

    // Tab interface toggle (Keep if tabs are used in any tool)
    $('.tabs ul li a').on('click', function (e) {
        e.preventDefault();
        $('.tabs ul li a').removeClass('active');
        $(this).addClass('active');
        $('.tab-content').addClass('hidden');
        const target = $(this).data('target');
        $(target).removeClass('hidden');
    });

    // GenAI menu ex-hide (Keep if right sidebar is used)
    $('#toggle-btn').click(function() {
        $('.r-navbar').toggleClass('expanded');
        $('#toggle-btn i').toggleClass('fa-angle-left fa-angle-right');
    });

}); // END OF $(document).ready()

// --- Helper Functions (Copied from content-assistant.js) ---

async function getORData(model, requestJson) {
    let ORjson;
    const apiKey = $("#api-key").val(); // Read key from hidden input (populated on load)

    if (!apiKey) {
        console.error("OpenRouter API Key is missing.");
        // Maybe show a user-friendly error message here?
        // e.g., $('#global-error-message').text("API Key is missing. Please refresh or submit a key.").show();
        return undefined; // Or throw an error
    }

    console.log("Request Body:", JSON.stringify({
        "model": model,
        "messages": requestJson
    })); // Log the request body for debugging

    try {
        // Using $.ajax as in the original code
        ORjson = await $.ajax({
            url: "https://openrouter.ai/api/v1/chat/completions",
            method: "POST",
            headers: {
                "Authorization": "Bearer " + apiKey,
                "Content-Type": "application/json",
                 // Optional: Add Referer header if OpenRouter requires it for free tier (check their docs)
                 // "HTTP-Referer": window.location.origin,
                 // "X-Title": "Content Assistant Tool", // Optional: Identify your app
            },
            data: JSON.stringify({
                "model": model,
                "messages": requestJson
            }),
            timeout: 90000 // Increase timeout (e.g., 90 seconds) for potentially long vision/translation tasks
        });

        // Basic check for response structure
        if (!ORjson || !ORjson.choices || !ORjson.choices.length > 0 || !ORjson.choices[0].message) {
             console.warn("Unexpected response structure from OpenRouter:", ORjson);
             // You might want to return a specific error object or throw here
             return undefined;
        }

    } catch (error) {
        console.error("Error fetching from OpenRouter API:", error.status, error.statusText, error.responseText, error);
        // Handle specific errors if needed (e.g., 401 Unauthorized, 429 Rate Limit)
        // You could display a more specific error to the user based on error.status
        return undefined; // Indicate failure
    }
    return ORjson;
}

const isValidUrl = urlString=> {
    // Simple check if it starts with http:// or https://
    if (!urlString || typeof urlString !== 'string') return false;
    return urlString.trim().startsWith('http://') || urlString.trim().startsWith('https://');
    // Original regex was more complex, kept simple version unless needed
    // try { return Boolean(new URL(urlString)); } catch(e){ return false; }
}

// Used by page-assistant, keep for potential reuse
function parsePageHTML(url, callback) {
    $.ajax({
        url: url, // Note: This might face CORS issues if fetching from different domains directly
        method: 'GET',
        success: function (response) {
            callback(null, response);
        },
        error: function (jqXHR, textStatus, errorThrown) {
            console.error("AJAX error fetching HTML:", textStatus, errorThrown, jqXHR.status);
            callback({ status: jqXHR.status, statusText: textStatus, error: errorThrown });
        }
    });
}

// Used by page-assistant, keep for potential reuse
function convertHtmlToText(html) {
    if (!html) return '';
    var tempDiv = document.createElement('div');
    // Replace block elements and BRs with newlines *before* putting into div
    html = html.replace(/<\/(p|div|h[1-6]|ul|ol|li|table|tr|td|th)>/gi, '\n');
    html = html.replace(/<br\s*\/?>/gi, '\n');
    tempDiv.innerHTML = html;
    // Get text content and clean up multiple newlines/whitespace
    return (tempDiv.textContent || tempDiv.innerText || "").replace(/\n\s*\n/g, '\n').trim();
}

// General HTML formatting using js-beautify (ensure beautify.js is loaded)
function formatHTML(htmlString) {
    if (typeof html_beautify === 'function') {
        return html_beautify(htmlString || '', { indent_size: 2, space_in_empty_paren: true });
    } else {
        console.warn("html_beautify not found. Returning raw HTML.");
        return htmlString || '';
    }
}

// General AI response formatting (Markdown-like to HTML)
function formatAIResponse(aiResponse) {
    if (!aiResponse) return '';
    // Chain replacements carefully
    let html = aiResponse;
    // Handle potential code blocks first (simple version, might need improvement)
    html = html.replace(/```(.*?)```/gs, '<pre><code>$1</code></pre>');
    // Bold, Italics
    html = html.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
    html = html.replace(/\*(.*?)\*/g, "<em>$1</em>");
    // Basic list conversion (assuming - at start of line)
    html = html.replace(/^\s*-\s+(.*)/gm, "<li>$1</li>");
    // Wrap consecutive LIs in ULs (might need refinement for complex lists)
    html = html.replace(/<\/li>\s*<li>/g, '</li><li>'); // Normalize spacing
    html = html.replace(/(<li>.*?<\/li>)/gs, '<ul>$1</ul>');
    // Replace standalone UL wrappers if nested incorrectly (basic cleanup)
    html = html.replace(/<\/ul>\s*<ul>/g, '');
    // Wrap remaining lines (not part of pre or ul) in paragraphs
    html = html.split('\n').map(line => {
        const trimmed = line.trim();
        if (trimmed === '' || trimmed.startsWith('<pre>') || trimmed.startsWith('<ul>') || trimmed.startsWith('<li>')) {
            return line; // Keep lines that are already structured or empty
        }
        return `<p>${line}</p>`; // Wrap others
    }).join('');
    // Remove empty paragraphs possibly created
    html = html.replace(/<p>\s*<\/p>/g, '');
    return html;
}

// XML cleanup (seems specific, keep if used)
function ensureCompleteXML(xml) {
  if (!xml) return '';
  xml = xml.replace(/^```xml\s*/, "").replace(/\s*```$/, "").trim();
  const marker = "[END_OF_XML]";
  const markerIndex = xml.indexOf(marker);
  if (markerIndex !== -1) {
    xml = xml.substring(0, markerIndex).trim();
  }
  // Basic check and append for closing tags - might be too simplistic
  if (!xml.includes("</w:body>")) {
      xml += "\n</w:body>";
  }
  if (!xml.includes("</w:document>")) {
    xml += "\n</w:document>";
  }
  return xml;
}

// UI helper for side-by-side comparison (keep if used)
function toggleComparisonElement(eleA, eleB) {
    if (!eleA || !eleB || eleA.length === 0 || eleB.length === 0) return;
    if (eleB.hasClass('hidden')) {
      eleB.removeClass('hidden');
      eleA.css('width', '50%');
      eleB.css('width', '50%');
    } else {
      eleB.addClass('hidden');
      eleA.css('width', '100%');
      eleB.css('width', ''); // Reset width if needed
    }
}

// Text chunking helpers (keep if large text processing is needed)
function estimateTokens(text) {
    if (!text) return 0;
    let words = text.match(/\b\w+\b/g) || [];
    return Math.ceil(words.length * 1.3); // Adjusted ratio (safer)
}

function chunkText(text, maxTokens) {
    if (!text) return [];
    // Simple split by paragraphs first, then words if needed
    const paragraphs = text.split(/(\n\s*\n)/); // Split and keep delimiters
    let chunks = [];
    let currentChunk = "";
    let currentTokenCount = 0;

    paragraphs.forEach(part => {
        if (!part.trim()) return; // Skip empty parts/delimiters

        let partTokens = estimateTokens(part);
        if (currentTokenCount + partTokens <= maxTokens) {
            currentChunk += part;
            currentTokenCount += partTokens;
        } else {
            // If the current chunk is not empty, push it
            if (currentChunk.trim()) {
                chunks.push(currentChunk.trim());
            }
            // If the new part itself exceeds maxTokens, it needs further splitting (basic word split)
            if (partTokens > maxTokens) {
                let words = part.match(/\b\w+\b/g) || [];
                let subChunk = "";
                let subTokenCount = 0;
                words.forEach(word => {
                    let wordTokens = estimateTokens(word);
                    if (subTokenCount + wordTokens > maxTokens) {
                        chunks.push(subChunk.trim());
                        subChunk = word + " ";
                        subTokenCount = wordTokens;
                    } else {
                        subChunk += word + " ";
                        subTokenCount += wordTokens;
                    }
                });
                if (subChunk.trim()) chunks.push(subChunk.trim());
                currentChunk = ""; // Reset main chunk
                currentTokenCount = 0;
            } else {
                // Start a new chunk with the current part
                currentChunk = part;
                currentTokenCount = partTokens;
            }
        }
    });

    if (currentChunk.trim()) {
        chunks.push(currentChunk.trim());
    }
    return chunks;
}


// URL Parameter Helpers
function getUrlParameter(name) {
    name = name.replace(/[\[]/, '\\[').replace(/[\]]/, '\\]');
    var regex = new RegExp('[\\?&]' + name + '=([^&#]*)');
    var results = regex.exec(location.search);
    return results === null ? null : decodeURIComponent(results[1].replace(/\+/g, ' '));
}

function updateLinks(queryString) {
    $('a[href]').each(function() {
        var $link = $(this);
        var href = $link.attr('href');
        if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:') || href.startsWith('javascript:')) {
            return; // Skip anchors, mailto, tel, javascript links
        }
        try {
            // Check if it's an absolute URL pointing to a different origin
            var linkUrl = new URL(href, window.location.origin); // Resolve relative URLs
            if (linkUrl.origin !== window.location.origin) {
                return; // Skip external links
            }
            // Process internal or relative links
            var baseUrl = linkUrl.pathname;
            var existingParams = new URLSearchParams(linkUrl.search);
            var newParams = new URLSearchParams(queryString); // Params to add/update

            newParams.forEach((value, key) => {
                existingParams.set(key, value); // Update or add key
            });

            var newHref = baseUrl + '?' + existingParams.toString() + linkUrl.hash;
            $link.attr('href', newHref);

        } catch (e) {
            console.warn(`Could not parse or update link href: ${href}`, e);
            // If it's not a valid URL structure (e.g., relative path without leading /), handle carefully
             if (!href.match(/^(https?:|#|mailto:|tel:|javascript:)/)) {
                 // Simple relative path logic (might not handle complex cases well)
                 var basePart = href.split('?')[0].split('#')[0];
                 var hashPart = href.includes('#') ? '#' + href.split('#')[1] : '';
                 var queryPart = href.includes('?') ? href.split('?')[1].split('#')[0] : '';

                 var oldParams = new URLSearchParams(queryPart);
                 var paramsToAdd = new URLSearchParams(queryString);
                 paramsToAdd.forEach((value, key) => oldParams.set(key, value));

                 var finalHref = basePart + '?' + oldParams.toString() + hashPart;
                 $link.attr('href', finalHref);
             }
        }
    });
}


// Updates URL parameter without page reload using History API
function updateUrlParameter(param, value) {
    var urlParams = new URLSearchParams(window.location.search);
    urlParams.set(param, value);
    var newUrl = window.location.pathname + '?' + urlParams.toString() + window.location.hash;
    // Use replaceState to avoid creating new history entries for key changes
    window.history.replaceState({ path: newUrl }, '', newUrl);
    return urlParams.toString(); // Return the new query string
}

// Iframe refresh helper (keep if needed)
function refreshIframe(id, html) {
    let iframe = document.getElementById(id);
    if (iframe) {
        try {
            let iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
            iframeDoc.open();
            iframeDoc.write(html || ''); // Ensure html is defined
            iframeDoc.close();
            // WET theme integration (keep if applicable)
            if (typeof wb !== 'undefined' && wb.allSelectors) {
                setTimeout(() => {
                  let $iframeBody = $(iframe.contentWindow.document.body);
                  $iframeBody
                    .find(wb.allSelectors)
                    .addClass("wb-init")
                    .filter(":not(.wb-init .wb-init)")
                    .trigger("timerpoke.wb");
                }, 100); // Increased timeout slightly
            }
        } catch (e) {
            console.error("Error writing to iframe:", e);
             hideAllSpinners();
        }
    } else {
        console.warn("Iframe with id " + id + " not found.");
        hideAllSpinners();
    }
}

function hideAllSpinners() {
  // More robust selector to find spinners within visible progress areas or generic spinners
  $(".spinner").closest('div:not(.hidden)').addClass("hidden");
  // Or specifically target known spinner containers if they have IDs/classes
  // $('#progress-area').addClass('hidden');
}

// Report generation helpers (keep if side-by-side reports are used)
function createBasicReport(labelText, formattedText) {
  // Ensure formattedText is an object with at least 'a' property
  const textContent = formattedText && formattedText.a ? formattedText.a : '[No content available]';
  return $(
    '<div class="generated-report basic-report">' + // Added class
      '<h4>' + (labelText || 'Report') + '</h4>' +
      '<div>' + textContent + '</div>' + // Changed to div for flexibility
    '</div>'
  );
}

function createSideBySideReport(counter, labelText, formattedText, model) {
    // Ensure formattedText is an object, provide defaults
    const textA = formattedText && formattedText.a ? formattedText.a : '[Content A not available]';
    const textB = formattedText && formattedText.b ? formattedText.b : '[Content B not available]';
    // Ensure model is an array, provide defaults
    const modelA = model && model[0] ? model[0] : '[Model A unknown]';
    const modelB = model && model[1] ? model[1] : (model && model[0] ? model[0] : '[Model B unknown]'); // Default B to A if only one provided

    const reportIdA = `report-container-A-${counter}`;
    const reportIdB = `report-container-B-${counter}`;
    const toolboxIdA = `report-toolbox-A-${counter}`;
    const toolboxIdB = `report-toolbox-B-${counter}`;
    const titleIdA = `report-A-title-${counter}`;
    const titleIdB = `report-B-title-${counter}`;

    const modelInfoA = `<p class="small model-info">Model: ${modelA}</p>`;
    const modelInfoB = `<p class="small model-info">Model: ${modelB}</p>`;

  return $(`
    <div class="sidebyside-wrapper generated-report">
      <h4>${labelText || 'Comparison Report'}</h4>
      <div style="display: flex; gap: 15px;"> <!-- Flex container -->
          <div id="${reportIdA}" class="sidebyside-container report-container-A" style="flex: 1; border: 1px solid #eee; padding: 10px; position: relative;">
            <div id="${toolboxIdA}" class="toolbar" style="position: absolute; top: 5px; right: 5px;">
              <button class="toolbar-button" id="accept-report-a-btn-${counter}" title="Accept A">
                <i class="fa fa-check"></i>
              </button>
            </div>
            <div class="sidebyside-report">
              <h5 id="${titleIdA}">Option A</h5>
              <div>${textA}</div>
              ${modelInfoA}
            </div>
          </div>
          <div id="${reportIdB}" class="sidebyside-container report-container-B" style="flex: 1; border: 1px solid #eee; padding: 10px; position: relative;">
            <div id="${toolboxIdB}" class="toolbar" style="position: absolute; top: 5px; right: 5px;">
              <button class="toolbar-button" id="accept-report-b-btn-${counter}" title="Accept B">
                <i class="fa fa-check"></i>
              </button>
            </div>
            <div class="sidebyside-report">
              <h5 id="${titleIdB}">Option B</h5>
              <div>${textB}</div>
              ${modelInfoB}
            </div>
          </div>
      </div> <!-- End flex container -->
    </div>
  `);
}

// File Extraction Helpers (Keep, but note they are not currently used by image-alt-text.js main flow)
// These might be useful if extending functionality later.

async function handleFileExtraction(file) { /* ... original code ... */ }
async function handleFileExtractionToHtml(file) { /* ... original code ... */ }
function handleFileExtractionToXML(file, successCallback, errorCallback) { /* ... original code ... */ }
function extractPlainTextFromHtml(html) { /* ... original code ... */ }

// --- End Helper Functions ---
