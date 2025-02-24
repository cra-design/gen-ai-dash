// --------------------
// DOMContentLoaded: API Key Screen & Initial Setup
// --------------------
document.addEventListener("DOMContentLoaded", function () {
  // Select elements for API key input and document upload screen
  const apiKeyEntry = document.getElementById("api-key-entry"); // API key section
  const apiKeyInput = document.getElementById("api-key");         // API key input field
  const apiKeySubmitBtn = document.getElementById("api-key-submit-btn"); // API key submit button
  const documentUploadContainer = document.getElementById("document-upload-container"); // Upload section

  // Show API key input first and hide the upload section
  apiKeyEntry.style.display = "block";
  documentUploadContainer.style.display = "none";

  // Clear any previously stored API key (forcing re-entry each time)
  sessionStorage.removeItem("openRouterApiKey");

  // When the API key is submitted, store it in session and show the upload section
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
/* Global variables to store the binary data and file type of the uploaded files */
let englishFileData = null;
let englishFileType = null;
let frenchFileData = null;
let frenchFileType = null;

/* *** UPDATE: Function to detect file type based on file extension */
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
// Radio Button Logic: Toggle Between Plain Text and File Upload for French Content
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
      // Determine the file type using the extension
      const type = getFileType(file);
      if (!type) {
        showError(errorElementId, "Only DOCX, PPTX, or XLSX files are allowed for English, and DOCX for French.");
        if (fileRole === "english") {
          englishFileData = null;
          englishFileType = null;
        }
        if (fileRole === "french") {
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
        }
        if (fileRole === "french") {
          frenchFileData = e.target.result;
          frenchFileType = type;
          console.log("French file loaded. Type:", type);
        }
      };
      reader.readAsBinaryString(file);
    }
  });
}

// Attach file input listeners for both English and French file inputs
handleFileInput(englishFileInput, "english-error", "english");
handleFileInput(frenchFileInput, "french-error", "french");

// --------------------
// Utility Functions: getApiKey, escapeXML, generateSimpleDocXml
// --------------------
function getApiKey() {
  return document.getElementById("api-key").value.trim();
}

/* Escapes XML special characters to prevent errors in the API request */
function escapeXML(xml) {
  return xml.replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&apos;");
}

/* Generates a simple DOCX XML structure from plain text (used when French content is provided as text) */
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
// Submit Button Handler: Processes English File Based on Its Type
// --------------------
submitBtn.addEventListener("click", async () => {
  // Check for API key and that an English file is provided
  const apiKey = getApiKey();
  if (!apiKey) {
    alert("Please enter a valid OpenRouter API key before proceeding.");
    return;
  }
  if (!englishFileData) {
    alert("Please upload the English document first.");
    return;
  }

  // Determine French content mode: plain text (textarea) or file
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
    // If using file mode, ensure a French file is provided (must be DOCX)
    if (!frenchFileData) {
      alert("Please upload the French document or select 'Paste French text'.");
      return;
    }
  }

  try {
    // Open the English file using PizZip
    const zipEN = new PizZip(englishFileData);

    // --- Branch Processing Based on English File Type ---
    if (englishFileType === "docx") {
      // DOCX Processing:
      let enDocumentXml = zipEN.file("word/document.xml").asText();
      console.log("Original DOCX XML:", enDocumentXml);
      let enDocumentRels = zipEN.file("word/_rels/document.xml.rels")?.asText();
      if (!enDocumentRels) {
        console.error("Missing relationships file (_rels/document.xml.rels)");
        alert("Invalid DOCX: Missing relationships file.");
        return;
      }
      // Preserve the relationships file
      zipEN.file("word/_rels/document.xml.rels", enDocumentRels);

      // Determine French XML:
      // If French file is provided (and is DOCX), extract its XML; otherwise, generate a simple XML from plain text.
      let frDocumentXml = "";
      if (frenchContentMode === "file" && frenchFileType === "docx") {
        frDocumentXml = new PizZip(frenchFileData).file("word/document.xml").asText();
      } else {
        frDocumentXml = generateSimpleDocXml(frenchTextData);
      }

      // --- Build AI Prompt for DOCX ---
      let requestJson = {
        messages: [
          {
            role: "system",
            content: "You are a DOCX formatting assistant. Your task is to update a Word document's XML by replacing the English text with the provided French content. Replace only the text inside <w:t> tags while leaving all XML tags, namespaces, and attributes unchanged. Return only valid XML without any extra commentary or code fences."
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
      let formattedText = formatAIResponse(aiResponse);
      if (!formattedText) return;

      // Write the updated XML back into the DOCX zip
      zipEN.file("word/document.xml", formattedText);
      zipEN.file("word/_rels/document.xml.rels", enDocumentRels);

      // Update [Content_Types].xml if necessary
      let contentTypes = zipEN.file("[Content_Types].xml")?.asText();
      if (contentTypes && !contentTypes.includes("word/document.xml")) {
        contentTypes = contentTypes.replace(
          "</Types>",
          `<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`
        );
        zipEN.file("[Content_Types].xml", contentTypes);
      }

    } else if (englishFileType === "pptx") {
      // PPTX Processing:
      // For PPTX, we update each slide's XML (located in ppt/slides/)
      // Use French content from plain text or, if available, extract text from a French DOCX.
      let frenchContent = "";
      if (frenchContentMode === "file" && frenchFileType === "docx") {
        let frenchDocXml = new PizZip(frenchFileData).file("word/document.xml").asText();
        // Extract text from the DOCX XML (assumes text is in <w:t> tags)
        frenchContent = extractFrenchText(frenchDocXml);
      } else {
        frenchContent = frenchTextData;
      }

      // Find all slide XML files (e.g., slide1.xml, slide2.xml, etc.)
      let slideFiles = zipEN.file(/ppt\/slides\/slide\d+\.xml/);
      if (!slideFiles || slideFiles.length === 0) {
        throw new Error("No slide files found in PPTX.");
      }
      // Process each slide file using an AI prompt tailored for PowerPoint
      for (let i = 0; i < slideFiles.length; i++) {
        let slideXml = slideFiles[i].asText();
        let requestJson = {
          messages: [
            {
              role: "system",
              content: "You are a PowerPoint formatting assistant. Your task is to update a slide's XML by replacing the English text with the provided French content. Replace only the text inside <a:t> tags while leaving all XML tags, namespaces, and attributes unchanged. Return only valid XML without any extra commentary or code fences."
            },
            {
              role: "user",
              content: "English slide XML: " + escapeXML(slideXml)
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
        let formattedSlideXml = formatAIResponse(aiResponse);
        if (!formattedSlideXml) return;
        // Update the slide file in the PPTX zip
        zipEN.file(slideFiles[i].name, formattedSlideXml);
      }

    } else if (englishFileType === "xlsx") {
      // XLSX (Excel) Processing:
      // For Excel, update the shared strings in xl/sharedStrings.xml (text is in <t> tags)
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
            content: "You are an Excel formatting assistant. Your task is to update an Excel file's sharedStrings XML by replacing the English text with the provided French content. Replace only the text inside <t> tags while leaving all XML tags, namespaces, and attributes unchanged. Return only valid XML without any extra commentary or code fences."
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
      let formattedSharedStringsXml = formatAIResponse(aiResponse);
      if (!formattedSharedStringsXml) return;
      // Write the updated shared strings back to the XLSX zip
      zipEN.file("xl/sharedStrings.xml", formattedSharedStringsXml);
    } else {
      alert("Unsupported English file type.");
      return;
    }

    // --------------------
    // Generate the New File and Set Up Download Link
    // --------------------
    const newFileBlob = zipEN.generate({ type: "blob", compression: "DEFLATE" });
    const newFileUrl = URL.createObjectURL(newFileBlob);
    downloadLink.href = newFileUrl;
    // Set the download file extension to match the English file type
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
// Function to Send Request to OpenRouter API
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
// Utility Functions: showError and hideError
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
// Utility Functions: removeCodeFences and formatAIResponse
// --------------------
/* Removes any triple-backtick code fences from the AI response */
function removeCodeFences(str) {
  return str
    .replace(/^```[a-zA-Z]*\s*/, '')
    .replace(/```$/, '')
    .trim();
}

/* Validates the AI response to ensure it returns valid XML */
function formatAIResponse(aiResponse) {
  if (!aiResponse) return "";
  let raw = removeCodeFences(aiResponse);
  // Basic check for an XML declaration or expected closing tags (for DOCX, PPTX, or XLSX)
  if (!raw.startsWith("<?xml")) {
    console.error("Invalid AI response: XML format is incorrect.");
    alert("The AI response is not in the correct XML format.");
    return "";
  }
  if (
    raw.indexOf("</w:document>") === -1 &&
    raw.indexOf("</p:sld>") === -1 &&
    raw.indexOf("</sst>") === -1
  ) {
    console.error("Invalid AI response: Missing expected closing XML tag.");
    alert("The AI response is missing required XML structure.");
    return "";
  }
  return raw.trim();
}

// --------------------
// Optional Utility Function: extractFrenchText (for DOCX XML)
// --------------------
/* Extracts text from all <w:t> tags within DOCX XML */
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
