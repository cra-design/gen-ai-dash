let generatedDownloadFile = null;
let englishHtmlStored = "";
let frenchFile = null;
let finalFrenchHtml = "";
let englishFile = null;

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
async function extractDocxParagraphs(arrayBuffer) {
  const zip = await JSZip.loadAsync(arrayBuffer);
  const docXml = await zip.file("word/document.xml").async("string");
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(docXml, "application/xml");

  const paragraphs = xmlDoc.getElementsByTagName("w:p");
  let fullText = [];

  for (let i = 0; i < paragraphs.length; i++) {
    let paragraph = paragraphs[i];
    let paragraphText = "";

    // Extract all <w:t> (text) elements within the paragraph
    let textNodes = paragraph.getElementsByTagName("w:t");
    for (let j = 0; j < textNodes.length; j++) {
      paragraphText += textNodes[j].textContent;
    }

    if (paragraphText.trim()) {
      fullText.push(paragraphText.trim());
    }
  }

  // Join paragraphs with double newline to separate them
  return fullText.join("\n\n");
}
function extractTextRunsByContext(paragraphNode) {
  const hyperlinkTexts = [];
  const normalTexts = [];

  // All direct <w:hyperlink> elements in this paragraph
  const hyperlinks = Array.from(paragraphNode.getElementsByTagName("w:hyperlink"));

  hyperlinks.forEach(hyperlink => {
    const runs = Array.from(hyperlink.getElementsByTagName("w:r"));
    runs.forEach(run => {
      const t = run.getElementsByTagName("w:t")[0];
      if (t) hyperlinkTexts.push({ tNode: t, inHyperlink: true });
    });
  });

  const allRuns = Array.from(paragraphNode.getElementsByTagName("w:r"));
  allRuns.forEach(run => {
    const insideHyperlink = !!run.closest("w\\:hyperlink");
    const t = run.getElementsByTagName("w:t")[0];
    if (t && !insideHyperlink) {
      normalTexts.push({ tNode: t, inHyperlink: false });
    }
  });

  return {
    normal: normalTexts,
    hyperlink: hyperlinkTexts
  };
}
function isInsideHyperlinkNode(node) {
  while (node) {
    if (node.nodeName === "w:hyperlink") return true;
    node = node.parentNode;
  }
  return false;
}
async function extractDocxTextXmlWithId(arrayBuffer) {
  const zip = await JSZip.loadAsync(arrayBuffer);
  const docXmlStr = await zip.file("word/document.xml").async("string");
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(docXmlStr, "application/xml");

  const paragraphs = xmlDoc.getElementsByTagName("w:p");
  let textElements = [];
  let paragraphCounter = 1;

  for (let i = 0; i < paragraphs.length; i++) {
    const paragraph = paragraphs[i];
    const runElements = paragraph.getElementsByTagName("w:r");
    if (runElements.length === 0) continue;

    let runCounter = 1;
    let paragraphTextParts = [];

    for (let j = 0; j < runElements.length; j++) {
      const run = runElements[j];
      const textNodes = run.getElementsByTagName("w:t");
      const isInsideHyperlink = isInsideHyperlinkNode(run);

      for (let k = 0; k < textNodes.length; k++) {
        const text = textNodes[k].textContent || "";
        const id = `P${paragraphCounter}_R${runCounter++}`;
        let wrappedText = text;

        if (isInsideHyperlink) {
          // If it doesn't already start with a space, but the original text does, add it
          const hasLeadingSpace = /^\s/.test(text);
          const trimmedText = text.trim();
          wrappedText = hasLeadingSpace ? ` <a>${trimmedText}</a>` : `<a>${trimmedText}</a>`;
        }

        textElements.push({ id, text: wrappedText });
        paragraphTextParts.push(wrappedText);
      }
    }

    paragraphCounter++;
  }

  return textElements;
}

async function extractPptxText(arrayBuffer) {
  const zip = await JSZip.loadAsync(arrayBuffer);
  const slideRegex = /^ppt\/slides\/slide(\d+)\.xml$/i;
  let allParagraphs = [];

  for (const fileName of Object.keys(zip.files)) {
    const match = slideRegex.exec(fileName);
    if (!match) continue;

    const slideNumber = match[1];
    const slideXml = await zip.file(fileName).async("string");
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(slideXml, "application/xml");

    // grab each paragraph on this slide
    const paraNodes = xmlDoc.getElementsByTagName("a:p");
    for (let i = 0; i < paraNodes.length; i++) {
      const paraNode = paraNodes[i];
      let paragraphText = "";

      // for each run (<a:t>) in the paragraph…
      const textNodes = paraNode.getElementsByTagName("a:t");
      for (let j = 0; j < textNodes.length; j++) {
        const node = textNodes[j];
        const rawText = node.textContent || "";
        const trimmed = rawText.trim();


        // 1) skip literal slide-number runs ("3" on slide 3)
        if (trimmed === slideNumber) {
          continue;
        }

        // 2) skip runs inside <a:fld type="slidenum">
        let ancestor = node.parentNode;
        let inSlideNumField = false;
        while (ancestor) {
          if (
            ancestor.localName === "fld" &&
            ancestor.getAttribute("type") === "slidenum"
          ) {
            inSlideNumField = true;
            break;
          }
          ancestor = ancestor.parentNode;
        }
        if (inSlideNumField) {
          continue;
        }

        // otherwise include this run in the paragraph
        paragraphText += rawText;
      }

      // only keep non-empty paragraphs
      if (paragraphText.trim().length > 0) {
        allParagraphs.push(paragraphText.trim());
      }
    }
  }

  // join slides with blank lines
  return allParagraphs.join("\n\n");
}



// Function to unzip PPTX, parse each slide's XML, and extract textual content with unique identifiers.
async function extractPptxTextXmlWithId(arrayBuffer) {
  const zip = await JSZip.loadAsync(arrayBuffer);
  const slideRe = /^ppt\/slides\/slide(\d+)\.xml$/i;
  const textElements = [];

  for (const fileName of Object.keys(zip.files)) {
    const m = slideRe.exec(fileName);
    if (!m) continue;
    const slideNumber = m[1];
    const slideXml = await zip.file(fileName).async("string");
    const xmlDoc = new DOMParser().parseFromString(slideXml, "application/xml");

    // Find every <a:r> that actually has a <a:t> child
    const runNodes = Array.from(xmlDoc.getElementsByTagName("a:r"))
      .filter(r => r.getElementsByTagName("a:t").length > 0);

    //  Enumerate exactly as your converter will:
    runNodes.forEach((runNode, idx) => {
      const tNode = runNode.getElementsByTagName("a:t")[0];
      const rawText = tNode.textContent || "";
      const trimmed = rawText.trim();

      // Skip anything inside <a:fld type="slidenum">
      let anc = runNode.parentNode, skip = false;
      while (anc) {
        if (anc.localName === "fld" && anc.getAttribute("type") === "slidenum") {
          skip = true;
          break;
        }
        anc = anc.parentNode;
      }
      if (skip) return;

      // Build IDs using idx+1 so they match your converter’s runIndex
      const uniqueId = `S${slideNumber}_T${idx + 1}`;
      textElements.push({ slide: slideNumber, id: uniqueId, text: rawText });
    });
  }

  return textElements;
}


function aggregateDocxMapping(mapping) {
  const aggregated = {};
  mapping.forEach(item => {
    // Extract paragraph part (e.g., "P1" from "P1_R1")
    const paraId = item.id.split('_')[0];
    if (!aggregated[paraId]) {
      aggregated[paraId] = { id: paraId, texts: [] };
    }
    aggregated[paraId].texts.push(item.text);
  });
  return Object.values(aggregated)
    .map(entry => {
      // Join text runs without adding extra spaces, then normalize spaces
      let combined = entry.texts.join('');
      combined = combined.replace(/\s+/g, ' ').trim();
      return { id: entry.id, text: combined };
    })
    // Filter out any paragraphs that end up empty
    .filter(item => item.text.length > 0);
}

function resetHiddenUploadOptions() {
  $('#translation-upload').addClass('hidden');
  $('#formatting-upload').addClass('hidden');
  $('#word-upload').addClass('hidden');
}

// 2) Top-level radio clicks
$(document).on('click', "input[name='function-option']", function() {
  resetHiddenUploadOptions();

  if (this.id === 'translation') {
    $('#translation-upload').removeClass('hidden');
  }
  else if (this.id === 'formatting') {
    $('#formatting-upload').removeClass('hidden');
  }
  else if (this.id === 'word') {
    $('#word-upload').removeClass('hidden');
  }
});

// 3) Formatting panel: Stage 1 → Stage 2 (preview)
$("#source-upload-provide-btn-formatting").on("click", async function() {
  // grab the uploaded file
  const englishFile = $("#source-file-formatting")[0].files[0];
  if (!englishFile) {
    alert("Please upload the source document first.");
    return;
  }

  // hide any previous error
  $("#source-doc-error-formatting").addClass("hidden");

  try {
    // determine extension
    const ext = englishFile.name.split('.').pop().toLowerCase();
    let extractedText = "";

    if (ext === "docx") {
      const arrayBuffer = await englishFile.arrayBuffer();
      extractedText = await extractDocxParagraphs(arrayBuffer);
    }
    else if (ext === "pptx") {
      const arrayBuffer = await englishFile.arrayBuffer();
      extractedText = await extractPptxText(arrayBuffer);
    }
    else if (ext === "xlsx") {
      const arrayBuffer = await englishFile.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: "array" });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      extractedText = XLSX.utils.sheet_to_csv(worksheet);
    }
    else {
      throw new Error("Unsupported file type for extraction");
    }

    // populate your original preview markup
    $("#source-text-preview").text(extractedText);
    // reveal the preview
    $("#source-preview-wrapper").removeClass("hidden");
    // reveal the next stage (paste & format)
    $("#second-upload-formatting").removeClass("hidden");
  }
  catch (err) {
    console.error("Error extracting source text:", err);
    $("#source-doc-error-formatting").removeClass("hidden");
  }
});

// 4) Formatting panel: Stage 3 → Stage 4 (spinner) → Stage 5 (download)
$('#second-upload-btn-formatting').on('click', async function () {
  // 1) Show the formatting spinner
  $('#processing-spinner-formatting').removeClass('hidden');

  // 2) Grab the French text the user pasted
  const frenchText = $('#second-text').val().trim();
  if (!frenchText) {
    alert("No French document/text found. Please copy and paste your translation.");
    $('#processing-spinner-formatting').addClass('hidden');
    return;
  }

  // 3) Get the stored English HTML (from your global)
  let englishHtml = englishHtmlStored || "";
  if (!englishHtml) {
    alert("No formatted English document found. Please complete the first step.");
    $('#processing-spinner-formatting').addClass('hidden');
    return;
  }

   englishHtml = englishHtml.replace(/<img[^>]*>/g, '');

  // Determine prompt based on the original English file extension
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
    "google/gemini-2.0-flash-exp:free",
    "google/gemma-3-12b-it:free",
    "google/gemma-3-4b-it:free",
    "google/gemma-3-1b-it:free",
    "cognitivecomputations/dolphin3.0-r1-mistral-24b:free",
    "cognitivecomputations/dolphin3.0-mistral-24b:free",
    "meta-llama/llama-3.3-70b-instruct:free",
    "nvidia/llama-3.1-nemotron-70b-instruct:free",
    "deepseek/deepseek-r1:free"
  ];

  finalFrenchHtml = "";
  const temperature = 0.0;
  for (let model of models) {
    const ORjson = await getORData(model, requestJson, temperature);
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

        if (/^([nN]d|[rR]d|[sS]t|[tT]h|[dlLcsà'‘’`’“”])$/.test(currText)
          && rawParagraphs[i + 1]) {
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
      // Do not display output, store it internally
      console.log("AI translation ready and stored (not displayed).");
    }

    console.log("Final French HTML (cleaned):", finalFrenchHtml);

  } catch (err) {
    console.error("Error during final output processing:", err);
    alert("An error occurred while processing the AI output.");
  } finally {
      $('#processing-spinner-formatting').addClass('hidden');
  $('#convert-translation').removeClass('hidden');
  $('#translated-doc-download').removeClass('hidden');
  }
});

$(document).ready(function () { 
  $("input[name='function-option']:checked").trigger("click");
  $('#source-upload-doc').prop('checked', true);
  $('#source-doc-upload').removeClass('hidden');
  $('#text-upload').addClass('hidden');
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
  $('#source-text').on('input', function () {
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
    if (event.target.id === "source-file" || event.target.id === "second-file") {
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
        if (fileExtension === "docx" || fileExtension === "xlsx") {
          let arrayBuffer = await uploadedFile.arrayBuffer();
          const zip = await JSZip.loadAsync(arrayBuffer);
          const docXmlStr = await zip.file("word/document.xml").async("string");
          const parser = new DOMParser();
          const xmlDoc = parser.parseFromString(docXmlStr, "application/xml");
          const textNodes = xmlDoc.getElementsByTagName("w:t");

          textContent = Array.from(textNodes)
            .map(node => `<p>${node.textContent}</p>`)
            .join('');
        } else if (fileExtension === "pptx") {
          let arrayBuffer = await uploadedFile.arrayBuffer();
          let textElements = await extractPptxTextXmlWithId(arrayBuffer);
          let pptxHtml = textElements
            .map(item => `<p id="${item.id}">${item.text}</p>`)
            .join('');
          textContent = pptxHtml;
        } else {
          throw new Error("Unsupported file type");
        }

        if (!textContent) {
          throw new Error("No text extracted.");
        }

        let detectedLanguage = detectLanguageBasedOnWords(textContent);
        if (detectedLanguage !== "french") {
          detectedLanguage = "english";
        }
        $(`#${language}-doc-detecting`).addClass("hidden");
        $(`#${language}-language-doc`).val(detectedLanguage).removeClass("hidden");

        // Process the source file for English content if it's "source-file"
        if (event.target.id === "source-file") {
          try {
            englishFile = uploadedFile;
            if (fileExtension === 'docx') {
              let arrayBuffer = await uploadedFile.arrayBuffer();

              // Now extract raw mapping with IDs and aggregate
              let rawMapping = await extractDocxTextXmlWithId(arrayBuffer);
              let aggregatedMapping = aggregateDocxMapping(rawMapping);

              // Rebuild the English HTML with the aggregated mapping
              let aggregatedHtml = aggregatedMapping
                .map(item => `<p id="${item.id}">${item.text}</p>`)
                .join('');
              // Store for AI prompt and display
              englishHtmlStored = aggregatedHtml;
              $("#translation-A").html(aggregatedHtml);
            } else if (fileExtension === 'pptx') {
              let arrayBuffer = await uploadedFile.arrayBuffer();
              let textElements = await extractPptxTextXmlWithId(arrayBuffer);
              console.log("Extracted PPTX Text Elements:", textElements);
              let pptxHtml = textElements
                .map(item => `<p id="${item.id}">${item.text}</p>`)
                .join('');
              englishHtmlStored = pptxHtml;
              $("#translation-A").html(pptxHtml);
            }
          } catch (err) {
            console.error('Error processing source file:', err);
            $(`#${language}-doc-error`).removeClass("hidden");
            $(`#${language}-doc-detecting, #${language}-language-heading`).addClass("hidden");
          }
        } else {
          // Handling for "second-file" (French file)
          frenchFile = uploadedFile;
        }
      } catch (err) {
        console.error('Error processing file change:', err);
      }
    }
  });


  $(document).on("click", "#copy-all-btn", function (e) {
    // Prevent the click from toggling the <details> element.
    e.stopPropagation();

    // Retrieve text from the <pre> element using .text()
    const textToCopy = $("#source-text-preview").text().trim();
    if (!textToCopy) {
      alert("There is no text to copy!");
      return;
    }

    // Use the Clipboard API if available.
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(textToCopy)
        .catch(err => {
          console.error("Failed to copy: ", err);
          alert("Failed to copy text.");
        });
    } else {
      // Fallback for older browsers: create a temporary textarea.
      const $tempTextarea = $("<textarea>");
      $("body").append($tempTextarea);
      $tempTextarea.val(textToCopy).select();
      try {
        document.execCommand("copy");
      } catch (err) {
        console.error("Fallback: Unable to copy", err);
        alert("Failed to copy text.");
      }
      $tempTextarea.remove();
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
  $("#source-upload-translate-btn").click(async function () {
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
              $container.contents().filter(function () {
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
              $container.contents().filter(function () {
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
      } else if (fileExtension === 'pptx' || fileExtension === 'xlsx') {
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
  /***********************************************************************
   * Provide Translation Button Flow:
   * show the second upload section
  ***********************************************************************/


  function removeCodeFences(str) {
    // Remove a leading line that starts with ``` (plus any following text)
    str = str.replace(/^```.*\n/, '');
    // Remove any trailing lines that contain only backticks and optional whitespace
    str = str.replace(/\n\s*```+\s*$/, '');
    return str.trim();
  }
  function fixInlineTagSpacing(html) {
    return html
      .replace(/([^\s>])(<(a|strong)[^>]*>)/g, '$1 $2')
      .replace(/(<\/(a|strong)>)([^\s<])/g, '$1 $3');
  }
});

/*************************************************************
 * Download Document Workflow
 *************************************************************/
$("#convert-translation-download-btn").click(async function () {
  if (!finalFrenchHtml || !finalFrenchHtml.trim()) {
    alert("No formatted French document available.");
    return;
  }

  let fileExtension = (englishFile?.name || "").split('.').pop().toLowerCase();
  let mimeType = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  if (fileExtension === 'pptx') {
    mimeType = "application/vnd.openxmlformats-officedocument.presentationml.presentation";
  } else if (fileExtension === 'xlsx') {
    mimeType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  }

  let generatedBlob;
  try {
    if (fileExtension === 'docx') {
      let arrayBuffer = await englishFile.arrayBuffer();
      const zip = await JSZip.loadAsync(arrayBuffer);
      let docXmlStr = await zip.file("word/document.xml").async("string");

      // Reconstruct aggregatedMapping (this should be the same mapping you built on file upload)
      let rawMapping = await extractDocxTextXmlWithId(arrayBuffer);
      let aggregatedMapping = aggregateDocxMapping(rawMapping);

      finalFrenchHtml = fixInlineTagSpacing(finalFrenchHtml);
      // Use the new conversion function.
      let updatedDocXml = conversionDocxXmlModified(docXmlStr, finalFrenchHtml, aggregatedMapping);

      // Write updated document.xml back into the zip.
      zip.file("word/document.xml", updatedDocXml);

      generatedBlob = await zip.generateAsync({ type: "blob", mimeType: mimeType });
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
      // XLSX branch
    }
  } catch (err) {
    console.error("Error while generating translated file:", err);
    alert("Failed to generate translated file.");
    return;
  }

  if (!generatedBlob) {
    alert("File generation failed.");
    return;
  }

  let baseFileName = englishFile ? englishFile.name.split('.').slice(0, -1).join('.') : "translated-file";
  let modifiedFileName = `${baseFileName}-FR.${fileExtension}`;

  let downloadLink = document.createElement('a');
  downloadLink.href = URL.createObjectURL(generatedBlob);
  downloadLink.download = modifiedFileName;
  downloadLink.click();
  URL.revokeObjectURL(downloadLink.href);
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
  const tempDiv = document.createElement("div");
  tempDiv.innerHTML = finalFrenchHtml;

  const rawParagraphs = Array.from(tempDiv.querySelectorAll("p[id]"));
  const frenchMap = {};

  rawParagraphs.forEach(p => {
    const id = p.getAttribute("id");
    const htmlContent = p.innerHTML.replace(/\s+/g, ' ').replace(/^\s+|\s+$/g, '');

    if (htmlContent.length > 0) {
      frenchMap[id] = htmlContent;
    }
  });

  return frenchMap;
}

function escapeXml(str) {
  return str.replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function splitFrenchText(text, parts) {
  if (parts <= 1) return [text];

  const words = text.trim().split(/\s+/);
  const result = Array(parts).fill("");
  let current = 0;

  for (let i = 0; i < words.length; i++) {
    result[current] += (result[current] ? " " : "") + words[i];
    if (current < parts - 1 && result[current].length >= text.length / parts) {
      current++;
    }
  }

  return result;
}
function splitFrenchTextByHyperlink(frenchHtml) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(frenchHtml, "text/html");
  const map = {};

  const paragraphs = doc.querySelectorAll("p[id^='P']");
  paragraphs.forEach(p => {
    const id = p.id;
    const a = p.querySelector("a");

    if (a) {
      const hyperlinkText = a.textContent.trim();
      const fullText = p.textContent.trim();
      const before = fullText.split(hyperlinkText)[0]?.trim();
      const after = fullText.split(hyperlinkText)[1]?.trim();
      const nonHyperlinkText = [before, after].filter(Boolean).join(" ");
      map[id] = {
        full: fullText,
        hyperlink: hyperlinkText,
        normal: nonHyperlinkText
      };
    } else {
      map[id] = {
        full: p.textContent.trim(),
        hyperlink: "",
        normal: p.textContent.trim()
      };
    }
  });

  return map;
}

function conversionDocxXmlModified(originalXml, finalFrenchHtml, aggregatedMapping) {
  const frenchMap = splitFrenchTextByHyperlink(finalFrenchHtml);

  const parser = new DOMParser();
  const serializer = new XMLSerializer();
  const xmlDoc = parser.parseFromString(originalXml, "application/xml");

  const paragraphs = xmlDoc.getElementsByTagName("w:p");
  let mappingIndex = 0;

  for (let i = 0; i < paragraphs.length && mappingIndex < aggregatedMapping.length; i++) {
    const p = paragraphs[i];

    const { normal, hyperlink } = extractTextRunsByContext(p);
    const key = aggregatedMapping[mappingIndex].id;
    const frenchEntry = frenchMap[key];

    // Only process if we have some French content for this ID
    if (frenchEntry) {
      // Assign normal text
      const splitNormal = splitFrenchText(frenchEntry.normal, normal.length);
      for (let j = 0; j < normal.length; j++) {
        normal[j].tNode.textContent = splitNormal[j] || "";
      }

      // Assign hyperlink text
      const splitHyperlink = splitFrenchText(frenchEntry.hyperlink, hyperlink.length);
      for (let j = 0; j < hyperlink.length; j++) {
        hyperlink[j].tNode.textContent = splitHyperlink[j] || "";
      }
    }

    mappingIndex++;
  }

  return serializer.serializeToString(xmlDoc);
}


// Helper function to convert French HTML back to PPTX XML:
function conversionPptxXml(originalXml, finalFrenchHtml, slideNumber) {
  const frenchMap = buildFrenchTextMap(finalFrenchHtml); // maps ID to Fr string
  const memoryCache = {};  // for fallback lookup
  let runIndex = 1;

  return originalXml.replace(
    /(<a:r>[\s\S]*?<a:t>)([\s\S]*?)(<\/a:t>[\s\S]*?<\/a:r>)/g,
    (match, prefix, origText, suffix) => {
      const key = `S${slideNumber}_T${runIndex++}`;
      const origTrim = origText.trim();
      const candidate = frenchMap[key]?.trim() || "";
      let newText = "";

      // Use French candidate if it's present and not identical to English
      if (candidate !== undefined) {
        // If present, use the candidate even if it's same as original — numbers and repeated tokens need this
        newText = candidate;
        if (origTrim && candidate !== origTrim) {
          memoryCache[origTrim] = candidate;
        }
      } else if (memoryCache[origTrim]) {
        newText = memoryCache[origTrim];
      } else if (/^\s*[\d.,-]+\s*$/.test(origTrim)) {
        // Allow number-like fallback (e.g. "1.00", "0.29")
        newText = origTrim;
      } else {
        newText = ""; // Skip
      }
      // If bold, apply heading/inline rules
      if (newText && /<a:rPr[^>]*\sb="1"/.test(prefix)) {
        newText = newText.trim();

        const wordCount = newText.split(/\s+/).length;
        const isHeading = wordCount > 2;

        if (isHeading) {
          if (!newText.endsWith(" ")) newText += " ";
        } else {
          if (!newText.startsWith(" ")) newText = " " + newText;
          if (!newText.endsWith(" ")) newText += " ";
        }
      }

      return prefix + escapeXml(newText) + suffix;
    }
  );
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
