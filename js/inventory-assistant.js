// JavaScript Document
$(document).ready(function () {

  $('#export-excel').click(function () {
    var wb = XLSX.utils.book_new();
    var ws_data = [];

    // Add header row
    ws_data.push(['URL', 'Page Title', 'Description metadata', 'Keywords metadata']);

    // Loop through each table row
    $('#table-init tbody tr').each(function () {
      var row = [];
      $(this).find('td').each(function (index) {
        var cellText = $(this).text().trim();
        var linkElement = $(this).find('a');

        if (linkElement.length) {
          var hyperlink = linkElement.attr('href');

          // Ensure the hyperlink starts with "http://" or "https://"
          if (!hyperlink.startsWith('http')) {
            hyperlink = 'http://' + hyperlink;
          }

          // Remove "-canada.ca" from the title
          var cleanedTitle = cellText.replace('-canada.ca', '').trim();

          // Add URL to column 1, cleaned title to column 2
          row.push(hyperlink, cleanedTitle);
        } else {
          row.push(cellText);
        }
      });
      ws_data.push(row);
    });

    var ws = XLSX.utils.aoa_to_sheet(ws_data);

    // Adjust column width for better visibility
    ws['!cols'] = [{
      wch: 50
    }, {
      wch: 30
    }, {
      wch: 30
    }, {
      wch: 30
    }];

    XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
    XLSX.writeFile(wb, 'table_data.xlsx');
  });

  /*$("#reset-btn").click(function () {
    resetHiddenUploadOptions();
    $('#api-key-entry').removeClass("hidden");
    $('#upload-chooser').addClass("hidden");
  });*/

  /*$("#api-key-submit-btn").click(function () {
    //validate the key to see if it's legit?

    $('#api-key-entry').addClass("hidden");
    $('#upload-chooser').removeClass("hidden");
    $('#url-upload').removeClass("hidden");
  });*/

  /*$(document).on("click", "input[type=radio]", function (event) {
    var target = event.target;
    // var parts = target.name.split("-");
    // var locationNumber = parts[parts.length - 1];
    if (target.name == "upload-option") {
      //Check which radio button it is and which content it's show/hiding
      resetHiddenUploadOptions();
      if (target.id == "live") {
        $('#url-upload').removeClass("hidden");
        $('#url-upload-input').removeClass("hidden");
      } else if (target.id == "prototype") {
        $('#url-upload').removeClass("hidden");
        $('#url-upload-input').removeClass("hidden");
      } else if (target.id == "word") {
        $('#word-upload').removeClass("hidden");
        $('#word-upload-input').removeClass("hidden");
      }
    }
  });

  $("#url-upload-btn").click(function () {
    $('#upload-chooser').addClass("hidden");
    $('#url-upload-input').addClass("hidden");
    $('#url-upload-preview').removeClass("hidden");
    $('#table-init').removeClass("hidden");
    $("#url-frame").addClass("hidden"); //reset iframe hidden
    $("#url-invalid-msg").addClass("hidden");
    $("#canada-ca-msg").addClass("hidden");
    $("#other-site-msg").addClass("hidden");

    populateUrlTable();

  });
  */

  //tab interface - page/code preview for urls
  $('.tabs ul li a').on('click', function (e) {
    e.preventDefault();
    $('.tabs ul li a').removeClass('active');
    $(this).addClass('active');
    $('.tab-content').addClass('hidden');
    const target = $(this).data('target');
    $(target).removeClass('hidden');
  });

}); //close document ready

async function createWordDoc(url) {
  try {
    if (!url) {
      alert("URL is missing!");
      return;
    }

    // Fetch content
    let response = await new Promise((resolve, reject) => {
      $.get(url)
        .done(data => resolve(data))
        .fail(err => reject(err));
    });

    // Parse HTML
    let tempDiv = $('<div>').html(response);

    // Extract <main> or fallback to <body>
    let mainContent = tempDiv.find('main').html();
    if (!mainContent || mainContent.trim().length === 0) {
      mainContent = tempDiv.find('body').html();
    }
    if (!mainContent || mainContent.trim().length === 0) {
      console.error(`No content found for ${url}`);
      alert(`No content found on: ${url}`);
      return;
    }

    // Extract filename
    let h1Tags = tempDiv.find('h1');
    let fileName = h1Tags.length > 1
      ? h1Tags.eq(1).text().trim()
      : h1Tags.first().text().trim();
    if (!fileName) {
      fileName = "Webpage_Content";
    }
    fileName = fileName.replace(/[<>:"\/\\|?*]+/g, '');

    // Add date and suffix
    let currentDate = new Date();
    let formattedDate = currentDate.toISOString().split('T')[0];
    let domainSuffix = url.includes('github') ? ' - github' : url.includes('canada.ca') ? ' - dotca' : '';
    fileName = `${fileName} - ${formattedDate}${domainSuffix}`;

    // Clone the main content to preserve styles
    let contentClone = $('<div>').html(mainContent);

    // Function to inline computed styles
    function applyInlineStyles(element) {
      let elements = element.find('*');
      elements.each(function () {
        let computedStyle = window.getComputedStyle(this);
        let inlineStyle = '';
        for (let i = 0; i < computedStyle.length; i++) {
          let property = computedStyle[i];
          let value = computedStyle.getPropertyValue(property);
          inlineStyle += `${property}: ${value}; `;
        }
        $(this).attr('style', inlineStyle);
      });
    }

    // Apply inline styles
    applyInlineStyles(contentClone);

    // 🔥 Handle WET-BOEW-specific styles manually
    contentClone.find('h1').each(function () {
      $(this).css('border-bottom', '5px solid red'); // Add red underline to H1
    });

    contentClone.find('ul.cnjnctn-type-or.cnjnctn-sm').each(function () {
      $(this).css({
        'background-color': '#f8f8f8',
        'border-left': '4px solid #0056b3',
        'padding': '10px'
      });
    });

    // 🏷 Convert tabs into markers
    contentClone.find('.wb-tabs > .tabpanels > .tabpanel').each(function () {
      let tabTitle = $(this).attr('aria-labelledby');
      let tabContent = $(this).html();
      $(this).html(`<p><strong>[Tab: ${tabTitle}]</strong></p>` + tabContent);
    });

    // 🎨 Handle WET-BOEW Icons
    async function replaceIcons() {
      let iconElements = contentClone.find('i.wb-icon');
      let iconPromises = iconElements.map(async function () {
        let $icon = $(this);
        let iconClass = $icon.attr("class").split(/\s+/).find(cls => cls.startsWith("wb-icon-"));
        if (!iconClass) return;

        let iconName = iconClass.replace("wb-icon-", ""); // e.g., wb-icon-info -> info
        let iconUrl = `https://wet-boew.github.io/wet-boew/assets/icons/${iconName}.png`; // Adjust if necessary

        try {
          let imgResponse = await fetch(iconUrl);
          let imgBlob = await imgResponse.blob();
          let reader = new FileReader();

          return new Promise(resolve => {
            reader.onloadend = function () {
              let base64Data = reader.result;
              let imgElement = `<img src="${base64Data}" alt="${iconName}" style="height: 16px; vertical-align: middle;">`;
              $icon.replaceWith(imgElement);
              resolve();
            };
            reader.readAsDataURL(imgBlob);
          });
        } catch (error) {
          console.error(`Failed to fetch icon: ${iconUrl}`, error);
        }
      }).get();

      await Promise.all(iconPromises);
    }

    await replaceIcons(); // Ensure icons are replaced before conversion

    // Full HTML content with inlined styles and icons
    let formattedContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <style>
            body { font-family: Arial, sans-serif; }
            a { color: blue; text-decoration: underline; }
            p { font-size: 14px; }
          </style>
        </head>
        <body>
          <p><strong>Source:</strong> <a href="${url}">${url}</a></p>
          ${contentClone.html()}
        </body>
      </html>
    `;

    // Convert HTML to .docx
    let converted = window.htmlDocx.asBlob(formattedContent);

    // Download link
    let link = document.createElement('a');
    link.href = URL.createObjectURL(converted);
    link.download = `${fileName}.docx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

  } catch (error) {
    console.error(`Failed to process ${url}:`, error);
    alert(`Failed to retrieve content from: ${url}`);
  }
}

function populateUrlTable() {
  let lines = [];
  let content = $('#url-input').html();

  content = content.replace(/<div>/g, '\n').replace(/<br>/g, '\n');
  content = content.replace(/<\/div>/g, '');

  lines = content.split('\n').map(line => line.trim()).filter(line => line.length > 0);

  let tbody = $('#table-init tbody');
  tbody.empty();

  let rows = new Array(lines.length).fill(null);

  lines.forEach((line, index) => {
    if (isValidUrl(line)) {
      parsePageHTML(line, function (err, html) {
        let metadata;
        if (err) {
          metadata = {
            title: line,
            description: 'Could not fetch metadata',
            keywords: ''
          };
        } else {
          metadata = extractMetadata(html, line);
        }

        // Remove " - Canada.ca" from the title if present
        metadata.title = metadata.title.replace(' - Canada.ca', '');

        rows[index] = `<tr>
                         <td><a href="${line}" target="_blank">${metadata.title}</a></td>
                         <td><button onclick="createWordDoc('${line}')">Create&nbsp;docx</button></td>
                         <td>${metadata.description}</td>
                         <td>${metadata.keywords}</td>
                       </tr>`;

        if (!rows.includes(null)) {
          tbody.html(rows.join(''));
        }
      });
    } else {
      rows[index] = `<tr>
                       <td>Invalid URL</td>
                       <td>N/A</td>
                       <td>N/A</td>
                       <td>N/A</td>
                     </tr>`;

      if (!rows.includes(null)) {
        tbody.html(rows.join(''));
      }
    }
  });
}

function extractMetadata(html, url) {
  let parser = new DOMParser();
  let doc = parser.parseFromString(html, 'text/html');

  let title = doc.querySelector('title')?.innerText || url;
  let description = doc.querySelector('meta[name="description"]')?.content || 'No Description';
  let keywords = doc.querySelector('meta[name="keywords"]')?.content || 'No Keywords';

  return {
    title,
    description,
    keywords
  };
}

/*
async function generateWordDocumentsFromTable() {
  const rows = $('#table-init tbody tr');
  if (rows.length === 0) {
    alert("No rows found in the table!");
    return;
  }

  for (let i = 0; i < rows.length; i++) {
    const url = $(rows[i]).find('td a').attr('href'); // Modify this selector based on how the URL is structured in the row

    if (!url) {
      console.warn(`No URL found in row ${i + 1}`);
      continue;
    }

    await generateWordDocumentFromURL(url); // Process each URL one at a time
  }
}

async function generateWordDocumentFromURL(url) {
  try {
    let response = await $.get(url);
    console.log(`Content received from ${url}`);

    let tempDiv = $('<div>').html(response);

    let mainContent = tempDiv.find('main').html();
    if (!mainContent || mainContent.trim().length === 0) {
      console.log("No <main> content found, using <body> instead.");
      mainContent = tempDiv.find('body').html();
    }

    if (!mainContent || mainContent.trim().length === 0) {
      console.error(`No extractable content found in ${url}`);
      return;
    }

    let h1Tags = tempDiv.find('h1');
    let fileName = h1Tags.length > 1
      ? h1Tags.eq(1).text().trim()
      : h1Tags.first().text().trim();

    if (!fileName) {
      fileName = "Webpage_Content";
    }

    fileName = fileName.replace(/[<>:"\/\\|?*]+/g, '');

    let formattedContent = `
      <p><strong>Source:</strong> <a href="${url}">${url}</a></p>
      ${mainContent}
    `;

    let docContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <style>
            body { font-family: Arial, sans-serif; }
            a { color: blue; text-decoration: underline; }
            p { font-size: 14px; }
          </style>
        </head>
        <body>${formattedContent}</body>
      </html>
    `;

    let blob = new Blob(['\ufeff' + docContent], {
      type: 'application/msword'
    });

    let link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${fileName}.doc`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

  } catch (error) {
    console.error(`Failed to process URL ${url}:`, error);
  }
  
  
  function formatHTML(htmlString) { // Create a new DOMParser instance
  const parser = new DOMParser();
  // Parse the HTML string into a Document
  const doc = parser.parseFromString(htmlString, 'text/html');
  // Serialize the Document back to a string with indentation
  const formattedHTML = doc.documentElement.outerHTML;
  // Return the formatted HTML
  return formattedHTML;
}

function convertTextToHTML(text) {
  // Split the text into paragraphs based on double newlines
  const paragraphs = text.split(/\n\s*\n/);

  // Wrap each paragraph with <p> tags and replace single newlines with <br>
  const htmlParagraphs = paragraphs.map(paragraph => {
    const escapedParagraph = paragraph
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
    const withLineBreaks = escapedParagraph.replace(/\n/g, '<br>');
    return `<p>${withLineBreaks}</p>`;
  });

  // Join all paragraphs into a single string
  return htmlParagraphs.join('');
}
}*/
