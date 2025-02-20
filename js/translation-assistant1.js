// Global variables to store the binary contents of the uploaded DOCX files
let englishDocxData = null;
let frenchDocxData = null;

// Grab DOM elements for English & French input, errors, and download link
const englishFileInput        = document.getElementById("english-file");
const frenchFileInput         = document.getElementById("french-file");
const frenchTextarea          = document.getElementById("french-text");
const frenchFileContainer     = document.getElementById("french-file-container");
const frenchTextareaContainer = document.getElementById("french-textarea-container");
const submitBtn               = document.getElementById("submit-btn");
const downloadLink            = document.getElementById("downloadLink");

// Radio button logic: toggle display of French text area or file upload field
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

// Listen for English file selection; read it as a binary string
englishFileInput.addEventListener("change", (event) => {
  const file = event.target.files[0];
  if (file) {
    if (!file.name.endsWith(".docx")) {
      showError("english-error", "Only one .docx file is allowed.");
      englishDocxData = null;
      return;
    }
    hideError("english-error");
    const reader = new FileReader();
    reader.onload = (e) => {
      englishDocxData = e.target.result;
    };
    reader.readAsBinaryString(file);
  }
});

// Listen for French file selection (if user chooses file upload)
frenchFileInput.addEventListener("change", (event) => {
  const file = event.target.files[0];
  if (file) {
    if (!file.name.endsWith(".docx")) {
      showError("french-error", "Only .docx files are allowed.");
      frenchDocxData = null;
      return;
    }
    hideError("french-error");
    const reader = new FileReader();
    reader.onload = (e) => {
      frenchDocxData = e.target.result;
    };
    reader.readAsBinaryString(file);
  }
});

// Submit button logic: process files and replace English text with French text
submitBtn.addEventListener("click", async () => {
  // Ensure English DOCX is provided
  if (!englishDocxData) {
    alert("Please upload the English Word Document first.");
    return;
  }
  
  // Determine French content mode based on radio selection
  let frenchContentMode = "textarea";
  radioOptions.forEach(radio => {
    if (radio.checked) frenchContentMode = radio.value;
  });
  
  let frenchTextData = "";
  if (frenchContentMode === "textarea") {
    // Get French text from the textarea
    frenchTextData = frenchTextarea.value.trim();
    if (!frenchTextData) {
      showError("french-text-error", "French content cannot be empty.");
      return;
    } else {
      hideError("french-text-error");
    }
  } else {
    // File upload option: ensure French DOCX is provided
    if (!frenchDocxData) {
      alert("Please upload a French Word Document or select 'Paste French text'.");
      return;
    }
  }
  
  try {
    // 1. Open the English DOCX using PizZip
    const zipEN = new PizZip(englishDocxData);
    // 2. Extract the main document.xml (contains the document’s text and formatting)
    let enDocumentXml = zipEN.file("word/document.xml").asText();
    console.log(enDocumentXml);
    // 3. Get French document XML either from the uploaded French DOCX or from the pasted text
    let frDocumentXml = null;
    if (frenchContentMode === "file") {
      const zipFR = new PizZip(frenchDocxData);
      frDocumentXml = zipFR.file("word/document.xml").asText();
    } else {
      // Generate minimal DOCX XML from pasted French text (each newline becomes a paragraph)
      frDocumentXml = generateSimpleDocXml(frenchTextData);
    }
    console.log(frDocumentXml);
    // 4. Parse both XML strings into DOM objects
    const parser = new DOMParser();
    const enDoc = parser.parseFromString(enDocumentXml, "application/xml");
    const frDoc = parser.parseFromString(frDocumentXml, "application/xml");
    
    // 5. Retrieve all <w:t> nodes (text elements) from both documents
    const enTextNodes = enDoc.getElementsByTagName("w:t");
    const frTextNodes = frDoc.getElementsByTagName("w:t");
    
    // 6. Replace text content: perform a 1:1 replacement so that all formatting (bullets,
    //    numbering, bold, italic, etc.) in the English DOCX is retained.
    const loopLength = Math.min(enTextNodes.length, frTextNodes.length);
    for (let i = 0; i < loopLength; i++) {
      enTextNodes[i].textContent = frTextNodes[i].textContent;
    }
    
    // 7. Serialize the updated English DOM back to a string
    const serializer = new XMLSerializer();
    enDocumentXml = serializer.serializeToString(enDoc);
    console.log(enDocumentXml);
    // 8. Replace the old document.xml with the updated version
    zipEN.file("word/document.xml", enDocumentXml);
    
    // 9. Generate the new DOCX file as a Blob and create a download link
    const newDocxBlob = zipEN.generate({ type: "blob" });
    const newDocUrl = URL.createObjectURL(newDocxBlob);
    downloadLink.href = newDocUrl;
    downloadLink.download = "french-translated.docx";
    downloadLink.style.display = "inline";
    downloadLink.textContent = "Download Formatted French Document";
    
    alert("Success! Your formatted French DOCX is ready to download.");
    
  } catch (error) {
    console.error("Error during DOCX processing:", error);
    alert("An error occurred while processing the documents: " + error.message);
  }
});

/**
 * Utility function: show an error message by element ID.
 */
function showError(elementId, message) {
  const el = document.getElementById(elementId);
  if (el) {
    el.textContent = message;
    el.style.display = "block";
  }
}

/**
 * Utility function: hide an error message by element ID.
 */
function hideError(elementId) {
  const el = document.getElementById(elementId);
  if (el) {
    el.style.display = "none";
  }
}

/**
 * Utility function: generate a minimal document.xml string from raw text.
 * Each newline in the input text is converted into a new <w:p> (paragraph)
 * that contains a <w:r> (run) and a <w:t> (text) element.
 */
function generateSimpleDocXml(text) {
  const lines = text.split("\n");
  let paragraphXml = "";
  
  lines.forEach(line => {
    paragraphXml += `
      <w:p>
        <w:r>
          <w:t>${escapeXml(line)}</w:t>
        </w:r>
      </w:p>
    `;
  });
  
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
  <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
    <w:body>
      ${paragraphXml}
    </w:body>
  </w:document>`;
}

/**
 * Utility function: escape XML special characters to prevent malformed XML.
 */
function escapeXml(str) {
  return str.replace(/[<>&'"]/g, function(c) {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '\'': return '&apos;';
      case '"': return '&quot;';
    }
  });
}

