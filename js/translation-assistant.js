document.addEventListener("DOMContentLoaded", function () {

    // Toggle input fields for French content selection
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

    document.querySelectorAll("input[name='french-input-option']").forEach(input => {
        input.addEventListener("change", function () {
            toggleFrenchInput(this.value);
        });
    });

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

    // Load Word document
    function loadWordFile(file, callback) {
        const reader = new FileReader();
        reader.onload = function (event) {
            const arrayBuffer = event.target.result;
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
                    processDocuments();
                });
            }
        } else {
            frenchContent = frenchTextArea.value.trim();
            if (frenchContent.length === 0) {
                document.getElementById("french-text-error").style.display = "block";
            } else {
                document.getElementById("french-text-error").style.display = "none";
                frenchValid = true;
            }
        }

        if (englishValid && frenchValid && frenchContent.length > 0) {
            loadWordFile(englishFileInput.files[0], function (englishText) {
                generateFrenchDoc(englishText, frenchContent);
            });
        }
    });

    function generateFrenchDoc(englishText, frenchText) {
        const zip = new PizZip();
        const doc = new window.docx.Document();

        const englishSections = englishText.split("\n\n");
        const frenchSections = frenchText.split("\n\n");

        if (englishSections.length !== frenchSections.length) {
            alert("Warning: The English and French documents have different section counts. Some formatting might be incorrect.");
        }

        for (let i = 0; i < englishSections.length; i++) {
            doc.addSection({
                properties: {},
                children: [
                    new window.docx.Paragraph({
                        text: frenchSections[i] || "", // Use English as fallback if French section is missing
                        style: "Normal",
                    }),
                ],
            });
        }

        docx.Packer.toBlob(doc).then(blob => {
            const link = document.createElement("a");
            link.href = URL.createObjectURL(blob);
            link.download = "Translated_French_Document.docx";
            link.textContent = "Download Translated French Document";
            document.body.appendChild(link);
        });
    }
});
