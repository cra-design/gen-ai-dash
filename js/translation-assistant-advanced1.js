document.addEventListener("DOMContentLoaded", function () {
    // Selecting elements
    const apiKeyEntry = document.getElementById("api-key-entry"); 
    const apiKeyInput = document.getElementById("api-key"); 
    const apiKeySubmitBtn = document.getElementById("api-key-submit-btn"); 
    const documentUploadContainer = document.getElementById("document-upload-container");

    // Check if an API key exists in sessionStorage
    const savedApiKey = sessionStorage.getItem("openRouterApiKey") || "";

    if (savedApiKey.trim() !== "") {
        apiKeyEntry.style.display = "none";
        documentUploadContainer.style.display = "block";
    } else {
        apiKeyEntry.style.display = "block";
        documentUploadContainer.style.display = "none";
    }

    // Handle API Key submission
    apiKeySubmitBtn.addEventListener("click", function () {
        const apiKey = apiKeyInput.value.trim();
        if (apiKey) {
            sessionStorage.setItem("openRouterApiKey", apiKey);
            apiKeyEntry.style.display = "none";
            documentUploadContainer.style.display = "block";
            documentUploadContainer.scrollIntoView({ behavior: "smooth" });
        } else {
            alert("Please enter a valid API key.");
        }
    });
});

// --- DOM Element Selections ---
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
        if (radio.value === "textarea") {
            frenchTextareaContainer.style.display = "block";
            frenchFileContainer.style.display = "none";
        } else {
            frenchTextareaContainer.style.display = "none";
            frenchFileContainer.style.display = "block";
        }
    });
});

// --- File Input Handling ---
function handleFileInput(fileInput, errorElementId, fileType) {
    fileInput.addEventListener("change", (event) => {
        const file = event.target.files[0];
        if (file && file.name.toLowerCase().endsWith(".docx")) {
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
        } else {
            showError(errorElementId, "Only .docx files are allowed.");
        }
    });
}

handleFileInput(englishFileInput, "english-error", "english");
handleFileInput(frenchFileInput, "french-error", "french");

// --- Utility Functions ---
function getApiKey() {
    return sessionStorage.getItem("openRouterApiKey") || "";
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

// --- Chunking Function ---
function chunkText(text, maxWords = 200) {
    const words = text.split(/\s+/);
    let chunks = [];
    for (let i = 0; i < words.length; i += maxWords) {
        chunks.push(words.slice(i, i + maxWords).join(" "));
    }
    return chunks;
}

// --- Submit Button Logic ---
submitBtn.addEventListener("click", async () => {
    const apiKey = getApiKey();
    if (!apiKey) {
        alert("Please enter a valid OpenRouter API key before proceeding.");
        return;
    }
    if (!englishDocxData) {
        alert("Please upload the English Word Document first.");
        return;
    }

    // Extract XML content
    const zipEN = new PizZip(englishDocxData);
    let englishDocxXml = zipEN.file("word/document.xml").asText();
    
    // Extract <w:body> content
    const bodyMatch = englishDocxXml.match(/<w:body>([\s\S]*?)<\/w:body>/);
    if (!bodyMatch) {
        alert("Invalid DOCX format: Missing body content.");
        return;
    }

    let bodyContent = bodyMatch[1];

    // Chunk content to avoid exceeding token limits
    let textChunks = chunkText(bodyContent, 500); // Adjust chunk size if needed

    let formattedChunks = [];
    for (let i = 0; i < textChunks.length; i++) {
        let requestJson = {
            messages: [
                { role: "system", content: "You are a DOCX formatting assistant. Preserve all formatting. Return only valid DOCX XML." },
                { role: "user", content: "English DOCX chunk: " + escapeXML(textChunks[i]) }
            ]
        };

        let ORjson = await getORData("google/gemini-2.0-flash-exp:free", requestJson);
        if (!ORjson) continue;

        let aiResponse = ORjson.choices[0]?.message?.content || "";
        formattedChunks.push(aiResponse);
    }

    // Merge formatted chunks
    let finalBodyContent = formattedChunks.join("\n");

    // Rebuild final XML
    let finalDocXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    ${finalBodyContent}
  </w:body>
</w:document>`;

    zipEN.file("word/document.xml", finalDocXml);
    
    // Generate final DOCX file
    const newDocxBlob = zipEN.generate({ type: "blob", compression: "DEFLATE" });
    const newDocUrl = URL.createObjectURL(newDocxBlob);
    downloadLink.href = newDocUrl;
    downloadLink.download = "formatted.docx";
    downloadLink.style.display = "inline";
    downloadLink.textContent = "Download Formatted DOCX";
    alert("Success! Your formatted DOCX is ready to download.");
});

// --- API Request Function ---
async function getORData(model, requestJson) {
    const apiKey = getApiKey();
    try {
        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: { "Authorization": "Bearer " + apiKey, "Content-Type": "application/json" },
            body: JSON.stringify({ "model": model, "messages": requestJson.messages })
        });

        if (!response.ok) throw new Error(`Response status: ${response.status}`);

        return await response.json();
    } catch (error) {
        alert("Failed to fetch from OpenRouter API: " + error.message);
        return undefined;
    }
}
