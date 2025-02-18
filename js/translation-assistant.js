document.addEventListener("DOMContentLoaded", function () {

    console.log("Translation Assistant Loaded");
     // Ensure docx library is available before proceeding
    if (typeof window.docx === "undefined") {
        console.error("Error: docx library is not loaded.");
        return;
    }
    // Function to toggle between French text input methods
    function toggleFrenchInput(option) {
        const textareaContainer = document.getElementById('french-textarea-container');
        const fileContainer = document.getElementById('french-file-container');

        if (option === 'textarea') {
            textareaContainer.style.display = 'block';
            fileContainer.style.display = 'none';
        } else {
            textareaContainer.style.display = 'none';
            fileContainer.style.display = 'block';
        }
    }

    // Ensure toggle works when user selects an option
    document.querySelectorAll("input[name='french-input-option']").forEach(input => {
        input.addEventListener("change", function () {
            toggleFrenchInput(this.value);
        });
    });

    // Initialize toggleFrenchInput based on default selection
    toggleFrenchInput(document.querySelector("input[name='french-input-option']:checked")?.value || 'textarea');

    // File validation function
    function validateFile(input, errorElementId) {
        const file = input.files[0];
        const errorElement = document.getElementById(errorElementId);

        if (!file) {
            errorElement.textContent = "No file selected.";
            errorElement.style.display = "block";
            return false;
        }

        if (file.type !== "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
            errorElement.textContent = "Only .docx files are allowed.";
            errorElement.style.display = "block";
            return false;
        }

        errorElement.style.display = "none";
        return true;
    }

    // Load Word document using Mammoth.js
    function loadWordFile(file, callback) {
        const reader = new FileReader();
        reader.onload = function (event) {
            const arrayBuffer = event.target.result;

            // Ensure Mammoth.js is loaded
            if (typeof mammoth === 'undefined') {
                console.error("Mammoth.js is not loaded.");
                return;
            }

            mammoth.extractRawText({ arrayBuffer: arrayBuffer })
                .then(function (result) {
                    callback(result.value);
                })
                .catch(function (err) {
                    console.error("Error extracting text:", err);
                });
        };
        reader.readAsArrayBuffer(file);
    }

    document.getElementById("submit-btn").addEventListener("click", function () {
        const englishFileInput = document.getElementById("english-file");
        const frenchFileInput = document.getElementById("french-file");
        const frenchTextArea = document.getElementById("french-text");
        const frenchOption = document.querySelector("input[name='french-input-option']:checked").value;

        const englishValid = validateFile(englishFileInput, "english-error");
        let frenchValid = false;
        let frenchContent = "";

        if (frenchOption === "file") {
            frenchValid = validateFile(frenchFileInput, "french-error");
            if (frenchValid) {
                loadWordFile(frenchFileInput.files[0], function (text) {
                    frenchContent = text;
                    processTranslation(englishFileInput.files[0], frenchContent);
                });
            }
        } else {
            frenchContent = frenchTextArea.value.trim();
            if (frenchContent.length === 0) {
                document.getElementById("french-text-error").style.display = "block";
            } else {
                document.getElementById("french-text-error").style.display = "none";
                frenchValid = true;
                processTranslation(englishFileInput.files[0], frenchContent);
            }
        }
    });

    function processTranslation(englishFile, frenchContent) {
        loadWordFile(englishFile, function (englishText) {
            generateFrenchDoc(englishText, frenchContent);
        });
    }

   function generateFrenchDoc(englishText, frenchText) {
    if (!window.docx || !window.docx.Document) {
        console.error("docx.js is not correctly loaded.");
        return;
    }

    console.log("Generating French Doc...");

    const { Document, Packer, Paragraph } = window.docx;
    const doc = new Document();
    const englishSections = englishText.split("\n\n");
    const frenchSections = frenchText.split("\n\n");

    if (englishSections.length !== frenchSections.length) {
        alert("Warning: English and French section counts do not match.");
    }

    for (let i = 0; i < englishSections.length; i++) {
        doc.addSection({
            children: [
                new Paragraph({
                    text: frenchSections[i] || "", 
                    style: "Normal",
                }),
            ],
        });
    }

    Packer.toBlob(doc).then(blob => {
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = "Translated_French_Document.docx";
        link.textContent = "Download Translated French Document";

        document.getElementById("download-container").style.display = "block";
        document.getElementById("download-container").innerHTML = "";
        document.getElementById("download-container").appendChild(link);
    }).catch(err => {
        console.error("Error generating document:", err);
    });
}
});
