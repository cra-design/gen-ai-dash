$(document).ready(function() {

  $(document).on("click", "input[type=radio]", function (event) {
    var target = event.target;
    if (target.name == "english-upload-option") {
      $('#english-doc-upload').addClass("hidden");
      $('#english-text-upload').addClass("hidden");
      if (target.id == "english-upload-doc") {
        $('#english-doc-upload').removeClass("hidden");
      } else if (target.id == "english-upload-text") {
        $('#english-text-upload').removeClass("hidden");
      }
    } else if (target.name == "french-upload-option") {
      $('#french-translation-preview').addClass("hidden");
      $('#french-doc-upload').addClass("hidden");
      $('#french-text-upload').addClass("hidden");
      if (target.id == "french-translate-english") {
        $('#french-translation-preview').removeClass("hidden");
      } else if (target.id == "french-upload-doc") {
        $('#french-doc-upload').removeClass("hidden");
      } else if (target.id == "french-upload-text") {
        $('#french-text-upload').removeClass("hidden");
      }
    }
  });

  //Validate file uploads to ensure 1 doc at a time + docx, xlsx or ppt
  $(document).on("change", "input", async function (event) {
    if (event.target.id == "english-file" || event.target.id == "french-file") {
      let language = event.target.id === "english-file" ? "english" : "french";
      $(`#${language}-multiple-msg`).addClass("hidden");
      $(`#${language}-doc-error`).addClass("hidden");
      var fileList = event.target.files;
      if (!fileList || fileList.length === 0) return;
      if (fileList.length > 1) {
          $(`#${language}-multiple-msg`).removeClass("hidden");
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
          return;
      }
    }
  });

  $("#english-upload-btn").click(function() {
    $("#english-upload").addClass("hidden");
    let enguploadoption = $('input[name="english-upload-option"]:checked').val();
    if (enguploadoption == "english-upload-text") {
      $("#translation-preview-model-b").removeClass("hidden");
    } else if (enguploadoption == "english-upload-doc") {
      $("#french-upload").removeClass("hidden");
    }
  });
  //
  // $("#translation-preview-model-b").click(function() {
  //   var selectedModel = $('input[name="english-upload-option"]:checked').val();
  //   $("#translation-preview-model-b").removeClass("hidden");
  //   $("#translation-preview").removeClass("hidden");
  //   translateEnglishToFrench($("#english-text").text());
  // });

  $("#french-upload-btn").click(function() {
      $("#french-upload").addClass("hidden");
      var selectedOption = $('input[name="french-upload-option"]:checked').val();
      if (selectedOption == "french-translate-english") {
        $("#translation-preview-model-b").removeClass("hidden");
      } else if (selectedOption == "french-upload-doc") { // uploading French file without GenAI translation
          var file = $('#french-file')[0].files[0]; // Get the selected file from the French file input
          handleFileExtraction(file, function(result) {
            console.log(result.text);
            console.log(result.html);
              // Output the formatted html to the div
              // frenchText = convertHtmlToText(englishText);
              $('#translation-A').html(result.html);
              $("#translation-preview").removeClass("hidden");
              $(".convert-translation").removeClass("hidden");
          }, function(err) {
              // Error handling callback
              console.error('Error processing French file:', err);
          });
      } else if (selectedOption == "french-upload-text") {
        // var formattedText = $("#french-text").val().replace(/\r?\n/g, '<br>');
        // Output the formatted text to the div
        $('#translation-A').html($("#french-text").val());
        $("#translation-preview").removeClass("hidden");
        $(".convert-translation").removeClass("hidden");
      }
  });
  $("#model-b-btn").click(function() {
    var selectedOption = $('input[name="english-upload-option"]:checked').val();
    var selectedModel = $('input[name="translate-model-b-option"]:checked').val();
    var englishText;
    //determine the English text to translate
    if (selectedOption == "english-upload-doc") {
      var file = $('#english-file')[0].files[0]; // Get the selected file from the English file input
      handleFileExtraction(file, function(result) {
        englishText = result.text;
        englishText = convertHtmlToText(englishText);
      }, function(err) {
          // Error handling callback
          console.error('Error processing English file:', err);
      });
    } else if (selectedOption == "") {
      englishText = $("#english-text").text();
    }
    $("#translation-preview").removeClass("hidden");
    $("#convert-translation-to-doc-btn").removeClass("hidden");
    let translationA = translateEnglishToFrench(englishText, "mistralai/mistral-nemo:free");
    // Convert line breaks to <br> tags
    // var formattedText = translationA.replace(/\r?\n/g, '<br>');
    // Output the formatted text to the div
    // Example of how to use the function:
    $('#translation-A').html(translationA);
    //if comparing models
    if (selectedModel != "" && selectedModel != "translate-none") {
      let translationB = translateEnglishToFrench(englishText, selectedModel);
      // formattedText = translationB.replace(/\r?\n/g, '<br>');
      // Output the formatted text to the div
      $('#translation-B').html(translationB);
      //create side-by-side view
      $('#accept-translation-A-btn').removeClass("hidden");
      $('#accept-translation-B-btn').removeClass("hidden");
      if ($('#translation-B').hasClass("hidden")) {
        toggleComparisonElement($('#translation-A-container'), $('#translation-B-container'));
      }
    } else {
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
    $('#converting-spinner').removeClass("hidden");
    const englishDocxData = $('#english-file')[0].files[0]; // Get the english file
    var englishXml;
    // Step 1: Extract the XML from the English DOCX file
    // Step 1: Extract the XML from the English DOCX file
    const fileExtension = englishDocxData.name.split('.').pop().toLowerCase();
    await new Promise((resolve, reject) => {
        handleFileExtractionToXML(englishDocxData, function(result) {
            englishXml = result;  // Store the extracted XML
            resolve();  // Resolve the promise once the XML is available
        }, function(error) {
            console.error('Error processing English file:', error);
            reject(error);  // Reject the promise if there is an error
        });
    });
    // After the XML is extracted and stored in englishXml
    if (!englishXml) {
        console.error("No XML document.");
        $('#converting-spinner').addClass("hidden");
        return;
    }
    var selectedMethod = $('input[name="convert-translation-method"]:checked').val();
    var updatedXml;
    if (selectedMethod == "convert-translation-docx") {
      updatedXml = await conversionDocxTemplater(englishXml);
    } else {
      updatedXml = await conversionGemini(englishXml, fileExtension);
    }
    let originalFileName = englishDocxData.name.split('.').slice(0, -1).join('.');
    let modifiedFileName = `${originalFileName}-FR.${fileExtension}`;
    // Create a new zip instance based on the file extension
    let zipEN = new JSZip();
    let xmlContent = createXmlContent(fileExtension, updatedXml, finalContent);
    let output;
    if (fileExtension === 'docx') {
      output = generateFile(zipEN, xmlContent, "application/vnd.openxmlformats-officedocument.wordprocessingml.document", doc);
    } else if (fileExtension === 'pptx') {
      output = generateFile(zipEN, xmlContent, "application/vnd.openxmlformats-officedocument.presentationml.presentation", pptx);
    } else if (fileExtension === 'xlsx') {
      output = generateFile(zipEN, xmlContent, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", xlsx);
    }
    saveAs(output, modifiedFileName);
    $('#converting-spinner').addClass("hidden");
  });
});

function generateFile(zip, xmlContent, mimeType, renderFunction) {
  try {
    zip.file("file.xml", xmlContent); // Assuming file name can be standardized for now
    renderFunction.render();
  } catch (error) {
    console.error(JSON.stringify({ error: error }, null, 2));
  }
  return zip.generate({
    type: "blob",
    mimeType: mimeType
  });
}

function createXmlContent(fileExtension, updatedXml, finalContent) {
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
        <p:sldMasterIdLst>${finalContent}</p:sldMasterIdLst>
      </p:presentation>`;
  } else if (fileExtension === 'xlsx') {
    xmlContent = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
      <workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
        <sheetData>${finalContent}</sheetData>
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
    "google/gemini-2.0-flash-exp:free",
    "google/gemini-exp-1206:free",
    "google/gemini-flash-1.5-8b-exp",
    "qwen/qwen-turbo"
  ];
  let modelCount = 0;
  for (let i = 0; i < groups.length;) {
    console.log(`Processing group ${i + 1}/${groups.length}...`);
    // Helper function: escape XML special characters in text
    const requestJson = [ systemGeneral, { role: "user", content: "English DOCX group: " + groups[i].replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;") } ];
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
  let finalContent;
  if (fileType === 'docx') {
    finalContent = formattedChunks.map(chunk => extractBodyContent(chunk)).join("\n");
  } else if (fileType === 'pptx') {
    finalContent = formattedChunks.map(chunk => extractSlideContent(chunk)).join("\n");
  } else if (fileType === 'xlsx') {
    finalContent = forvmattedChunks.map(chunk => extractRowContent(chunk)).join("\n");
  }
  return finalBodyContent;
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

function translateEnglishToFrench(english, model) {
  //The English text should be plain text extracted from doc or textbox
  /*
    Step 1: Filter JSON glossary
    Step 2: Get the custom instructions
    Step 3: Translate with model
    Step 4: Return text translation
  */
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
