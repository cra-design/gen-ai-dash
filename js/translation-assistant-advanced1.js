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
      console.log("French input option selected:", this.value);
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

  // Helper function: extract all <w:p>...</w:p> blocks from XML
  function extractParagraphs(xml) {
    return xml.match(/<w:p[\s\S]*?<\/w:p>/g) || [];
  }

  // Group paragraphs into batches so that total API calls do not exceed maxRequests
  function groupParagraphs(paragraphs, groupSize) {
    let groups = [];
    for (let i = 0; i < paragraphs.length; i += groupSize) {
      groups.push(paragraphs.slice(i, i + groupSize).join("\n"));
    }
    return groups;
  }

  // Helper function: remove code fences, marker, and ensure the XML is complete.
  function ensureCompleteXML(xml) {
    xml = xml.replace(/^```xml\s*/, "").replace(/\s*```$/, "").trim();
    const marker = "[END_OF_XML]";
    const markerIndex = xml.indexOf(marker);
    if (markerIndex !== -1) {
      xml = xml.substring(0, markerIndex).trim();
    }
    if (!xml.endsWith("</w:document>")) {
      if (!xml.includes("</w:body>")) {
        xml += "\n</w:body>";
      }
      xml += "\n</w:document>";
    }
    return xml;
  }

  // Helper function: extract inner <w:body> content from a complete XML document
  function extractBodyContent(xml) {
    const match = xml.match(/<w:body>([\s\S]*?)<\/w:body>/);
    return match ? match[1] : '';
  }

  // Helper function: remove code fences from AI response
  function formatAIResponse(aiResponse) {
    return aiResponse.replace(/^```xml\s*/, "").replace(/\s*```$/, "").trim();
  }

  // Helper function: escape XML special characters in text
  function escapeXML(xml) {
    return xml.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
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

    // Extract paragraphs and group them with a computed group size
    let paragraphs = extractParagraphs(bodyContent);
    console.log(`Total paragraphs found: ${paragraphs.length}`);
    const maxRequests = 30;
    let groupSize = Math.ceil(paragraphs.length / maxRequests);
    console.log(`Grouping paragraphs into batches of ${groupSize} (max ${maxRequests} requests)`);
    let groups = groupParagraphs(paragraphs, groupSize);
    console.log(`Total groups to process: ${groups.length}`);

    let formattedChunks = [];
    for (let i = 0; i < groups.length; i++) {
      console.log(`Processing group ${i + 1}/${groups.length}...`);
      let requestJson = {
        messages: [
          {
            role: "system",
            content:
              "You are a DOCX formatting assistant. Reformat the provided DOCX XML (which contains multiple <w:p> paragraphs) to produce complete and valid XML output. Ensure your output includes the XML declaration and a full <w:document> element (with its <w:body>) and all necessary closing tags. Do not include extra text or code fences. End your output with the marker [END_OF_XML] on its own line."
          },
          { role: "user", content: "English DOCX group: " + escapeXML(groups[i]) }
        ]
      };

      let ORjson = await getORData("google/gemini-2.0-flash-lite-preview-02-05:free", requestJson);
      if (!ORjson || !ORjson.choices || ORjson.choices.length === 0) {
        console.error(`API request failed or returned unexpected structure for group ${i + 1}:`, ORjson);
        continue;
      }
      let aiResponse = ORjson.choices[0]?.message?.content || "";
      console.log(`Group ${i + 1} Response:\n`, aiResponse);

      let formattedText = formatAIResponse(aiResponse);
      formattedText = ensureCompleteXML(formattedText);
      if (!formattedText) {
        console.error(`Skipping group ${i + 1} due to formatting issues.`);
        continue;
      }
      formattedChunks.push(formattedText);
    }

    // Reassemble the processed groups into a single <w:body>
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

  // Helper function: call the API
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
});
