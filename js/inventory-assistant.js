// JavaScript Document

$(document).ready(function() {
    function readLines() {
        let lines = [];
        let content = $('#url-input').html();
        
        // Convert <div> and <br> to new lines
        content = content.replace(/<div>/g, '\n').replace(/<br>/g, '\n');
        content = content.replace(/<\/div>/g, '');
        
        lines = content.split('\n').map(line => line.trim()).filter(line => line.length > 0);
        
        console.log("Lines read:", lines); // Log the lines to the console
        return lines;
    }
    
    $('#url-input').on('input', function() {
        let lines = readLines(); // Call function when input changes
        console.log("Logged lines:", lines); // Log lines to console separately
    });
});
