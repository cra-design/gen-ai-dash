// js/image-alt.js
// Contains JS common to assistant tools, adapted specifically for image-alt-text.html
// Handles API key submission from URL or input, and provides common helper functions.
// Includes conditional prompts for PDF processing based on selected vision model.

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
    // Note: Assumes the corresponding HTML elements (#changeKeyBtn, #keyPopup, #newKeyInput, #saveKeyBtn, #cancelKeyBtn) exist if this feature is desired.
    // If they don't exist in image-alt-text.html, these listeners won't do anything harmful.

    // Show the pop-up when the button is clicked
    $('#changeKeyBtn').on('click', function() {
        // Pre-fill the popup with the current key from the hidden input
        $('#newKeyInput').val($("#api-key").val());
        $('#keyPopup').removeClass("hidden");
    });

    // Save the new key and update the URL and links
    $('#saveKeyBtn').on('click', function() {
        var newKey = $('#newKeyInput').val().trim();
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
            $('#keyPopup').addClass("hidden");
            $('#newKeyInput').val(''); // Clear popup input
        } else {
            alert("Please enter a new key."); // Or show error message in popup
        }
    });

    // Cancel and close the pop-up without saving
    $('#cancelKeyBtn').on('click', function() {
        $('#keyPopup').addClass("hidden");
        $('#newKeyInput').val(''); // Clear popup input
    });
    // --- End Change Key Popup Logic ---


    // --- Other existing code from content-assistant.js ---

    /* Image Drop/Upload Area Code - Commented out
    $(function () {
      // ... (rest of the commented out drag/drop code) ...
    })
    */

    // Tab interface toggle (Keep if tabs are used)
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


// =====================================================================
// == CORE IMAGE/PDF PROCESSING LOGIC FOR image-alt-text.js           ==
// =====================================================================

// Import PDF.js - Make sure the path is correct relative to your HTML file
// Note: This relies on the HTML including this script with type="module"
// and PDF.js files being available at the specified paths.
let pdfjsLib;
try {
    // Dynamically import if possible (better for non-module scripts)
    import('./pdfjs/pdf.mjs').then(module => {
        pdfjsLib = module;
        // Set worker source - IMPORTANT: Adjust path as needed
        pdfjsLib.GlobalWorkerOptions.workerSrc = './js/pdfjs/pdf.worker.mjs';
        console.log("PDF.js library loaded dynamically.");
    }).catch(err => {
        console.error("Failed to load PDF.js dynamically. Ensure it's included correctly and paths are right.", err);
        // Provide fallback or error message to user if PDF processing is critical
        alert("Error: PDF processing library could not be loaded. PDF uploads may fail.");
    });
} catch (e) {
     console.error("Dynamic import not supported or failed. Ensure PDF.js is loaded.", e);
     alert("Error: PDF processing library could not be loaded. PDF uploads may fail.");
}


$(document).ready(function() {
    // --- State Variables ---
    let processedFilesData = {}; // Stores results { filename: { type: 'image'/'pdf', status: 'processing'/'completed'/'error'/'partial_error', data: [...] } }
    let filesInProgress = 0;
    const MAX_IMAGE_SIZE = 1024; // Max width/height for resizing

    // --- Event Listeners ---

    // File Uploader Change Event
    $('#file-uploader').on('change', async function(event) {
        // Check if PDF.js loaded before proceeding with PDFs
        if (!pdfjsLib && Array.from(event.target.files).some(f => f.type === 'application/pdf')) {
             alert("PDF library not loaded. Cannot process PDF files.");
             $('#file-uploader').val(''); // Clear selection
             return;
        }

        const files = event.target.files;
        if (!files || files.length === 0) {
            return;
        }

        // Check for API key (should be populated by this script's ready() function)
        if (!$("#api-key").val()) {
            alert("OpenRouter API Key is missing. Please submit a key first.");
            $('#file-uploader').val('');
            return;
        }


        const newFiles = Array.from(files).filter(f => !processedFilesData[f.name] || processedFilesData[f.name].status === 'error'); // Allow retrying failed files

        if (newFiles.length > 0) {
            $('#progress-area').removeClass('hidden');
            $('#progress-bar').val(0);
            $('#progress-text').text(`Starting processing for ${newFiles.length} file(s)...`);
            filesInProgress = newFiles.length;

            let processedCount = 0;
            // $('#results-display').prepend(`<h3>Processing ${newFiles.length} new file(s)...</h3>`); // Initial message - can be noisy

            for (const file of newFiles) {
                // Reset status if retrying an error
                 processedFilesData[file.name] = { // Placeholder/Reset
                    type: file.type === 'application/pdf' ? 'pdf' : 'image',
                    status: 'processing',
                    data: [], // For PDF pages or single image data
                    error: null // Clear previous error
                 };
                 // Ensure result display area for this file exists or is cleared
                 displayResult(file.name); // Will create/clear the container

                 try {
                    $('#progress-text').text(`Processing: ${file.name} (${processedCount + 1}/${filesInProgress})`);
                     if (file.type === 'application/pdf') {
                         await processPdf(file);
                     } else if (file.type.startsWith('image/')) {
                         await processImage(file);
                     } else {
                         console.warn(`Unsupported file type: ${file.name} (${file.type})`);
                         processedFilesData[file.name].status = 'error';
                         processedFilesData[file.name].error = 'Unsupported file type';
                         displayResult(file.name); // Display error message
                     }
                 } catch (error) {
                     console.error(`Error processing ${file.name}:`, error);
                      processedFilesData[file.name].status = 'error';
                      processedFilesData[file.name].error = error.message || 'Processing failed';
                      displayResult(file.name); // Display error message
                 } finally {
                     processedCount++;
                     $('#progress-bar').val((processedCount / filesInProgress) * 100);
                     if (processedCount === filesInProgress) {
                        $('#progress-text').text(`Processing complete. ${processedCount} file(s) attempted.`);
                         updateCsvLink();
                         setTimeout(() => $('#progress-area').addClass('hidden'), 3000);
                     }
                 }
            }
             $('#file-uploader').val(''); // Clear file input
        } else {
             alert("No new files selected or all selected files have been processed successfully.");
             $('#file-uploader').val('');
        }
    });

    // Model Selection Change Event (Reset state)
    $('#vision-model-select').on('change', function() {
        console.log("Model changed, resetting state.");
        processedFilesData = {}; // Clear processed data
        $('#results-display').empty(); // Clear displayed results
        $('#csv-download-area').empty(); // Clear download link
        $('#file-uploader').val(''); // Clear file input
        alert("Vision model changed. Please re-upload files if you want to process them with the new model.");
    });

    // Event delegation for copy buttons
    $('#results-display').on('click', '.copy-button', function() {
        const textToCopy = $(this).data('copytext');
        const button = $(this);
        navigator.clipboard.writeText(textToCopy).then(() => {
            button.text('Copied!');
            setTimeout(() => button.text('Copy Text'), 2000); // Reset after 2s
        }).catch(err => {
            console.error('Failed to copy text: ', err);
            button.text('Copy Failed');
             setTimeout(() => button.text('Copy Text'), 2000);
        });
    });

    // --- Processing Functions ---

    async function processImage(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    const img = new Image();
                    img.onload = async () => {
                        const canvas = resizeImageIfNeeded(img, MAX_IMAGE_SIZE);
                        const base64Data = canvas.toDataURL('image/png');
                        const base64SizeKB = (base64Data.length * 0.75) / 1024;
                        console.log(`${file.name} - Base64 size: ${base64SizeKB.toFixed(2)} KB`);

                        const analysisResult = await getVisionAnalysis(base64Data, file.name, false);

                        processedFilesData[file.name].status = analysisResult.error ? 'error' : 'completed';
                        processedFilesData[file.name].error = analysisResult.error;
                        processedFilesData[file.name].data = [{
                            imageBase64: base64Data,
                            english: analysisResult.english,
                            french: analysisResult.french
                        }];
                        displayResult(file.name);
                        resolve();
                    };
                    img.onerror = (err) => reject(`Failed to load image: ${file.name}`);
                    img.src = e.target.result;
                } catch (error) {
                    reject(error);
                }
            };
            reader.onerror = (err) => reject(`Failed to read file: ${file.name}`);
            reader.readAsDataURL(file);
        });
    }

    async function processPdf(file) {
         return new Promise(async (resolve, reject) => {
            // Double check pdfjsLib is loaded
             if (!pdfjsLib) {
                 const loadError = "PDF library not loaded. Cannot process PDF.";
                 processedFilesData[file.name].status = 'error';
                 processedFilesData[file.name].error = loadError;
                 displayResult(file.name);
                 return reject(new Error(loadError));
             }

            const reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    const pdfData = new Uint8Array(e.target.result);
                    const pdf = await pdfjsLib.getDocument({ data: pdfData }).promise;
                    console.log(`${file.name} - Found ${pdf.numPages} pages.`);

                    // Get existing or initialize file data structure
                    let fileResults = processedFilesData[file.name];
                    fileResults.data = []; // Clear any previous page data if retrying

                    for (let i = 1; i <= pdf.numPages; i++) {
                         $('#progress-text').text(`Processing: ${file.name} (Page ${i}/${pdf.numPages})`);
                         console.log(`Processing PDF page ${i}`);
                        let pageData = {
                            pageNumber: i,
                            imageBase64: null,
                            english: null,
                            french: null,
                            error: null
                        };
                        try {
                            const page = await pdf.getPage(i);
                            const viewport = page.getViewport({ scale: 2.0 }); // Increased scale for potentially better quality
                            const canvas = document.getElementById('pdf-canvas');
                             if (!canvas) throw new Error("Canvas element #pdf-canvas not found");
                            const context = canvas.getContext('2d');
                             if (!context) throw new Error("Could not get 2D context from canvas");
                            canvas.height = viewport.height;
                            canvas.width = viewport.width;

                            await page.render({ canvasContext: context, viewport: viewport }).promise;

                            const resizedCanvas = resizeCanvasIfNeeded(canvas, MAX_IMAGE_SIZE);
                            pageData.imageBase64 = resizedCanvas.toDataURL('image/png');
                            const base64SizeKB = (pageData.imageBase64.length * 0.75) / 1024;
                             console.log(`${file.name}_page_${i} - Base64 size: ${base64SizeKB.toFixed(2)} KB`);

                            const analysisResult = await getVisionAnalysis(pageData.imageBase64, `${file.name}_page_${i}`, true);
                            pageData.english = analysisResult.english;
                            pageData.french = analysisResult.french;
                            pageData.error = analysisResult.error;

                        } catch (pageError) {
                             console.error(`Error processing page ${i} of ${file.name}:`, pageError);
                             pageData.error = pageError.message || `Failed to process page ${i}`;
                        }
                         fileResults.data.push(pageData);
                         displayResult(file.name); // Update UI incrementally
                    }
                     const hasPageErrors = fileResults.data.some(p => p.error);
                     fileResults.status = hasPageErrors ? 'partial_error' : 'completed';
                    resolve();

                } catch (pdfError) {
                    console.error(`Error loading PDF ${file.name}:`, pdfError);
                     processedFilesData[file.name].status = 'error';
                     processedFilesData[file.name].error = pdfError.message || 'Failed to load PDF';
                     displayResult(file.name);
                    reject(pdfError);
                }
            };
             reader.onerror = (err) => reject(`Failed to read file: ${file.name}`);
            reader.readAsArrayBuffer(file);
        });
    }


    function resizeImageIfNeeded(img, maxSize) {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > maxSize || height > maxSize) {
            if (width > height) {
                height = Math.round(height * (maxSize / width));
                width = maxSize;
            } else {
                width = Math.round(width * (maxSize / height));
                height = maxSize;
            }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        return canvas;
    }

     function resizeCanvasIfNeeded(sourceCanvas, maxSize) {
        let width = sourceCanvas.width;
        let height = sourceCanvas.height;

        if (width <= maxSize && height <= maxSize) {
            return sourceCanvas;
        }

        const targetCanvas = document.createElement('canvas');
        let newWidth = width;
        let newHeight = height;

         if (width > maxSize || height > maxSize) {
            if (width > height) {
                newHeight = Math.round(height * (maxSize / width));
                newWidth = maxSize;
            } else {
                newWidth = Math.round(width * (maxSize / height));
                newHeight = maxSize;
            }
        }

        targetCanvas.width = newWidth;
        targetCanvas.height = newHeight;
        const ctx = targetCanvas.getContext('2d');
        ctx.drawImage(sourceCanvas, 0, 0, width, height, 0, 0, newWidth, newHeight);
        return targetCanvas;
    }

    // *** THIS FUNCTION NOW CONTAINS THE CONDITIONAL PROMPT LOGIC ***
    async function getVisionAnalysis(base64Data, identifier, isPdf) {
        const visionModel = $('#vision-model-select').val(); // Get selected model
        const apiKey = $("#api-key").val();
        if (!apiKey) return { error: "API Key not found." };

        let prompt;
        let max_tokens;

        if (isPdf) {
            // Conditional PDF prompt based on model
            if (visionModel === 'google/gemini-pro-vision') {
                // Use the more detailed prompt for Gemini when processing PDFs
                prompt = "DO NOT start with phrases like 'The image depicts', 'The image shows', or similar. Describe this PDF page in extensive detail for accessibility purposes. Extract and include ALL visible text content, including headings, paragraphs, list items, table content, form elements, and any captions. Also, briefly describe the general layout and structure (e.g., columns, sections identified by headings). Aim for a complete textual representation of the page's content. Do not omit details or summarize briefly. Be thorough.";
                console.log(`Using detailed Gemini prompt for PDF: ${identifier}`);
            } else {
                // Use the original prompt for other models (like Llama) for PDFs
                prompt = "Provide a thorough description of the text content in this page. Be concise and don't truncate your response";
                 console.log(`Using standard prompt for PDF (${visionModel}): ${identifier}`);
            }
            max_tokens = 500; // Keep max_tokens high for PDF descriptions regardless of model
        } else {
            // Use the standard concise alt text prompt for non-PDF images (applies to all models)
            prompt = "Create a short, concise alt text for this image suitable for a website. " +
                     "DO NOT start with phrases like 'The image depicts', 'The image shows', or similar. " +
                     "Instead, directly describe the main subject in 15-20 words maximum. " +
                     "Focus only on the key elements necessary for accessibility. " +
                     "Use simple, direct language without unnecessary words.";
            max_tokens = 50; // Keep max_tokens lower for alt text
            console.log(`Using alt text prompt for image (${visionModel}): ${identifier}`);
        }

        const messages = [{
            "role": "user",
            "content": [
                { "type": "image_url", "image_url": { "url": base64Data } },
                { "type": "text", "text": prompt } // Use the selected prompt
            ]
        }];

        const payload = {
            model: visionModel,
            messages: messages,
            max_tokens: max_tokens, // Use the determined max_tokens
            temperature: 0.3,
            top_p: 0.85
        };

        console.log(`Sending to OpenRouter (${visionModel}) for: ${identifier}`);
        // console.log("Payload:", JSON.stringify(payload)); // Optional: uncomment to log full payload

        try {
            const response = await $.ajax({
                url: "https://openrouter.ai/api/v1/chat/completions",
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${apiKey}`,
                    "Content-Type": "application/json"
                },
                data: JSON.stringify(payload),
                timeout: 60000 // 60 second timeout
            });

            const englishText = response?.choices?.[0]?.message?.content?.trim();
            if (!englishText) {
                console.warn(`No content returned or unexpected structure from vision model for ${identifier}. Response:`, response);
                throw new Error("No content returned from vision model.");
            }
            console.log(`${identifier} - English Analysis: ${englishText.substring(0, 100)}...`);

            const frenchText = await translateToFrench(englishText, identifier);
            console.log(`${identifier} - French Translation: ${frenchText ? frenchText.substring(0, 100) + '...' : '[Empty/Error]'}`);

            return { english: englishText, french: frenchText, error: null };

        } catch (error) {
            console.error(`Error getting analysis from OpenRouter for ${identifier}:`, error.statusText || error.message, error.responseText);
            const errorMsg = `API Error (${error.status || 'Network'}): ${error.statusText || error.message}`;
            let detailedError = errorMsg;
            try {
                 if(error.responseText) {
                     const errorJson = JSON.parse(error.responseText);
                     if(errorJson && errorJson.error && errorJson.error.message) {
                         detailedError += ` - ${errorJson.error.message}`;
                     }
                 }
            } catch (e) { /* Ignore parsing error */ }

            return { error: detailedError, english: null, french: null };
        }
    }


    async function translateToFrench(text, identifier) {
        if (!text) return "";

        const apiKey = $("#api-key").val();
         if (!apiKey) return "[Translation Error: API Key missing]";

        const translationModel = "mistralai/mixtral-8x7b-instruct";

        const messages = [
             {
                 "role": "system",
                 "content": "You are a professional translator. Your task is to translate the following text from English to French. CRITICAL INSTRUCTION: You must provide ONLY the direct translation. DO NOT include any explanations, notes, disclaimers, or additional commentary of any kind. DO NOT include phrases like 'Here is the translation:'. DO NOT wrap your response in quotes. Simply translate the text directly, maintaining the same tone and style of the original."
             },
             { "role": "user", "content": text }
         ];

         const payload = {
             model: translationModel,
             messages: messages,
             temperature: 0.1,
             max_tokens: Math.max(250, Math.ceil(text.length * 2.5)),
             top_p: 0.9
         };

         console.log(`Sending to OpenRouter (${translationModel}) for translation: ${identifier}`);

         try {
             const response = await $.ajax({
                 url: "https://openrouter.ai/api/v1/chat/completions",
                 method: "POST",
                 headers: {
                     "Authorization": `Bearer ${apiKey}`,
                     "Content-Type": "application/json"
                 },
                 data: JSON.stringify(payload),
                 timeout: 45000 // 45 second timeout
             });

             let translation = response?.choices?.[0]?.message?.content?.trim();
             if (!translation) {
                 console.warn(`No content returned or unexpected structure from translation model for ${identifier}. Response:`, response);
                 throw new Error("No content returned from translation model.");
             }

             // Basic cleanup
             translation = translation.replace(/^Voici la traduction\s*:\s*/i, '');
             translation = translation.replace(/^Translation\s*:\s*/i, '');

             return translation;
         } catch (error) {
             console.error(`Error translating text from OpenRouter for ${identifier}:`, error.statusText || error.message, error.responseText);
              const errorMsg = `[Translation Error (${error.status || 'Network'}): ${error.statusText || error.message}]`;
             return errorMsg;
         }
    }

    // --- Display and Output Functions ---

    function displayResult(fileName) {
        const fileInfo = processedFilesData[fileName];
        if (!fileInfo) return;

        let containerId = `result-${fileName.replace(/[^a-zA-Z0-9-_]/g, '-')}`; // Allow underscore and hyphen in ID
        let $container = $(`#${containerId}`);

        // Create or clear container
        if ($container.length === 0) {
            $container = $(`<div id="${containerId}" class="result-container"></div>`);
            $container.append(`<h4>Results for: ${fileName}</h4>`);
             $('#results-display').prepend($container); // Prepend new file results
        } else {
             // Clear previous content *except* the H4 title
             $container.children(':not(h4)').remove();
        }

         // Display overall file processing error first
         if (fileInfo.status === 'error' && fileInfo.error) {
            $container.append(`<p class="error-message" style="color: red;"><strong>Error processing file:</strong> ${escapeHtml(fileInfo.error)}</p>`);
            $container.append('<hr style="border-top: 2px solid #ccc; margin-top: 20px;">'); // Add divider after error
             return; // Stop here if the file itself failed
         }
         // Display message if still processing
         if (fileInfo.status === 'processing') {
             $container.append(`<p class="processing-message"><span class="spinner" style="width: 15px; height: 15px; border-width: 2px;"></span> Processing...</p>`);
              // Don't add divider yet if processing
             return;
         }

        // Display data for each image/page
        if (fileInfo.data && fileInfo.data.length > 0) {
            fileInfo.data.forEach((itemData, index) => {
                let pageIdentifier = fileInfo.type === 'pdf' ? ` (Page ${itemData.pageNumber})` : '';
                let pageContainerId = `${containerId}-item-${index}`;

                const $pageContainer = $(`<div id="${pageContainerId}" class="page-result" style="margin-top: 15px; padding-top: 10px; border-top: 1px dashed #eee;"></div>`); // Add separator

                if (fileInfo.type === 'pdf') {
                    $pageContainer.append(`<h5>Page ${itemData.pageNumber}</h5>`);
                }

                if (itemData.imageBase64) {
                    $pageContainer.append(`<img src="${itemData.imageBase64}" alt="Preview for ${fileName}${pageIdentifier}" class="result-image" style="max-height: 200px; width: auto; border: 1px solid #eee; margin-bottom: 10px; display: block;">`);
                }

                if (itemData.error) {
                     $pageContainer.append(`<p class="error-message" style="color: red;"><strong>Processing Error${pageIdentifier}:</strong> ${escapeHtml(itemData.error)}</p>`);
                } else {
                    const $columns = $(`<div class="result-columns"></div>`);
                    const title = fileInfo.type === 'pdf' ? 'Description' : 'Alt Text';

                    $columns.append(`
                        <div class="result-column">
                            <strong>English ${title}:</strong>
                            <p>${escapeHtml(itemData.english) || '[Not available]'}</p>
                            ${itemData.english ? `<button class="copy-button" data-copytext="${escapeHtml(itemData.english)}">Copy Text</button>` : ''}
                        </div>
                    `);

                    $columns.append(`
                        <div class="result-column">
                            <strong>${title} Français:</strong>
                            <p>${escapeHtml(itemData.french) || '[Not available]'}</p>
                             ${itemData.french ? `<button class="copy-button" data-copytext="${escapeHtml(itemData.french)}">Copy Text</button>` : ''}
                        </div>
                    `);
                     $pageContainer.append($columns);
                }
                $container.append($pageContainer);
            });
        } else if (fileInfo.status !== 'processing') {
            // Handle cases where processing finished but no data was generated (e.g. empty PDF)
             $container.append(`<p class="info-message">No content processed for this file.</p>`);
        }

        // Add final divider after all content for the file is displayed (unless it was just an error)
        if (fileInfo.status !== 'error') {
           $container.append('<hr style="border-top: 2px solid #ccc; margin-top: 20px;">');
        }
    }


    function updateCsvLink() {
        let csvContent = "Image filename,Image alt text (English),Image alt text (French),PDF description (English),PDF description (French)\n";
        let hasData = false;

        // Iterate filenames in the order they appear in the results display for consistency
        $('#results-display .result-container').each(function() {
             const containerId = $(this).attr('id');
             if (!containerId) return;
             // Extract original filename from ID (more complex if names have hyphens/numbers)
             // This is a simplification, might need adjustment if IDs are complex
             const fileNameMatch = containerId.match(/^result-(.+)/);
             if (!fileNameMatch) return;
             const fileName = fileNameMatch[1].replace(/-/g,' '); // Basic reversal of ID creation

             if (processedFilesData[fileName]) {
                const fileInfo = processedFilesData[fileName];
                if (fileInfo.status === 'completed' || fileInfo.status === 'partial_error') {
                    fileInfo.data.forEach(itemData => {
                        if(itemData.error && !itemData.english && !itemData.french) return; // Skip fully failed items

                        hasData = true;
                        const identifier = fileInfo.type === 'pdf' ? `${fileName}_page_${itemData.pageNumber}` : fileName;
                        const isPdf = fileInfo.type === 'pdf';

                        const altEn = !isPdf ? (itemData.english || '') : '';
                        const altFr = !isPdf ? (itemData.french || '') : '';
                        const descEn = isPdf ? (itemData.english || '') : '';
                        const descFr = isPdf ? (itemData.french || '') : '';

                        const escapeCsv = (str) => `"${(str || '').replace(/"/g, '""')}"`;

                        csvContent += `${escapeCsv(identifier)},${escapeCsv(altEn)},${escapeCsv(altFr)},${escapeCsv(descEn)},${escapeCsv(descFr)}\n`;
                    });
                }
            }
        });


        if (hasData) {
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const $link = $(`<a href="${url}" download="image_descriptions.csv" class="btn btn-primary">Download CSV</a>`);
            $('#csv-download-area').empty().append($link);
        } else {
             $('#csv-download-area').html('<p>No data processed successfully to generate CSV.</p>');
        }
    }

     function escapeHtml(unsafe) {
        if (typeof unsafe !== 'string') return '';
        return unsafe
             .replace(/&/g, "&")
             .replace(/</g, "<")
             .replace(/>/g, ">")
             .replace(/"/g, """)
             .replace(/'/g, "'");
     }

}); // End secondary document ready for processing logic

// =====================================================================
// == HELPER FUNCTIONS (Originally from content-assistant.js)         ==
// =====================================================================

// Note: getORData is less used now as specific logic is in getVisionAnalysis/translateToFrench
// Keep it for potential other uses or remove if definitely not needed.
async function getORData(model, requestJson) {
    let ORjson;
    const apiKey = $("#api-key").val();

    if (!apiKey) {
        console.error("OpenRouter API Key is missing.");
        return undefined;
    }
    console.log("Generic getORData Request Body:", JSON.stringify({ model, messages: requestJson }));

    try {
        ORjson = await $.ajax({
            url: "https://openrouter.ai/api/v1/chat/completions",
            method: "POST",
            headers: {
                "Authorization": "Bearer " + apiKey,
                "Content-Type": "application/json",
            },
            data: JSON.stringify({ model, messages: requestJson }),
            timeout: 90000
        });
        if (!ORjson || !ORjson.choices || !ORjson.choices.length > 0 || !ORjson.choices[0].message) {
             console.warn("Unexpected response structure from OpenRouter (getORData):", ORjson);
             return undefined;
        }
    } catch (error) {
        console.error("Error fetching from OpenRouter API (getORData):", error.status, error.statusText, error.responseText, error);
        return undefined;
    }
    return ORjson;
}

const isValidUrl = urlString=> {
    if (!urlString || typeof urlString !== 'string') return false;
    return urlString.trim().startsWith('http://') || urlString.trim().startsWith('https://');
}

function parsePageHTML(url, callback) {
    $.ajax({
        url: url,
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

function convertHtmlToText(html) {
    if (!html) return '';
    var tempDiv = document.createElement('div');
    html = html.replace(/<\/(p|div|h[1-6]|ul|ol|li|table|tr|td|th)>/gi, '\n');
    html = html.replace(/<br\s*\/?>/gi, '\n');
    tempDiv.innerHTML = html;
    return (tempDiv.textContent || tempDiv.innerText || "").replace(/\n\s*\n/g, '\n').trim();
}

function formatHTML(htmlString) {
    if (typeof html_beautify === 'function') {
        return html_beautify(htmlString || '', { indent_size: 2, space_in_empty_paren: true });
    } else {
        console.warn("html_beautify not found. Returning raw HTML.");
        return htmlString || '';
    }
}

function formatAIResponse(aiResponse) {
    if (!aiResponse) return '';
    let html = aiResponse;
    html = html.replace(/```(.*?)```/gs, '<pre><code>$1</code></pre>');
    html = html.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
    html = html.replace(/\*(.*?)\*/g, "<em>$1</em>");
    html = html.replace(/^\s*-\s+(.*)/gm, "<li>$1</li>");
    html = html.replace(/<\/li>\s*<li>/g, '</li><li>');
    html = html.replace(/(<li>.*?<\/li>)/gs, '<ul>$1</ul>');
    html = html.replace(/<\/ul>\s*<ul>/g, '');
    html = html.split('\n').map(line => {
        const trimmed = line.trim();
        if (trimmed === '' || trimmed.startsWith('<pre>') || trimmed.startsWith('<ul>') || trimmed.startsWith('<li>')) {
            return line;
        }
        // Avoid wrapping lines that seem to be part of existing tags incorrectly
         if (trimmed.match(/^<\/?(p|div|h[1-6]|table|tr|td|th)/i)) {
             return line;
         }
        return `<p>${line}</p>`;
    }).join('');
    html = html.replace(/<p>\s*<\/p>/g, '');
    return html;
}

function ensureCompleteXML(xml) {
  if (!xml) return '';
  xml = xml.replace(/^```xml\s*/, "").replace(/\s*```$/, "").trim();
  const marker = "[END_OF_XML]";
  const markerIndex = xml.indexOf(marker);
  if (markerIndex !== -1) {
    xml = xml.substring(0, markerIndex).trim();
  }
  if (!xml.includes("</w:body>")) { xml += "\n</w:body>"; }
  if (!xml.includes("</w:document>")) { xml += "\n</w:document>"; }
  return xml;
}

function toggleComparisonElement(eleA, eleB) {
    if (!eleA || !eleB || eleA.length === 0 || eleB.length === 0) return;
    if (eleB.hasClass('hidden')) {
      eleB.removeClass('hidden');
      eleA.css('width', '50%');
      eleB.css('width', '50%');
    } else {
      eleB.addClass('hidden');
      eleA.css('width', '100%');
      eleB.css('width', '');
    }
}

function estimateTokens(text) {
    if (!text) return 0;
    let words = text.match(/\b\w+\b/g) || [];
    return Math.ceil(words.length * 1.3);
}

function chunkText(text, maxTokens) {
    if (!text) return [];
    const paragraphs = text.split(/(\n\s*\n)/);
    let chunks = [];
    let currentChunk = "";
    let currentTokenCount = 0;
    paragraphs.forEach(part => {
        if (!part.trim()) return;
        let partTokens = estimateTokens(part);
        if (currentTokenCount + partTokens <= maxTokens) {
            currentChunk += part;
            currentTokenCount += partTokens;
        } else {
            if (currentChunk.trim()) { chunks.push(currentChunk.trim()); }
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
                currentChunk = "";
                currentTokenCount = 0;
            } else {
                currentChunk = part;
                currentTokenCount = partTokens;
            }
        }
    });
    if (currentChunk.trim()) { chunks.push(currentChunk.trim()); }
    return chunks;
}

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
            return;
        }
        try {
            var linkUrl = new URL(href, window.location.origin);
            if (linkUrl.origin !== window.location.origin) { return; }

            var baseUrl = linkUrl.pathname;
            var existingParams = new URLSearchParams(linkUrl.search);
            var newParams = new URLSearchParams(queryString);

            newParams.forEach((value, key) => { existingParams.set(key, value); });

            var newHref = baseUrl + '?' + existingParams.toString() + linkUrl.hash;
            $link.attr('href', newHref);

        } catch (e) {
             if (!href.match(/^(https?:|#|mailto:|tel:|javascript:)/)) {
                 var basePart = href.split('?')[0].split('#')[0];
                 var hashPart = href.includes('#') ? '#' + href.split('#')[1] : '';
                 var queryPart = href.includes('?') ? href.split('?')[1].split('#')[0] : '';
                 var oldParams = new URLSearchParams(queryPart);
                 var paramsToAdd = new URLSearchParams(queryString);
                 paramsToAdd.forEach((value, key) => oldParams.set(key, value));
                 var finalHref = basePart + '?' + oldParams.toString() + hashPart;
                 $link.attr('href', finalHref);
             } else {
                 console.warn(`Could not parse or update link href: ${href}`, e);
             }
        }
    });
}

function updateUrlParameter(param, value) {
    var urlParams = new URLSearchParams(window.location.search);
    urlParams.set(param, value);
    var newUrl = window.location.pathname + '?' + urlParams.toString() + window.location.hash;
    window.history.replaceState({ path: newUrl }, '', newUrl);
    return urlParams.toString();
}

function refreshIframe(id, html) {
    let iframe = document.getElementById(id);
    if (iframe) {
        try {
            let iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
            iframeDoc.open();
            iframeDoc.write(html || '');
            iframeDoc.close();
            if (typeof wb !== 'undefined' && wb.allSelectors) {
                setTimeout(() => { /* ... WET theme logic ... */ }, 100);
            }
        } catch (e) { console.error("Error writing to iframe:", e); hideAllSpinners(); }
    } else { console.warn("Iframe with id " + id + " not found."); hideAllSpinners(); }
}

function hideAllSpinners() {
  $(".spinner").closest('div:not(.hidden)').addClass("hidden");
  $('#progress-area').addClass('hidden'); // Also hide the main progress area
}

function createBasicReport(labelText, formattedText) {
    const textContent = formattedText && formattedText.a ? formattedText.a : '[No content available]';
    return $( /* ... basic report HTML ... */ ); // Simplified for brevity
}

function createSideBySideReport(counter, labelText, formattedText, model) {
    const textA = formattedText && formattedText.a ? formattedText.a : '[Content A not available]';
    const textB = formattedText && formattedText.b ? formattedText.b : '[Content B not available]';
    const modelA = model && model[0] ? model[0] : '[Model A unknown]';
    const modelB = model && model[1] ? model[1] : (model && model[0] ? model[0] : '[Model B unknown]');
    return $( /* ... side-by-side report HTML ... */ ); // Simplified for brevity
}

// File Extraction Helpers (Keep if needed for other tools/features)
async function handleFileExtraction(file) { /* ... original code ... */ }
async function handleFileExtractionToHtml(file) { /* ... original code ... */ }
function handleFileExtractionToXML(file, successCallback, errorCallback) { /* ... original code ... */ }
function extractPlainTextFromHtml(html) { /* ... original code ... */ }

// --- End Helper Functions ---
