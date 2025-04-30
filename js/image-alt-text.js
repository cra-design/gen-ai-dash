// Import PDF.js - Make sure the path is correct relative to your HTML file
import * as pdfjsLib from './pdfjs/pdf.mjs';

// Set worker source - IMPORTANT: Adjust path as needed
pdfjsLib.GlobalWorkerOptions.workerSrc = './js/pdfjs/pdf.worker.mjs';

$(document).ready(function() {
    // --- State Variables ---
    let processedFilesData = {}; // Stores results { filename: { type: 'image'/'pdf', data: [...] } }
    let filesInProgress = 0;
    const MAX_IMAGE_SIZE = 1024; // Max width/height for resizing

    // --- Event Listeners ---

    // File Uploader Change Event
    $('#file-uploader').on('change', async function(event) {
        const files = event.target.files;
        if (!files || files.length === 0) {
            return;
        }

        // Check for API key (should be populated by content-assistant.js)
        if (!$("#api-key").val()) {
            alert("OpenRouter API Key is missing. Please submit a key first.");
            // Optionally clear the file input
            $('#file-uploader').val('');
            return;
        }


        const newFiles = Array.from(files).filter(f => !processedFilesData[f.name]);

        if (newFiles.length > 0) {
            $('#progress-area').removeClass('hidden');
            $('#progress-bar').val(0);
            $('#progress-text').text(`Starting processing for ${newFiles.length} file(s)...`);
            filesInProgress = newFiles.length;

            let processedCount = 0;
            $('#results-display').append(`<h3>Processing ${newFiles.length} new file(s)...</h3>`); // Initial message

            for (const file of newFiles) {
                processedFilesData[file.name] = { // Placeholder
                   type: file.type === 'application/pdf' ? 'pdf' : 'image',
                   status: 'processing',
                   data: [] // For PDF pages or single image data
                };

                 try {
                    $('#progress-text').text(`Processing: ${file.name} (${processedCount + 1}/${filesInProgress})`);
                     if (file.type === 'application/pdf') {
                         await processPdf(file);
                     } else if (file.type.startsWith('image/')) {
                         await processImage(file);
                     } else {
                         console.warn(`Unsupported file type: ${file.name} (${file.type})`);
                         // Update status for this file
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
                     // Check if all files are done (even if some failed)
                     if (processedCount === filesInProgress) {
                        $('#progress-text').text(`Processing complete. ${processedCount} file(s) attempted.`);
                         updateCsvLink();
                         // Optionally hide progress bar after a delay
                         setTimeout(() => $('#progress-area').addClass('hidden'), 3000);
                     }
                 }
            }
             // Clear file input to allow re-uploading the same file if needed
             $('#file-uploader').val('');
        } else {
             alert("Selected file(s) have already been processed or are currently processing.");
             $('#file-uploader').val('');
        }
    });

    // Model Selection Change Event (Reset state)
    $('#vision-model-select').on('change', function() {
        console.log("Model changed, resetting state.");
        processedFilesData = {}; // Clear processed data
        $('#results-display').empty(); // Clear displayed results
        $('#csv-download-area').empty(); // Clear download link
        // Optionally clear the file input as well
        $('#file-uploader').val('');
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
                        const base64Data = canvas.toDataURL('image/png'); // Use PNG for consistency
                        const base64SizeKB = (base64Data.length * 0.75) / 1024; // Approx size
                        console.log(`${file.name} - Base64 size: ${base64SizeKB.toFixed(2)} KB`);

                        // Get analysis
                        const analysisResult = await getVisionAnalysis(base64Data, file.name, false);

                        // Store result
                        processedFilesData[file.name] = {
                            type: 'image',
                            status: analysisResult.error ? 'error' : 'completed',
                            error: analysisResult.error,
                            data: [{ // Use array to be consistent with PDF structure
                                imageBase64: base64Data, // Store for display
                                english: analysisResult.english,
                                french: analysisResult.french
                            }]
                        };
                        displayResult(file.name); // Update UI for this file
                        resolve(); // Resolve promise when done
                    };
                    img.onerror = (err) => reject(`Failed to load image: ${file.name}`);
                    img.src = e.target.result; // Load image from file reader result
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
            const reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    const pdfData = new Uint8Array(e.target.result);
                    const pdf = await pdfjsLib.getDocument({ data: pdfData }).promise;
                    console.log(`${file.name} - Found ${pdf.numPages} pages.`);

                    const fileResults = {
                        type: 'pdf',
                        status: 'processing', // Initial status
                        data: []
                    };
                    processedFilesData[file.name] = fileResults; // Store placeholder

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
                            const viewport = page.getViewport({ scale: 1.5 }); // Adjust scale for quality
                            // Create a new canvas for each page instead of reusing the same one
                            const canvas = document.createElement('canvas');
                            const context = canvas.getContext('2d');
                            canvas.height = viewport.height;
                            canvas.width = viewport.width;

                            await page.render({ canvasContext: context, viewport: viewport }).promise;

                            // Resize if needed (reuse canvas or create new one)
                            const resizedCanvas = resizeCanvasIfNeeded(canvas, MAX_IMAGE_SIZE);
                            pageData.imageBase64 = resizedCanvas.toDataURL('image/png');
                            const base64SizeKB = (pageData.imageBase64.length * 0.75) / 1024;
                             console.log(`${file.name}_page_${i} - Base64 size: ${base64SizeKB.toFixed(2)} KB`);

                            // Get analysis
                            const analysisResult = await getVisionAnalysis(pageData.imageBase64, `${file.name}_page_${i}`, true);
                            pageData.english = analysisResult.english;
                            pageData.french = analysisResult.french;
                            pageData.error = analysisResult.error; // Store potential API error

                        } catch (pageError) {
                             console.error(`Error processing page ${i} of ${file.name}:`, pageError);
                             pageData.error = pageError.message || `Failed to process page ${i}`;
                        }
                         fileResults.data.push(pageData); // Add page result
                         displayResult(file.name); // Update UI incrementally for the PDF
                    }
                     // Update final status for the PDF file
                     const hasPageErrors = fileResults.data.some(p => p.error);
                     fileResults.status = hasPageErrors ? 'partial_error' : 'completed';
                    resolve(); // Resolve after all pages are attempted

                } catch (pdfError) {
                    console.error(`Error loading PDF ${file.name}:`, pdfError);
                     processedFilesData[file.name].status = 'error'; // Update main file status
                     processedFilesData[file.name].error = pdfError.message || 'Failed to load PDF';
                     displayResult(file.name); // Show error for the PDF file
                    reject(pdfError);
                }
            };
             reader.onerror = (err) => reject(`Failed to read file: ${file.name}`);
            reader.readAsArrayBuffer(file);
        });
    }


    function resizeImageIfNeeded(img, maxSize) {
        const canvas = document.createElement('canvas'); // Use temporary canvas
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
            return sourceCanvas; // No resizing needed
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
        // Draw the source canvas onto the target canvas, resizing it
        ctx.drawImage(sourceCanvas, 0, 0, width, height, 0, 0, newWidth, newHeight);
        return targetCanvas;
    }

    async function getVisionAnalysis(base64Data, identifier, isPdf) {
        const visionModel = $('#vision-model-select').val();
        const apiKey = $("#api-key").val();
        if (!apiKey) return { error: "API Key not found." };

        const prompt = isPdf
            ? "Provide a thorough description of the text content in this page. Be concise and don't truncate your response"
            : "Create a short, concise alt text for this image suitable for a website. " +
              "DO NOT start with phrases like 'The image depicts', 'The image shows', or similar. " +
              "Instead, directly describe the main subject in 15-20 words maximum. " +
              "Focus only on the key elements necessary for accessibility. " +
              "Use simple, direct language without unnecessary words.";
        const max_tokens = isPdf ? 500 : 50; // Increased slightly for alt text

        const messages = [{
            "role": "user",
            "content": [
                { "type": "image_url", "image_url": { "url": base64Data } }, // Already includes data:image/png;base64,
                { "type": "text", "text": prompt }
            ]
        }];

        const payload = {
            model: visionModel,
            messages: messages,
            max_tokens: max_tokens,
             temperature: 0.3,
             top_p: 0.85
        };

        console.log(`Sending to OpenRouter (${visionModel}) for: ${identifier}`);

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
                throw new Error("No content returned from vision model.");
            }
            console.log(`${identifier} - English Analysis: ${englishText}`);

            // Now translate
            const frenchText = await translateToFrench(englishText, identifier);
             console.log(`${identifier} - French Translation: ${frenchText}`);

            return { english: englishText, french: frenchText, error: null };

        } catch (error) {
            console.error(`Error getting analysis from OpenRouter for ${identifier}:`, error.statusText || error.message, error.responseText);
             const errorMsg = `API Error (${error.status || 'Network'}): ${error.statusText || error.message}`;
            return { error: errorMsg, english: null, french: null };
        }
    }

    async function translateToFrench(text, identifier) {
        if (!text) return ""; // Don't translate empty text
        // Basic check if likely already French (optional, rely on LLM for accuracy)
        // if (text.match(/[àâçéèêëîïôûùü]/)) { // Simple check for French chars
        //    console.log(`${identifier} - Skipping translation, likely already French.`);
        //    return text;
        // }

        const apiKey = $("#api-key").val();
        // Use a capable text model for translation (Mixtral is good, Llama 3 also works)
        const translationModel = "mistralai/mixtral-8x7b-instruct"; // Or choose another like 'meta-llama/llama-3-70b-instruct'

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
            max_tokens: Math.max(150, text.length * 3), // Estimate tokens needed
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
                throw new Error("No content returned from translation model.");
            }

            // Optional: Basic cleanup (though the prompt aims to prevent extra text)
            translation = translation.replace(/^Voici la traduction\s*:\s*/i, '');
            translation = translation.replace(/^Translation\s*:\s*/i, '');

            return translation;
        } catch (error) {
            console.error(`Error translating text from OpenRouter for ${identifier}:`, error.statusText || error.message, error.responseText);
            return `[Translation Error: ${error.statusText || error.message}]`; // Return error inline
        }
    }

    // --- Display and Output Functions ---

    function displayResult(fileName) {
        const fileInfo = processedFilesData[fileName];
        if (!fileInfo) return;

        let containerId = `result-${fileName.replace(/[^a-zA-Z0-9]/g, '-')}`; // Create safe ID
        let $container = $(`#${containerId}`);

        // Create container if it doesn't exist
        if ($container.length === 0) {
            $container = $(`<div id="${containerId}" class="result-container"></div>`);
            $container.append(`<h4>Results for: ${fileName}</h4>`);
             // Prepend new results, or append based on preference
             $('#results-display').prepend($container);
        } else {
             // Clear previous content if re-displaying (e.g., for PDF page updates)
             $container.find('.page-result').remove(); // Remove only page-specific results if any
             $container.find('.error-message').remove(); // Remove old errors
        }

         // Handle overall file error
         if (fileInfo.status === 'error' && fileInfo.error) {
            $container.append(`<p class="error-message" style="color: red;"><strong>Error:</strong> ${fileInfo.error}</p>`);
             return; // Don't display page data if the whole file failed
         }

        // Display data for each image/page
        fileInfo.data.forEach((itemData, index) => {
            let pageIdentifier = fileInfo.type === 'pdf' ? `_page_${itemData.pageNumber}` : '';
            let pageContainerId = `${containerId}-page-${index}`; // Unique ID for each page/image result

            // Remove existing page result if updating
            $(`#${pageContainerId}`).remove();

            // Create new container for this specific page/image result
            const $pageContainer = $(`<div id="${pageContainerId}" class="page-result" style="margin-top: 15px;"></div>`);

            if (fileInfo.type === 'pdf') {
                $pageContainer.append(`<h5>Page ${itemData.pageNumber}</h5>`);
            }

            // Display image preview
            if (itemData.imageBase64) {
                $pageContainer.append(`<img src="${itemData.imageBase64}" alt="Preview for ${fileName}${pageIdentifier}" class="result-image" style="max-height: 200px; width: auto; border: 1px solid #eee;">`);
            }

            // Display errors for this specific item
            if (itemData.error) {
                 $pageContainer.append(`<p class="error-message" style="color: red;"><strong>Processing Error:</strong> ${itemData.error}</p>`);
            } else {
                // Display English and French results
                const $columns = $(`<div class="result-columns"></div>`);
                const title = fileInfo.type === 'pdf' ? 'Description' : 'Alt Text';

                // English Column
                $columns.append(`
                    <div class="result-column">
                        <strong>English ${title}:</strong>
                        <p>${itemData.english || '[Not available]'}</p>
                        ${itemData.english ? `<button class="copy-button" data-copytext="${escapeHtml(itemData.english)}">Copy Text</button>` : ''}
                    </div>
                `);

                // French Column
                $columns.append(`
                    <div class="result-column">
                        <strong>${title} Français:</strong>
                        <p>${itemData.french || '[Not available]'}</p>
                         ${itemData.french ? `<button class="copy-button" data-copytext="${escapeHtml(itemData.french)}">Copy Text</button>` : ''}
                    </div>
                `);
                 $pageContainer.append($columns);
            }

             // Add a divider if it's a PDF with multiple pages being displayed
             if (fileInfo.type === 'pdf' && fileInfo.data.length > 1) {
                $pageContainer.append('<hr>');
            }

            $container.append($pageContainer); // Append the result for this page/image
        });
         // Add a main divider after the entire file's results
         if ($container.find('.page-result').length > 0) {
             $container.append('<hr style="border-top: 2px solid #ccc; margin-top: 20px;">');
         }
    }


    function updateCsvLink() {
        let csvContent = "Image filename,Image alt text (English),Image alt text (French),PDF description (English),PDF description (French)\n";
        let hasData = false;

        for (const fileName in processedFilesData) {
            const fileInfo = processedFilesData[fileName];
             if (fileInfo.status === 'completed' || fileInfo.status === 'partial_error') { // Include partially failed PDFs
                 fileInfo.data.forEach(itemData => {
                    // Skip items that had processing errors entirely
                    if(itemData.error && !itemData.english && !itemData.french) return;

                    hasData = true;
                    const identifier = fileInfo.type === 'pdf' ? `${fileName}_page_${itemData.pageNumber}` : fileName;
                    const isPdf = fileInfo.type === 'pdf';

                    const altEn = !isPdf ? (itemData.english || '') : '';
                    const altFr = !isPdf ? (itemData.french || '') : '';
                    const descEn = isPdf ? (itemData.english || '') : '';
                    const descFr = isPdf ? (itemData.french || '') : '';

                    // Basic CSV escaping (wrap in quotes, double quotes inside)
                    const escapeCsv = (str) => `"${(str || '').replace(/"/g, '""')}"`;

                    csvContent += `${escapeCsv(identifier)},${escapeCsv(altEn)},${escapeCsv(altFr)},${escapeCsv(descEn)},${escapeCsv(descFr)}\n`;
                });
             }
        }


        if (hasData) {
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const $link = $(`<a href="${url}" download="image_descriptions.csv" class="btn btn-primary">Download CSV</a>`); // Use Bootstrap style button
            $('#csv-download-area').empty().append($link);
        } else {
             $('#csv-download-area').html('<p>No data processed successfully to generate CSV.</p>');
        }
    }

     function escapeHtml(unsafe) {
        if (!unsafe) return '';
        return unsafe
             .replace(/&/g, "&amp;")
             .replace(/</g, "&lt;")
             .replace(/>/g, "&gt;")
             .replace(/"/g, "&quot;")
             .replace(/'/g, "&#039;");
     }

}); // End document ready
