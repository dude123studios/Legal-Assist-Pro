function extractLegalText() {
  const keywords = [
    /terms of service/i,
    /privacy policy/i,
    /user agreement/i,
    /fine print/i,
    /disclaimer/i,
    /arbitration/i,
    /liability/i,
    /refund/i,
    /renewal/i
  ];

  const legalSections: string[] = [];
  const allTextNodes = document.body.querySelectorAll('*');

  allTextNodes.forEach(node => {
    if (node.textContent) {
      const text = node.textContent.trim();
      if (text.length > 100) {
        if (keywords.some(kw => kw.test(text))) {
          legalSections.push(text);
        }
      }
    }
  });

  if (legalSections.length > 0) {
    const popup = document.createElement('div');
    popup.innerText = '⚖️ Legal Summary Available';
    popup.className = 'text-2xl font-bold mb-4 text-blue-700 flex items-center gap-2';
    popup.style.fontFamily = 'sans-serif';
    popup.onclick = () => {
      console.log("CLICKED");
      //chrome.runtime.sendMessage({ type: 'SHOW_SUMMARY_POPUP', text: legalSections.join('\n\n') });
      popup.remove();
    };
    document.body.appendChild(popup);
    chrome.storage.local.set({ popupLegalText: legalSections[0]})
    .then(() => {
      console.log('Content Script: Legal text saved to storage.');
    })
    .catch(error => {
      console.error('Content Script: Error saving text to storage:', error);
    });
} else {
  console.log('Content Script: No significant legal text to save to storage.');
  chrome.storage.local.set({ popupLegalText: '' }); // Clear any old text if current is too short
}

  return legalSections.join('\n\n');
}


// Optional: Listener for messages from the background script or popup
// Your previous code had a listener here. Keep it if needed for future features.
// For now, the primary extraction happens above.
chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  if (request.type === 'SHOW_SUMMARY_POPUP') {
    // This part might be for an advanced scenario where the popup asks content script to show something.
    // For now, our popup reads from storage, so this specific request type might not be strictly needed for basic flow.
    console.log("Content Script: Received SHOW_SUMMARY_POPUP message. (No action taken for now)");
    sendResponse({ status: "OK" }); // Always send a response to avoid errors.
    return true; // Indicates asynchronous response
  }
});

// Automatically extract legal text when the content script loads
extractLegalText();

chrome.runtime.onMessage.addListener((request, _, sendResponse) => {
  if (request.type === 'EXTRACT_LEGAL') {
    const result = extractLegalText();
    sendResponse({ legalText: result });
  }
});

