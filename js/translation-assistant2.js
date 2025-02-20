document.addEventListener("DOMContentLoaded", function () {
    // Selecting elements based on your provided HTML
    const apiKeyEntry = document.getElementById("api-key-entry"); // API key section
    const apiKeyInput = document.getElementById("api-key"); // Input field
    const apiKeySubmitBtn = document.getElementById("api-key-submit-btn"); // Submit button
    const documentUploadContainer = document.getElementById("document-upload-container"); // Upload section

    // Ensure elements exist before proceeding
   // if (!apiKeyEntry || !apiKeyInput || !apiKeySubmitBtn || !documentUploadContainer) {
        //console.error("One or more required elements are missing. Check your HTML structure.");
       // return; // Stop execution if elements are missing
    //}

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

// Ensure only .docx files are uploaded
function handleFileInput(fileInput, errorElementId, dataVariable) {
  fileInput.addEventListener("change", (event) => {
    const file = event.target.files[0];
    if (file) {
      if (!file.name.toLowerCase().endsWith(".docx")) {
        showError(errorElementId, "Only .docx files are allowed.");
        dataVariable = null;
      } else {
        hideError(errorElementId);
        const reader = new FileReader();
        reader.onload = (e) => {
          dataVariable = e.target.result;
        };
        reader.readAsBinaryString(file);
      }
    }
  });
}

handleFileInput(englishFileInput, "english-error", englishDocxData);
handleFileInput(frenchFileInput, "french-error", frenchDocxData);

// Ensure OpenRouter API Key is provided
function getApiKey() {
  return document.getElementById("api-key").value.trim();
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

    // Get French document XML from uploaded DOCX or text area
    let frDocumentXml = null;
    if (frenchContentMode === "file") {
      const zipFR = new PizZip(frenchDocxData);
      frDocumentXml = zipFR.file("word/document.xml").asText();
    } else {
      frDocumentXml = generateSimpleDocXml(frenchTextData);
    }

    // Select AI model (default: GPT-4)
    let model = "openai/gpt-4";
    let requestJson = {
      messages: [
        { role: "system", content: "You are a DOCX formatting assistant. Preserve all formatting." },
        { role: "system", content: "Replace the English text with the following French content while keeping the XML structure intact." },
        { role: "user", content: "English DOCX XML: " + enDocumentXml },
        { role: "user", content: "French content: " + (frenchContentMode === "textarea" ? frenchTextData : extractFrenchText(frDocumentXml)) }
      ]
    };

    // Send request to AI
    let ORjson = await getORData(model, requestJson);
    if (!ORjson) return;

    let aiResponse = ORjson.choices[0]?.message?.content || "";
    let formattedText = formatAIResponse(aiResponse);

    if (!formattedText) {
      alert("AI response was empty or invalid.");
      return;
    }

    // Replace content in DOCX and create download link
    zipEN.file("word/document.xml", formattedText);
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


// Function to send request to OpenRouter API
async function getORData(model, requestJson) {
  let ORjson;
  const apiKey = getApiKey();

  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + apiKey,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        "model": model,
        "messages": requestJson
      })
    });

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
  return aiResponse ? aiResponse.trim() : "";
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
