import { GoogleGenAI, Modality } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

if (!process.env.GEMINI_API_KEY) {
  console.error("GEMINI_API_KEY is missing from process.env!");
}

const ttsCache = new Map<string, string>();
const pendingTTS = new Map<string, Promise<string | null>>();

export function isTTSCached(text: string, voiceName: 'Puck' | 'Charon' | 'Kore' | 'Fenrir' | 'Zephyr' = 'Kore'): boolean {
  return ttsCache.has(`${voiceName}:${text}`);
}

export async function generateTTS(text: string, voiceName: 'Puck' | 'Charon' | 'Kore' | 'Fenrir' | 'Zephyr' = 'Kore'): Promise<string | null> {
  const cacheKey = `${voiceName}:${text}`;
  
  // 1. Check cache
  if (ttsCache.has(cacheKey)) {
    console.log("Returning cached TTS for:", text.substring(0, 20) + "...");
    return ttsCache.get(cacheKey)!;
  }

  // 2. Check if there's already a pending request for this exact text/voice
  if (pendingTTS.has(cacheKey)) {
    console.log("Waiting for pending TTS request:", text.substring(0, 20) + "...");
    return pendingTTS.get(cacheKey)!;
  }

  const ttsPromise = (async () => {
    console.log("Generating TTS for:", text.substring(0, 20) + "...");
    
    const maxRetries = 6; // Increased retries
    let retryCount = 0;

    while (retryCount <= maxRetries) {
      try {
        const response = await ai.models.generateContent({
          model: "gemini-2.5-flash-preview-tts",
          contents: [{ parts: [{ text }] }],
          config: {
            systemInstruction: "You are a friendly marine biologist. Read the following description naturally and clearly in Chinese.",
            responseModalities: [Modality.AUDIO],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName },
              },
            },
          },
        });

        const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        if (base64Audio) {
          console.log("TTS generated successfully");
          const byteCharacters = atob(base64Audio);
          const byteNumbers = new Array(byteCharacters.length);
          for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
          }
          const byteArray = new Uint8Array(byteNumbers);
          const blob = new Blob([byteArray], { type: 'audio/mpeg' });
          const url = URL.createObjectURL(blob);
          ttsCache.set(cacheKey, url);
          return url;
        }
        console.warn("TTS generated no audio data");
        return null;
      } catch (error: any) {
        const errorStr = error?.message || (typeof error === 'object' ? JSON.stringify(error) : String(error));
        const isQuotaError = errorStr.includes("429") || errorStr.includes("RESOURCE_EXHAUSTED");
        const isInternalError = errorStr.includes("500") || errorStr.includes("INTERNAL");
        
        if ((isQuotaError || isInternalError) && retryCount < maxRetries) {
          retryCount++;
          // Exponential backoff with jitter: 4s, 8s, 16s, 32s, 64s, 128s
          const baseDelay = Math.pow(2, retryCount) * 2000; 
          const jitter = Math.random() * 2000;
          const delay = baseDelay + jitter;
          
          console.warn(`TTS API error (${errorStr}). Retrying in ${Math.round(delay)}ms... (Attempt ${retryCount}/${maxRetries})`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }

        console.error("TTS Generation Error (final attempt failed):", error);
        return null;
      }
    }
    return null;
  })();

  pendingTTS.set(cacheKey, ttsPromise);
  
  try {
    const result = await ttsPromise;
    return result;
  } finally {
    // Cleanup pending map once finished
    pendingTTS.delete(cacheKey);
  }
}
