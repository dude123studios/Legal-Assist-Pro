import { pipeline, TextGenerationPipeline } from '@xenova/transformers';

let chat: TextGenerationPipeline | null = null;

export async function initChat(): Promise<void> {
  if (!chat) {
    chat = await pipeline("text-generation", "Xenova/TinyLlama-1.1B-Chat");
  }
}

export async function handleUserInput(userMessage: string): Promise<string> {
  await initChat();
  if (!chat) throw new Error("Chat pipeline failed to initialize.");
  const result = await chat(userMessage);
  return result[0].toString();
}