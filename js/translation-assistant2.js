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

// Submit button logic: process files, then use GenAI to replace English text with French text
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
    console.log("English document.xml:", enDocumentXml);
    
    // 3. Get French document XML either from the uploaded French DOCX or from the pasted text
    let frDocumentXml = null;
    if (frenchContentMode === "file") {
      const zipFR = new PizZip(frenchDocxData);
      frDocumentXml = zipFR.file("word/document.xml").asText();
    } else {
      // Generate minimal DOCX XML from pasted French text (each newline becomes a paragraph)
      frDocumentXml = generateSimpleDocXml(frenchTextData);
    }
    console.log("French source XML:", frDocumentXml);
    
    // ============================================================
    // NEW SECTION: Use GenAI to merge the French content into the English formatting
    // ============================================================
    // Get the selected model from your radio button (or use a default)
    let modelInput = document.querySelector('input[name="html-upload-genai-model"]:checked');
    let model = modelInput ? modelInput.value : "default-model";

    // Build the messages for the GenAI API request
    let systemGeneral = { role: "system", content: "You are a DOCX formatting assistant. Preserve all formatting from the English document (including bullet lists, numbering, bold, italic, etc.)." };
    let systemTask = { role: "system", content: "Replace the English text with the following French content while keeping the exact XML structure and formatting." };
    let userContent = { role: "user", content: "English DOCX XML: " + enDocumentXml };
    // For French content, if file mode then extract plain text; otherwise use the pasted text.
    let frenchPlainText = (frenchContentMode === "textarea") ? frenchTextData : extractFrenchText(frDocumentXml);
    let userData = { role: "user", content: "French content: " + frenchPlainText };

    // Build the request JSON with the messages
    let requestJson = { messages: [systemGeneral, systemTask, userContent, userData] };

    // Send it to the GenAI API – this function should be implemented to call your GenAI endpoint.
    let ORjson = await getORData("openai/gpt-4", requestJson);
    let aiResponse = ORjson.choices[0].message.content;
    let formattedText = formatAIResponse(aiResponse);
    console.log("Formatted document.xml from GenAI:", formattedText);
    
    // ============================================================
    // END NEW SECTION
    // ============================================================
    
    // 4. Replace the document.xml in the English ZIP with the new version returned by GenAI
    zipEN.file("word/document.xml", formattedText);
    
    // 5. Generate the new DOCX file as a Blob and create a download link
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

/**
 * Dummy implementation of getORData.
 * Replace this function with your actual GenAI API call logic.
 */
async function getORData(model, requestJson) {
  // Example: using fetch to send the request to your API endpoint.
  // Note: In production, ensure your API key and URL are handled securely.
  const response = await fetch("https://gemini.google.com/app?hl=en-IN", {
    method: "POST", 
    
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: model, messages: requestJson.messages })
  });
  return response.json();
}

/**
 * Dummy implementation of formatAIResponse.
 * This function can be used to clean or validate the AI response.
 */
function formatAIResponse(aiResponse) {
  // In this example, we'll assume the response is valid DOCX XML.
  return aiResponse.trim();
}

/**
 * Utility function: extract plain text from a DOCX XML string.
 * This example extracts all <w:t> elements and concatenates them.
 */
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

