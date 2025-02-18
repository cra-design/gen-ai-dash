document.addEventListener("DOMContentLoaded", function () {
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

    document.getElementById("submit-btn").addEventListener("click", async function () {
        const englishFile = document.getElementById("english-file").files[0];
        const frenchFile = document.getElementById("french-file").files[0];
        const frenchText = document.getElementById("french-text").value.trim();
        const englishError = document.getElementById("english-error");
        const frenchError = document.getElementById("french-error");
        const frenchTextError = document.getElementById("french-text-error");
        
        englishError.style.display = "none";
        frenchError.style.display = "none";
        frenchTextError.style.display = "none";
        
        let hasError = false;

        if (!englishFile || englishFile.type !== "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
            englishError.style.display = "block";
            hasError = true;
        }
        
        if (document.querySelector("input[name='french-input-option']:checked").value === 'file') {
            if (!frenchFile || frenchFile.type !== "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
                frenchError.style.display = "block";
                hasError = true;
            }
        } else {
            if (!frenchText) {
                frenchTextError.style.display = "block";
                hasError = true;
            }
        }
        
        if (hasError) return;
        
        try {
            const englishDoc = await extractTextFromDocx(englishFile);
            let frenchContent = frenchFile ? await extractTextFromDocx(frenchFile) : frenchText;
            
            const formattedFrenchDoc = replaceEnglishWithFrench(englishDoc, frenchContent);
            
            generateDownloadableDocx(formattedFrenchDoc);
        } catch (error) {
            console.error("Error processing document:", error);
        }
    });

    async function extractTextFromDocx(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = async function (event) {
                const arrayBuffer = reader.result;
                try {
                    const result = await mammoth.extractRawText({ arrayBuffer });
                    resolve(result.value.trim());
                } catch (err) {
                    reject("Failed to extract text from document.");
                }
            };
            reader.readAsArrayBuffer(file);
        });
    }

    function replaceEnglishWithFrench(englishText, frenchText) {
        const englishLines = englishText.split("\n");
        const frenchLines = frenchText.split("\n");
        let formattedText = "";
        
        for (let i = 0; i < englishLines.length; i++) {
            formattedText += frenchLines[i] ? frenchLines[i] + "\n" : "\n";
        }
        return formattedText;
    }

    function generateDownloadableDocx(content) {
        const doc = new docx.Document({
            sections: [
                {
                    properties: {},
                    children: [new docx.Paragraph(content)],
                },
            ],
        });
        
        docx.Packer.toBlob(doc).then(blob => {
            const downloadLink = document.getElementById("download-link");
            downloadLink.href = URL.createObjectURL(blob);
            document.getElementById("download-container").style.display = "block";
        });
    }

    // Ensure the correct input is displayed on page load
    toggleFrenchInput(document.querySelector("input[name='french-input-option']:checked").value);
});
