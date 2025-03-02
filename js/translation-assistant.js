// Global variable outside the document ready function
let generatedDownloadFile = null;


$(document).ready(function() {

  $(document).on("click", "input[type=radio]", function (event) {
    var target = event.target;
    if (target.name == "source-upload-option") {
      $('#source-doc-upload').addClass("hidden");
      $('#text-upload').addClass("hidden");
      $('#second-upload').addClass("hidden");
      $('#translation-preview').addClass("hidden");
      $('#convert-translation').addClass("hidden");
      if (target.id == "source-upload-doc") {
        $('#source-doc-upload').removeClass("hidden");
      } else if (target.id == "source-upload-text") {
        $('#text-upload').removeClass("hidden");
      }
    } else if (target.name == "second-upload-option") {
      // $('#second-translation-preview').addClass("hidden");
      $('#second-doc-upload').addClass("hidden");
      $('#second-text-upload').addClass("hidden");
      // if (target.id == "second-translate-english") {
      //   $('#second-translation-preview').removeClass("hidden");
      // } else
      if (target.id == "second-upload-doc") {
        $('#second-doc-upload').removeClass("hidden");
      } else if (target.id == "second-upload-text") {
        $('#second-text-upload').removeClass("hidden");
      }
    } else if (target.name == "translations-compare") {
      if (target.id == "translations-llm-compare") {
        $('#genai-model-options').removeClass("hidden");
      } else if (target.id == "translations-instructions-compare") {
        $('#genai-model-options').addClass("hidden");
      } else if (target.id == "translations-no-compare") {
        $('#genai-model-options').addClass("hidden");
      }
    }
  });

  $('#source-text').on('input', function() {
    $('#source-heading-detecting').removeClass("hidden");
    var text = $(this).val().trim();
    if (text.length === 0) {
      $('#source-language').addClass("hidden"); // Hide the select if textarea is empty
      return;
    }
    var detectedLanguage = detectLanguageBasedOnWords(text);
    // Default to English if the detection is unclear
    if (detectedLanguage == 'unknown') {
      detectedLanguage = 'english';
    }
    $('#source-heading-detecting').addClass("hidden");
    $('#source-language').removeClass("hidden");
    $('#source-language').val(detectedLanguage);
  });

  $(document).on("change", "input", async function (event) {
    if (event.target.id == "source-file" || event.target.id == "second-file") {
      let language = event.target.id === "source-file" ? "source" : "second";
      $(`#${language}-doc-detecting`).removeClass("hidden");
      $(`#${language}-multiple-msg`).addClass("hidden");
      $(`#${language}-doc-error`).addClass("hidden");
      $(`#${language}-language-heading`).removeClass("hidden");
      $(`#${language}-language-doc`).addClass("hidden");
      var fileList = event.target.files;
      if (!fileList || fileList.length === 0) return;
      if (fileList.length > 1) {
          $(`#${language}-multiple-msg`).removeClass("hidden");
          $(`#${language}-doc-detecting`).addClass("hidden");
          $(`#${language}-language-heading`).addClass("hidden");
          return;
      }
      var uploadedFile = fileList[0];
      var fileExtension = uploadedFile.name.split('.').pop().toLowerCase();
      // Allow docx, xlsx, and ppt
      var validExtensions = ["docx", "xlsx", "ppt"];
      var validMimeTypes = [
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // docx
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",      // xlsx
          "application/vnd.ms-powerpoint"                                          // ppt
      ];
      // Check if the file type and extension are valid
      if (!validExtensions.includes(fileExtension) || !validMimeTypes.includes(uploadedFile.type)) {
          $(`#${language}-doc-error`).removeClass("hidden");
          $(`#${language}-doc-detecting`).addClass("hidden");
          $(`#${language}-language-heading`).removeClass("hidden");
          return;
      }
      try {
          let textContent = await handleFileExtraction(uploadedFile);
          if (!textContent) {
              throw new Error("No text extracted.");
          }
          var detectedLanguage = detectLanguageBasedOnWords(textContent);
          if (detectedLanguage !== "french") {
              detectedLanguage = "english"; // Default to English
          }
          $(`#${language}-doc-detecting`).addClass("hidden");
          $(`#${language}-language-doc`).val(detectedLanguage).removeClass("hidden");
      } catch (err) {
          console.error('Error processing source file:', err);
          $(`#${language}-doc-error`).removeClass("hidden");
          $(`#${language}-doc-detecting`).addClass("hidden");
          $(`#${language}-language-heading`).addClass("hidden");
      }
    }
  });

  $("#source-upload-translate-btn").click(async function() {
    var selectedOption = $('input[name="source-upload-option"]:checked').val();
    var selectedCompare = $('input[name="translations-instructions-compare"]:checked').val();
    var selectedModel = $('input[name="translate-model-b-option"]:checked').val();
    const models = [
        "mistralai/mistral-nemo:free",
        "cognitivecomputations/dolphin3.0-r1-mistral-24b:free",
        "cognitivecomputations/dolphin3.0-mistral-24b:free",
        "mistralai/mistral-small-24b-instruct-2501:free",
        "mistralai/mistral-7b-instruct:free"
    ];
    var selectedLanguage = $('#source-language').val();
    var sourceText;
    //determine the source text to translate
    if (selectedOption == "source-upload-doc") {
      var file = $('#source-file')[0].files[0]; // Get the selected file from the English file input
      if (file) {
        try {
            sourceText = await handleFileExtractionToHtml(file);
        } catch (err) {
            console.error('Error processing source file:', err);
        }
      } else {
        $(`#source-doc-error`).removeClass("hidden");
        return;
      }
    } else if (selectedOption == "source-upload-text") {
      sourceText = $("#source-text").text();
    }
    let translationInstructions = "custom-instructions/translation/english2french.txt";
    if (selectedLanguage == "French") {
      translationInstructions = "custom-instructions/translation/french2english.txt";
    }
    $("#translation-preview").removeClass("hidden");
    $("#convert-translation-to-doc-btn").removeClass("hidden");
    let { translationA, modelUsed } = await translateText(sourceText, models, translationInstructions, selectedLanguage);
    $('#translation-A').html(translationA);
    $('#translation-model-A').html(modelUsed);
    let translationB;
    if (selectedCompare == "translations-llm-compare" && selectedModel != "") {
      let { translationB, modelUsed } = await translateText(sourceText, selectedModel, translationInstructions, selectedLanguage);
    } else if (selectedCompare == "translations-instructions-compare") {
      let { translationB, modelUsed } = await translateText(sourceText, models, translationInstructions.replace(".txt", "-B.txt"), selectedLanguage);
    } else {
      $(".convert-translation").removeClass("hidden");
      return;
    }
    if (translationB != "") {
      $('#translation-B').html(translationB);
      $('#translation-model-B').html(modelUsed);
      $('#accept-translation-A-btn').removeClass("hidden");
      $('#accept-translation-B-btn').removeClass("hidden");
      if ($('#translation-B').hasClass("hidden")) {
        toggleComparisonElement($('#translation-A-container'), $('#translation-B-container'));
      }
    }
  });
  $("#source-upload-provide-btn").click(function() {
    $("#second-upload").removeClass("hidden");
  });


  //A) We could do milestone matches with genAI calls - check the intervening line counts and narrow down mismatches, then handle by creating new fields?
    //-- How about manual guesses by looking at character counts on specific lines? This could minimize GenAI calls
  //B) We could translate just the text per field
  //C) Use text styling placeholders then rebuild them

  $("#second-upload-btn").click(async function() {
      // $("#second-upload").addClass("hidden");
      var selectedOption = $('input[name="second-upload-option"]:checked').val();
      // if (selectedOption == "second-translate-english") {
      //   $("#translation-preview-model-b").removeClass("hidden");
      // } else
      if (selectedOption == "second-upload-doc") { // uploading French file without GenAI translation
          var file = $('#second-file')[0].files[0]; // Get the selected file from the French file input
          try {
              let translatedText = await handleFileExtractionToHtml(file);
              console.log(translatedText);
              $('#translation-A').html(translatedText);
              $("#translation-preview").removeClass("hidden");
              $(".convert-translation").removeClass("hidden");
          } catch (err) {
              console.error('Error processing source file:', err);
          }
      } else if (selectedOption == "second-upload-text") {
        // var formattedText = $("#second-text").val().replace(/\r?\n/g, '<br>');
        // Output the formatted text to the div
        $('#translation-A').html($("#second-text").val());
        $("#translation-preview").removeClass("hidden");
        $(".convert-translation").removeClass("hidden");
      }
  });

  $("#accept-translation-A-btn").click(function() {
    acceptTranslation("a");
  });
  $("#accept-translation-B-btn").click(function() {
    acceptTranslation("b");
  });

  $("#edit-translation-A-btn").click(function() {
    var $translation = $('#translation-A');
    var isEditable = $translation.attr('contenteditable') === 'true';
    if (isEditable) {
        // Disable editing
        $translation.attr('contenteditable', 'false');
        $(this).attr('title', 'Edit Code');
        $(this).find('i').removeClass('fa-save').addClass('fa-edit');
    } else {
        // Enable editing
        $translation.attr('contenteditable', 'true');
        $(this).attr('title', 'Save Code');
        $(this).find('i').removeClass('fa-edit').addClass('fa-save');
    }
  });

  $("#convert-translation-to-doc-btn").click(async function() {
    try {
      $('#converting-spinner').removeClass("hidden");
      const englishDocxData = $('#source-file')[0].files[0]; // Get the english file
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
      // Step 1: Extract the XML from the English DOCX file
      const englishXml = await new Promise((resolve, reject) => {
        handleFileExtractionToXML(englishDocxData,
          function(result) {
            resolve(result); // Store the extracted XML
          },
          function(error) {
            console.error('Error processing English file:', error);
            reject(error);
          }
        );
      });
      if (!englishXml) {
        console.error("No XML document extracted.");
        $('#converting-spinner').addClass("hidden");
        return;
      }
      // Step 2: Translate the content
      const selectedMethod = $('input[name="convert-translation-method"]:checked').val();
      let updatedXml;
      if (selectedMethod === "convert-translation-docx") {
        updatedXml = await conversionDocxTemplater(englishXml);
      } else {
        updatedXml = await conversionGemini(englishXml, fileExtension);
      }
      // Step 3: Generate the translated file
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
      // Generate file and save it as a Blob
      generatedDownloadFile = await generateFile(zipEN, xmlContent, mimeType);
      // Show the download button
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
          URL.revokeObjectURL(downloadLink.href); // Clean up
      } else {
          console.error("No file generated.");
      }
  });

});

function generateFile(zip, xmlContent, mimeType, renderFunction) {
  try {
    zip.file("file.xml", xmlContent); // Assuming file name can be standardized for now
    if (typeof renderFunction === 'function') {
      renderFunction(); // Call the function directly
    }
  } catch (error) {
    console.error("Error during file generation:", error);
  }
  return zip.generateAsync({
    type: "blob",
    mimeType: mimeType
  });
}


function createXmlContent(fileExtension, updatedXml) {
  let xmlContent = '';
  if (fileExtension === 'docx') {
    xmlContent = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
      <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" ...>
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

async function conversionDocxTemplater(englishXml) {
  // Step 2: Extract all <w:t> nodes (text nodes) preserving their positions
  const textNodes = [];
  const regex = /<w:t[^>]*>([\s\S]*?)<\/w:t>/g;
  let match;
  while ((match = regex.exec(englishXml)) !== null) {
      textNodes.push(match[1]); // Extract the text content of each <w:t> node
  }

  console.log("Getting French...");

  // Split the textNodes into smaller chunks (e.g., 10 nodes per chunk)
  const chunkSize = 10;
  const textChunks = [];
  for (let i = 0; i < textNodes.length; i += chunkSize) {
      textChunks.push(textNodes.slice(i, i + chunkSize));
  }

  const systemGeneral = { role: "system", content: await $.get("custom-instructions/system/match-syntax-for-xml.txt") };
  const retrySystemGeneral = { role: "system", content: await $.get("custom-instructions/system/match-syntax-for-xml-retry.txt") };
  const translatedText = $("#translation-A").text().trim();
  let chunkCounter = 1;

  // Step 3: Process each chunk sequentially
  let adjustedFrenchText = "";
  for (const chunk of textChunks) {
      // Join the chunk into a reference string (English text) and translated French text
      const englishReference = chunk.join("\n");
      const requestJson = [ systemGeneral,
          { role: "user", content: "English Reference (part " + chunkCounter + " of " + textChunks.length + " ):" + englishReference },
          { role: "user", content: "Translated French (for the full document): " + translatedText }
      ];
      // Call the GenAI API using the existing getORData function
      const ORjson = await getORData("google/gemini-2.0-flash-lite-preview-02-05:free", requestJson);
      if (!ORjson || !ORjson.choices || !ORjson.choices[0] || !ORjson.choices[0].message) {
          alert("No response from GenAI. Please try again.");
          $('#converting-spinner').addClass("hidden");
          return;
      }
      // Extract the adjusted French text from the response
      const adjustedChunkText = ORjson.choices[0].message.content;
      // Split the adjusted text into lines
      const adjustedLines = adjustedChunkText.split("\n");
      console.log(chunk.length);
      console.log(chunk);
      console.log(adjustedLines.length);
      console.log(adjustedLines);

      let retryCount = 0;
      // Define the mismatch threshold (e.g., we allow some margin of difference before retrying)
      while (chunk.length !== adjustedLines.length) {
          console.log("Mismatch detected, sending back for adjustment... " + chunkCounter);
          // Prepare the prompt for further adjustment by GenAI
          const retryRequestJson = [ retrySystemGeneral,
             { role: "user", content: "English Reference (" + textNodes.length + " lines): " + englishReference },
             { role: "user", content: "Translated French (" + translatedText.split("\n").length + "): " + adjustedChunkText }
         ];

          // Call the GenAI API again for further adjustments
          const retryORjson = await getORData("google/gemini-2.0-flash-lite-preview-02-05:free", retryRequestJson);

          if (!retryORjson || !retryORjson.choices || !retryORjson.choices[0] || !retryORjson.choices[0].message) {
              alert("Error adjusting the French text. Please try again.");
              $('#converting-spinner').addClass("hidden");
              return;
          }

          // Extract the further adjusted French text
          adjustedChunkText = retryORjson.choices[0].message.content;
          adjustedLines = adjustedChunkText.split("\n"); // Split again after adjustment

          // Optional: Limit the number of retries (e.g., after 3 retries, abort)
          if (retryCount >= 3) {
              alert("Too many retries. Could not match the line count.");
              $('#converting-spinner').addClass("hidden");
              return;
          }
          retryCount++;
      }
      adjustedFrenchText += adjustedChunkText + "\n";  // Append the adjusted text for this chunk
      chunkCounter++;
  }

  const translatedLines = adjustedFrenchText.split("\n");
  // Proceed if the number of lines matches after the adjustments
  if (textNodes.length !== translatedLines.length) {
      alert("Mismatch between full documents.");
      $('#converting-spinner').addClass("hidden");
      return;
  }

  // Step 5: Replace English text with corresponding adjusted French lines
  let updatedXml = englishXml;
  textNodes.forEach((node, index) => {
      const escapedNode = node.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&'); // Escape special characters
      const regexNode = new RegExp(`<w:t[^>]*>${escapedNode}<\/w:t>`);
      updatedXml = updatedXml.replace(regexNode, `<w:t>${translatedLines[index]}</w:t>`);
  });
  return updatedXml;
}

async function conversionGemini(englishXml, fileType) {
  let groups = [];
  let formattedChunks = [];
  let paragraphs = [];
  const systemGeneral = { role: "system", content: await $.get("custom-instructions/system/xml-docx-formatting.txt") };

  // Extract content based on file type
  if (fileType === 'docx') {
    // For .docx, we extract paragraphs
    paragraphs = englishXml.match(/<w:p[\s\S]*?<\/w:p>/g) || [];
    console.log(`Total paragraphs found: ${paragraphs.length}`);
  } else if (fileType === 'pptx') {
    // For .pptx, we extract slide elements
    paragraphs = englishXml.match(/<p:sld[\s\S]*?<\/p:sld>/g) || [];
    console.log(`Total slides found: ${paragraphs.length}`);
  } else if (fileType === 'xlsx') {
    // For .xlsx, we extract rows
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
    // Helper function: escape XML special characters in text
    const escapedContent = groups[i].replace(/[&<>]/g, match => ({
      '&': "&amp;",
      '<': "&lt;",
      '>': "&gt;"
    }[match]));
    const requestJson = [ systemGeneral, { role: "user", content: "English DOCX group: " + escapedContent } ];
    let ORjson = await getORData(model[modelCount], requestJson);
    // If ORjson is invalid, attempt with the next model
    if (!ORjson || !ORjson.choices || ORjson.choices.length === 0) {
      console.error(`API request failed or returned unexpected structure for group ${i + 1} with model ${model[modelCount]}:`, ORjson);
      modelCount++; // Try the next model
      if (modelCount >= model.length) {
        console.error(`All models exhausted for group ${i + 1}. Skipping this group.`);
        i++; // Move to the next group if all models fail
        modelCount = 0; // Reset modelCount for the next group
        continue;
      }
      console.log(`Retrying with model ${model[modelCount]}...`);
      continue; // Skip the current iteration and retry with the next model
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
  // Reassemble the processed groups into the final content structure
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
  // Extracts <w:body> content for Word (docx)
  return chunk.match(/<w:t[\s\S]*?<\/w:t>/g) || [];
}
function extractSlideContent(chunk) {
  // Extracts slide content for PowerPoint (pptx)
  return chunk.match(/<p:sp[\s\S]*?<\/p:sp>/g) || [];
}
function extractRowContent(chunk) {
  // Extracts row content for Excel (xlsx)
  return chunk.match(/<row[\s\S]*?<\/row>/g) || [];
}

//modify for both directions
async function translateText(source, models, instructions, sourceLanguage) {
  const systemGeneral = { role: "system", content: await $.get(instructions) };
  var glossary;
  var systemGlossary;
  if ($('#translations-glossary').prop('checked')) { //Step 1: Filter JSON glossary
    try {
      glossary = await $.get("custom-instructions/translation/en-fr-glossary.json");
    } catch (error) {
      console.error("Unexpected error in glossary get:", error);
      return error;
    }
    // Filter glossary entries that match the 'english' string
    glossary = glossary.filter(entry => {
      //modify for FR.
      return sourceLanguage === "French"
                ? source.toLowerCase().includes(entry.FR.toLowerCase())
                : source.toLowerCase().includes(entry.EN.toLowerCase());
    });
    systemGlossary = glossary.length > 0 ? { role: "system", content: glossary } : null;
  } else {
    systemGlossary = null;
  }
  let requestJson = [systemGeneral];
  if (systemGlossary) {
    requestJson.push(systemGlossary);
  }
  requestJson.push({ role: "user", content: source });
  for (let model of models) {
     try {
         console.log(`Attempting translation with model: ${model}`);
         let ORjson = await getORData(model, requestJson);
         // Validate API response
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
  let html = "";
  if (option == "b") {
    //write text from translation-B overwrite translation-A
    $("#translation-A").text($("translation-B").text());
  }
  $("#edit-translation-A-btn").removeClass("hidden");
  $("#accept-translation-A-btn").addClass("hidden");
  $("#accept-translation-B-btn").addClass("hidden");
  $(".convert-translation").removeClass("hidden");
  toggleComparisonElement($('#translation-A-container'), $('#translation-B-container'));
}

function detectLanguageBasedOnWords(text) {
  const englishWords = ['the', 'and', 'is', 'in', 'it', 'to', 'of', 'for', 'on', 'with'];
  const frenchWords = ['le', 'la', 'et', 'est', 'dans', 'il', 'à', 'de', 'pour', 'sur'];
  text = text.toLowerCase();
  function countMatches(wordList) {
    return wordList.reduce((count, word) => count + (text.includes(word) ? 1 : 0), 0);
  }
  const englishMatches = countMatches(englishWords);
  const frenchMatches = countMatches(frenchWords);
  if (englishMatches > frenchMatches) {
    return 'english';
  } else if (frenchMatches > englishMatches) {
    return 'french';
  } else {
    return 'unknown'; // If there's no clear match, return 'unknown'
  }
}
