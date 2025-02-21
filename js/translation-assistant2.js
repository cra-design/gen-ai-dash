document.addEventListener("DOMContentLoaded", function () {
    // Selecting elements based on your provided HTML
    const apiKeyEntry = document.getElementById("api-key-entry"); // API key section
    const apiKeyInput = document.getElementById("api-key"); // Input field
    const apiKeySubmitBtn = document.getElementById("api-key-submit-btn"); // Submit button
    const documentUploadContainer = document.getElementById("document-upload-container"); // Upload section

    // Show API key input section first, hide document upload section
    apiKeyEntry.style.display = "block";
    documentUploadContainer.style.display = "none";

    // Ensure API key is not stored persistently (forces re-entry each time)
    sessionStorage.removeItem("openRouterApiKey");

    // Handle API Key submission
    apiKeySubmitBtn.addEventListener("click", function () {
        const apiKey = apiKeyInput.value.trim();
        if (apiKey) {
            // Temporarily store API key for this session (not persistent)
            sessionStorage.setItem("openRouterApiKey", apiKey);

            // Hide API key entry section and show document upload section
            apiKeyEntry.style.display = "none";
            documentUploadContainer.style.display = "block";
        } else {
            alert("Please enter a valid API key.");
        }
    });
});


// Grab DOM elements for English & French input, errors, and download link
const englishFileInput = document.getElementById("english-file");
const frenchFileInput = document.getElementById("french-file");
const frenchTextarea = document.getElementById("french-text");
const frenchFileContainer = document.getElementById("french-file-container");
const frenchTextareaContainer = document.getElementById("french-textarea-container");
const submitBtn = document.getElementById("submit-btn");
const downloadLink = document.getElementById("downloadLink");

// Global variables to store the binary contents of the uploaded DOCX files
let englishDocxData = null;
let frenchDocxData = null;

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

// Ensure only .docx files are uploaded and update global variables correctly
function handleFileInput(fileInput, errorElementId, fileType) {
    fileInput.addEventListener("change", (event) => {
        const file = event.target.files[0];
        if (file) {
            if (!file.name.toLowerCase().endsWith(".docx")) {
                showError(errorElementId, "Only .docx files are allowed.");
                if (fileType === "english") englishDocxData = null;
                if (fileType === "french") frenchDocxData = null;
            } else {
                hideError(errorElementId);
                const reader = new FileReader();
                reader.onload = (e) => {
                    if (fileType === "english") {
                        englishDocxData = e.target.result; 
                        console.log("English file loaded successfully."); // Debugging
                    }
                    if (fileType === "french") {
                        frenchDocxData = e.target.result; 
                        console.log("French file loaded successfully."); // Debugging
                    }
                };
                reader.readAsBinaryString(file);
            }
        }
    });
}

// Attach event listeners for file inputs
handleFileInput(englishFileInput, "english-error", "english");
handleFileInput(frenchFileInput, "french-error", "french");


// Ensure OpenRouter API Key is provided
function getApiKey() {
  return document.getElementById("api-key").value.trim();
} 

// Function to escape XML special characters to prevent API errors
function escapeXML(xml) {
    return xml.replace(/&/g, "&amp;")
              .replace(/</g, "&lt;")
              .replace(/>/g, "&gt;")
              .replace(/"/g, "&quot;")
              .replace(/'/g, "&apos;");
} 
// Function to generate simple DOCX XML if using textarea input
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
// Submit button logic: process files and replace English text with French text using AI
submitBtn.addEventListener("click", async () => {
  // Ensure API Key is present
  const apiKey = getApiKey();
  if (!apiKey) {
    alert("Please enter a valid OpenRouter API key before proceeding.");
    return;
  }

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
    frenchTextData = frenchTextarea.value.trim();
    if (!frenchTextData) {
      showError("french-text-error", "French content cannot be empty.");
      return;
    } else {
      hideError("french-text-error");
    }
  } else {
    if (!frenchDocxData) {
      alert("Please upload a French Word Document or select 'Paste French text'.");
      return;
    }
  }

  try {
    // Open the English DOCX using PizZip
    const zipEN = new PizZip(englishDocxData);
    let enDocumentXml = zipEN.file("word/document.xml").asText();  
     console.log("Original English DOCX XML:", enDocumentXml);
    let enDocumentRels = zipEN.file("word/_rels/document.xml.rels").asText();
    if (!enDocumentRels) {
    console.error("Missing relationships file (_rels/document.xml.rels)");
    alert("Invalid DOCX: Missing relationships file.");
    return;
    }

   // Preserve _rels/document.xml.rels
    zipEN.file("word/_rels/document.xml.rels", enDocumentRels);
    let frDocumentXml = frenchContentMode === "file" ? 
            new PizZip(frenchDocxData).file("word/document.xml").asText() : 
            generateSimpleDocXml(frenchTextData); 
    let requestJson = {
    messages: [
        { role: "system", content: "You are a DOCX formatting assistant. Preserve all formatting, including XML namespaces and attributes." },
        { role: "system", content: "Do not remove or modify any XML tags. Only replace text inside <w:t> tags while keeping the structure unchanged." },
        { role: "user", content: "English DOCX XML: " + escapeXML(enDocumentXml) },
        { role: "user", content: "French content: " + escapeXML(frDocumentXml) }
              ]
       };

    // Send request to AI
    let ORjson = await getORData("google/gemini-2.0-flash-exp:free", requestJson);
    if (!ORjson) return;

    let aiResponse = ORjson.choices[0]?.message?.content || "";  
    // DEBUGGING: Log raw AI response before processing
    console.log("Raw AI Response (Before Formatting):", aiResponse); 
   
    
    let formattedText = formatAIResponse(aiResponse);  
     // DEBUGGING: Log formatted XML before inserting into DOCX
    console.log("Formatted XML Output Before DOCX Save:", formattedText);

    zipEN.file("word/document.xml", formattedText);
    zipEN.file("word/_rels/document.xml.rels", enDocumentRels);

     let contentTypes = zipEN.file("[Content_Types].xml")?.asText();
         if (!contentTypes.includes("word/document.xml")) {
        contentTypes = contentTypes.replace("</Types>", 
    `<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`);
    }
    zipEN.file("[Content_Types].xml", contentTypes);
      
    const newDocxBlob = zipEN.generate({ type: "blob", compression: "DEFLATE" });
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


// Function to send request to OpenRouter API
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
        "model": model,
        "messages": requestJson.messages
      }) 
   
    });
    console.log("API Response Status:", response.status); // Debugging line 
      
    if (!response.ok) {
      throw new Error(`Response status: ${response.status} - ${response.statusText}`);
    }

    ORjson = await response.json();

    if (!ORjson || !ORjson.choices || ORjson.choices.length === 0) {
      throw new Error("Invalid API response format.");
    }

  } catch (error) {
    console.error("Error fetching from OpenRouter API:", error.message);
    alert("Failed to fetch from OpenRouter API: " + error.message);
    return undefined;
  }

  return ORjson;
}

// Utility functions
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

function formatAIResponse(aiResponse) {
    let formattedText = aiResponse ? aiResponse.trim() : "";
    
    // Ensure AI response starts with valid XML declaration
    if (!formattedText.startsWith('<?xml')) {
        console.error("Invalid AI response: XML format is incorrect.");
        alert("The AI response is not in the correct XML format.");
        return "";
    }

    // Ensure all Word document tags are properly closed
    if (!formattedText.includes("</w:document>")) {
        console.error("Invalid AI response: Missing closing </w:document> tag.");
        alert("The AI response is missing required XML structure.");
        return "";
    }

    return formattedText;
}


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
