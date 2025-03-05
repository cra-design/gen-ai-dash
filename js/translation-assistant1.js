let generatedDownloadFile = null; 

// Helper function to wrap file extraction into a Promise.
function extractXmlFromFile(file) {
  return new Promise((resolve, reject) => {
    // Call handleFileExtractionToXML with proper callbacks.
    handleFileExtractionToXML(file, resolve, reject);
  });
}

// Function to format raw translated output into structured HTML.
// Splits text into paragraphs using double-newlines and replaces remaining newlines with <br> tags.
function formatTranslatedOutput(rawText) {
  if (!rawText) return "";
  rawText = rawText.trim();
  let paragraphs = rawText.split(/\n\s*\n/);
  let formatted = paragraphs.map(p => `<p>${p.replace(/\n/g, '<br>')}</p>`).join('');
  return formatted;
}

$(document).ready(function() {

  // Handle radio button changes for various upload and compare options.
  $(document).on("click", "input[type=radio]", function (event) {
    var target = event.target;
    if (target.name == "source-upload-option") {
      $('#source-doc-upload, #text-upload, #second-upload, #translation-preview, #convert-translation').addClass("hidden");
      if (target.id == "source-upload-doc") {
        $('#source-doc-upload').removeClass("hidden");
      } else if (target.id == "source-upload-text") {
        $('#text-upload').removeClass("hidden");
      }
    } else if (target.name == "second-upload-option") {
      $('#second-doc-upload, #second-text-upload').addClass("hidden");
      if (target.id == "second-upload-doc") {
        $('#second-doc-upload').removeClass("hidden");
      } else if (target.id == "second-upload-text") {
        $('#second-text-upload').removeClass("hidden");
      }
    } else if (target.name == "translations-compare") {
      if (target.id == "translations-llm-compare") {
        $('#genai-model-options').removeClass("hidden");
      } else if (target.id == "translations-instructions-compare" || target.id == "translations-no-compare") {
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
    if (detectedLanguage == 'unknown') { detectedLanguage = 'english'; }
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
      var validExtensions = ["docx", "xlsx", "ppt"];
      var validMimeTypes = [
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "application/vnd.ms-powerpoint"
      ];
      if (!validExtensions.includes(fileExtension) || !validMimeTypes.includes(uploadedFile.type)) {
          $(`#${language}-doc-error`).removeClass("hidden");
          $(`#${language}-doc-detecting`).addClass("hidden");
          $(`#${language}-language-heading`).removeClass("hidden");
          return;
      }
      try {
          let textContent = await handleFileExtraction(uploadedFile);
          if (!textContent) { throw new Error("No text extracted."); }
          var detectedLanguage = detectLanguageBasedOnWords(textContent);
          if (detectedLanguage !== "french") { detectedLanguage = "english"; }
          $(`#${language}-doc-detecting`).addClass("hidden");
          $(`#${language}-language-doc`).val(detectedLanguage).removeClass("hidden");
      } catch (err) {
          console.error('Error processing source file:', err);
          $(`#${language}-doc-error`).removeClass("hidden");
          $(`#${language}-doc-detecting, #${language}-language-heading`).addClass("hidden");
      }
    }
  });

  /***********************************************************************
   * Translate Button Flow:
   * For file uploads, extract XML and use a conversion function that applies 
   * milestone matching (with retries). For plain text, use the existing translation.
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
      try {
        const englishXml = await extractXmlFromFile(file);
        if (!englishXml) { throw new Error("No XML extracted from file."); }
        let updatedXml;
        if (fileExtension === 'docx') {
          updatedXml = await conversionDocxTemplater(englishXml);
        } else if (fileExtension === 'pptx' || fileExtension === 'xlsx') {
          updatedXml = await conversionGemini(englishXml, fileExtension);
        } else {
          throw new Error("Unsupported file type for translation.");
        }
        let formattedOutput = formatTranslatedOutput(updatedXml);
        $('#translation-A').html(formattedOutput);
        $("#translation-preview, #convert-translation-to-doc-btn").removeClass("hidden");
      } catch (error) {
        console.error("Error during file translation:", error);
        alert("Error during file translation. Please check the console for details.");
      }
    } else if (selectedOption == "source-upload-text") {
      var sourceText = $("#source-text").text();
      var selectedLanguage = $('#source-language').val();
      let translationInstructions = "custom-instructions/translation/english2french.txt";
      if (selectedLanguage == "French") { translationInstructions = "custom-instructions/translation/french2english.txt"; }
      $("#translation-preview, #convert-translation-to-doc-btn").removeClass("hidden");
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

  // Show second upload section.
  $("#source-upload-provide-btn").click(function() {
    $("#second-upload").removeClass("hidden");
  });

  // Second upload: manual translation.
  $("#second-upload-btn").click(async function() {
    var selectedOption = $('input[name="second-upload-option"]:checked').val();
    if (selectedOption == "second-upload-doc") {
      var file = $('#second-file')[0].files[0];
      try {
        let translatedText = await handleFileExtractionToHtml(file);
        console.log(translatedText);
        $('#translation-A').html(formatTranslatedOutput(translatedText));
        $("#translation-preview, .convert-translation").removeClass("hidden");
      } catch (err) {
        console.error('Error processing source file:', err);
      }
    } else if (selectedOption == "second-upload-text") {
      $('#translation-A').html(formatTranslatedOutput($("#second-text").val()));
      $("#translation-preview, .convert-translation").removeClass("hidden");
    }
  });

  // Accept and edit translation button handlers.
  $("#accept-translation-A-btn").click(function() { acceptTranslation("a"); });
  $("#accept-translation-B-btn").click(function() { acceptTranslation("b"); });
  $("#edit-translation-A-btn").click(function() {
    var $translation = $('#translation-A');
    var isEditable = $translation.attr('contenteditable') === 'true';
    if (isEditable) {
      $translation.attr('contenteditable', 'false');
      $(this).attr('title', 'Edit Code');
      $(this).find('i').removeClass('fa-save').addClass('fa-edit');
    } else {
      $translation.attr('contenteditable', 'true');
      $(this).attr('title', 'Save Code');
      $(this).find('i').removeClass('fa-edit').addClass('fa-save');
    }
  });

  // Create document button flow.
  $("#convert-translation-to-doc-btn").click(async function() {
    try {
      $('#converting-spinner').removeClass("hidden");
      const englishDocxData = $('#source-file')[0].files[0];
      if (!englishDocxData) {
        console.error("No file selected.");
        $('#converting-spinner').addClass("hidden");
        return;
      }
      const fileExtension = englishDocxData.name.split('.').pop().toLowerCase();
      if (!['docx', 'pptx', 'xlsx'].includes(fileExtension)) {
        console.error("Unsupported file type.");
        $('#converting-spinner').addClass("hidden");
        return;
      }
      // Step 1: Extract the XML from the original file.
      const englishXml = await new Promise((resolve, reject) => {
        handleFileExtractionToXML(englishDocxData,
          function(result) { resolve(result); },
          function(error) { console.error('Error processing English file:', error); reject(error); }
        );
      });
      if (!englishXml) {
        console.error("No XML document extracted.");
        $('#converting-spinner').addClass("hidden");
        return;
      }
      // Step 2: Translate the content using conversion functions.
      const selectedMethod = $('input[name="convert-translation-method"]:checked').val();
      let updatedXml;
      if (selectedMethod === "convert-translation-docx") {
        updatedXml = await conversionDocxTemplater(englishXml);
      } else {
        updatedXml = await conversionGemini(englishXml, fileExtension);
      }
      // Step 3: Generate the final translated file.
      const originalFileName = englishDocxData.name.split('.').slice(0, -1).join('.');
      const modifiedFileName = `${originalFileName}-FR.${fileExtension}`;
      const zipEN = new JSZip();
      const xmlContent = createXmlContent(fileExtension, updatedXml);
      let mimeType;
      if (fileExtension === 'docx') {
        mimeType = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
      } else if (fileExtension === 'pptx') {
        mimeType = "application/vnd.openxmlformats-officedocument.presentationml.presentation";
      } else if (fileExtension === 'xlsx') {
        mimeType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
      }
      generatedDownloadFile = await generateFile(zipEN, xmlContent, mimeType);
      $("#translated-doc-download").removeClass("hidden");
      $("#convert-translation-download-btn").attr("data-filename", modifiedFileName);
      $('#converting-spinner').addClass("hidden");
    } catch (error) {
      console.error("An error occurred:", error);
    } finally {
      $('#converting-spinner').addClass("hidden");
    }
  });

  $("#convert-translation-download-btn").click(function() {
    if (generatedDownloadFile) {
      let fileName = $(this).attr("data-filename") || "translated-file.docx";
      let downloadLink = document.createElement('a');
      downloadLink.href = URL.createObjectURL(generatedDownloadFile);
      downloadLink.download = fileName;
      downloadLink.click();
      URL.revokeObjectURL(downloadLink.href);
    } else {
      console.error("No file generated.");
    }
  });

});

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

// Helper function to align lines using word counts without GenAI.
// This fallback splits the entire adjusted text into words and groups them evenly.
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

// Conversion function for DOCX using milestone matching (Method A).
// It extracts <w:t> nodes, splits them into chunks, and uses GenAI (with retries) to align line counts.
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
    if (!ORjson || !ORjson.choices || !ORjson.choices[0] || !ORjson.choices[0].message) {
      alert("No response from GenAI. Please try again.");
      $('#converting-spinner').addClass("hidden");
      return;
    }
    
    let adjustedChunkText = ORjson.choices[0].message.content;
    // Use a robust newline split (matches \r, \n, or both).
    let adjustedLines = adjustedChunkText.split(/[\r\n]+/).filter(line => line.trim() !== "");
    let retryCount = 0;
    
    // If the number of lines does not match, attempt retries...
    while (chunk.length !== adjustedLines.length) {
      if (retryCount >= 3) {
        console.log("Too many retries. Falling back to fallbackAlignLines.");
        adjustedLines = fallbackAlignLines(chunk, adjustedChunkText);
        break;
      }
      console.log("Mismatch detected, sending back for adjustment... " + chunkCounter);
      const retryRequestJson = [
        retrySystemGeneral,
        { role: "user", content: "English Reference (" + chunk.length + " lines): " + englishReference },
        { role: "user", content: "Translated French (" + translatedText.split(/[\r\n]+/).filter(line => line.trim() !== "").length + "): " + adjustedChunkText }
      ];
      const retryORjson = await getORData("google/gemini-2.0-flash-lite-preview-02-05:free", retryRequestJson);
      if (!retryORjson || !retryORjson.choices || !retryORjson.choices[0] || !retryORjson.choices[0].message) {
        alert("Error adjusting the French text. Please try again.");
        $('#converting-spinner').addClass("hidden");
        return;
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
    alert("Mismatch between full documents after alignment.");
    $('#converting-spinner').addClass("hidden");
    return;
  }
  
  // Replace each original XML text node with its corresponding translated line.
  let updatedXml = englishXml;
  textNodes.forEach((node, index) => {
    const escapedNode = node.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
    const regexNode = new RegExp(`<w:t[^>]*>${escapedNode}<\/w:t>`);
    updatedXml = updatedXml.replace(regexNode, `<w:t>${translatedLines[index]}</w:t>`);
  });
  return updatedXml;
}

// Conversion function for PPTX/XLSX using a similar approach.
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

// Translation function that calls the GenAI API with optional glossary support.
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

// Accept translation function to finalize the selection.
function acceptTranslation(option) {
  if (option == "b") { $("#translation-A").text($("#translation-B").text()); }
  $("#edit-translation-A-btn").removeClass("hidden");
  $("#accept-translation-A-btn, #accept-translation-B-btn").addClass("hidden");
  $(".convert-translation").removeClass("hidden");
  toggleComparisonElement($('#translation-A-container'), $('#translation-B-container'));
}

// Simple language detection based on keyword matches.
function detectLanguageBasedOnWords(text) {
  const englishWords = ['the', 'and', 'is', 'in', 'it', 'to', 'of', 'for', 'on', 'with'];
  const frenchWords = ['le', 'la', 'et', 'est', 'dans', 'il', 'à', 'de', 'pour', 'sur'];
  text = text.toLowerCase();
  function countMatches(wordList) {
    return wordList.reduce((count, word) => count + (text.includes(word) ? 1 : 0), 0);
  }
  const englishMatches = countMatches(englishWords);
  const frenchMatches = countMatches(frenchWords);
  if (englishMatches > frenchMatches) { return 'english'; }
  else if (frenchMatches > englishMatches) { return 'french'; }
  else { return 'unknown'; }
}

