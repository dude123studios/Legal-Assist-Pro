
/*
// Define message types for communication with popup
type MessageType = 'SUMMARIZE_LEGAL' | 'FOLLOWUP_QUESTION';

interface Message {
  type: MessageType;
  text: string;
  previousSummary?: string; // For FOLLOWUP_QUESTION context
  history?: Array<{ role: 'user' | 'model'; content: string }>; // For full chat history
}

  // Define the Hugging Face API endpoint and the model you want to use.
// You chose models like Qwen1.5-7B-Chat or Qwen1.5-3B-Chat for large contexts.
const HF_API_BASE_URL = 'https://router.huggingface.co/novita/v3/openai/chat/completions';
const HF_MODEL_ID = 'deepseek/deepseek-v3-0324'; // <--- Choose your desired Qwen model ID here

// Access the API token from the environment variable injected by Vite.
// Vite exposes env variables prefixed with VITE_ via import.meta.env.
// This variable will be replaced at build time, protecting the token in source code.
const HF_API_TOKEN = import.meta.env.VITE_HF_API_TOKEN;

// Ensure the API token is present
if (!HF_API_TOKEN) {
  console.error("Hugging Face API token is missing! Please set VITE_HF_API_TOKEN in your .env file.");
  // Throw an error or disable functionality if the token isn't available
}
/*
async function localInference(finalMessages:  Array<{ role: string; content: string }>){


}

async function APIInference(finalMessages:  Array<{ role: string; content: string }>) {
   const response = await fetch(`${HF_API_BASE_URL}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${HF_API_TOKEN}`,
            },
            body: JSON.stringify({
                messages: finalMessages, // <--- Use the transformed messages here
                'model': `${HF_MODEL_ID}`, // Ensure this is the correct model ID for Deepseek V3
                'stream': false,
                'max_tokens': 256 // Increased max_tokens slightly for better responses
            })
        });
    return response;
}*/
/*
async function callLLMApi(messages: Array<{ role: string; content: string }>): Promise<string> {
  // The prompt remains the same, as it defines the task for the LLM
   if (!HF_API_TOKEN) {
    throw new Error("OpenRouter API token is not configured.");
  }
  console.log('Background: Making Hugging Face API call...');

  // Basic validation for the API token
  if (!HF_API_TOKEN) {
    return "Error: Hugging Face API token is not configured.";
  }
  
  try {
    const messagesForAPI = messages.map(msg => ({
            role: msg.role === 'model' ? 'assistant' : msg.role, // Convert 'model' to 'assistant'
            content: msg.content
        }));

        // Optional: Add a system message at the beginning for context
        // Check Deepseek's documentation if a system message is required or beneficial.
        // For legal assistant, this is highly recommended!
        const systemMessage = {
            role: 'system',
            content: "You are a helpful and ultra concise legal assistant. Summarize legal documents and answer follow-up questions accurately based on the provided context."
        };

        // Prepend the system message ONLY if it's the start of a new conversation
        // or if required for every turn. Typically, it's just once at the start.
        // For follow-ups, if the history is short (e.g., just the initial summary),
        // adding the system message might be appropriate.
        // A common pattern is to always include it for each API call if it's stateless.
        // Let's add it always for simplicity, as it's harmless and often helpful.
        const finalMessages = [systemMessage, ...messagesForAPI];

        console.log("Deepseek API Request Body (messages):", finalMessages); // VERY IMPORTANT FOR DEBUGGING
        const response = await fetch(`${HF_API_BASE_URL}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${HF_API_TOKEN}`,
            },
            body: JSON.stringify({
                messages: finalMessages, // <--- Use the transformed messages here
                'model': `${HF_MODEL_ID}`, // Ensure this is the correct model ID for Deepseek V3
                'stream': false,
                'max_tokens': 256 // Increased max_tokens slightly for better responses
            })
        });

    
    // Handle non-OK responses from Hugging Face API
    if (!response.ok) {
      const errorBody = await response.json(); // Hugging Face API often returns JSON errors
      console.error(`Hugging Face API error: ${response.status} - ${JSON.stringify(errorBody)}`);
      throw new Error(`Failed to get summary from Hugging Face: ${errorBody.error || response.statusText}`);
    }
    const data = await response.json();
    console.log(data['choices'][0]['message']['content']);
    return data['choices'][0]['message']['content'];
    
  } catch (error) {
    console.error('Error calling Hugging Face API:', error);
    return `Error getting summary: ${(error as Error).message}. Ensure you have an internet connection.`;
  }
}


// Listen for messages from the popup
chrome.runtime.onMessage.addListener(
  (message: Message, _sender, sendResponse) => {
    // Important: Use 'return true;' to indicate that sendResponse will be called asynchronously.
    // This keeps the message channel open until sendResponse is called.

    if (message.type === 'SUMMARIZE_LEGAL') {
      console.log('Background: Received SUMMARIZE_LEGAL message.');
      const prompt = `You are a legal assistant helping unkowledgable users understand fine print in user agreements. Use ultra minamal words, symbols, and space in general. Do not cite the sources to your answer. Summarize the following text (As Breifly as possible, in at most 200 words But try to shoot as low as possible) in a few, simple terms, focusing ONLY on unusual, restrictive, or risky clauses (e.g., forced arbitration, automatic renewals, data sharing, cancellation policies).\n\nText:\n${message.text}\n\nYour output should look like: (Rating, one of the following Green (standard), Yellow (some caution), or Red (contains harmful/unusual terms).) \n2. Key clauses(do not need to say "key clauses", just list bullet points of what they are) \n3. Red Flags (short, clear, easy to understand description)`;

      // Initial summary uses a single user message
      
      callLLMApi([{ role: 'user', content: prompt }])
        .then(summary => sendResponse({ summary: summary }))
        .catch(error => sendResponse({ summary: `Error: ${error.message}` }));
      
      return true; // Keep channel open
    } else if (message.type === 'FOLLOWUP_QUESTION') {
      console.log('Background: Received FOLLOWUP_QUESTION message.');
      // The `history` array passed from the popup already contains the conversation turns.
      // The `previousSummary` is no longer directly used for constructing messages here,
      // as the full `history` from the popup (which includes the initial summary) is used.
      const chatMessages = message.history || [];

      // Ensure the history is not empty and ends with a user message
      if (chatMessages.length === 0 || chatMessages[chatMessages.length - 1].role !== 'user') {
        sendResponse({ summary: "Error: Invalid chat history for follow-up." });
        return true;
      }

      // Call the LLM API with the provided chat history
      callLLMApi(chatMessages)
        .then(response => sendResponse({ summary: response }))
        .catch(error => sendResponse({ summary: `Error: ${error.message}` }));

      return true; // Keep channel open
    }
  }
);

export {}; // Ensure this is treated as a module

  */