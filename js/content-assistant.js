//Includes JS common to all of the content assistant tools
$(document).ready(function() {

  /*
  $(function () {
  var dropZoneId = "image-drop-upload-area";
  var buttonId = "file-upload-btn";
  var mouseOverClass = "mouse-over";

  var dropZone = $("#" + dropZoneId);
  var ooleft = dropZone.offset().left;
  var ooright = dropZone.outerWidth() + ooleft;
  var ootop = dropZone.offset().top;
  var oobottom = dropZone.outerHeight() + ootop;
  var inputFile = dropZone.find("input");
  document.getElementById(dropZoneId).addEventListener("dragover", function (e) {
  e.preventDefault();
  e.stopPropagation();
  dropZone.addClass(mouseOverClass);
  var x = e.pageX;
  var y = e.pageY;

  if (!(x < ooleft || x > ooright || y < ootop || y > oobottom)) {
    inputFile.offset({ top: y - 15, left: x - 100 });
  } else {
    inputFile.offset({ top: -400, left: -400 });
  }

  }, true);

  if (buttonId != "") {
  var clickZone = $("#" + buttonId);

  var oleft = clickZone.offset().left;
  var oright = clickZone.outerWidth() + oleft;
  var otop = clickZone.offset().top;
  var obottom = clickZone.outerHeight() + otop;

  $("#" + buttonId).mousemove(function (e) {
    var x = e.pageX;
    var y = e.pageY;
    if (!(x < oleft || x > oright || y < otop || y > obottom)) {
      inputFile.offset({ top: y - 15, left: x - 160 });
    } else {
      inputFile.offset({ top: -400, left: -400 });
    }
  });
  }

  document.getElementById(dropZoneId).addEventListener("drop", function (e) {
  $("#" + dropZoneId).removeClass(mouseOverClass);
  }, true);

  })
  */



  //tab interface toggle
  $('.tabs ul li a').on('click', function (e) {
    e.preventDefault();
    $('.tabs ul li a').removeClass('active');
    $(this).addClass('active');
    $('.tab-content').addClass('hidden');
    const target = $(this).data('target');
    $(target).removeClass('hidden');
  });

  //GenAI menu ex-hide
  $('#toggle-btn').click(function() {
      $('.r-navbar').toggleClass('expanded');
      $('#toggle-btn i').toggleClass('fa-angle-left fa-angle-right');
  });


});

async function getORData(model, requestJson) {
    let ORjson;
    console.log(JSON.stringify({
        "model": model,
        "messages": requestJson
    }));
    try {
        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": "Bearer " + $("#api-key").val(),
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                "model": model,
                "messages": requestJson
            })
        });

        if (!response.ok) {
            throw new Error(`Response status: ${response.status}`);
        }
        ORjson = await response.json();

    } catch (error) {
        console.error("Error fetching from OpenRouter API:", error.message);
        return undefined;
    }
  return ORjson;
}

const isValidUrl = urlString=> {
    try {
        return Boolean(new URL(urlString));
    }
    catch(e){
        return false;
    }
}

function parsePageHTML(url, callback) {
    $.ajax({
        url: url,
        method: 'GET',
        success: function (response) {
            callback(null, response);
        },
        error: function (err) {
            callback(err);
        }
    });
}

function formatHTML(htmlString) {
    // // Create a new DOMParser instance
    // const parser = new DOMParser();
    // // Parse the HTML string into a Document
    // const doc = parser.parseFromString(htmlString, 'text/html');
    // // Serialize the Document back to a string with indentation
    // const formattedHTML = doc.documentElement.outerHTML;
    // Assuming htmlString contains your unformatted HTML
    // Return the formatted HTML
    return html_beautify(htmlString, { indent_size: 2, space_in_empty_paren: true });
}

function formatAIResponse(aiResponse) {
  return aiResponse
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>") // Bold (**text** → <strong>text</strong>)
    .replace(/\*(.*?)\*/g, "<em>$1</em>") // Italics (*text* → <em>text</em>)
    .replace(/\n\s*-\s*(.*?)(?=\n|$)/g, "<li>$1</li>") // Convert "- item" to list items
    .replace(/(<li>.*<\/li>)/g, "<ul>$1</ul>") // Wrap list items in <ul>
    .split("\n") // Split by line breaks
    .filter(line => line.trim() !== "") // Remove empty lines
    .map(line => `<p>${line}</p>`) // Wrap remaining text in <p> tags
    .join(""); // Join everything back together
}

//Displays a side-by-side element for comparison and changes both to 50% width, or toggles the 2nd off and eleA back to 100% width
function toggleComparisonElement(eleA, eleB) {
    if (eleB.hasClass('hidden')) {
      // Show the second iframe
      eleB.removeClass('hidden');
      eleA.css('width', '50%');
      eleB.css('width', '50%');
    } else {
      // Hide the second iframe
      eleB.addClass('hidden');
      eleA.css('width', '100%');
    }
}

//For large documents, they may exceed the token limit of the API, so we need to break them down
function estimateTokens(text) {
    // Roughly estimate token count based on word count
    let words = text.match(/\b\w+\b/g) || [];
    return Math.ceil(words.length / 0.75); // Approximate word-to-token ratio
}

function chunkText(text, maxTokens) {
    let words = text.match(/\b\w+\b/g) || [];
    let chunks = [];
    let currentChunk = [];
    let tokenCount = 0;

    words.forEach(word => {
        let wordTokens = Math.ceil(word.length / 4); // Rough estimate of token count per word
        if (tokenCount + wordTokens > maxTokens) {
            chunks.push(currentChunk.join(" "));
            currentChunk = [];
            tokenCount = 0;
        }
        currentChunk.push(word);
        tokenCount += wordTokens;
    });

    if (currentChunk.length > 0) {
        chunks.push(currentChunk.join(" "));
    }

    return chunks;
}

// // Example usage:
// let text = "Your long document content goes here...";
// let maxTokens = 1000; // Adjust token limit as needed
// let chunks = chunkText(text, maxTokens);
//
// console.log(chunks);
