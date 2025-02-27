document.addEventListener("DOMContentLoaded", function () {
    // Selecting elements
    const apiKeyEntry = document.getElementById("api-key-entry");
    const apiKeyInput = document.getElementById("api-key");
    const apiKeySubmitBtn = document.getElementById("api-key-submit-btn");
    const documentUploadContainer = document.getElementById("document-upload-container");
    const frenchTextareaContainer = document.getElementById("french-textarea-container");
    const frenchFileContainer = document.getElementById("french-file-container");

    // Global Variables
    let englishDocxData = null;
    let frenchDocxData = null;
    const loadingIndicator = document.createElement("p");
    loadingIndicator.innerText = "Processing...";
    loadingIndicator.style.display = "none";
    loadingIndicator.style.color = "blue";
    document.body.appendChild(loadingIndicator);

    const savedApiKey = sessionStorage.getItem("openRouterApiKey") || "";

    if (savedApiKey.trim() !== "") {
        apiKeyEntry.style.display = "none";
        documentUploadContainer.style.display = "block";
    } else {
        apiKeyEntry.style.display = "block";
        documentUploadContainer.style.display = "none";
    }

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

    // Handle French input selection (textarea or file)
    const radioOptions = document.getElementsByName("french-input-option");
    radioOptions.forEach(radio => {
        radio.addEventListener("change", function () {
            console.log("French input option selected:", this.value); // Debugging log
            if (this.value === "textarea") {
                frenchTextareaContainer.style.display = "block";
                frenchFileContainer.style.display = "none";
            } else if (this.value === "file") {
                frenchTextareaContainer.style.display = "none";
                frenchFileContainer.style.display = "block";
            }
        });
    });

    // File Upload Handlers
    function handleFileInput(fileInput, fileType) {
        fileInput.addEventListener("change", (event) => {
            const file = event.target.files[0];
            if (file) {
                if (!file.name.toLowerCase().endsWith(".docx")) {
                    alert("Only .docx files are allowed.");
                    return;
                }
                const reader = new FileReader();
                reader.onload = (e) => {
                    if (fileType === "english") {
                        englishDocxData = e.target.result;
                        console.log("English file loaded successfully.");
                    } else if (fileType === "french") {
                        frenchDocxData = e.target.result;
                        console.log("French file loaded successfully.");
                    }
                };
                reader.readAsBinaryString(file);
            }
        });
    }

    handleFileInput(document.getElementById("english-file"), "english");
    handleFileInput(document.getElementById("french-file"), "french");
     
    function extractBodyContent(xml) {
  const match = xml.match(/<w:body>([\s\S]*?)<\/w:body>/);
  return match ? match[1] : '';
}
    // Submit Processing
    const submitBtn = document.getElementById("submit-btn");
    const downloadLink = document.getElementById("downloadLink");

    submitBtn.addEventListener("click", async () => {
        const apiKey = sessionStorage.getItem("openRouterApiKey");
        if (!apiKey) {
            alert("Please enter an API key.");
            return;
        }

        console.log("Submit button clicked. Processing started...");
        loadingIndicator.style.display = "block";

        if (!englishDocxData) {
            alert("Please upload an English Word Document.");
            return;
        }

        console.log("Reading English DOCX...");
        const zipEN = new PizZip(englishDocxData);
        let englishDocxXml = zipEN.file("word/document.xml")?.asText();

        if (!englishDocxXml) {
            alert("Error: Could not extract XML from the English DOCX.");
            return;
        }

        console.log("Extracting body content...");
        const bodyMatch = englishDocxXml.match(/<w:body>([\s\S]*?)<\/w:body>/);
        if (!bodyMatch) {
            alert("Invalid DOCX format: Missing body content.");
            return;
        }

        let bodyContent = bodyMatch[1];
        let textChunks = chunkText(bodyContent, 400); // Adjust chunk size here
        console.log(`Total chunks to process: ${textChunks.length}`);

        let formattedChunks = [];

        for (let i = 0; i < textChunks.length; i++) {
            console.log(`Processing chunk ${i + 1}/${textChunks.length}...`);

            let requestJson = {
                messages: [
                    { role: "system", content: "You are a DOCX formatting assistant. When given a chunk of DOCX XML, reformat and return only the complete, valid DOCX XML. Ensure your output includes the XML declaration, the complete <w:document> element (with its <w:body>), and all necessary closing tags. Do not wrap your output in code fences. Finally, end your output with the marker [END_OF_XML] (on its own line)." },
                    { role: "user", content: "English DOCX chunk: " + escapeXML(textChunks[i]) }
                ]
            };

            let ORjson = await getORData("google/gemini-2.0-flash-lite-preview-02-05:free", requestJson);

            if (!ORjson || !ORjson.choices || ORjson.choices.length === 0) {
    console.error(`API request failed or returned unexpected structure for chunk ${i + 1}:`, ORjson);
    continue;
}
            let aiResponse = ORjson.choices[0]?.message?.content || "";
            console.log(`Chunk ${i + 1} Response:\n`, aiResponse);

            function ensureCompleteXML(xml) {
  // Remove code fences if present
  xml = xml.replace(/^```xml\s*/, "").replace(/\s*```$/, "").trim();

  // If our marker is present, cut the string there
  const marker = "[END_OF_XML]";
  const markerIndex = xml.indexOf(marker);
  if (markerIndex !== -1) {
    xml = xml.substring(0, markerIndex).trim();
  }
  
  // Now check if the XML ends with the necessary closing tags
  if (!xml.endsWith("</w:document>")) {
    // If </w:body> is missing, add it.
    if (!xml.includes("</w:body>")) {
      xml += "\n</w:body>";
    }
    // Append closing document tag.
    xml += "\n</w:document>";
  }
  return xml;
}


// Example usage after receiving and formatting the AI response:
let formattedText = formatAIResponse(aiResponse);
formattedText = ensureCompleteXML(formattedText);

            if (!formattedText) {
                console.error(`Skipping chunk ${i + 1} due to formatting issues.`);
                continue;
            }

            formattedChunks.push(formattedText);
        }
        
        let finalBodyContent = formattedChunks.map(chunk => extractBodyContent(chunk)).join("\n");
        let finalDocXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" ...>
  <w:body>
    ${finalBodyContent}
  </w:body>
</w:document>`;

        zipEN.file("word/document.xml", finalDocXml);
        console.log("Final DOCX XML constructed.");

        const newDocxBlob = zipEN.generate({ type: "blob", compression: "DEFLATE" });
        const newDocUrl = URL.createObjectURL(newDocxBlob);

        downloadLink.href = newDocUrl;
        downloadLink.download = "formatted.docx";
        downloadLink.style.display = "inline";
        downloadLink.textContent = "Download Formatted DOCX";

        console.log("Processing complete. Download link ready.");
        alert("Success! Your formatted DOCX is ready to download.");
        loadingIndicator.style.display = "none";
    });

    // Helper Functions
    async function getORData(model, requestJson) {
        const apiKey = sessionStorage.getItem("openRouterApiKey");
        console.log("Sending API request...", requestJson);

        try {
            const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
                method: "POST",
                headers: { "Authorization": "Bearer " + apiKey, "Content-Type": "application/json" },
                body: JSON.stringify({ "model": model, "messages": requestJson.messages })
            });

            console.log("API Response Status:", response.status);
            if (!response.ok) throw new Error(`Response status: ${response.status}`);

            return await response.json();
        } catch (error) {
            alert("API request failed: " + error.message);
            console.error("Error fetching from OpenRouter API:", error.message);
            return undefined;
        }
    }

    function chunkText(text, maxWords = 400) {
        const words = text.split(/\s+/);
        let chunks = [];
        for (let i = 0; i < words.length; i += maxWords) {
            chunks.push(words.slice(i, i + maxWords).join(" "));
        }
        return chunks;
    }

    function formatAIResponse(aiResponse) {
  let cleaned = aiResponse.replace(/^```xml\s*/, '').replace(/\s*```$/, '').trim();
  return cleaned;
}

    function escapeXML(xml) {
        return xml.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    }
});
