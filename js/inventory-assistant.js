$('#create-word-docs-btn').click(async function () {
  try {
    // Prompt the user for a URL
    let url = prompt("Please enter the URL of the page:");
    if (!url) {
      alert("URL is required!");
      return;
    }

    // Fetch the content of the page using $.get()
    let response = await $.get(url);
    console.log("Page content received.");

    // Create a temporary container to parse HTML properly
    let tempDiv = $('<div>').html(response);

    // Extract content from the <main> tag (more flexible selector)
    let mainContent = tempDiv.find('main').html();

    // If <main> is empty, fallback to <body>
    if (!mainContent || mainContent.trim().length === 0) {
      console.log("No <main> content found, using <body> instead.");
      mainContent = tempDiv.find('body').html();
    }

    // If no content is found at all, show an error message
    if (!mainContent || mainContent.trim().length === 0) {
      console.error("No extractable content found.");
      alert("No content found on this page!");
      return;
    }

    // Structure the content for the Word document
    let docContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <style>
            body { font-family: Arial, sans-serif; }
          </style>
        </head>
        <body>${mainContent}</body>
      </html>
    `;

    // Create a Blob to download as a Word document
    let blob = new Blob(['\ufeff' + docContent], { type: 'application/msword' });

    // Create a download link
    let link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'Webpage_Content.doc';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

  } catch (error) {
    console.error("Failed to fetch or process the page:", error);
    alert("Failed to retrieve content. Please check the URL.");
  }
});
