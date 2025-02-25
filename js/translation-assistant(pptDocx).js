// --------------------
// DOMContentLoaded: API Key Screen & Initial Setup
// --------------------
document.addEventListener("DOMContentLoaded", function () {
  const apiKeyEntry = document.getElementById("api-key-entry"); // API key section
  const apiKeyInput = document.getElementById("api-key");         // API key input field
  const apiKeySubmitBtn = document.getElementById("api-key-submit-btn"); // API key submit button
  const documentUploadContainer = document.getElementById("document-upload-container"); // Upload section

  // Check if the URL has a 'key' parameter
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.has("key")) {
    apiKeyEntry.style.display = "none";
    documentUploadContainer.style.display = "block";
  } else {
    apiKeyEntry.style.display = "block";
    documentUploadContainer.style.display = "none";
  }

  sessionStorage.removeItem("openRouterApiKey");

  apiKeySubmitBtn.addEventListener("click", function () {
    const apiKey = apiKeyInput.value.trim();
    if (apiKey) {
      sessionStorage.setItem("openRouterApiKey", apiKey);
      apiKeyEntry.style.display = "none";
      documentUploadContainer.style.display = "block";
    } else {
      alert("Please enter a valid API key.");
    }
  });
});

// --------------------
// Global Variables & File Type Detection
// --------------------
let englishFileData = null;
let englishFileType = null;
let frenchFileData = null;
let frenchFileType = null;

function getFileType(file) {
  const name = file.name.toLowerCase();
  if (name.endsWith(".docx")) return "docx";
  if (name.endsWith(".pptx")) return "pptx";
  if (name.endsWith(".xlsx")) return "xlsx";
  return null;
}

// --------------------
// Grab DOM Elements for File Inputs, Textarea, Buttons, and Download Link
// --------------------
const englishFileInput = document.getElementById("english-file");
const frenchFileInput = document.getElementById("french-file");
const frenchTextarea = document.getElementById("french-text");
const frenchFileContainer = document.getElementById("french-file-container");
const frenchTextareaContainer = document.getElementById("french-textarea-container");
const submitBtn = document.getElementById("submit-btn");
const downloadLink = document.getElementById("downloadLink");

// --------------------
// Radio Button Logic: Toggle Between Plain Text & File for French Content
// --------------------
const radioOptions = document.getElementsByName("french-input-option");
radioOptions.forEach(radio => {
  radio.addEventListener("change", () => {
    if (radio.value === "textarea" && radio.checked) {
      frenchTextareaContainer.style.display = "block";
      frenchFileContainer.style.display = "none";
    } else if (radio.value === "file" && radio.checked) {
      frenchTextareaContainer.style.display = "none";
      frenchFileContainer.style.display = "block";
    }
  });
});

// --------------------
// File Input Handler: Accepts DOCX, PPTX, XLSX for English; DOCX for French
// --------------------
function handleFileInput(fileInput, errorElementId, fileRole) {
  fileInput.addEventListener("change", (event) => {
    const file = event.target.files[0];
    if (file) {
      const type = getFileType(file);
      if (!type) {
        showError(errorElementId, "Only DOCX, PPTX, or XLSX files are allowed for English, and DOCX for French.");
        if (fileRole === "english") {
          englishFileData = null;
          englishFileType = null;
        } else {
          frenchFileData = null;
          frenchFileType = null;
        }
        return;
      }
      hideError(errorElementId);
      const reader = new FileReader();
      reader.onload = (e) => {
        if (fileRole === "english") {
          englishFileData = e.target.result;
          englishFileType = type;
          console.log("English file loaded. Type:", type);
        } else {
          frenchFileData = e.target.result;
          frenchFileType = type;
          console.log("French file loaded. Type:", type);
        }
      };
      reader.readAsBinaryString(file);
    }
  });
}

handleFileInput(englishFileInput, "english-error", "english");
handleFileInput(frenchFileInput, "french-error", "french");

// --------------------
// Utility Functions: getApiKey, escapeXML, generateSimpleDocXml
// --------------------
function getApiKey() {
  return document.getElementById("api-key").value.trim();
}

function escapeXML(xml) {
  return xml
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function generateSimpleDocXml(text) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p>
      <w:r>
        <w:t>${escapeXML(text)}</w:t>
      </w:r>
    </w:p>
  </w:body>
</w:document>`;
}

// --------------------
// Utility Functions for AI Response Processing
// --------------------

// Unescape HTML entities (converts &lt; to <, etc.)
function unescapeHTMLEntities(str) {
  const txt = document.createElement("textarea");
  txt.innerHTML = str;
  return txt.value;
}

// Remove triple-backtick code fences
function removeCodeFences(str) {
  return str.replace(/```[^\n]*\n?/g, "").replace(/```/g, "").trim();
}

/* 
  Validates the AI response and unescapes HTML entities.
  Additionally, it performs a file-type–specific check:
  - For PPTX: ensures the output starts with <p:sld and contains the PPTX namespace.
  - For DOCX/XLSX: ensures it starts with <?xml or a tag.
*/
function formatAIResponse(aiResponse, fileType) {
  if (!aiResponse) return "";
  let raw = removeCodeFences(aiResponse).trim();
  raw = unescapeHTMLEntities(raw);
  console.log("Unescaped AI response:", raw);
  
  if (fileType === "pptx") {
    if (!raw.startsWith("<p:sld") || raw.indexOf('xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"') === -1) {
      console.error("Invalid AI response for PPTX: Expected PPTX slide structure. Raw output:", raw);
      alert("The AI response for PPTX is not in the correct XML format.");
      return "";
    }
  } else {
    if (!raw.startsWith("<?xml") && raw.indexOf("<") !== 0) {
      console.error("Invalid AI response: XML does not start with an XML tag. Raw output:", raw);
      alert("The AI response is not in the correct XML format.");
      return "";
    }
  }
  
  if (raw.indexOf("</") === -1) {
    console.error("Invalid AI response: Missing closing XML tags. Raw output:", raw);
    alert("The AI response is missing closing XML structure.");
    return "";
  }
  
  return raw;
}

// --------------------
// Optional Utility: extractFrenchText (for DOCX XML)
// --------------------
function extractFrenchText(docXml) {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(docXml, "application/xml");
  const textNodes = xmlDoc.getElementsByTagName("w:t");
  let extractedText = "";
  for (let i = 0; i < textNodes.length; i++) {
    extractedText += textNodes[i].textContent + " ";
  }
  return extractedText.trim();
}

// --------------------
// Submit Button Handler: Processes English File Based on Its Type
// --------------------
submitBtn.addEventListener("click", async () => {
  const apiKey = getApiKey();
  if (!apiKey) {
    alert("Please enter a valid OpenRouter API key before proceeding.");
    return;
  }
  if (!englishFileData) {
    alert("Please upload the English document first.");
    return;
  }

  let frenchContentMode = "textarea"; // default mode
  radioOptions.forEach(radio => {
    if (radio.checked) frenchContentMode = radio.value;
  });

  let frenchTextData = "";
  if (frenchContentMode === "textarea") {
    frenchTextData = frenchTextarea.value.trim();
    if (!frenchTextData) {
      showError("french-text-error", "French content cannot be empty.");
      return;
    } else {
      hideError("french-text-error");
    }
  } else {
    if (!frenchFileData) {
      alert("Please upload the French document or select 'Paste French text'.");
      return;
    }
  }

  try {
    const zipEN = new PizZip(englishFileData);

    // Branch based on English file type
    if (englishFileType === "docx") {
      // DOCX Processing: Let AI rewrite the document.xml
      let enDocumentXml = zipEN.file("word/document.xml").asText();
      console.log("Original DOCX XML:", enDocumentXml);
      let enDocumentRels = zipEN.file("word/_rels/document.xml.rels")?.asText();
      if (!enDocumentRels) {
        console.error("Missing relationships file (_rels/document.xml.rels)");
        alert("Invalid DOCX: Missing relationships file.");
        return;
      }
      zipEN.file("word/_rels/document.xml.rels", enDocumentRels);

      let frDocumentXml = "";
      if (frenchContentMode === "file" && frenchFileType === "docx") {
        frDocumentXml = new PizZip(frenchFileData).file("word/document.xml").asText();
      } else {
        frDocumentXml = generateSimpleDocXml(frenchTextData);
      }

      let requestJson = {
        messages: [
          {
            role: "system",
            content: "You are a DOCX formatting assistant. Replace only the text inside <w:t> tags with the provided French text. Preserve all other XML tags, namespaces, and attributes. Return only valid XML with no extra commentary or code fences."
          },
          {
            role: "user",
            content: "English DOCX XML: " + escapeXML(enDocumentXml)
          },
          {
            role: "user",
            content: "French content: " + escapeXML(frDocumentXml)
          }
        ]
      };

      let ORjson = await getORData("google/gemini-2.0-flash-exp:free", requestJson);
      if (!ORjson) return;
      let aiResponse = ORjson.choices[0]?.message?.content || "";
      let formattedText = formatAIResponse(aiResponse, "docx");
      if (!formattedText) return;
      zipEN.file("word/document.xml", formattedText);

      let contentTypes = zipEN.file("[Content_Types].xml")?.asText();
      if (contentTypes && !contentTypes.includes("word/document.xml")) {
        contentTypes = contentTypes.replace(
          "</Types>",
          `<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`
        );
        zipEN.file("[Content_Types].xml", contentTypes);
      }

    } else if (englishFileType === "pptx") {
      // PPTX Processing: Let AI rewrite each slide's XML for PPTX
      let frenchContent = "";
      if (frenchContentMode === "file" && frenchFileType === "docx") {
        let frenchDocXml = new PizZip(frenchFileData).file("word/document.xml").asText();
        frenchContent = extractFrenchText(frenchDocXml);
      } else {
        frenchContent = frenchTextData;
      }

      const slideFiles = zipEN.file(/ppt\/slides\/slide\d+\.xml/);
      if (!slideFiles || slideFiles.length === 0) {
        throw new Error("No slide files found in PPTX.");
      }

      for (let i = 0; i < slideFiles.length; i++) {
        let slideXml = slideFiles[i].asText();
        let requestJson = {
          messages: [
            {
              role: "system",
              content: "You are a PowerPoint formatting assistant. Replace only the text inside <a:t> tags with the provided French text. Preserve all XML tags, attributes, and relationships exactly as they are. Return only the updated valid XML with no extra commentary or code fences."
            },
            {
              role: "user",
              content: "English slide XML: " + escapeXML(slideXml)
            },
            {
              role: "user",
              content: "French content (plain text): " + escapeXML(frenchContent)
            }
          ]
        };

        console.log("Sending PPTX prompt for slide", slideFiles[i].name);
        let ORjson = await getORData("google/gemini-2.0-flash-exp:free", requestJson);
        if (!ORjson) return;
        let aiResponse = ORjson.choices[0]?.message?.content || "";
        console.log("Raw AI Response for slide", slideFiles[i].name, ":", aiResponse);
        let formattedSlideXml = formatAIResponse(aiResponse, "pptx");
        if (!formattedSlideXml) return;
        zipEN.file(slideFiles[i].name, formattedSlideXml);
      }

    } else if (englishFileType === "xlsx") {
      // XLSX Processing: Let AI rewrite the sharedStrings.xml
      let sharedStringsXml = zipEN.file("xl/sharedStrings.xml")?.asText();
      if (!sharedStringsXml) {
        throw new Error("No sharedStrings.xml found in XLSX.");
      }
      let frenchContent = "";
      if (frenchContentMode === "file" && frenchFileType === "docx") {
        let frenchDocXml = new PizZip(frenchFileData).file("word/document.xml").asText();
        frenchContent = extractFrenchText(frenchDocXml);
      } else {
        frenchContent = frenchTextData;
      }
      let requestJson = {
        messages: [
          {
            role: "system",
            content: "You are an Excel formatting assistant. Replace only the text inside <t> tags in the sharedStrings XML with the provided French text, preserving all other XML structure. Return only valid XML with no extra commentary or code fences."
          },
          {
            role: "user",
            content: "English sharedStrings XML: " + escapeXML(sharedStringsXml)
          },
          {
            role: "user",
            content: "French content: " + escapeXML(frenchContent)
          }
        ]
      };

      let ORjson = await getORData("google/gemini-2.0-flash-exp:free", requestJson);
      if (!ORjson) return;
      let aiResponse = ORjson.choices[0]?.message?.content || "";
      let formattedSharedStringsXml = formatAIResponse(aiResponse, "xlsx");
      if (!formattedSharedStringsXml) return;
      zipEN.file("xl/sharedStrings.xml", formattedSharedStringsXml);

    } else {
      alert("Unsupported English file type.");
      return;
    }

    // Generate the new file and set up the download link
    const newFileBlob = zipEN.generate({ type: "blob", compression: "DEFLATE" });
    const newFileUrl = URL.createObjectURL(newFileBlob);
    downloadLink.href = newFileUrl;
    let ext = (englishFileType === "docx") ? "docx" : (englishFileType === "pptx") ? "pptx" : (englishFileType === "xlsx") ? "xlsx" : "out";
    downloadLink.download = `french-translated.${ext}`;
    downloadLink.style.display = "inline";
    downloadLink.textContent = "Download Formatted Document";
    alert("Success! Your formatted document is ready to download.");
    
  } catch (error) {
    console.error("Error during processing:", error);
    alert("An error occurred while processing the document: " + error.message);
  }
});

// --------------------
// getORData: Send Request to OpenRouter API
// --------------------
async function getORData(model, requestJson) {
  const apiKey = getApiKey();
  console.log("Sending API request:", requestJson);
  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + apiKey,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: model,
        messages: requestJson.messages
      })
    });
    console.log("API Response Status:", response.status);
    if (!response.ok) {
      throw new Error(`Response status: ${response.status} - ${response.statusText}`);
    }
    const ORjson = await response.json();
    if (!ORjson || !ORjson.choices || ORjson.choices.length === 0) {
      throw new Error("Invalid API response format.");
    }
    return ORjson;
  } catch (error) {
    console.error("Error fetching from OpenRouter API:", error.message);
    alert("Failed to fetch from OpenRouter API: " + error.message);
    return undefined;
  }
}

// --------------------
// showError & hideError
// --------------------
function showError(elementId, message) {
  const el = document.getElementById(elementId);
  if (el) {
    el.textContent = message;
    el.style.display = "block";
  }
}

function hideError(elementId) {
  const el = document.getElementById(elementId);
  if (el) {
    el.style.display = "none";
  }
}

// --------------------
// Utility Functions: unescapeHTMLEntities, removeCodeFences, formatAIResponse
// --------------------
function unescapeHTMLEntities(str) {
  const txt = document.createElement("textarea");
  txt.innerHTML = str;
  return txt.value;
}

function removeCodeFences(str) {
  return str.replace(/```[^\n]*\n?/g, "").replace(/```/g, "").trim();
}

/* 
  Validates and unescapes the AI response.
  Uses fileType (docx, pptx, xlsx) to apply file-specific checks.
*/
function formatAIResponse(aiResponse, fileType) {
  if (!aiResponse) return "";
  let raw = removeCodeFences(aiResponse).trim();
  raw = unescapeHTMLEntities(raw);
  console.log("Unescaped AI response:", raw);
  
  if (fileType === "pptx") {
    if (!raw.startsWith("<p:sld") || raw.indexOf('xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"') === -1) {
      console.error("Invalid AI response for PPTX: Expected PPTX slide structure. Raw output:", raw);
      alert("The AI response for PPTX is not in the correct XML format.");
      return "";
    }
  } else {
    if (!raw.startsWith("<?xml") && raw.indexOf("<") !== 0) {
      console.error("Invalid AI response: XML does not start with an XML tag. Raw output:", raw);
      alert("The AI response is not in the correct XML format.");
      return "";
    }
  }
  
  if (raw.indexOf("</") === -1) {
    console.error("Invalid AI response: Missing closing XML tags. Raw output:", raw);
    alert("The AI response is missing closing XML structure.");
    return "";
  }
  
  return raw;
}

// --------------------
// Optional Utility: extractFrenchText (for DOCX XML)
// --------------------
function extractFrenchText(docXml) {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(docXml, "application/xml");
  const textNodes = xmlDoc.getElementsByTagName("w:t");
  let extractedText = "";
  for (let i = 0; i < textNodes.length; i++) {
    extractedText += textNodes[i].textContent + " ";
  }
  return extractedText.trim();
}
