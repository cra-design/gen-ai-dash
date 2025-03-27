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

        if (event.target.id === "source-file") {
            englishFile = uploadedFile;
            if (fileExtension === 'docx') {
              let arrayBuffer = await uploadedFile.arrayBuffer();
              let mammothResult = await mammoth.convertToHtml({ arrayBuffer: arrayBuffer });
              $("#translation-A").html(mammothResult.value);
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

$("#source-upload-provide-btn").click(function() {
    if (!englishFile) {
      alert("Please upload the English document first.");
      return;
    }
    $("#second-upload").removeClass("hidden");
  }); 
  
  // 'Provide translation' button, show the second upload section
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

  // Second upload: manual translation.
  $("#second-upload-btn").click(async function() {  
     $('#processing-spinner').removeClass("hidden"); 
    console.log("Spinner should now be visible.");
    var selectedOption = $('input[name="second-upload-option"]:checked').val();  
    let frenchText = "";  

    // Ensure the French file is uploaded if the user selected document upload.
  if (selectedOption == "second-upload-doc" && !frenchFile) {
    alert("Please upload your translated French document.");
    return;
  }
    
    // 1) Get the raw French text from doc or text:
    if (selectedOption == "second-upload-doc") {
      var file = $('#second-file')[0].files[0]; 
     
      if (!file) {
        alert("Please select your translated file.");
        return;
      } 
      file.arrayBuffer().then(buffer => {
      mammoth.convertToHtml({ arrayBuffer: buffer })
        .then(result => {
          console.log("Direct extraction result:", result.value);
        })
        .catch(err => console.error("Error with direct extraction:", err));
    });
      
      try {
        // This should extract text from the user-provided FR doc (unformatted).
        let extractedText = await handleFileExtractionToHtml(file);
        frenchText = extractedText || "";
      } catch (err) {
        console.error('Error processing the second (FR) file:', err);
        alert("Error reading your translated file. Check console for details."); 
        $('#converting-spinner').addClass("hidden");
        return;
      }
    } else if (selectedOption == "second-upload-text") {
      frenchText = $("#second-text").val();
    } 
    console.log("French text:", frenchText);
    // 2) Retrieve the formatted English HTML from #translation-A
    //    (#translation-A is where we stored the first doc's structure).
    let englishHtml = $("#translation-A").html();
    if (!englishHtml || englishHtml.trim().length === 0) {
      alert("No formatted English document found. Please complete the first step."); 
      $('#converting-spinner').addClass("hidden");
      return;
    }
    if (!frenchText || frenchText.trim().length === 0) {
      alert("No French document/text found. Please upload or enter your translation."); 
      $('#converting-spinner').addClass("hidden");
      return;
    }
    // load the system prompt
    let systemPrompt = "";
    try {
    systemPrompt = await $.get("custom-instructions/translation/english2french1.txt");
  } catch (error) {
    console.error("Error loading system prompt:", error);
    alert("Could not load translation instructions. Please check your files."); 
    $('#converting-spinner').addClass("hidden");
    return;
  }
    let combinedPrompt = systemPrompt + "\n\n" +
    "English Document (HTML):\n" + englishHtml + "\n\n" +
    "French Text:\n" + frenchText + "\n\n" +
    "Please return the French document in HTML format that exactly follows the structure of the English document."; 

    
  let requestJson = [
    { role: "system", content: systemPrompt },
    { role: "user", content: combinedPrompt }
  ]; 

   let models = [
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
    let ORjson = await getORData(model, requestJson);
    if (ORjson && ORjson.choices && ORjson.choices.length > 0 && ORjson.choices[0].message) {
      finalFrenchHtml = ORjson.choices[0].message.content;
      break;
    }
  }
  try{ 
    if (!finalFrenchHtml) {
    alert("Translation alignment failed. No valid response from any model.");
    return;
  } 
     finalFrenchHtml = removeCodeFences(finalFrenchHtml);
     console.log("Final French HTML (cleaned):", finalFrenchHtml);

    // 4) Display the final merged output in #review-translation
     $("#translation-A").html(finalFrenchHtml); 
     $('#converting-spinner').addClass("hidden");
     $("#translation-preview").removeClass("hidden").show();  
      } catch (err) {
    console.error("Error during second-upload processing:", err);
  } finally {
    // Hide spinner once processing is complete (successfully or on error)
    $('#processing-spinner').addClass("hidden");  
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
 
// Existing download button click handler remains unchanged.
// When the user clicks the Download button, the file will be downloaded.
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
    } 
    else if (fileExtension === 'pptx' || fileExtension === 'xlsx') {
      // Fallback for PPTX/XLSX if you were using conversionGemini
      let englishXml = await handleFileExtraction(englishFile);
      let updatedXml = await conversionGemini(englishXml, fileExtension);
      let zip = new JSZip();
      if (fileExtension === 'pptx') {
        zip.file("ppt/slides/slide1.xml", updatedXml);
      } else {
        zip.file("xl/worksheets/sheet1.xml", updatedXml);
      }
      generatedBlob = await zip.generateAsync({ type: "blob", mimeType: mimeType });
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

    // Now that the file is generated, show the download button
    // or directly trigger the download:
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
    return wordList.reduce((count, word) => count + (text.includes(word) ? 1 : 0), 0);
  }
  const englishMatches = countMatches(englishWords);
  const frenchMatches = countMatches(frenchWords);
  if (englishMatches > frenchMatches) { return 'english'; }
  else if (frenchMatches > englishMatches) { return 'french'; }
  else { return 'unknown'; }
}
