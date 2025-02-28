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
    var englishDocxXml;
    // Step 1: Extract the XML from the English DOCX file
    await handleFileExtractionToXML(englishDocxData, function(result) {
      console.log(englishDocxXml);
    }, function(err) {
        // Error handling callback
        console.error('Error processing English file:', err);
    });
    if (!englishDocxXml) {
        $('#converting-spinner').addClass("hidden");
        return;
    }
    console.log("Extracting text nodes...");
    // Step 2: Extract all <w:t> nodes (text nodes) preserving their positions
    const textNodes = [];
    const regex = /<w:t[^>]*>([\s\S]*?)<\/w:t>/g;
    let match;
    while ((match = regex.exec(englishDocxXml)) !== null) {
        textNodes.push(match[1]);
    }

    // Step 3: Get the translated French text and prepare for GenAI adjustment
    const translatedText = $("#translation-A").text().trim();
    const englishReference = textNodes.join("\n");
    const requestJson = [
        { role: "system", content: await $.get("custom-instructions/system/match-syntax-for-xml.txt") },
        { role: "user", content: "English Reference: " + englishReference },
        { role: "user", content: "English Reference: " + translatedText }
    ];

    // Call the GenAI API using the existing getORData function
    const ORjson = await getORData("google/gemini-2.0-flash-lite-preview-02-05:free", requestJson);

    if (!ORjson || !ORjson.choices || !ORjson.choices[0] || !ORjson.choices[0].message) {
        alert("No response from GenAI. Please try again.");
        $('#converting-spinner').addClass("hidden");
        return;
    }
    // Extract the adjusted French text from the response
    const adjustedFrenchText = ORjson.choices[0].message.content;

    // // Step 4: Split adjusted French text by line breaks and check if it matches the English text nodes
    // const translatedLines = adjustedFrenchText.split("\n");
    // if (textNodes.length !== translatedLines.length) {
    //     alert("Mismatch between English text segments and adjusted French lines. Please verify the translation.");
    //     $('#converting-spinner').addClass("hidden");
    //     return;
    // }

    // Step 4: Split adjusted French text by line breaks and check if it matches the English text nodes
    let translatedLines = adjustedFrenchText.split("\n");
    // Define the mismatch threshold (e.g., we allow some margin of difference before retrying)
    const mismatchThreshold = 2; // You can adjust this value based on acceptable mismatch
    while (textNodes.length !== translatedLines.length && Math.abs(textNodes.length - translatedLines.length) > mismatchThreshold) {
        console.log("Mismatch detected, sending back for adjustment...");
        // Prepare the prompt for further adjustment by GenAI
        const retryRequestJson = [
            { role: "system", content: await $.get("custom-instructions/system/match-syntax-for-xml-retry.txt") },
            { role: "user", content: "English Reference: " + englishReference },
            { role: "user", content: "English Reference: " + adjustedFrenchText }
        ];

        // Call the GenAI API again for further adjustments
        const retryORjson = await getORData("google/gemini-2.0-flash-lite-preview-02-05:free", retryRequestJson);

        if (!retryORjson || !retryORjson.choices || !retryORjson.choices[0] || !retryORjson.choices[0].message) {
            alert("Error adjusting the French text. Please try again.");
            $('#converting-spinner').addClass("hidden");
            return;
        }

        // Extract the further adjusted French text
        adjustedFrenchText = retryORjson.choices[0].message.content;
        translatedLines = adjustedFrenchText.split("\n"); // Split again after adjustment

        // Optional: Limit the number of retries (e.g., after 3 retries, abort)
        if (retryCount >= 3) {
            alert("Too many retries. Could not match the line count.");
            $('#converting-spinner').addClass("hidden");
            return;
        }
        retryCount++;
    }

    // Proceed if the number of lines matches after the adjustments
    if (textNodes.length !== translatedLines.length) {
        alert("Mismatch between English text segments and adjusted French lines after retries.");
        $('#converting-spinner').addClass("hidden");
        return;
    }

    // Step 5: Replace English text with corresponding adjusted French lines
    let updatedXml = englishDocxXml;
    textNodes.forEach((node, index) => {
        const escapedNode = node.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&'); // Escape special characters
        const regexNode = new RegExp(`<w:t[^>]*>${escapedNode}<\/w:t>`);
        updatedXml = updatedXml.replace(regexNode, `<w:t>${translatedLines[index]}</w:t>`);
    });

    // Step 6: Rebuild the DOCX with the updated XML
    const zip = new PizZip();
    zip.file("word/document.xml", updatedXml);
    const doc = new Docxtemplater(zip, {
        paragraphLoop: true,
        linebreaks: true,
    });

    try {
        doc.render();
    } catch (error) {
        console.error(JSON.stringify({ error: error }, null, 2));
    }

    const output = doc.getZip().generate({
        type: "blob",
        mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });

    saveAs(output, "translated_document.docx");

    $('#converting-spinner').addClass("hidden");
    $('#translated-doc-download').removeClass("hidden");
  });

});

// Function to send the extracted body content to OpenAI for restyling
async function restyleTextWithOpenAI(text, apikey) {
    const prompt = `Restyle this translated text to match the XML structure of the original document, preserving styling like bold, italics, lists, headers, and any other formatting: ${text}`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apikey}`
        },
        body: JSON.stringify({
            model: "gpt-4",
            messages: [{ role: "user", content: prompt }],
            max_tokens: 2000
        })
    });

    const data = await response.json();
    return data.choices[0].message.content;
}


//
//
//     // Extract paragraphs and group them with a computed group size
//     let paragraphs = extractParagraphs(bodyContent);
//     console.log(`Total paragraphs found: ${paragraphs.length}`);
//     const maxRequests = 30;
//     let groupSize = Math.ceil(paragraphs.length / maxRequests);
//     console.log(`Grouping paragraphs into batches of ${groupSize} (max ${maxRequests} requests)`);
//     let groups = groupParagraphs(paragraphs, groupSize);
//     console.log(`Total groups to process: ${groups.length}`);
//
//     let formattedChunks = [];
//     for (let i = 0; i < groups.length; i++) {
//       console.log(`Processing group ${i + 1}/${groups.length}...`);
//       let requestJson = {
//         messages: [
//           {
//             role: "system",
//             content:
//               "You are a DOCX formatting assistant. Reformat the provided DOCX XML (which contains multiple <w:p> paragraphs) to produce complete and valid XML output. Ensure your output includes the XML declaration and a full <w:document> element (with its <w:body>) and all necessary closing tags. Do not include extra text or code fences. End your output with the marker [END_OF_XML] on its own line."
//           },
//           { role: "user", content: "English DOCX group: " + escapeXML(groups[i]) }
//         ]
//       };
//
//       let ORjson = await getORData("google/gemini-2.0-flash-lite-preview-02-05:free", requestJson);
//       if (!ORjson || !ORjson.choices || ORjson.choices.length === 0) {
//         console.error(`API request failed or returned unexpected structure for group ${i + 1}:`, ORjson);
//         continue;
//       }
//       let aiResponse = ORjson.choices[0]?.message?.content || "";
//       console.log(`Group ${i + 1} Response:\n`, aiResponse);
//
//       let formattedText = formatAIResponse(aiResponse);
//       formattedText = ensureCompleteXML(formattedText);
//       if (!formattedText) {
//         console.error(`Skipping group ${i + 1} due to formatting issues.`);
//         continue;
//       }
//       formattedChunks.push(formattedText);
//     }
//
//     // Reassemble the processed groups into a single <w:body>
//     let finalBodyContent = formattedChunks.map(chunk => extractBodyContent(chunk)).join("\n");
//     let finalDocXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
// <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" ...>
//   <w:body>
//     ${finalBodyContent}
//   </w:body>
// </w:document>`;
//
//     zipEN.file("word/document.xml", finalDocXml);
//     console.log("Final DOCX XML constructed.");
//
//     const newDocxBlob = zipEN.generate({ type: "blob", compression: "DEFLATE" });
//     const newDocUrl = URL.createObjectURL(newDocxBlob);
//
//     downloadLink.href = newDocUrl;
//     downloadLink.download = "formatted.docx";
//     downloadLink.style.display = "inline";
//     downloadLink.textContent = "Download Formatted DOCX";
//
//     console.log("Processing complete. Download link ready.");
//     alert("Success! Your formatted DOCX is ready to download.");
//     loadingIndicator.style.display = "none";
//   });
//
//   // Helper function: call the API
//   async function getORData(model, requestJson) {
//     const apiKey = sessionStorage.getItem("openRouterApiKey");
//     console.log("Sending API request...", requestJson);
//     try {
//       const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
//         method: "POST",
//         headers: { "Authorization": "Bearer " + apiKey, "Content-Type": "application/json" },
//         body: JSON.stringify({ "model": model, "messages": requestJson.messages })
//       });
//       console.log("API Response Status:", response.status);
//       if (!response.ok) throw new Error(`Response status: ${response.status}`);
//       return await response.json();
//     } catch (error) {
//       alert("API request failed: " + error.message);
//       console.error("Error fetching from OpenRouter API:", error.message);
//       return undefined;
//     }
//   }
// });













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
