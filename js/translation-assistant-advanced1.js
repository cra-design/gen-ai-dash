let generatedDownloadFile = null;
let englishFile = null;
let frenchFile = null;

function extractXmlFromFile(file) {
  return new Promise((resolve, reject) => {
    handleFileExtractionToXML(file, resolve, reject);
  });
}
// Function to format raw translated output into structured HTML.
function formatTranslatedOutput(rawText) {
  if (!rawText) return "";
  rawText = rawText.trim();
  let paragraphs = rawText.split(/\n\s*\n/);
  let formatted = paragraphs.map(p => `<p>${p.replace(/\n/g, '<br>')}</p>`).join('');
  return formatted;
} 


// Function to unzip PPTX, parse each slide's XML, and extract textual content with unique identifiers.
async function extractPptxTextXmlWithId(arrayBuffer) {
  const zip = await JSZip.loadAsync(arrayBuffer); 
  const slideRegex = /^ppt\/slides\/slide(\d+)\.xml$/i;
  let textElements = [];

  for (const fileName of Object.keys(zip.files)) {
    const match = slideRegex.exec(fileName);
    if (match) {
      const slideNumber = match[1];
      const slideXml = await zip.file(fileName).async("string"); 

      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(slideXml, "application/xml"); 
       console.log(xmlDoc);
      const textNodes = xmlDoc.getElementsByTagName("a:t");

      for (let i = 0; i < textNodes.length; i++) {
        let uniqueId = `S${slideNumber}_T${i + 1}`;
        let text = textNodes[i].textContent;
        textElements.push({ slide: slideNumber, id: uniqueId, text });
      }
    }
  }
  return textElements;
} 

$(document).ready(function() {
  // Handle radio button changes for various upload and compare options.
  $(document).on("click", "input[type=radio]", function (event) {
    var target = event.target;
    if (target.name === "source-upload-option") {
      $('#source-doc-upload, #text-upload, #second-upload, #translation-preview, #convert-translation').addClass("hidden");
      if (target.id === "source-upload-doc") {
        $('#source-doc-upload').removeClass("hidden");
      } else if (target.id === "source-upload-text") {
        $('#text-upload').removeClass("hidden");
      }
    } else if (target.name === "second-upload-option") {
      $('#second-doc-upload, #second-text-upload').addClass("hidden");
      if (target.id === "second-upload-doc") {
        $('#second-doc-upload').removeClass("hidden");
      } else if (target.id === "second-upload-text") {
        $('#second-text-upload').removeClass("hidden");
      }
    } else if (target.name === "translations-compare") {
      if (target.id === "translations-llm-compare") {
        $('#genai-model-options').removeClass("hidden");
      } else if (target.id === "translations-instructions-compare" || target.id === "translations-no-compare") {
        $('#genai-model-options').addClass("hidden");
      }
    }
  }); 

  // Detect language from entered text as the user types.
  $('#source-text').on('input', function() {
    $('#source-heading-detecting').removeClass("hidden");
    var text = $(this).val().trim();
    if (text.length === 0) {
      $('#source-language').addClass("hidden");
      return;
    }
    var detectedLanguage = detectLanguageBasedOnWords(text);
    if (detectedLanguage === 'unknown') { detectedLanguage = 'english'; }
    $('#source-heading-detecting').addClass("hidden");
    $('#source-language').removeClass("hidden").val(detectedLanguage); 
  });


  // Handle file input change for both source and second file uploads.
  $(document).on("change", "input", async function (event) {
    if (event.target.id == "source-file" || event.target.id == "second-file") {
      let language = event.target.id === "source-file" ? "source" : "second";
      $(`#${language}-doc-detecting`).removeClass("hidden");
      $(`#${language}-multiple-msg, #${language}-doc-error`).addClass("hidden");
      $(`#${language}-language-heading`).removeClass("hidden");
      $(`#${language}-language-doc`).addClass("hidden");
      var fileList = event.target.files; 
      if (!fileList || fileList.length === 0) return;
      if (fileList.length > 1) {
          $(`#${language}-multiple-msg`).removeClass("hidden");
          $(`#${language}-doc-detecting, #${language}-language-heading`).addClass("hidden");
          return;
      }
      var uploadedFile = fileList[0];
      var fileExtension = uploadedFile.name.split('.').pop().toLowerCase();
      var validExtensions = ["docx", "xlsx", "pptx"];
      var validMimeTypes = [
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "application/vnd.openxmlformats-officedocument.presentationml.presentation"
      ];
      if (!validExtensions.includes(fileExtension) || !validMimeTypes.includes(uploadedFile.type)) {
          $(`#${language}-doc-error`).removeClass("hidden");
          $(`#${language}-doc-detecting`).addClass("hidden");
          $(`#${language}-language-heading`).removeClass("hidden");
          return;
      }
      try {
          let textContent; 
          const fileExtension = uploadedFile.name.split('.').pop().toLowerCase();  
          if (fileExtension === "docx" || fileExtension === "xlsx") {
              textContent = await handleFileExtraction(uploadedFile); 
          } else if (fileExtension === "pptx") { 
              let arrayBuffer = await uploadedFile.arrayBuffer(); 
              let textElements = await extractPptxTextXmlWithId(arrayBuffer); 
              let pptxHtml = textElements
                .map(item => `<p id="${item.id}">${item.text}</p>`)
                .join('');
              //Assign pptxHtml to textContent.
              textContent = pptxHtml;
          } else {
              throw new Error("Unsupported file type");
          }
          if (!textContent) { 
              throw new Error("No text extracted."); 
          }
          
          let detectedLanguage = detectLanguageBasedOnWords(textContent); 
          if (detectedLanguage !== "french") { detectedLanguage = "english"; }
          $(`#${language}-doc-detecting`).addClass("hidden");
          $(`#${language}-language-doc`).val(detectedLanguage).removeClass("hidden"); 
       
          if (event.target.id === "source-file") {
              englishFile = uploadedFile;
              if (fileExtension === 'docx') {
                let arrayBuffer = await uploadedFile.arrayBuffer();
                let mammothResult = await mammoth.convertToHtml({ arrayBuffer: arrayBuffer });
                $("#translation-A").html(mammothResult.value);
              } else if (fileExtension == 'pptx'){
                let arrayBuffer = await uploadedFile.arrayBuffer();
                let textElements = await extractPptxTextXmlWithId(arrayBuffer); 
                console.log("Extracted PPTX Text Elements:", textElements);
                let pptxHtml = textElements
                  .map(item => `<p id="${item.id}">${item.text}</p>`)
                  .join('');
                // NEW: Set the formatted PPTX content into #translation-A.
                $("#translation-A").html(pptxHtml);
              }
          } else {
              frenchFile = uploadedFile;
          }
      } catch (err) {
          console.error('Error processing source file:', err);
          $(`#${language}-doc-error`).removeClass("hidden");
          $(`#${language}-doc-detecting, #${language}-language-heading`).addClass("hidden");
      }
    }
  });

  /***********************************************************************
   * Translate Button Flow:
   * For file uploads, if DOCX, convert the file to HTML via Mammoth, then traverse the
   * DOM to extract all text nodes (including titles, bullet points, table cells, etc.),
   * join them with a unique delimiter, send the entire text for translation,
   * then split the translated text and reassign each text node.
   * For plain text, use the existing translation.
   ***********************************************************************/
  $("#source-upload-translate-btn").click(async function() {
    var selectedOption = $('input[name="source-upload-option"]:checked').val();
    if (selectedOption == "source-upload-doc") {
      var file = $('#source-file')[0].files[0];
      if (!file) {
        $(`#source-doc-error`).removeClass("hidden");
        return;
      }
      var fileExtension = file.name.split('.').pop().toLowerCase();
      
      // For DOCX files, translate all visible text (titles, bullet points, tables, etc.)
      if (fileExtension === 'docx') {
  try {
    // Convert DOCX to HTML using Mammoth.
    let arrayBuffer = await file.arrayBuffer();
    let mammothResult = await mammoth.convertToHtml({ arrayBuffer: arrayBuffer });
    let originalHtml = mammothResult.value;
    
    // Create a temporary DOM element to hold the HTML.
    let tempDiv = document.createElement("div");
    tempDiv.innerHTML = originalHtml;
    
    // Recursively collect all text nodes.
    function getTextNodes(root) {
      let walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null, false);
      let nodes = [];
      let currentNode;
      while (currentNode = walker.nextNode()) {
        nodes.push(currentNode);
      }
      return nodes;
    }
    let textNodes = getTextNodes(tempDiv);
    
    // Use a delimiter that is unlikely to occur in text.
    const delimiter = "<<<DELIM>>>";
    let joinedText = textNodes.map(node => node.nodeValue).join(delimiter);
    
    // Set translation instructions and model list.
    let selectedLanguage = $('#source-language').val();
    let translationInstructions = "custom-instructions/translation/english2french1.txt";
    if (selectedLanguage == "French") { 
      translationInstructions = "custom-instructions/translation/french2english.txt"; 
    }
    let models = [
      "mistralai/mistral-nemo:free",
      "cognitivecomputations/dolphin3.0-r1-mistral-24b:free",
      "cognitivecomputations/dolphin3.0-mistral-24b:free",
      "mistralai/mistral-small-24b-instruct-2501:free",
      "mistralai/mistral-7b-instruct:free"
    ];
    
    // Load the system prompt from your file.
    let systemPrompt = await $.get(translationInstructions);
    
    // Build the request JSON.
    let requestJson = [
      { role: "system", content: systemPrompt },
      { role: "user", content: joinedText }
    ];
    
    // Iterate over your model list until one returns a valid response.
    let translatedJoinedText = null;
    for (let model of models) {
      let ORjson = await getORData(model, requestJson);
      if (ORjson && ORjson.choices && ORjson.choices.length > 0 && ORjson.choices[0].message) {
        translatedJoinedText = ORjson.choices[0].message.content;
        break;
      }
    }
    if (!translatedJoinedText) {
      alert("Translation failed. No valid response from any model.");
      return;
    }
    
    // Remove extraneous content before the first occurrence and after the last occurrence of the delimiter.
    function cleanTranslatedText(text, delimiter) {
      let first = text.indexOf(delimiter);
      if (first !== -1) {
        text = text.substring(first);
      }
      let last = text.lastIndexOf(delimiter);
      if (last !== -1 && last + delimiter.length < text.length) {
        text = text.substring(0, last + delimiter.length);
      }
      return text;
    }
    translatedJoinedText = cleanTranslatedText(translatedJoinedText, delimiter);
    
    // Split the translated text back using the delimiter.
    let translatedSegments = translatedJoinedText.split(delimiter);
    if (translatedSegments.length !== textNodes.length) {
      console.warn("Mismatch in number of segments. Possibly some delimiters were removed.");
      // Fallback: Normalize the entire raw translated output as HTML.
      function normalizeHtmlContent(htmlContent) {
        let $container = $("<div>").html(htmlContent);
        $container.contents().filter(function() {
          return this.nodeType === 3 && !/\S/.test(this.nodeValue);
        }).remove();
        return $container.html().trim();
      }
      let finalHtml = normalizeHtmlContent(translatedJoinedText);
      $('#translation-A').html(finalHtml);
    } else {
      // Reassign each text node's value with its corresponding translated segment.
      textNodes.forEach((node, index) => {
        node.nodeValue = translatedSegments[index] || "";
      });
      // Optional: further normalize the resulting HTML.
      function normalizeHtmlContent(htmlContent) {
        let $container = $("<div>").html(htmlContent);
        $container.contents().filter(function() {
          return this.nodeType === 3 && !/\S/.test(this.nodeValue);
        }).remove();
        return $container.html().trim();
      }
      let normalizedHtml = normalizeHtmlContent(tempDiv.innerHTML);
      $('#translation-A').html(normalizedHtml);
    }
    
    $("#translation-preview").removeClass("hidden");
  } catch (error) {
    console.error("Error during DOCX translation:", error);
    alert("Error during file translation. Please check the console for details.");
  }
}else if (fileExtension === 'pptx' || fileExtension === 'xlsx') {
        try {
          const englishXml = await extractXmlFromFile(file);
          if (!englishXml) { throw new Error("No XML extracted from file."); }
          let updatedXml = await conversionGemini(englishXml, fileExtension);
          let formattedOutput = formatTranslatedOutput(updatedXml);
          $('#translation-A').html(formattedOutput);
          $("#translation-preview").removeClass("hidden");
        } catch (error) {
          console.error("Error during file translation:", error);
          alert("Error during file translation. Please check the console for details.");
        }
      } else {
        alert("Unsupported file type for translation.");
      }
    } else if (selectedOption == "source-upload-text") {
      var sourceText = $("#source-text").text();
      var selectedLanguage = $('#source-language').val();
      let translationInstructions = "custom-instructions/translation/english2french.txt";
      if (selectedLanguage == "French") { 
        translationInstructions = "custom-instructions/translation/french2english.txt"; 
      }
      $("#translation-preview").removeClass("hidden");
      let models = [
          "mistralai/mistral-nemo:free",
          "cognitivecomputations/dolphin3.0-r1-mistral-24b:free",
          "cognitivecomputations/dolphin3.0-mistral-24b:free",
          "mistralai/mistral-small-24b-instruct-2501:free",
          "mistralai/mistral-7b-instruct:free"
      ];
      let translationResult = await translateText(sourceText, models, translationInstructions, selectedLanguage);
      let formattedOutput = formatTranslatedOutput(translationResult);
      $('#translation-A').html(formattedOutput);
      // Handle compare options if selected.
      let selectedCompare = $('input[name="translations-instructions-compare"]:checked').val();
      let selectedModel = $('input[name="translate-model-b-option"]:checked').val();
      if (selectedCompare == "translations-llm-compare" && selectedModel != "") {
        let compareResult = await translateText(sourceText, selectedModel, translationInstructions, selectedLanguage);
        if (compareResult != "") {
          $('#translation-B').html(formatTranslatedOutput(compareResult));
          $('#translation-model-B').html(selectedModel);
          $('#accept-translation-A-btn, #accept-translation-B-btn').removeClass("hidden");
          if ($('#translation-B').hasClass("hidden")) {
            toggleComparisonElement($('#translation-A-container'), $('#translation-B-container'));
          }
        }
      } else if (selectedCompare == "translations-instructions-compare") {
        let compareResult = await translateText(sourceText, models, translationInstructions.replace(".txt", "-B.txt"), selectedLanguage);
        if (compareResult != "") {
          $('#translation-B').html(formatTranslatedOutput(compareResult));
          $('#translation-model-B').html("Instructions Compare");
          $('#accept-translation-A-btn, #accept-translation-B-btn').removeClass("hidden");
          if ($('#translation-B').hasClass("hidden")) {
            toggleComparisonElement($('#translation-A-container'), $('#translation-B-container'));
          }
        }
      }
    }
  }); 
 
// 'Provide translation' button, show the second upload section
$("#source-upload-provide-btn").click(function() {
    if (!englishFile) {
      alert("Please upload the English document first.");
      return;
    }
    $("#second-upload").removeClass("hidden");
  }); 
  
  /***********************************************************************
   * Provide Translation Button Flow:
   * show the second upload section
  ***********************************************************************/
  $("#source-upload-provide-btn").click(function() {
    $("#second-upload").removeClass("hidden"); 
    console.log($("#translation-A").html());
  });

  function removeCodeFences(str) {
  // Remove a leading line that starts with ``` (plus any following text)
  str = str.replace(/^```.*\n/, '');
  // Remove any trailing lines that contain only backticks and optional whitespace
  str = str.replace(/\n\s*```+\s*$/, '');
  return str.trim();
}
  // Add event listener for "convert back to document" link
  $("a[href='#convert-translation']").click(function(e) {
    e.preventDefault();
    if ($("#translation-preview").is(":visible")) { 
       $("#convert-translation").removeClass("hidden");  
       $("#translated-doc-download").removeClass("hidden");
        // Optionally, scroll to the conversion card
        $('html, body').animate({
            scrollTop: $("#convert-translation").offset().top
        }, 500);
    } else {
        alert("Please complete the translation before converting back to document.");
    }
});

  /***********************************************************************
   * Second File Upload Button
   * For the second file uploads, extract and parse
   ***********************************************************************/
$("#second-upload-btn").click(async function () {
  $('#processing-spinner').removeClass("hidden");
  console.log("Spinner should now be visible.");

  const selectedOption = $('input[name="second-upload-option"]:checked').val();
  let frenchText = "";

  if (selectedOption === "second-upload-doc") {
    const file = $('#second-file')[0].files[0];

    if (!file) {
      alert("Please select your translated file.");
      $('#processing-spinner').addClass("hidden");
      return;
    }

    try {
      const fileExtension = file.name.split('.').pop().toLowerCase();

      if (fileExtension === "docx" || fileExtension === "xlsx") {
        frenchText = await handleFileExtractionToHtml(file);
      } else if (fileExtension === "pptx") {
        const arrayBuffer = await file.arrayBuffer();
        const textElements = await extractPptxTextXmlWithId(arrayBuffer);
        frenchText = textElements.map(item => `<p>${item.text}</p>`).join('');
      } else {
        throw new Error("Unsupported file type");
      }

      console.log("French text after extraction:", frenchText);
    } catch (err) {
      console.error('Error processing the second (FR) file:', err);
      alert("Error reading your translated file. Check console for details.");
      $('#converting-spinner').addClass("hidden");
      $('#processing-spinner').addClass("hidden");
      return;
    }
  } else if (selectedOption === "second-upload-text") {
    frenchText = $("#second-text").val();
  }

  if (!frenchText || frenchText.trim().length === 0) {
    alert("No French document/text found. Please upload or enter your translation.");
    $('#converting-spinner').addClass("hidden");
    $('#processing-spinner').addClass("hidden");
    return;
  }

  // 2) Get the English HTML from the first upload section
  let englishHtml = $("#translation-A").html();
  if (!englishHtml || englishHtml.trim().length === 0) {
    alert("No formatted English document found. Please complete the first step.");
    $('#converting-spinner').addClass("hidden");
    $('#processing-spinner').addClass("hidden");
    return;
  }

  // Determine prompt based on original English file extension
  const fileExtensionEnglish = (englishFile?.name || "").split('.').pop().toLowerCase();
  const promptPath = (fileExtensionEnglish === "pptx")
    ? "custom-instructions/translation/english2french-pptx.txt"
    : "custom-instructions/translation/english2french1.txt";

  let systemPrompt = "";
  try {
    systemPrompt = await $.get(promptPath);
  } catch (error) {
    console.error("Error loading system prompt:", error);
    alert("Could not load translation instructions. Please check your files.");
    $('#converting-spinner').addClass("hidden");
    $('#processing-spinner').addClass("hidden");
    return;
  }

  const combinedPrompt = `${systemPrompt}\n\nEnglish Document (HTML):\n${englishHtml}\n\nFrench Text:\n${frenchText}\n\nPlease return the French document in HTML format that exactly follows the structure of the English document.`;

  const requestJson = [
    { role: "system", content: systemPrompt },
    { role: "user", content: combinedPrompt }
  ];

  const models = [
    "google/gemini-2.0-flash-lite-preview-02-05:free",
    "google/gemini-2.0-pro-exp-02-05:free",
    "google/gemini-2.0-flash-thinking-exp:free",
    "meta-llama/llama-3.3-70b-instruct:free",
    "nvidia/llama-3.1-nemotron-70b-instruct:free",
    "google/gemini-2.0-flash-exp:free",
    "google/gemini-exp-1206:free",
    "google/gemini-flash-1.5-8b-exp",
    "deepseek/deepseek-r1:free"
  ];

  let finalFrenchHtml = "";
  for (let model of models) {
    const ORjson = await getORData(model, requestJson); 
    console.log(`Model: ${model}`, ORjson);
    if (ORjson?.choices?.[0]?.message) {
      finalFrenchHtml = ORjson.choices[0].message.content; 
        console.log("Raw AI output:", finalFrenchHtml);
      break;
    }
  }

  try {
  if (!finalFrenchHtml) {
    alert("Translation alignment failed. No valid response from any model.");
    return;
  }

  finalFrenchHtml = removeCodeFences(finalFrenchHtml);
   
  const fileExtension = (englishFile?.name || "").split('.').pop().toLowerCase();
  let formattedOutput; 

  if (fileExtension === 'pptx') {
  const tempDiv = document.createElement("div");
  tempDiv.innerHTML = finalFrenchHtml;
  const rawParagraphs = Array.from(tempDiv.querySelectorAll("p[id]"));
  const rebuilt = [];

  for (let i = 0; i < rawParagraphs.length; i++) {
    const currText = rawParagraphs[i].textContent.trim();
    const currId = rawParagraphs[i].id;

    if (/^[dlLcsà'‘’`’“”]$/.test(currText) && rawParagraphs[i + 1]) {
      const nextText = rawParagraphs[i + 1].textContent.trim();
      rebuilt.push(`<p id="${currId}">${currText}${nextText}</p>`);
      i++;
    } else {
      rebuilt.push(`<p id="${currId}">${currText}</p>`);
    }
  }
 
  finalFrenchHtml = rebuilt.join('');  
  formattedOutput = finalFrenchHtml;
  } else {
    formattedOutput = formatTranslatedOutput(finalFrenchHtml);
  } 

  if (!formattedOutput || formattedOutput.trim() === "") {
  alert("Formatted output is empty. Please check the AI response.");
} else {
  $("#translation-A").html(formattedOutput);
  $("#translation-preview").removeClass("hidden").show();
}
  console.log("Final French HTML (cleaned):", finalFrenchHtml);

} catch (err) {
  console.error("Error during final output processing:", err);
  alert("An error occurred while processing the AI output.");
} finally {
  $('#converting-spinner').addClass("hidden"); 
  $('#processing-spinner').addClass("hidden");
}
 });
// Accept and edit translation button handlers
$("#accept-translation-A-btn").click(function () { acceptTranslation("a"); });
$("#accept-translation-B-btn").click(function () { acceptTranslation("b"); });
$("#edit-translation-A-btn").click(function () {
  const $translation = $('#translation-A');
  const isEditable = $translation.attr('contenteditable') === 'true';
  $translation.attr('contenteditable', !isEditable);
  $(this).attr('title', isEditable ? 'Edit Code' : 'Save Code');
  $(this).find('i').toggleClass('fa-edit fa-save');
});
  
   /***********************************************************************
   * Convert-translation-download-button work flow:
   * When the user clicks the Download button, the download button will show
   * the file will be downloaded
   ***********************************************************************/
$("#convert-translation-download-btn").click(async function() {
  try {
    $('#converting-spinner').removeClass("hidden");
    
    // 1) Grab the final, user-edited HTML
    let finalFrenchHtml = $("#translation-A").html();
    if (!finalFrenchHtml || finalFrenchHtml.trim().length === 0) {
      alert("No formatted French document available.");
      $('#converting-spinner').addClass("hidden");
      return;
    }

    // 2) Determine the file type from the original English file
    let fileExtension = englishFile 
      ? englishFile.name.split('.').pop().toLowerCase() 
      : 'docx';
    let mimeType = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    if (fileExtension === 'pptx') {
      mimeType = "application/vnd.openxmlformats-officedocument.presentationml.presentation";
    } else if (fileExtension === 'xlsx') {
      mimeType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    }

    // 3) Generate the Blob (DOCX, PPTX, or XLSX)
    let generatedBlob;
    if (fileExtension === 'docx') {
      // Example: using htmlDocx.asBlob with Calibri
      let fullHtml = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="UTF-8">
            <style>
              body { font-family: Calibri, "Calibri (Body)", sans-serif; }
            </style>
          </head>
          <body>
            ${finalFrenchHtml}
          </body>
        </html>
      `;
      generatedBlob = htmlDocx.asBlob(fullHtml);
    } else if (fileExtension === 'pptx') {
      const arrayBuffer = await englishFile.arrayBuffer();
      const zip = await JSZip.loadAsync(arrayBuffer);
      const slideRegex = /^ppt\/slides\/slide(\d+)\.xml$/i;

      for (const fileName of Object.keys(zip.files)) {
        const match = slideRegex.exec(fileName);
        if (match) {
          const slideNumber = match[1];
          const slideXml = await zip.file(fileName).async("string");
          const updatedSlideXml = conversionPptxXml(slideXml, finalFrenchHtml, slideNumber);
          zip.file(fileName, updatedSlideXml);
        }
      }
      generatedBlob = await zip.generateAsync({ type: "blob", mimeType: mimeType });
    } else if (fileExtension === 'xlsx') {
      // Add XLSX logic 
    }
    if (!generatedBlob) {
      alert("File generation failed.");
      $('#converting-spinner').addClass("hidden");
      return;
    }

    // 4) Download the file
    let englishFileName = englishFile 
      ? englishFile.name.split('.').slice(0, -1).join('.') 
      : "translated-file";
    let modifiedFileName = `${englishFileName}-FR.${fileExtension}`;

    let downloadLink = document.createElement('a');
    downloadLink.href = URL.createObjectURL(generatedBlob);
    downloadLink.download = modifiedFileName;
    downloadLink.click();
    URL.revokeObjectURL(downloadLink.href);

  } catch (error) {
    console.error("An error occurred:", error);
  } finally {
    $('#converting-spinner').addClass("hidden");
  }
});
  }); 
//************************************************************************************
//* Add a pre-cleaning step to rebuild any broken French lines from the AI output ***** 
//* Can be added more if needed                                                   ***** 
//*************************************************************************************/
function deduplicateFrenchParagraphs(finalFrenchHtml) {
  const tempDiv = document.createElement("div");
  tempDiv.innerHTML = finalFrenchHtml;

  const seenTexts = new Set();
  const cleanedParagraphs = [];

  const paragraphs = Array.from(tempDiv.querySelectorAll("p[id]"));
  for (const p of paragraphs) {
    const cleanText = p.textContent.trim();
    if (!seenTexts.has(cleanText)) {
      seenTexts.add(cleanText);
      cleanedParagraphs.push(p.outerHTML);
    }
  }

  return cleanedParagraphs.join("");
} 
function buildFrenchTextMap(finalFrenchHtml) { 
  finalFrenchHtml = deduplicateFrenchParagraphs(finalFrenchHtml);
  const tempDiv = document.createElement("div");
  tempDiv.innerHTML = finalFrenchHtml;

  const rawParagraphs = Array.from(tempDiv.querySelectorAll("p[id]"));

  // Step 1: Rebuild any broken phrases like "d" + "'identifier"
  const rebuilt = [];
  for (let i = 0; i < rawParagraphs.length; i++) {
    const curr = rawParagraphs[i].textContent.trim();
     if (i > 0 && !rebuilt[rebuilt.length - 1].text.endsWith(" ") && !curr.startsWith(" ")) {
  rebuilt[rebuilt.length - 1].text += " ";
}
rebuilt.push({ id: rawParagraphs[i].id, text: curr });
 
  }

  // Build a map from rebuilt result
  const frenchMap = {};
  for (const { id, text } of rebuilt) {
    frenchMap[id] = text;
  }

  return frenchMap;
}

function escapeXml(str) {
  return str.replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;");
}

// Helper function to convert French HTML back to PPTX XML:
function conversionPptxXml(originalXml, finalFrenchHtml, slideNumber) {
  const frenchMap = buildFrenchTextMap(finalFrenchHtml);
  let runIndex = 1;

 const updatedXml = originalXml.replace(/<a:r>[\s\S]*?<a:t>([\s\S]*?)<\/a:t>[\s\S]*?<\/a:r>/g, (match, capturedText) => {
      const key = `S${slideNumber}_T${runIndex++}`;
      let newText = frenchMap[key] || capturedText;

      if (newText === undefined || !newText.trim()) {
        newText = " "; // fallback to keep structure
      }
      
      const escaped = escapeXml(newText);
      return match.replace(capturedText, newText);
    }
  );

  return updatedXml;
}
  
// Function to generate a file blob from the zip and XML content.
function generateFile(zip, xmlContent, mimeType, renderFunction) {
  try {
    zip.file("file.xml", xmlContent);
    if (typeof renderFunction === 'function') { renderFunction(); }
  } catch (error) {
    console.error("Error during file generation:", error);
  }
  return zip.generateAsync({ type: "blob", mimeType: mimeType });
}

// Create XML content for the final file based on file extension.
function createXmlContent(fileExtension, updatedXml) {
  let xmlContent = '';
  if (fileExtension === 'docx') {
    xmlContent = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
      <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
      <w:body>
        ${updatedXml}
      </w:body>
      </w:document>`;
  } else if (fileExtension === 'pptx') {
    xmlContent = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
      <p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
        <p:sldMasterIdLst>${updatedXml}</p:sldMasterIdLst>
      </p:presentation>`;
  } else if (fileExtension === 'xlsx') {
    xmlContent = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
      <workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
        <sheetData>${updatedXml}</sheetData>
      </workbook>`;
  }
  return xmlContent;
}

// (The functions fallbackAlignLines, conversionDocxTemplater, conversionGemini, translateText, acceptTranslation, and detectLanguageBasedOnWords remain unchanged.)

function fallbackAlignLines(originalLines, adjustedText) {
  let words = adjustedText.split(/\s+/).filter(w => w.trim() !== "");
  let targetLineCount = originalLines.length;
  let wordsPerLine = Math.ceil(words.length / targetLineCount);
  let newLines = [];
  for (let i = 0; i < targetLineCount; i++) {
    let lineWords = words.slice(i * wordsPerLine, (i + 1) * wordsPerLine);
    newLines.push(lineWords.join(" "));
  }
  return newLines;
}

async function conversionDocxTemplater(englishXml) {
  const textNodes = [];
  const regex = /<w:t[^>]*>([\s\S]*?)<\/w:t>/g;
  let match;
  while ((match = regex.exec(englishXml)) !== null) {
    textNodes.push(match[1]);
  }
  console.log("Getting French...");

  // Divide the text nodes into chunks (milestones).
  const chunkSize = 10;
  const textChunks = [];
  for (let i = 0; i < textNodes.length; i += chunkSize) {
    textChunks.push(textNodes.slice(i, i + chunkSize));
  }
  
  const systemGeneral = { role: "system", content: await $.get("custom-instructions/system/match-syntax-for-xml.txt") };
  const retrySystemGeneral = { role: "system", content: await $.get("custom-instructions/system/match-syntax-for-xml-retry.txt") };
  const translatedText = $("#translation-A").text().trim();
  
  let chunkCounter = 1;
  let adjustedFrenchText = "";
  
  for (const chunk of textChunks) {
    const englishReference = chunk.join("\n");
    const requestJson = [
      systemGeneral,
      { role: "user", content: "English Reference (part " + chunkCounter + " of " + textChunks.length + "):" + englishReference },
      { role: "user", content: "Translated French (for the full document): " + translatedText }
    ];
    
    let ORjson = await getORData("google/gemini-2.0-flash-lite-preview-02-05:free", requestJson);
    let adjustedChunkText;
    if (!ORjson || !ORjson.choices || !ORjson.choices[0] || !ORjson.choices[0].message) {
      console.error("No response from GenAI for chunk", chunkCounter, "using fallback.");
      adjustedChunkText = translatedText;
    } else {
      adjustedChunkText = ORjson.choices[0].message.content;
    }
    
    let adjustedLines = adjustedChunkText.split(/[\r\n]+/).filter(line => line.trim() !== "");
    let retryCount = 0;
    
    while (chunk.length !== adjustedLines.length && retryCount < 3) {
      console.log("Mismatch detected for chunk", chunkCounter, "attempting adjustment.");
      const retryRequestJson = [
        retrySystemGeneral,
        { role: "user", content: "English Reference (" + chunk.length + " lines): " + englishReference },
        { role: "user", content: "Translated French (" + translatedText.split(/[\r\n]+/).filter(line => line.trim() !== "").length + "): " + adjustedChunkText }
      ];
      const retryORjson = await getORData("google/gemini-2.0-flash-lite-preview-02-05:free", retryRequestJson);
      if (!retryORjson || !retryORjson.choices || !retryORjson.choices[0] || !retryORjson.choices[0].message) {
        console.error("Error adjusting the French text for chunk", chunkCounter, "using fallback.");
        adjustedLines = fallbackAlignLines(chunk, translatedText);
        break;
      }
      adjustedChunkText = retryORjson.choices[0].message.content;
      adjustedLines = adjustedChunkText.split(/[\r\n]+/).filter(line => line.trim() !== "");
      retryCount++;
    }
    
    adjustedFrenchText += adjustedLines.join("\n") + "\n";
    chunkCounter++;
  }
  
  const translatedLines = adjustedFrenchText.split(/[\r\n]+/).filter(line => line.trim() !== "");
  if (textNodes.length !== translatedLines.length) {
    console.error("Mismatch between full documents after alignment. Using fallback for entire document.");
    adjustedFrenchText = fallbackAlignLines(textNodes, translatedText).join("\n");
  }
  
  let updatedXml = englishXml;
  textNodes.forEach((node, index) => {
    const escapedNode = node.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
    const regexNode = new RegExp(`<w:t[^>]*>${escapedNode}<\/w:t>`);
    updatedXml = updatedXml.replace(regexNode, `<w:t>${translatedLines[index] || ""}</w:t>`);
  });
  return updatedXml;
}

async function conversionGemini(englishXml, fileType) {
  let groups = [];
  let formattedChunks = [];
  let paragraphs = [];
  const systemGeneral = { role: "system", content: await $.get("custom-instructions/system/xml-docx-formatting.txt") };
  if (fileType === 'docx') {
    paragraphs = englishXml.match(/<w:p[\s\S]*?<\/w:p>/g) || [];
    console.log(`Total paragraphs found: ${paragraphs.length}`);
  } else if (fileType === 'pptx') {
    paragraphs = englishXml.match(/<p:sld[\s\S]*?<\/p:sld>/g) || [];
    console.log(`Total slides found: ${paragraphs.length}`);
  } else if (fileType === 'xlsx') {
    paragraphs = englishXml.match(/<sheetData[\s\S]*?<\/sheetData>/g) || [];
    console.log(`Total rows found: ${paragraphs.length}`);
  }
  const maxRequests = 30;
  let groupSize = Math.ceil(paragraphs.length / maxRequests);
  console.log(`Grouping paragraphs into batches of ${groupSize} (max ${maxRequests} requests)`);
  for (let i = 0; i < paragraphs.length; i += groupSize) {
    groups.push(paragraphs.slice(i, i + groupSize).join("\n"));
  }
  console.log(`Total groups to process: ${groups.length}`);
  let model = [
    "google/gemini-2.0-flash-lite-preview-02-05:free",
    "google/gemini-2.0-pro-exp-02-05:free",
    "google/gemini-2.0-flash-thinking-exp:free",
    "meta-llama/llama-3.3-70b-instruct:free",
    "nvidia/llama-3.1-nemotron-70b-instruct:free",
    "google/gemini-2.0-flash-exp:free",
    "google/gemini-exp-1206:free",
    "google/gemini-flash-1.5-8b-exp",
    "deepseek/deepseek-r1:free"
  ];
  let modelCount = 0;
  for (let i = 0; i < groups.length;) {
    console.log(`Processing group ${i + 1}/${groups.length}...`);
    const escapedContent = groups[i].replace(/[&<>]/g, match => ({
      '&': "&amp;",
      '<': "&lt;",
      '>': "&gt;"
    }[match]));
    const requestJson = [ systemGeneral, { role: "user", content: "English DOCX group: " + escapedContent } ];
    let ORjson = await getORData(model[modelCount], requestJson);
    if (!ORjson || !ORjson.choices || ORjson.choices.length === 0) {
      console.error(`API request failed for group ${i + 1} with model ${model[modelCount]}:`, ORjson);
      modelCount++;
      if (modelCount >= model.length) {
        console.error(`All models exhausted for group ${i + 1}. Skipping this group.`);
        i++;
        modelCount = 0;
        continue;
      }
      console.log(`Retrying with model ${model[modelCount]}...`);
      continue;
    }
    let aiResponse = ORjson.choices[0]?.message?.content || "";
    console.log(`Group ${i + 1} Response:\n`, aiResponse);
    let formattedText = formatAIResponse(aiResponse);
    formattedText = ensureCompleteXML(formattedText);
    if (!formattedText) {
      console.error(`Skipping group ${i + 1} due to formatting issues.`);
      continue;
    }
    formattedChunks.push(formattedText);
    i++;
  }
  let updatedXml;
  if (fileType === 'docx') {
    updatedXml = formattedChunks.map(chunk => extractBodyContent(chunk)).join("\n");
  } else if (fileType === 'pptx') {
    updatedXml = formattedChunks.map(chunk => extractSlideContent(chunk)).join("\n");
  } else if (fileType === 'xlsx') {
    updatedXml = formattedChunks.map(chunk => extractRowContent(chunk)).join("\n");
  }
  return updatedXml;
}

function extractBodyContent(chunk) {
  return chunk.match(/<w:t[\s\S]*?<\/w:t>/g) || [];
}
function extractSlideContent(chunk) {
  return chunk.match(/<p:sp[\s\S]*?<\/p:sp>/g) || [];
}
function extractRowContent(chunk) {
  return chunk.match(/<row[\s\S]*?<\/row>/g) || [];
}

async function translateText(source, models, instructions, sourceLanguage) {
  const systemGeneral = { role: "system", content: await $.get(instructions) };
  var glossary;
  var systemGlossary;
  if ($('#translations-glossary').prop('checked')) {
    try {
      glossary = await $.get("custom-instructions/translation/en-fr-glossary.json");
    } catch (error) {
      console.error("Unexpected error in glossary get:", error);
      return error;
    }
    glossary = glossary.filter(entry => {
      return sourceLanguage === "French"
                ? source.toLowerCase().includes(entry.FR.toLowerCase())
                : source.toLowerCase().includes(entry.EN.toLowerCase());
    });
    systemGlossary = glossary.length > 0 ? { role: "system", content: glossary } : null;
  } else {
    systemGlossary = null;
  }
  let requestJson = [systemGeneral];
  if (systemGlossary) { requestJson.push(systemGlossary); }
  requestJson.push({ role: "user", content: source });
  for (let model of models) {
    try {
      console.log(`Attempting translation with model: ${model}`);
      let ORjson = await getORData(model, requestJson);
      if (ORjson && ORjson.choices && ORjson.choices.length > 0) {
        return ORjson.choices[0].message.content;
      } else {
        console.error(`Model ${model} returned an unexpected response:`, ORjson);
      }
    } catch (error) {
      console.error(`Error calling getORData with model ${model}:`, error);
    }
  }
  console.error("All models failed to translate.");
  return "error";
}

function acceptTranslation(option) {
  if (option == "b") { $("#translation-A").text($("#translation-B").text()); }
  $("#edit-translation-A-btn").removeClass("hidden");
  $("#accept-translation-A-btn, #accept-translation-B-btn").addClass("hidden");
  $(".convert-translation").removeClass("hidden");
  toggleComparisonElement($('#translation-A-container'), $('#translation-B-container'));
}

function detectLanguageBasedOnWords(text) {
  const englishWords = ['the', 'and', 'is', 'in', 'it', 'to', 'of', 'for', 'on', 'with'];
  const frenchWords = ['le', 'la', 'et', 'est', 'dans', 'il', 'à', 'de', 'pour', 'sur'];
  text = text.toLowerCase();  
 function countMatches(wordList) {
    return wordList.reduce((count, word) => {
      const regex = new RegExp(`\\b${word}\\b`, 'g');
      return count + ((text.match(regex) || []).length);
    }, 0);
  }
  const englishMatches = countMatches(englishWords); 
  const frenchMatches = countMatches(frenchWords);  

  const hasAccents = /[àâçéèêëîïôûùüÿœæ]/.test(text); 
  if (frenchMatches > englishMatches || (hasAccents && frenchMatches >= englishMatches - 1)) {
    return 'french';
  } else if (englishMatches > frenchMatches) {
    return 'english';
  } else {
    return 'unknown';
  }
}
