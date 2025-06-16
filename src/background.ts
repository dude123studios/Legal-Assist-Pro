import { pipeline, TextGenerationPipeline } from '@xenova/transformers';

type Message = { role: 'user' | 'assistant'; content: string };
type GenOutput = { generated_text: string }[];
let chat: TextGenerationPipeline | null = null;
let history: Message[] = [];

chrome.runtime.onMessage.addListener(async (request, _sender, sendResponse) => {
  if (request.type === 'SUMMARIZE_LEGAL') {
    console.log('starting up');
    if (!chat) {
      chat = await pipeline("text-generation", "Xenova/TinyLlama-1.1B-Chat");
    }
     const prompt = `You are a legal assistant helping unkowledgable users understand fine print in legal agreements that could be notable or harfmul to the user. Be incredibly brief using no overly technical jargon to explain ONLY on unusual, restrictive, or risky clauses (e.g., forced arbitration, automatic renewals, data sharing, cancellation policies).\n\nText:\n${request.text.slice(0, 2000)}\n\nYour output should look like: (Rating, one of the following Green (standard), Yellow (some caution), or Red (contains harmful/unusual terms).) \n2. Key clauses(short) \n3. Red Flags (short)`;
    console.log(prompt);
     history.push({role: 'assistant', content: prompt});
    const output = (await chat(prompt, { max_new_tokens: 100 })) as GenOutput;
    console.log(output);
    const reply = output[0]?.generated_text?.split('Assistant:').pop()?.trim() || '';

    history.push({ role: 'assistant', content: reply });

    sendResponse({ reply });


  }
  if (request.type === 'FOLLOWUP_QUESTION') {
    if (!chat) {
      chat = await pipeline("text-generation", "Xenova/TinyLlama-1.1B-Chat");
    }
    
    const userText = request.text;
    history.push({ role: 'user', content: userText });

    const prompt = history.map(m =>
      `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`
    ).join('\n') + `\nAssistant:`;

    const output = (await chat(prompt, { max_new_tokens: 100 })) as GenOutput;
    console.log(output);
    const reply = output[0]?.generated_text?.split('Assistant:').pop()?.trim() || '';

    history.push({ role: 'assistant', content: reply });

    sendResponse({ reply });
  }

  return true; // Keep the message channel open for async
});