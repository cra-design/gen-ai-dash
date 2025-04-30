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
        console.log("Submit button clicked, key read:", key); // Debug log
  
        if (!key) {
            console.log("Key is empty - showing error."); // Debug log
            // Show error if the input is empty
            $('#api-key-entry-error').removeClass("hidden");
        } else {
            console.log("Key found - hiding error and attempting redirect."); // Debug log
            // Hide error message if it was shown
            $('#api-key-entry-error').addClass("hidden");
            // Reload the page with the key as a URL parameter
            let redirectUrl = window.location.pathname + '?key=' + encodeURIComponent(key);
            console.log("Redirecting to:", redirectUrl); // Debug log
            window.location.href = redirectUrl;
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
    console.log("Initial document ready setup complete for image-alt.js"); // Debug log
  }); // END OF $(document).ready()
  
  
  // =====================================================================
  // == CORE IMAGE/PDF PROCESSING LOGIC FOR image-alt-text.js           ==
  // =====================================================================
  
  // Import PDF.js - Make sure the path is correct relative to your HTML file
  // Note: This relies on the HTML including this script with type="module"
  // and PDF.js files being available at the specified paths.
  let pdfjsLib;
  try {
    // Attempt dynamic import
    import('./pdfjs/pdf.mjs').then(module => {
        pdfjsLib = module;
        // Set worker source - IMPORTANT: Adjust path as needed
        // Use an absolute path from the site root if needed for GitHub Pages deployment
        // Example: pdfjsLib.GlobalWorkerOptions.workerSrc = '/your-repo-name/js/pdfjs/pdf.worker.mjs';
        pdfjsLib.GlobalWorkerOptions.workerSrc = './js/pdfjs/pdf.worker.mjs';
        console.log("PDF.js library loaded dynamically.");
    }).catch(err => {
        console.error("Failed to load PDF.js dynamically. Ensure it's included correctly and paths are right.", err);
        // Alert user only once maybe?
        if (!window.pdfJsLoadErrorShown) {
            alert("Error: PDF processing library could not be loaded. PDF uploads may fail. Check console (F12) for details.");
            window.pdfJsLoadErrorShown = true;
        }
    });
  } catch (e) {
     console.error("Dynamic import not supported or failed. Ensure PDF.js is loaded.", e);
      if (!window.pdfJsLoadErrorShown) {
            alert("Error: PDF processing library could not be loaded (check browser compatibility or script loading). PDF uploads may fail.");
            window.pdfJsLoadErrorShown = true;
        }
  }
  
  
  $(document).ready(function() {
    // --- State Variables ---
    let processedFilesData = {}; // Stores results { filename: { type: 'image'/'pdf', status: 'processing'/'completed'/'error'/'partial_error', data: [...] } }
    let filesInProgress = 0;
    const MAX_IMAGE_SIZE = 1024; // Max width/height for resizing
  
    // --- Event Listeners ---
  
    // File Uploader Change Event
    $('#file-uploader').on('change', async function(event) {
        console.log("File uploader change event triggered."); // Debug log
        // Check if PDF.js loaded before proceeding with PDFs
        const containsPdf = Array.from(event.target.files).some(f => f.type === 'application/pdf');
        if (containsPdf && !pdfjsLib) {
             alert("PDF library not yet loaded or failed to load. Please wait a moment or refresh. Cannot process PDF files yet.");
             $('#file-uploader').val(''); // Clear selection
             return;
        }
  
        const files = event.target.files;
        if (!files || files.length === 0) {
            console.log("No files selected."); // Debug log
            return;
        }
        console.log(`Files selected: ${files.length}`); // Debug log
  
        // Check for API key (should be populated by this script's ready() function)
        if (!$("#api-key").val()) {
            alert("OpenRouter API Key is missing. Please submit a key first.");
            $('#file-uploader').val('');
            return;
        }
  
  
        const newFiles = Array.from(files).filter(f => !processedFilesData[f.name] || processedFilesData[f.name].status === 'error'); // Allow retrying failed files
        console.log(`New files to process: ${newFiles.length}`); // Debug log
  
        if (newFiles.length > 0) {
            $('#progress-area').removeClass('hidden');
            $('#progress-bar').val(0);
            $('#progress-text').text(`Starting processing for ${newFiles.length} file(s)...`);
            filesInProgress = newFiles.length;
  
            let processedCount = 0;
            // $('#results-display').prepend(`<h3>Processing ${newFiles.length} new file(s)...</h3>`); // Can be noisy
  
            for (const file of newFiles) {
                console.log(`Starting processing for: ${file.name}`); // Debug log
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
                     console.log(`Finished processing attempt for: ${file.name}`); // Debug log
                 } catch (error) {
                     console.error(`Top-level error processing ${file.name}:`, error); // Debug log
                      processedFilesData[file.name].status = 'error';
                      processedFilesData[file.name].error = error.message || 'Processing failed';
                      displayResult(file.name); // Display error message
                 } finally {
                     processedCount++;
                     $('#progress-bar').val((processedCount / filesInProgress) * 100);
                     // Update text only when finished
                     if (processedCount === filesInProgress) {
                        console.log("All file processing attempts finished."); // Debug log
                        $('#progress-text').text(`Processing complete. ${processedCount} file(s) attempted.`);
                         updateCsvLink();
                         // Hide progress after a delay
                         setTimeout(() => {
                              console.log("Hiding progress area."); // Debug log
                              $('#progress-area').addClass('hidden');
                         }, 3000);
                     }
                 }
            }
             $('#file-uploader').val(''); // Clear file input after processing starts
        } else {
             alert("No new files selected or all selected files have already been processed successfully.");
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
    
    // Event delegation for toggle buttons (show more/less)
    $('#results-display').on('click', '.toggle-button', function() {
        const $button = $(this);
        const $container = $button.closest('.collapsible-container');
        const $preview = $container.find('.preview-text');
        const $fullText = $container.find('.full-text');
        
        $preview.toggleClass('hidden');
        $fullText.toggleClass('hidden');
        
        if ($fullText.hasClass('hidden')) {
            $button.text('Show More');
        } else {
            $button.text('Show Less');
        }
    });
  
    // --- Processing Functions ---
  
    async function processImage(file) {
        console.log(`processImage started for: ${file.name}`); // Debug log
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    const img = new Image();
                    img.onload = async () => {
                        console.log(`Image loaded in processImage: ${file.name}`); // Debug log
                        const canvas = resizeImageIfNeeded(img, MAX_IMAGE_SIZE);
                        const base64Data = canvas.toDataURL('image/png');
                        const base64SizeKB = (base64Data.length * 0.75) / 1024;
                        console.log(`${file.name} - Base64 size: ${base64SizeKB.toFixed(2)} KB`);
  
                        const analysisResult = await getVisionAnalysis(base64Data, file.name, false);
                         console.log(`Vision analysis result for ${file.name}:`, analysisResult); // Debug log
  
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
                    img.onerror = (err) => {
                        console.error(`Image load error in processImage: ${file.name}`, err); // Debug log
                        reject(new Error(`Failed to load image: ${file.name}`));
                    }
                    img.src = e.target.result;
                } catch (error) {
                     console.error(`Catch block error in processImage reader.onload: ${file.name}`, error); // Debug log
                    reject(error);
                }
            };
            reader.onerror = (err) => {
                 console.error(`File read error in processImage: ${file.name}`, err); // Debug log
                 reject(new Error(`Failed to read file: ${file.name}`));
            }
            reader.readAsDataURL(file);
        });
    }
  
    async function processPdf(file) {
         console.log(`processPdf started for: ${file.name}`); // Debug log
         return new Promise(async (resolve, reject) => {
            // Double check pdfjsLib is loaded
             if (!pdfjsLib) {
                 const loadError = "PDF library not loaded. Cannot process PDF.";
                 console.error(loadError); // Debug log
                 processedFilesData[file.name].status = 'error';
                 processedFilesData[file.name].error = loadError;
                 displayResult(file.name);
                 return reject(new Error(loadError));
             }
  
            const reader = new FileReader();
            reader.onload = async (e) => {
                 console.log(`File read success in processPdf: ${file.name}`); // Debug log
                try {
                    const pdfData = new Uint8Array(e.target.result);
                    const pdf = await pdfjsLib.getDocument({ data: pdfData }).promise;
                    console.log(`${file.name} - PDF loaded. Found ${pdf.numPages} pages.`); // Debug log
  
                    // Get existing or initialize file data structure
                    let fileResults = processedFilesData[file.name];
                    fileResults.data = []; // Clear previous page data if retrying
  
                    for (let i = 1; i <= pdf.numPages; i++) {
                         $('#progress-text').text(`Processing: ${file.name} (Page ${i}/${pdf.numPages})`);
                         console.log(`Processing PDF page ${i} of ${pdf.numPages}`); // Debug log
                        let pageData = {
                            pageNumber: i,
                            imageBase64: null,
                            english: null,
                            french: null,
                            error: null
                        };
                        try {
                            const page = await pdf.getPage(i);
                             console.log(`Got page ${i}`); // Debug log
                            const viewport = page.getViewport({ scale: 2.0 }); // Increased scale
                             console.log(`Got viewport for page ${i}`); // Debug log
                            const canvas = document.getElementById('pdf-canvas');
                             if (!canvas) throw new Error("Canvas element #pdf-canvas not found");
                            const context = canvas.getContext('2d');
                             if (!context) throw new Error("Could not get 2D context from canvas");
                            canvas.height = viewport.height;
                            canvas.width = viewport.width;
                             console.log(`Rendering page ${i} to canvas...`); // Debug log
                            await page.render({ canvasContext: context, viewport: viewport }).promise;
                             console.log(`Page ${i} rendered.`); // Debug log
  
                            const resizedCanvas = resizeCanvasIfNeeded(canvas, MAX_IMAGE_SIZE);
                            pageData.imageBase64 = resizedCanvas.toDataURL('image/png');
                            const base64SizeKB = (pageData.imageBase64.length * 0.75) / 1024;
                             console.log(`${file.name}_page_${i} - Base64 size: ${base64SizeKB.toFixed(2)} KB`);
  
                            const analysisResult = await getVisionAnalysis(pageData.imageBase64, `${file.name}_page_${i}`, true);
                             console.log(`Vision analysis result for page ${i}:`, analysisResult); // Debug log
                            pageData.english = analysisResult.english;
                            pageData.french = analysisResult.french;
                            pageData.error = analysisResult.error;
  
                        } catch (pageError) {
                             console.error(`Error processing page ${i} of ${file.name}:`, pageError); // Debug log
                             pageData.error = pageError.message || `Failed to process page ${i}`;
                        }
                         fileResults.data.push(pageData);
                         displayResult(file.name); // Update UI incrementally
                    }
                     const hasPageErrors = fileResults.data.some(p => p.error);
                     fileResults.status = hasPageErrors ? 'partial_error' : 'completed';
                     console.log(`Finished all pages for ${file.name}. Final status: ${fileResults.status}`); // Debug log
                    resolve();
  
                } catch (pdfError) {
                    console.error(`Error loading/processing PDF ${file.name}:`, pdfError); // Debug log
                     processedFilesData[file.name].status = 'error';
                     processedFilesData[file.name].error = pdfError.message || 'Failed to load PDF';
                     displayResult(file.name);
                    reject(pdfError);
                }
            };
             reader.onerror = (err) => {
                console.error(`File read error in processPdf: ${file.name}`, err); // Debug log
                reject(new Error(`Failed to read file: ${file.name}`));
             }
            reader.readAsArrayBuffer(file);
        });
    }
  
  
    function resizeImageIfNeeded(img, maxSize) {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
  
        if (width > maxSize || height > maxSize) {
             console.log(`Resizing image from ${width}x${height} to max ${maxSize}`); // Debug log
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
         console.log(`Image resized to ${width}x${height}`); // Debug log
        return canvas;
    }
  
     function resizeCanvasIfNeeded(sourceCanvas, maxSize) {
        let width = sourceCanvas.width;
        let height = sourceCanvas.height;
  
        if (width <= maxSize && height <= maxSize) {
            console.log(`Canvas resize not needed (${width}x${height})`); // Debug log
            return sourceCanvas;
        }
  
        const targetCanvas = document.createElement('canvas');
        let newWidth = width;
        let newHeight = height;
  
         if (width > maxSize || height > maxSize) {
            console.log(`Resizing canvas from ${width}x${height} to max ${maxSize}`); // Debug log
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
         console.log(`Canvas resized to ${newWidth}x${newHeight}`); // Debug log
        return targetCanvas;
    }
  
    // *** THIS FUNCTION CONTAINS THE CONDITIONAL PROMPT LOGIC ***
    async function getVisionAnalysis(base64Data, identifier, isPdf) {
        console.log(`getVisionAnalysis called for: ${identifier}, isPdf: ${isPdf}`); // Debug log
        const visionModel = $('#vision-model-select').val(); // Get selected model
        const apiKey = $("#api-key").val();
        if (!apiKey) {
            console.error("API Key not found in getVisionAnalysis"); // Debug log
            return { error: "API Key not found." };
        }
  
        let prompt;
        let max_tokens;
  
        if (isPdf) {
            // Conditional PDF prompt based on model
            if (visionModel === 'google/gemini-pro-vision') {
                // Use the more detailed prompt for Gemini when processing PDFs
                prompt = "Describe this PDF page in extensive detail for accessibility purposes. Extract and include ALL visible text content, including headings, paragraphs, list items, table content, form elements, and any captions. Also, briefly describe the general layout and structure (e.g., columns, sections identified by headings). Aim for a complete textual representation of the page's content. Do not omit details or summarize briefly. Be thorough.";
                console.log(`Using detailed Gemini prompt for PDF: ${identifier}`); // Debug log
            } else {
                // Use the original prompt for other models (like Llama) for PDFs
                prompt = "Provide a thorough description of the text content in this page. Be concise and don't truncate your response";
                 console.log(`Using standard prompt for PDF (${visionModel}): ${identifier}`); // Debug log
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
            console.log(`Using alt text prompt for image (${visionModel}): ${identifier}`); // Debug log
        }
  
        const messages = [{
            "role": "user",
            "content": [
                { "type": "image_url", "image_url": { "url": base64Data } }, // base64Data should already have the 'data:image/png;base64,' prefix
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
  
        console.log(`Sending to OpenRouter (${visionModel}) for: ${identifier}`); // Debug log
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
            console.log(`Received response from OpenRouter for ${identifier}`); // Debug log
  
            const englishText = response?.choices?.[0]?.message?.content?.trim();
            if (!englishText) {
                console.warn(`No content returned or unexpected structure from vision model for ${identifier}. Response:`, response); // Debug log
                throw new Error("No content returned from vision model.");
            }
            console.log(`${identifier} - English Analysis (Raw): ${englishText}`); // Debug log raw response
  
            const frenchText = await translateToFrench(englishText, identifier);
             console.log(`${identifier} - French Translation (Raw): ${frenchText}`); // Debug log raw translation
  
            return { english: englishText, french: frenchText, error: null };
  
        } catch (error) {
            console.error(`Error in AJAX call for ${identifier}:`, error); // Debug log full error
            const errorStatus = error.status || 'Network Error';
            const errorStatusText = error.statusText || 'Unknown Network Error';
            let detailedErrorMsg = `API Error (${errorStatus}): ${errorStatusText}`;
  
            try {
                 if(error.responseText) {
                    const errorJson = JSON.parse(error.responseText);
                    if(errorJson && errorJson.error && errorJson.error.message) {
                        detailedErrorMsg += ` - ${errorJson.error.message}`;
                    }
                 }
            } catch (e) { /* Ignore parsing error of responseText */ }
            console.error(`Formatted error for ${identifier}: ${detailedErrorMsg}`); // Debug log formatted error
  
            return { error: detailedErrorMsg, english: null, french: null };
        }
    }
  
  
    async function translateToFrench(text, identifier) {
        if (!text) {
            console.log(`Skipping translation for empty text: ${identifier}`); // Debug log
            return "";
        }
  
        const apiKey = $("#api-key").val();
         if (!apiKey) {
            console.error("API Key missing for translation"); // Debug log
            return "[Translation Error: API Key missing]";
         }
  
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
             max_tokens: Math.max(250, Math.ceil(text.length * 2.5)), // Ensure enough tokens
             top_p: 0.9
         };
  
         console.log(`Sending to OpenRouter (${translationModel}) for translation: ${identifier}`); // Debug log
  
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
             console.log(`Received translation response for ${identifier}`); // Debug log
  
             let translation = response?.choices?.[0]?.message?.content?.trim();
             if (!translation) {
                 console.warn(`No content returned or unexpected structure from translation model for ${identifier}. Response:`, response); // Debug log
                 throw new Error("No content returned from translation model.");
             }
  
             // Basic cleanup (though prompt aims to prevent this)
             translation = translation.replace(/^Voici la traduction\s*:\s*/i, '');
             translation = translation.replace(/^Translation\s*:\s*/i, '');
  
             return translation;
         } catch (error) {
             console.error(`Error translating text from OpenRouter for ${identifier}:`, error.statusText || error.message, error.responseText); // Debug log full error
              const errorMsg = `[Translation Error (${error.status || 'Network'}): ${error.statusText || error.message}]`;
             return errorMsg; // Return error inline
         }
    }
  
    // --- Display and Output Functions ---
  
    function displayResult(fileName) {
        const fileInfo = processedFilesData[fileName];
        if (!fileInfo) {
             console.warn(`displayResult called for unknown file: ${fileName}`); // Debug log
             return;
        }
         console.log(`displayResult called for: ${fileName}, Status: ${fileInfo.status}`); // Debug log
  
        let containerId = `result-${fileName.replace(/[^a-zA-Z0-9-_]/g, '-')}`;
        let $container = $(`#${containerId}`);
  
        // Create or clear container
        if ($container.length === 0) {
            console.log(`Creating result container: ${containerId}`); // Debug log
            $container = $(`<div id="${containerId}" class="result-container"></div>`);
            $container.append(`<h4>Results for: ${fileName}</h4>`);
             $('#results-display').prepend($container);
        } else {
             console.log(`Clearing existing content (except H4) for: ${containerId}`); // Debug log
             $container.children(':not(h4)').remove();
        }
  
         // Display overall file processing error first
         if (fileInfo.status === 'error' && fileInfo.error) {
            console.log(`Displaying file-level error for ${fileName}: ${fileInfo.error}`); // Debug log
            $container.append(`<p class="error-message" style="color: red;"><strong>Error processing file:</strong> ${escapeHtml(fileInfo.error)}</p>`);
            $container.append('<hr style="border-top: 2px solid #ccc; margin-top: 20px;">');
             return; // Stop here
         }
         // Display message if still processing (and no data items yet)
         if (fileInfo.status === 'processing' && (!fileInfo.data || fileInfo.data.length === 0)) {
             console.log(`Displaying processing message for: ${fileName}`); // Debug log
             $container.append(`<p class="processing-message"><span class="spinner" style="width: 15px; height: 15px; border-width: 2px;"></span> Processing...</p>`);
             return; // Show only processing message for now
         }
  
        // Display data for each image/page
        if (fileInfo.data && fileInfo.data.length > 0) {
             console.log(`Displaying ${fileInfo.data.length} data items for: ${fileName}`); // Debug log
            fileInfo.data.forEach((itemData, index) => {
                let pageIdentifier = fileInfo.type === 'pdf' ? ` (Page ${itemData.pageNumber})` : '';
                let pageContainerId = `${containerId}-item-${index}`;
                 console.log(`Displaying item ${index} for ${fileName}${pageIdentifier}`); // Debug log
  
                const $pageContainer = $(`<div id="${pageContainerId}" class="page-result" style="margin-top: 15px; padding-top: 10px; border-top: 1px dashed #eee;"></div>`);
  
                if (fileInfo.type === 'pdf') {
                    $pageContainer.append(`<h5>Page ${itemData.pageNumber}</h5>`);
                }
  
                if (itemData.imageBase64) {
                    $pageContainer.append(`<img src="${itemData.imageBase64}" alt="Preview for ${fileName}${pageIdentifier}" class="result-image" style="max-height: 200px; width: auto; border: 1px solid #eee; margin-bottom: 10px; display: block;">`);
                }
  
                if (itemData.error) {
                     console.log(`Displaying item-level error for ${fileName}${pageIdentifier}: ${itemData.error}`); // Debug log
                     $pageContainer.append(`<p class="error-message" style="color: red;"><strong>Processing Error${pageIdentifier}:</strong> ${escapeHtml(itemData.error)}</p>`);
                } else {
                     console.log(`Displaying results for ${fileName}${pageIdentifier}`); // Debug log
                    const $columns = $(`<div class="result-columns"></div>`);
                    const title = fileInfo.type === 'pdf' ? 'Description' : 'Alt Text';
                    
                    // Determine if we should use collapsible sections (for PDF descriptions that are long)
                    const isPdfWithLongText = fileInfo.type === 'pdf' && itemData.english && itemData.english.length > 300;
                    
                    // English column with potential collapsible content
                    if (isPdfWithLongText) {
                        $columns.append(`
                            <div class="result-column">
                                <strong>English ${title}:</strong>
                                <div class="collapsible-container">
                                    <div class="preview-text">${escapeHtml(itemData.english.substring(0, 150))}...</div>
                                    <button class="toggle-button">Show More</button>
                                    <div class="full-text hidden formatted-description">${formatDescription(escapeHtml(itemData.english))}</div>
                                </div>
                                ${itemData.english ? `<button class="copy-button" data-copytext="${escapeHtml(itemData.english)}">Copy Text</button>` : ''}
                            </div>
                        `);
                    } else {
                        // For shorter content or non-PDF files
                        const displayContent = fileInfo.type === 'pdf'
                            ? formatDescription(escapeHtml(itemData.english) || '[Not available]')
                            : `<p>${escapeHtml(itemData.english) || '[Not available]'}</p>`;
                            
                        $columns.append(`
                            <div class="result-column">
                                <strong>English ${title}:</strong>
                                <div class="${fileInfo.type === 'pdf' ? 'formatted-description' : ''}">${displayContent}</div>
                                ${itemData.english ? `<button class="copy-button" data-copytext="${escapeHtml(itemData.english)}">Copy Text</button>` : ''}
                            </div>
                        `);
                    }
                    
                    // French column with potential collapsible content
                    if (isPdfWithLongText && itemData.french && itemData.french.length > 300) {
                        $columns.append(`
                            <div class="result-column">
                                <strong>${title} Français:</strong>
                                <div class="collapsible-container">
                                    <div class="preview-text">${escapeHtml(itemData.french.substring(0, 150))}...</div>
                                    <button class="toggle-button">Show More</button>
                                    <div class="full-text hidden formatted-description">${formatDescription(escapeHtml(itemData.french))}</div>
                                </div>
                                ${itemData.french ? `<button class="copy-button" data-copytext="${escapeHtml(itemData.french)}">Copy Text</button>` : ''}
                            </div>
                        `);
                    } else {
                        // For shorter content or non-PDF files
                        const displayContent = fileInfo.type === 'pdf'
                            ? formatDescription(escapeHtml(itemData.french) || '[Not available]')
                            : `<p>${escapeHtml(itemData.french) || '[Not available]'}</p>`;
                            
                        $columns.append(`
                            <div class="result-column">
                                <strong>${title} Français:</strong>
                                <div class="${fileInfo.type === 'pdf' ? 'formatted-description' : ''}">${displayContent}</div>
                                ${itemData.french ? `<button class="copy-button" data-copytext="${escapeHtml(itemData.french)}">Copy Text</button>` : ''}
                            </div>
                        `);
                    }
                    
                    $pageContainer.append($columns);
                }
                $container.append($pageContainer);
            });
        } else if (fileInfo.status !== 'processing') {
             console.log(`No data items to display for completed/failed file: ${fileName}`); // Debug log
             $container.append(`<p class="info-message">No content processed for this file.</p>`);
        }
  
        // Add final divider after all content for the file is displayed (unless it was just an error)
        if (fileInfo.status !== 'error' && fileInfo.status !== 'processing') {
            // Add divider only if there was some content or page results displayed
            if ($container.find('.page-result, .info-message').length > 0) {
                 console.log(`Adding final divider for ${fileName}`); // Debug log
                $container.append('<hr style="border-top: 2px solid #ccc; margin-top: 20px;">');
            }
        }
    }
  
  
    function updateCsvLink() {
        console.log("Updating CSV link..."); // Debug log
        let csvContent = "Image filename,Image alt text (English),Image alt text (French),PDF description (English),PDF description (French)\n";
        let hasData = false;
  
        // Iterate based on the order of displayed containers for consistency
        $('#results-display .result-container').each(function() {
             const containerId = $(this).attr('id');
             if (!containerId || !containerId.startsWith('result-')) return;
  
             // Attempt to reconstruct the filename (handle spaces replaced by hyphens)
             // This assumes filenames don't contain '--' originally.
             const reconstructedFileName = containerId.substring(7).replace(/-/g, ' ');
  
             // Find the data using the reconstructed name (or potentially iterate processedFilesData)
             let fileInfo = processedFilesData[reconstructedFileName];
             // Fallback: Iterate through keys if reconstruction fails often
             if (!fileInfo) {
                 for (const key in processedFilesData) {
                     if (containerId === `result-${key.replace(/[^a-zA-Z0-9-_]/g, '-')}`) {
                         fileInfo = processedFilesData[key];
                         break;
                     }
                 }
             }
  
             if (fileInfo && (fileInfo.status === 'completed' || fileInfo.status === 'partial_error')) {
                 const originalFileName = Object.keys(processedFilesData).find(key => processedFilesData[key] === fileInfo); // Get the key back
                 if (!originalFileName) return; // Should not happen if fileInfo was found
  
                 fileInfo.data.forEach(itemData => {
                     if(itemData.error && !itemData.english && !itemData.french) return;
  
                     hasData = true;
                     const identifier = fileInfo.type === 'pdf' ? `${originalFileName}_page_${itemData.pageNumber}` : originalFileName;
                     const isPdf = fileInfo.type === 'pdf';
  
                     const altEn = !isPdf ? (itemData.english || '') : '';
                     const altFr = !isPdf ? (itemData.french || '') : '';
                     const descEn = isPdf ? (itemData.english || '') : '';
                     const descFr = isPdf ? (itemData.french || '') : '';
  
                     const escapeCsv = (str) => `"${(str || '').replace(/"/g, '""')}"`;
  
                     csvContent += `${escapeCsv(identifier)},${escapeCsv(altEn)},${escapeCsv(altFr)},${escapeCsv(descEn)},${escapeCsv(descFr)}\n`;
                 });
             }
        });
  
  
        if (hasData) {
            console.log("CSV has data, creating download link."); // Debug log
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            // Clean up previous blob URL if exists to prevent memory leaks
            const existingLink = $('#csv-download-area a');
            if (existingLink.length > 0 && existingLink.attr('href').startsWith('blob:')) {
                URL.revokeObjectURL(existingLink.attr('href'));
            }
            // Create new link
            const url = URL.createObjectURL(blob);
            const $link = $(`<a href="${url}" download="image_descriptions.csv" class="btn btn-primary">Download CSV</a>`);
            $('#csv-download-area').empty().append($link);
        } else {
             console.log("No successful data for CSV."); // Debug log
             $('#csv-download-area').html('<p>No data processed successfully to generate CSV.</p>');
        }
    }
  
     function escapeHtml(unsafe) {
        if (typeof unsafe !== 'string') return '';
        // Stricter escaping for display in HTML
        return unsafe
             .replace(/&/g, "&amp;")
             .replace(/</g, "&lt;")
             .replace(/>/g, "&gt;")
             .replace(/"/g, "&quot;")
             .replace(/'/g, "&#39;"); // Escapes single quotes too
     }

     // Format description text with better paragraph and list detection
     function formatDescription(text) {
        if (!text) return '';
        
        // Convert paragraphs (double line breaks) to proper HTML paragraphs
        let formatted = text.replace(/\n\s*\n/g, '</p><p>');
        
        // Convert single line breaks to <br>
        formatted = formatted.replace(/\n/g, '<br>');
        
        // Wrap in paragraph tags if not already
        if (!formatted.startsWith('<p>')) {
            formatted = '<p>' + formatted;
        }
        if (!formatted.endsWith('</p>')) {
            formatted = formatted + '</p>';
        }
        
        // Identify and format lists (lines starting with - or * or numbers)
        formatted = formatted.replace(/<p>(\s*[-*•][\s\S]*?)<\/p>/g, '<ul><li>$1</li></ul>');
        formatted = formatted.replace(/<br>\s*([-*•])\s+/g, '</li><li>');
        
        // Format numbered lists
        formatted = formatted.replace(/<p>(\s*\d+\.[\s\S]*?)<\/p>/g, '<ol><li>$1</li></ol>');
        formatted = formatted.replace(/<br>\s*(\d+\.)\s+/g, '</li><li>');
        
        // Format headings (lines in all caps or ending with colon)
        formatted = formatted.replace(/<p>([A-Z][A-Z\s]+[A-Z]:?)<\/p>/g, '<h4>$1</h4>');
        
        return formatted;
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
  };
  
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
    html = html.replace(/<\/(p|div|h[1-6]|ul|ol|li|table|tr|td|th|blockquote)>/gi, '\n'); // Added blockquote
    html = html.replace(/<br\s*\/?>/gi, '\n');
    tempDiv.innerHTML = html;
    // Add spaces around inline elements that might merge words
    $(tempDiv).find('a, span, strong, em, b, i, code').each(function() { $(this).text(' ' + $(this).text() + ' '); });
    return (tempDiv.textContent || tempDiv.innerText || "").replace(/[ \t]+/g,' ').replace(/\n\s*\n/g, '\n').trim(); // Consolidate whitespace
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
    // Escape HTML syntax inside potential code blocks BEFORE converting markdown
    html = html.replace(/```([\s\S]*?)```/gs, function(match, codeContent) {
        return '<pre><code>' + escapeHtml(codeContent) + '</code></pre>';
    });
    // Markdown conversions (Bold, Italics) - apply only outside pre tags
    html = html.replace(/(\W|^)\*\*(?!\s)(.*?)(?!\s)\*\*(\W|$)/g, '$1<strong>$2</strong>$3');
    html = html.replace(/(\W|^)\*(?!\s)(.*?)(?!\s)\*(\W|$)/g, '$1<em>$2</em>$3');
    // Basic list conversion (handle multiline items better)
    html = html.replace(/^\s*-\s+(.*(?:\n(?!\s*[-*>#]).*)*)/gm, "<li>$1</li>"); // Capture multiline list items
    html = html.replace(/<\/li>\s*<li>/g, '</li><li>'); // Normalize spacing
    html = html.replace(/(<li>.*?<\/li>)/gs, '<ul>$1</ul>'); // Wrap LIs in ULs
    html = html.replace(/<\/ul>\s*<ul>/g, ''); // Replace standalone UL wrappers
    // Wrap remaining lines (not part of pre or ul) in paragraphs
    html = html.split('\n').map(line => {
        const trimmed = line.trim();
        if (trimmed === '' || trimmed.startsWith('<pre>') || trimmed.startsWith('<ul>') || trimmed.startsWith('<li>')) {
            return line;
        }
         if (trimmed.match(/^<\/?(p|div|h[1-6]|table|tr|td|th|blockquote|strong|em)/i)) { // Avoid re-wrapping existing block/strong tags
             return line;
         }
        return `<p>${line}</p>`;
    }).join('\n'); // Join with newline initially
    // Clean up paragraphs containing only whitespace or <br>
    html = html.replace(/<p>\s*(<br\s*\/?>)?\s*<\/p>/gi, '');
     // Remove <br> at the start/end of paragraphs
    html = html.replace(/<p><br\s*\/?>/gi, '<p>');
    html = html.replace(/<br\s*\/?>\s*<\/p>/gi, '</p>');
    return html.trim(); // Trim final whitespace
  }
  
  function ensureCompleteXML(xml) {
  // This function seems highly specific to word/document.xml and might be too simplistic.
  // Use with caution or replace with a proper XML parser if needed.
  if (!xml) return '';
  xml = xml.replace(/^```xml\s*/, "").replace(/\s*```$/, "").trim();
  const marker = "[END_OF_XML]";
  const markerIndex = xml.indexOf(marker);
  if (markerIndex !== -1) {
    xml = xml.substring(0, markerIndex).trim();
  }
  // Very basic check - might incorrectly add tags
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
    // Simple word count approximation
    let words = text.match(/\b\w+\b/g) || [];
    return Math.ceil(words.length * 1.3); // More generous ratio
  }
  
  function chunkText(text, maxTokens) {
    // Basic chunking - might split mid-sentence. More sophisticated chunking is complex.
    if (!text) return [];
    const paragraphs = text.split(/(\n\s*\n)/); // Split by double newline
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
            // If the part itself is too long, just add it as its own chunk (API might reject)
            // Or implement more complex word-level splitting here if needed.
             chunks.push(part.trim()); // Simple approach: add the oversized part anyway
            currentChunk = "";
            currentTokenCount = 0;
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
            return; // Skip special links
        }
        try {
            var linkUrl = new URL(href, window.location.origin); // Resolve relative URLs correctly
            // Only update links pointing to the same origin
            if (linkUrl.origin !== window.location.origin) { return; }
  
            var baseUrl = linkUrl.pathname;
            var existingParams = new URLSearchParams(linkUrl.search);
            var newParams = new URLSearchParams(queryString); // Params to add/update
  
            newParams.forEach((value, key) => { existingParams.set(key, value); }); // Update or add key
  
            var newHref = baseUrl + '?' + existingParams.toString() + linkUrl.hash;
            $link.attr('href', newHref);
  
        } catch (e) {
            // Handle cases like relative paths without leading slash if needed
             if (!href.match(/^(https?:|#|mailto:|tel:|javascript:|\/\/)/)) { // Avoid //domain links too
                 try {
                     var basePart = href.split('?')[0].split('#')[0];
                     var hashPart = href.includes('#') ? '#' + href.split('#')[1] : '';
                     var queryPart = href.includes('?') ? href.split('?')[1].split('#')[0] : '';
                     var oldParams = new URLSearchParams(queryPart);
                     var paramsToAdd = new URLSearchParams(queryString);
                     paramsToAdd.forEach((value, key) => oldParams.set(key, value));
                     var finalHref = basePart + '?' + oldParams.toString() + hashPart;
                     $link.attr('href', finalHref);
                 } catch (e2) {
                      console.warn(`Could not parse or update relative link href: ${href}`, e2); // Log error for relative path handling
                 }
             } else {
                 console.warn(`Could not parse or update link href: ${href}`, e); // Log other parsing errors
             }
        }
    });
  }
  
  function updateUrlParameter(param, value) {
    var urlParams = new URLSearchParams(window.location.search);
    urlParams.set(param, value);
    var newUrl = window.location.pathname + '?' + urlParams.toString() + window.location.hash;
    // Use replaceState to avoid bloating browser history
    window.history.replaceState({ path: newUrl }, '', newUrl);
    return urlParams.toString(); // Return the new query string for potential use
  }
  
  function refreshIframe(id, html) {
    // Keep this function if iframes are used in other tools sharing this base JS
    let iframe = document.getElementById(id);
    if (iframe) {
        try {
            let iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
            iframeDoc.open();
            iframeDoc.write(html || ''); // Default to empty string if html is null/undefined
            iframeDoc.close();
            // Optional WET theme integration
            if (typeof wb !== 'undefined' && wb.allSelectors) {
                setTimeout(() => {
                     try { // Add try-catch for safety
                         let $iframeBody = $(iframe.contentWindow.document.body);
                         $iframeBody
                           .find(wb.allSelectors)
                           .addClass("wb-init")
                           .filter(":not(.wb-init .wb-init)")
                           .trigger("timerpoke.wb");
                     } catch (wetError) {
                         console.warn("WET theme re-init error in iframe:", wetError);
                     }
                }, 150); // Slightly longer timeout
            }
        } catch (e) { console.error("Error writing to iframe:", e); hideAllSpinners(); }
    } else { console.warn("Iframe with id " + id + " not found."); hideAllSpinners(); }
  }
  
  function hideAllSpinners() {
  // Hide generic spinners and the main progress area
  $(".spinner").closest('div:not(.hidden)').addClass("hidden"); // Hide parent div if spinner is visible
  $('#progress-area').addClass('hidden');
  }
  
  // Basic report function (keep if used)
  function createBasicReport(labelText, formattedText) {
    const textContent = formattedText && formattedText.a ? formattedText.a : '[No content available]';
    // Return jQuery object or HTML string for basic report structure
    return $(`<div class="generated-report basic-report"><h4>${escapeHtml(labelText || 'Report')}</h4><div>${textContent}</div></div>`);
  }
  
  // Side-by-side report function (keep if used)
  function createSideBySideReport(counter, labelText, formattedText, model) {
    const textA = formattedText && formattedText.a ? formattedText.a : '[Content A not available]';
    const textB = formattedText && formattedText.b ? formattedText.b : '[Content B not available]';
    const modelA = model && model[0] ? model[0] : '[Model A unknown]';
    const modelB = model && model[1] ? model[1] : (model && model[0] ? model[0] : '[Model B unknown]'); // Default B to A if only one provided
  
    const reportIdA = `report-container-A-${counter}`;
    const reportIdB = `report-container-B-${counter}`;
    const toolboxIdA = `report-toolbox-A-${counter}`;
    const toolboxIdB = `report-toolbox-B-${counter}`;
  
    // Return jQuery object or HTML string for side-by-side structure
    // (Using simplified structure here, replace with your actual desired HTML if different)
    return $(`
      <div class="sidebyside-wrapper generated-report">
        <h4>${escapeHtml(labelText || 'Comparison Report')}</h4>
        <div style="display: flex; gap: 15px;">
          <div id="${reportIdA}" style="flex: 1; border: 1px solid #eee; padding: 10px; position: relative;">
            <div id="${toolboxIdA}" class="toolbar" style="position: absolute; top: 5px; right: 5px; z-index: 1;">
              <button class="toolbar-button" id="accept-report-a-btn-${counter}" title="Accept A"><i class="fa fa-check"></i></button>
            </div>
            <h5>Option A</h5><div>${textA}</div><p class="small model-info">Model: ${escapeHtml(modelA)}</p>
          </div>
          <div id="${reportIdB}" style="flex: 1; border: 1px solid #eee; padding: 10px; position: relative;">
            <div id="${toolboxIdB}" class="toolbar" style="position: absolute; top: 5px; right: 5px; z-index: 1;">
              <button class="toolbar-button" id="accept-report-b-btn-${counter}" title="Accept B"><i class="fa fa-check"></i></button>
            </div>
            <h5>Option B</h5><div>${textB}</div><p class="small model-info">Model: ${escapeHtml(modelB)}</p>
          </div>
        </div>
      </div>`);
  }
  
  
  // --- File Extraction Helpers (UNUSED by current image-alt flow, keep for reference) ---
  async function handleFileExtraction(file) { /* ... original code ... */ console.warn("handleFileExtraction called but not implemented in image-alt flow"); return Promise.reject("Not implemented"); }
  async function handleFileExtractionToHtml(file) { /* ... original code ... */ console.warn("handleFileExtractionToHtml called but not implemented in image-alt flow"); return Promise.reject("Not implemented"); }
  function handleFileExtractionToXML(file, successCallback, errorCallback) { /* ... original code ... */ console.warn("handleFileExtractionToXML called but not implemented in image-alt flow"); if(errorCallback) errorCallback("Not implemented"); }
  function extractPlainTextFromHtml(html) {
     // Re-implemented simple version from convertHtmlToText for reference if needed elsewhere
     if (!html) return '';
     var tempDiv = document.createElement('div');
     tempDiv.innerHTML = html.replace(/<br\s*\/?>/gi, '\n');
     return (tempDiv.textContent || tempDiv.innerText || "").trim();
  }
  
  // --- End Helper Functions ---
