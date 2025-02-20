async function getORData(model, requestJson) {
    let ORjson;
    
    // Check if API Key is provided
    const apiKey = document.getElementById("api-key").value.trim();
    if (!apiKey) {
        alert("Please enter a valid OpenRouter API key before proceeding.");
        return undefined;
    }

    console.log(JSON.stringify({
        "model": model,
        "messages": requestJson
    }));

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

        // Validate response structure
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

function formatAIResponse(aiResponse) {
    if (!aiResponse || typeof aiResponse !== "string") {
        console.error("Invalid AI response:", aiResponse);
        return "";
    }
    return aiResponse.trim();
}

// Improved file validation and error handling
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

// Ensure `ORjson` is valid before accessing its contents
submitBtn.addEventListener("click", async () => {
    if (!englishDocxData) {
        alert("Please upload the English Word Document first.");
        return;
    }

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
        const zipEN = new PizZip(englishDocxData);
        let enDocumentXml = zipEN.file("word/document.xml").asText();

        let frDocumentXml = null;
        if (frenchContentMode === "file") {
            const zipFR = new PizZip(frenchDocxData);
            frDocumentXml = zipFR.file("word/document.xml").asText();
        } else {
            frDocumentXml = generateSimpleDocXml(frenchTextData);
        }

        let model = "openai/gpt-4";
        let requestJson = {
            messages: [
                { role: "system", content: "You are a DOCX formatting assistant. Preserve all formatting." },
                { role: "system", content: "Replace the English text with the following French content while keeping the XML structure intact." },
                { role: "user", content: "English DOCX XML: " + enDocumentXml },
                { role: "user", content: "French content: " + (frenchContentMode === "textarea" ? frenchTextData : extractFrenchText(frDocumentXml)) }
            ]
        };

        let ORjson = await getORData(model, requestJson);
        if (!ORjson) return;

        let aiResponse = ORjson.choices[0]?.message?.content || "";
        let formattedText = formatAIResponse(aiResponse);

        if (!formattedText) {
            alert("AI response was empty or invalid.");
            return;
        }

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
