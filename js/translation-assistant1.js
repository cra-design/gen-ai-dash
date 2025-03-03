// Global variable outside the document ready function
let generatedDownloadFile = null;

$(document).ready(function() {

  $(document).on("click", "input[type=radio]", function (event) {
    var target = event.target;
    if (target.name == "source-upload-option") {
      $('#source-doc-upload').addClass("hidden");
      $('#text-upload').addClass("hidden");
      $('#second-upload').addClass("hidden");
      $('#translation-preview').addClass("hidden");
      $('#convert-translation').addClass("hidden");
      if (target.id == "source-upload-doc") {
        $('#source-doc-upload').removeClass("hidden");
      } else if (target.id == "source-upload-text") {
        $('#text-upload').removeClass("hidden");
      }
    } else if (target.name == "second-upload-option") {
      $('#second-doc-upload').addClass("hidden");
      $('#second-text-upload').addClass("hidden");
      if (target.id == "second-upload-doc") {
        $('#second-doc-upload').removeClass("hidden");
      } else if (target.id == "second-upload-text") {
        $('#second-text-upload').removeClass("hidden");
      }
    } else if (target.name == "translations-compare") {
      if (target.id == "translations-llm-compare") {
        $('#genai-model-options').removeClass("hidden");
      } else if (target.id == "translations-instructions-compare") {
        $('#genai-model-options').addClass("hidden");
      } else if (target.id == "translations-no-compare") {
        $('#genai-model-options').addClass("hidden");
      }
    }
  });

  $("#source-upload-translate-btn").click(async function() {
    var selectedOption = $('input[name="source-upload-option"]:checked').val();
    var selectedLanguage = $('#source-language').val();
    var sourceText;

    if (selectedOption == "source-upload-doc") {
      var file = $('#source-file')[0].files[0];
      if (file) {
        try {
            sourceText = await handleFileExtractionToHtml(file);
        } catch (err) {
            console.error('Error processing source file:', err);
        }
      } else {
        $("#source-doc-error").removeClass("hidden");
        return;
      }
    } else if (selectedOption == "source-upload-text") {
      sourceText = $("#source-text").val();
    }

    $("#translation-preview").removeClass("hidden");
    $("#convert-translation-to-doc-btn").removeClass("hidden");

    // NEW: Implementing Method A (Milestone Matching with GenAI)
    let translatedSegments = await translateMilestonesWithGenAI(sourceText, selectedLanguage);
    let finalTranslation = translatedSegments.join("\n\n");

    $('#translation-A').html(finalTranslation);
    $(".convert-translation").removeClass("hidden");
  });

});

// NEW: Extract milestones (headers, paragraphs, bullet points)
function extractMilestones(text) {
  let milestones = [];
  let regex = /(.*?)(\n\s*\n|$)/g; // Matches paragraphs or blank lines
  let match;

  while ((match = regex.exec(text)) !== null) {
    let segment = match[1].trim();
    if (segment) {
      milestones.push(segment);
    }
  }
  return milestones;
}

// NEW: Translate each milestone separately
async function translateMilestonesWithGenAI(text, selectedLanguage) {
  let milestones = extractMilestones(text);
  let translatedMilestones = [];

  console.log("Milestones detected:", milestones.length);

  for (let i = 0; i < milestones.length; i++) {
    let milestone = milestones[i];

    let prompt = [
      { role: "system", content: "Translate the following text while keeping the structure consistent." },
      { role: "user", content: milestone }
    ];

    let ORjson = await getORData("google/gemini-2.0-flash-lite-preview-02-05:free", prompt);

    if (!ORjson || !ORjson.choices || ORjson.choices.length === 0) {
      console.error("Translation API error, skipping milestone:", milestone);
      translatedMilestones.push(milestone); // Fallback: Use original text if translation fails
      continue;
    }

    let translatedText = ORjson.choices[0].message.content.trim();
    translatedMilestones.push(translatedText);
  }

  return translatedMilestones;
}

function detectLanguageBasedOnWords(text) {
  const englishWords = ['the', 'and', 'is', 'in', 'it', 'to', 'of', 'for', 'on', 'with'];
  const frenchWords = ['le', 'la', 'et', 'est', 'dans', 'il', 'à', 'de', 'pour', 'sur'];
  text = text.toLowerCase();

  function countMatches(wordList) {
    return wordList.reduce((count, word) => count + (text.includes(word) ? 1 : 0), 0);
  }

  const englishMatches = countMatches(englishWords);
  const frenchMatches = countMatches(frenchWords);

  if (englishMatches > frenchMatches) {
    return 'english';
  } else if (frenchMatches > englishMatches) {
    return 'french';
  } else {
    return 'unknown';
  }
}
