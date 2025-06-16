import React, { useEffect, useState, useRef } from 'react';
import type { JSX } from 'react';

// You commented these out in your code, but they are good practice for type safety
// type MessageType = 'SUMMARIZE_LEGAL' | 'FOLLOWUP_QUESTION';

// interface Message {
//   type: MessageType;
//   text: string;
//   history?: Array<{ role: 'user' | 'model'; content: string }>;
// }

interface SummaryResponse {
  summary: string;
}

export default function Sidebar() {
  // Renamed _legalText to legalText as it's typically used for context
  const [_legalText, setLegalText] = useState<string>('');
  const [chatHistory, setChatHistory] = useState<Array<{ role: 'user' | 'model'; content: string }>>([]);
  const [isLoadingSummary, setIsLoadingSummary] = useState<boolean>(true); // Initial state is true for loading
  const [isLoadingFollowup, setIsLoadingFollowup] = useState<boolean>(false);
  const [followupInput, setFollowupInput] = useState<string>('');
  const [summaryRating, setSummaryRating] = useState<'Green' | 'Yellow' | 'Red' | null>(null);
  

  // NEW STATE: To control the display of the initial status message (Loading/No text found)
  const [initialStatusMessage, setInitialStatusMessage] = useState<string>('Loading legal summary...');

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // We already set initialStatusMessage to 'Loading legal summary...' in useState,
    // so no need to set chatHistory here immediately.
    // The initialStatusMessage will be displayed via its own JSX block.

    chrome.storage.local.get(['popupLegalText'], (res) => {
      const saved = res.popupLegalText;
      console.log("Sidebar: Retrieved legal text from storage:", saved ? `Length ${saved.length}` : "No text in storage.");

      if (saved && saved.length > 100) {
        setLegalText(saved); // Store the legal text for potential future use (e.g., follow-up context)

        // Send message to background script for summarization
        chrome.runtime.sendMessage({ type: 'SUMMARIZE_LEGAL', text: saved }, (summaryRes: SummaryResponse) => {
          console.log("Sidebar: Received summary response from background:", summaryRes);
          if (chrome.runtime.lastError) {
            console.error("Error sending message for summary:", chrome.runtime.lastError);
            // Update initialStatusMessage with error
            setInitialStatusMessage(`Error: Failed to get summary. ${chrome.runtime.lastError.message}`);
          } else if (summaryRes && summaryRes.summary) {
            
            let summaryContent = summaryRes.summary;
            const ratingMatch = summaryContent.match(/(Green|Yellow|Red)/i);


            if (ratingMatch && ratingMatch[1]) {
              const extractedRating = ratingMatch[1].toLowerCase() as 'green' | 'yellow' | 'red';
              setSummaryRating(extractedRating.charAt(0).toUpperCase() + extractedRating.slice(1) as 'Green' | 'Yellow' | 'Red');

              // Remove the entire "Rating: [Color] (optional text)" line from the displayed content
            //summaryContent = summaryContent.replace(/Rating:\s*(Green|Yellow|Red)\s*(\(.*?\))?\s*[\n\r]/i, '').trim();

            } else {
              setSummaryRating(null); // No specific rating found
            }
            console.log("Actual summary:", summaryRes.summary); // Log the actual summary here
            // Once summary is received, set it as the first item in chat history
            setChatHistory([{ role: 'model', content: summaryContent }]);
            // Clear initial status message as we now have actual content
            setInitialStatusMessage('');
          } else {
            // Handle unexpected empty responses from the API
            setInitialStatusMessage('Failed to get summary: Unexpected response from the legal assistant.');
          }
          setIsLoadingSummary(false); // Summary loading complete, regardless of outcome
        });
      } else {
        // No substantial legal text found case
        setLegalText(''); // Ensure legalText is empty
        // Update initialStatusMessage for "no text found" scenario
        setInitialStatusMessage('No substantial legal text found on this page to summarize. Please highlight legal text and try again.');
        setIsLoadingSummary(false); // Loading complete, message displayed
      }
    });
  }, []); // Empty dependency array means this effect runs once on component mount

  // Effect to auto-resize textarea as user types
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'; // Reset height
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px'; // Set to scroll height
    }
  }, [followupInput]);

  // Effect to scroll chat history to the bottom when new messages are added
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [chatHistory, initialStatusMessage]); // Also re-scroll if initial status changes (to show its content)

  const handleFollowupSubmit = () => {
    if (!followupInput.trim()) return; // Don't send empty questions

    const userQuestion = followupInput.trim();
    // Add user's question to history immediately
    setChatHistory(prevHistory => [...prevHistory, { role: 'user', content: userQuestion }]);
    setFollowupInput(''); // Clear the input field

    setIsLoadingFollowup(true); // Set loading state for follow-up

    // Create message history for the LLM call
    // Filter out initial status messages (if they were ever put into chatHistory, though with new logic they mostly won't be)
    // and error messages for context to the LLM.
    const conversationHistoryForLLM = [
      ...chatHistory.filter(msg =>
        !msg.content.startsWith('Error: Failed to get summary.') &&
        !msg.content.startsWith('No substantial legal text found') &&
        msg.content !== 'Loading legal summary...' // Ensure actual "loading" message isn't sent
      ).map(msg => ({
        role: msg.role,
        content: msg.content
      })),
      { role: 'user', content: userQuestion } // Add the new user question
    ];

    console.log("Sidebar: Sending FOLLOWUP_QUESTION message with history:", conversationHistoryForLLM);

    chrome.runtime.sendMessage({ type: 'FOLLOWUP_QUESTION', history: conversationHistoryForLLM }, (followupRes: SummaryResponse) => {
      console.log("Sidebar: Received followup response from background:", followupRes);
      if (chrome.runtime.lastError) {
        console.error("Error sending message for followup:", chrome.runtime.lastError);
        // FIX: Include the actual error message here
        setChatHistory(prevHistory => [...prevHistory, { role: 'model', content: `Error:}` }]);
      } else if (followupRes && followupRes.summary) {
        setChatHistory(prevHistory => [...prevHistory, { role: 'model', content: followupRes.summary }]);
      } else {
        setChatHistory(prevHistory => [...prevHistory, { role: 'model', content: 'Could not get a response to your question.' }]);
      }
      setIsLoadingFollowup(false); // Follow-up loading complete
    });
  };
   // Helper for content within list items (just bolding, no newlines/br)
  const parseLineContentForLists = (line: string) => {
      const parts: (JSX.Element | string)[] = [];
      const segments = line.split(/(\*\*.*?\*\*)/g); // Split by bolded text

      segments.forEach((segment, segIdx) => {
          if (segment.startsWith('**') && segment.endsWith('**') && segment.length > 3) {
              const boldContent = segment.substring(2, segment.length - 2).trim();
              parts.push(<strong key={segIdx}>{boldContent}</strong>); // Use strong for bold within lists
          } else {
              parts.push(segment);
          }
      });
      return parts;
  };

  // Helper function to render text with paragraphs and Markdown bold/header
  const renderFormattedText = (text: string) => {
    if (!text) return <>&nbsp;</>; // Return non-breaking space for empty text

      const elements: (JSX.Element | string)[] = [];
      const lines = text.split('\n'); // Process text line by line

      let currentParagraphLines: string[] = [];
      let currentListItems: (JSX.Element | string)[] = [];
      let listType: 'ul' | 'ol' | null = null; // Tracks if we're in an unordered or ordered list

      // Helper to close and add a paragraph block to elements
      const flushParagraph = () => {
          if (currentParagraphLines.length > 0) {
              const paragraphText = currentParagraphLines.join('\n');
              const parts = paragraphText.split(/(\*\*.*?\*\*)/g); // Split by bold/header text
              const paragraphElements: (JSX.Element | string)[] = [];

              parts.forEach((part, partIdx) => {
                  if (part.startsWith('**') && part.endsWith('**') && part.length > 3) {
                      const boldContent = part.substring(2, part.length - 2).trim();
                      // Use a span with a class for styling as a bold header
                      paragraphElements.push(
                          <span key={partIdx} className="bold-header-text">{boldContent}</span>
                      );
                  }else {
                  // FIX STARTS HERE
                  // Wrap the result of the map in a single React.Fragment
                  // This ensures that map returns an array of elements,
                  // but we are pushing a single JSX element (the Fragment)
                  // into paragraphElements.
                  paragraphElements.push(
                      <React.Fragment key={`text-part-${partIdx}`}>
                          {part.split('\n').map((linePart, linePartIdx) => (
                              <React.Fragment key={`${partIdx}-${linePartIdx}`}>
                                  {linePart}
                                  {linePartIdx < part.split('\n').length - 1 && <br />}
                              </React.Fragment>
                          ))}
                      </React.Fragment>
                  );
                  // FIX ENDS HERE
                }
              });
              elements.push(<p key={`p-${elements.length}`}>{paragraphElements}</p>);
              currentParagraphLines = []; // Reset for the next paragraph
          }
      };

      // Helper to close and add a list block (ul or ol) to elements
      const flushList = () => {
          if (currentListItems.length > 0) {
              if (listType === 'ul') {
                  elements.push(<ul key={`ul-${elements.length}`}>{currentListItems}</ul>);
              } else if (listType === 'ol') {
                  elements.push(<ol key={`ol-${elements.length}`}>{currentListItems}</ol>);
              }
              currentListItems = []; // Reset for the next list
              listType = null; // Clear list type
          }
      };

      lines.forEach((line, idx) => {
          const trimmedLine = line.trim();

          // Check for ordered list items (e.g., "1. some text")
          const olMatch = trimmedLine.match(/^(\d+\.\s)(.*)/);
          // Check for unordered list items (e.g., "- some text" or "* some text")
          const ulMatch = trimmedLine.match(/^([-*]\s)(.*)/);

          if (olMatch) {
              flushParagraph(); // If we were in a paragraph, close it
              if (listType !== 'ol') {
                  flushList(); // If we were in a different type of list, close it
                  listType = 'ol'; // Set to ordered list
              }
              const listItemContent = olMatch[2]; // Content after "1. "
              currentListItems.push(<li key={`li-${idx}`}>{parseLineContentForLists(listItemContent)}</li>);
          } else if (ulMatch) {
              flushParagraph(); // Close any pending paragraph
              if (listType !== 'ul') {
                  flushList(); // Close existing list if changing type
                  listType = 'ul'; // Set to unordered list
              }
              const listItemContent = ulMatch[2]; // Content after "- " or "* "
              currentListItems.push(<li key={`li-${idx}`}>{parseLineContentForLists(listItemContent)}</li>);
          } else if (trimmedLine === '' && listType !== null) {
              // An empty line when currently in a list usually means the list has ended
              flushList();
              // Don't add this empty line to a paragraph, it's a structural break
          } else if (trimmedLine === '' && currentParagraphLines.length > 0) {
              // An empty line when we have paragraph content, signifies a new paragraph block
              flushParagraph();
          } else {
              // This line is neither a list item nor a standalone paragraph break
              flushList(); // Close any active list, as this line doesn't fit list format
              currentParagraphLines.push(line); // Add it to the current paragraph
          }
      });

      // After iterating through all lines, flush any remaining content
      flushParagraph(); // Flush any final paragraph content
      flushList();      // Flush any final list content

      return elements;
  };


  // --- NEW: Function to determine sidebar title based on rating ---
  const getSidebarTitle = () => {
    if (summaryRating === 'Red') return 'ALARMING';
    if (summaryRating === 'Yellow') return 'CAUTION';
    if (summaryRating === 'Green') return 'STANDARD';
    return 'FinePrint Legal Assistant'; // Default title if no rating or not loaded yet
  };

  return (
    <div className="sidebar-container">
      <h1 className="sidebar-title">{getSidebarTitle()}</h1>

      {/* Chat History / Summary Display Area */}
      <div className="chat-history-container" ref={chatContainerRef}>
        {/* Display initial status message (Loading or No text found) */}
        {isLoadingSummary && initialStatusMessage && (
            <div className="chat-message model status-message">
                <p>{initialStatusMessage}</p>
                {initialStatusMessage === 'Loading legal summary...' && (
                  <div className="spinner-container">
                    <div className="spinner"></div>
                  </div>
                )}
            </div>
        )}

        {/* Render chatHistory only after initial loading is done AND chatHistory has content */}
        {!isLoadingSummary && chatHistory.length > 0 && chatHistory.map((message, index) => {
          // --- NEW: Apply dynamic class for the initial summary box color ---
          // Only apply the rating class to the very first message from the model, if a rating exists
          const isInitialSummaryAndRated = index === 0 && message.role === 'model' && summaryRating !== null;
          const messageClasses = ` ${isInitialSummaryAndRated ? `summary-${summaryRating.toLowerCase()}` : `chat-message ${message.role}`}`;

          return (
            <div key={index} className={messageClasses}>
              {renderFormattedText(message.content)}
            </div>
          );
        })}

        {/* Show loading spinner at the very bottom of history if FOLLOW-UP is actively loading */}
        {isLoadingFollowup && (
          <div className="loading-message-inline">
            <div className="spinner-small"></div>
          </div>
        )}
      </div>

      {/* Follow-up Question Input */}
      {!isLoadingSummary && (
        <div className="input-area-container">
          <textarea
            ref={textareaRef}
            className="gemini-input-textarea"
            placeholder="Ask a follow-up question or clarify terms..."
            value={followupInput}
            onChange={(e) => setFollowupInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleFollowupSubmit();
              }
            }}
            rows={1}
          />
          <button
            className="gemini-send-button"
            onClick={handleFollowupSubmit}
            disabled={!followupInput.trim() || isLoadingFollowup}
          >
            {isLoadingFollowup ? <div className="spinner-small"></div> : (
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
              </svg>
            )}
          </button>
        </div>
      )}
    </div>
  );
}