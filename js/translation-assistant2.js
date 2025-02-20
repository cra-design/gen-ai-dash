document.addEventListener("DOMContentLoaded", function () {
  // API key section
  const apiKeyInput = document.getElementById("api-key");
  const apiKeySubmitBtn = document.getElementById("api-key-submit-btn");
  const documentUploadContainer = document.getElementById("document-upload-container");

  // Hide document upload section initially
  documentUploadContainer.classList.add("hidden");

  // API key submission handling
  apiKeySubmitBtn.addEventListener("click", function () {
    const apiKey = apiKeyInput.value.trim();
    if (apiKey) {
      localStorage.setItem("openRouterApiKey", apiKey);
      apiKeyInput.disabled = true;
      apiKeySubmitBtn.disabled = true;
      documentUploadContainer.classList.remove("hidden");
    } else {
      alert("Please enter a valid API key.");
    }
  });

  // Load stored API key if available
  const storedApiKey = localStorage.getItem("openRouterApiKey");
  if (storedApiKey) {
    apiKeyInput.value = storedApiKey;
    apiKeyInput.disabled = true;
    apiKeySubmitBtn.disabled = true;
    documentUploadContainer.classList.remove("hidden");
  }

  // Grab DOM elements for file inputs, text area, errors, and download link
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

  // Listen for English file selection; read it as a binary string
  englishFileInput.addEventListener("change", (event) => {
    const file = event.target.files[0];
    if (file) {
      if (!file.name.toLowerCase().endsWith(".docx")) {
        showError("english-error", "Only .docx files are allowed.");
        englishDocxData = null;
      } else {
        hideError("english-error");
        const reader = new FileReader();
        reader.onload = (e) => {
          englishDocxData = e.target.result;
        };
        reader.readAsBinaryString(file);
      }
    }
  });

  // Listen for French file selection; read it as a binary string
  frenchFileInput.addEventListener("change", (event) => {
    const file = event.target.files[0];
    if (file) {
      if (!file.name.toLowerCase().endsWith(".docx")) {
        showError("french-error", "Only .docx files are allowed.");
        frenchDocxData = null;
      } else {
        hideError("french-error");
        const reader = new FileReader();
        reader.onload = (e) => {
          frenchDocxData = e.target.result;
        };
        reader.readAsBinaryString(file);
      }
    }
  });

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

      // Get French document XML from uploaded DOCX or from the pasted text
      let frDocumentXml = null;
      if (frenchContentMode === "file") {
        const zipFR = new PizZip(frenchDocxData);
        frDocumentXml = zipFR.file("word/document.xml").asText();
      } else {
        frDocumentXml = generateSimpleDocXml(frenchTextData);
      }

      // Build the request payload for the AI service
      let model = "openai/gpt-4"; // or another model string as needed
      let requestJson = {
        messages: [
          { role: "system", content: "You are a DOCX formatting assistant. Preserve all formatting." },
          { role: "system", content: "Replace the English text with the following French content while keeping the XML structure intact." },
          { role: "user", content: "English DOCX XML: " + enDocumentXml },
          { role: "user", content: "French content: " + (frenchContentMode === "textarea" ? frenchTextData : extractFrenchText(frDocumentXml)) }
        ]
      };

      // Send the request to the AI API
      let ORjson = await getORData(model, requestJson);
      if (!ORjson) return;

      let aiResponse = ORjson.choices[0]?.message?.content || "";
      let formattedText = formatAIResponse(aiResponse);

      if (!formattedText) {
        alert("AI response was empty or invalid.");
        return;
      }

      // Replace the document.xml content in the English DOCX with the new formatted XML
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

  // --- Utility functions ---

  // Returns the API key from the input field
  function getApiKey() {
    return document.getElementById("api-key").value.trim();
  }

  // Shows an error message for a given element ID
  function showError(elementId, message) {
    const el = document.getElementById(elementId);
    if (el) {
      el.textContent = message;
      el.style.display = "block";
    }
  }

  // Hides the error message for a given element ID
  function hideError(elementId) {
    const el = document.getElementById(elementId);
    if (el) {
      el.style.display = "none";
    }
  }

  // Trims the AI response
  function formatAIResponse(aiResponse) {
    return aiResponse ? aiResponse.trim() : "";
  }

  // Generates a minimal document.xml string from raw text (each newline becomes a paragraph)
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

  // Escapes XML special characters to prevent malformed XML
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

  // Extracts plain text from DOCX XML by concatenating all <w:t> nodes
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

  // Sends a request to the OpenRouter API and returns the JSON response
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
          "messages": requestJson.messages
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
});
