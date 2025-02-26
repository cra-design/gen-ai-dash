document.addEventListener("DOMContentLoaded", function () {
    // Selecting elements
    const apiKeyEntry = document.getElementById("api-key-entry"); // API key section
    const apiKeyInput = document.getElementById("api-key"); // Input field
    const apiKeySubmitBtn = document.getElementById("api-key-submit-btn"); // Submit button
    const documentUploadContainer = document.getElementById("document-upload-container"); // Upload section

    // Check if an API key exists in sessionStorage (this prevents re-entering on refresh)
    const savedApiKey = sessionStorage.getItem("openRouterApiKey");

    if (savedApiKey) {
        // If API key is already stored, show the upload page directly
        apiKeyEntry.style.display = "none";
        documentUploadContainer.style.display = "block";
    } else {
        // Otherwise, show the API key entry section
        apiKeyEntry.style.display = "block";
        documentUploadContainer.style.display = "none";
    }

    // Handle API Key submission
    apiKeySubmitBtn.addEventListener("click", function () {
        const apiKey = apiKeyInput.value.trim();
        if (apiKey) {
            // Store API key in sessionStorage
            sessionStorage.setItem("openRouterApiKey", apiKey);

            // Hide API key entry and show upload section
            apiKeyEntry.style.display = "none";
            documentUploadContainer.style.display = "block";

            // Scroll to the document upload section
            documentUploadContainer.scrollIntoView({ behavior: "smooth" });
        } else {
            alert("Please enter a valid API key.");
        }
    });
}); 
// --- Existing variable declarations & DOM element selections ---
const englishFileInput = document.getElementById("english-file");
const frenchFileInput = document.getElementById("french-file");
const frenchTextarea = document.getElementById("french-text");
const frenchFileContainer = document.getElementById("french-file-container");
const frenchTextareaContainer = document.getElementById("french-textarea-container");
const submitBtn = document.getElementById("submit-btn");
const downloadLink = document.getElementById("downloadLink");

let englishDocxData = null;
let frenchDocxData = null;

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
            console.log("English file loaded successfully.");
          }
          if (fileType === "french") {
            frenchDocxData = e.target.result; 
            console.log("French file loaded successfully.");
          }
        };
        reader.readAsBinaryString(file);
      }
    }
  });
}

handleFileInput(englishFileInput, "english-error", "english");
handleFileInput(frenchFileInput, "french-error", "french");

// Utility functions
function getApiKey() {
  return document.getElementById("api-key") ? document.getElementById("api-key").value.trim() : "dummy-key";
}

function escapeXML(xml) {
  return xml.replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&apos;");
}

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

function removeCodeFences(str) {
  return str
    .replace(/^```[a-zA-Z]*\s*/, '')
    .replace(/```$/, '')
    .trim();
}

function formatAIResponse(aiResponse) {
  if (!aiResponse) return "";
  let raw = removeCodeFences(aiResponse);
  if (!raw.startsWith('<?xml')) {
    console.error("Invalid AI response: XML format is incorrect.");
    alert("The AI response is not in the correct XML format.");
    return "";
  }
  if (!raw.includes("</w:document>")) {
    console.error("Invalid AI response: Missing closing </w:document> tag.");
    alert("The AI response is missing required XML structure.");
    return "";
  }
  return raw.trim();
}

// Extract French text from a DOCX XML (for file-based French content)
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

// --- Updated Submit Logic with DocxTemplater Pre-Processing ---
submitBtn.addEventListener("click", async () => {
  // Check API key and English file
  const apiKey = getApiKey();
  if (!apiKey) {
    alert("Please enter a valid OpenRouter API key before proceeding.");
    return;
  }
  if (!englishDocxData) {
    alert("Please upload the English Word Document first.");
    return;
  }
  
  // Determine French content mode and get French content
  let frenchContentMode = "textarea";
  radioOptions.forEach(radio => {
    if (radio.checked) frenchContentMode = radio.value;
  });
  
  let frenchContent = "";
  if (frenchContentMode === "textarea") {
    frenchContent = frenchTextarea.value.trim();
    if (!frenchContent) {
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
    try {
      const zipFR = new PizZip(frenchDocxData);
      frenchContent = extractFrenchText(zipFR.file("word/document.xml").asText());
    } catch (err) {
      alert("Error processing French DOCX file: " + err.message);
      return;
    }
  }
  
  // --- Pre-Processing Step: Substitute French Content Using DocxTemplater ---
  let substitutedXml = "";
  try {
    const zipEN = new PizZip(englishDocxData);
    // Create a DocxTemplater instance (ensure your template contains a tag like {{content}})
    var doc = new window.docxtemplater(zipEN, {
      paragraphLoop: true,
      linebreaks: true,
    });
    doc.setData({
      content: frenchContent
    });
    doc.render();
    // Get the substituted XML from the rendered document
    substitutedXml = doc.getZip().file("word/document.xml").asText();
    console.log("Substituted DOCX XML:", substitutedXml);
  } catch (error) {
    console.error("Error during DocxTemplater processing:", error);
    alert("Error during document substitution: " + error.message);
    return;
  }
  
  // --- Send the Substituted XML for AI Formatting ---
  try {
    let requestJson = {
      messages: [
        { role: "system", content: "You are a DOCX formatting assistant. Preserve all formatting, including XML namespaces and attributes. Return only valid XML. Do not add any text outside the XML. Do not add code blocks or backticks." },
        { role: "system", content: "Do not remove or modify any XML tags. Only replace text inside <w:t> tags while keeping the structure unchanged." },
        { role: "user", content: "Substituted DOCX XML: " + escapeXML(substitutedXml) }
      ]
    };
    let ORjson = await getORData("google/gemini-2.0-flash-exp:free", requestJson);
    if (!ORjson) return;
    let aiResponse = ORjson.choices[0]?.message?.content || "";
    let formattedText = formatAIResponse(aiResponse);
    if (!formattedText) return;
    
    // --- Update the English DOCX ZIP with the Formatted XML ---
    const zipEN = new PizZip(englishDocxData);
    zipEN.file("word/document.xml", formattedText);
    let enDocumentRels = zipEN.file("word/_rels/document.xml.rels").asText();
    zipEN.file("word/_rels/document.xml.rels", enDocumentRels);
    let contentTypes = zipEN.file("[Content_Types].xml")?.asText();
    if (!contentTypes.includes("word/document.xml")) {
      contentTypes = contentTypes.replace("</Types>", `<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`);
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

// --- API Request Function (unchanged) ---
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

