import { Buffer } from 'node:buffer';
import OpenAI from 'openai';

export interface TranscriptionResult {
  text: string;
  detectedLanguage: 'yo' | 'en';
  confidence?: number;
  engine: 'ncair-n-atlas' | 'whisper-fallback';
}

export function stripMarkdownForTTS(markdown: string): string {
  return markdown
    .normalize('NFC')
    .replace(/⚠️/g, 'Ìkìlọ̀:') // Map alert emoji to Yoruba warning prefix
    .replace(/[*#_~`>]/g, '') // Strip markdown formatting symbols
    .replace(/\[(.*?)\]\(.*?\)/g, '$1') // Convert markdown links [text](url) -> text
    .replace(/\[(CRITICAL|WARNING)\]/gi, '$1:') // Convert [CRITICAL] -> CRITICAL:
    .replace(/[\[\]]/g, '') // Strip any remaining brackets
    .replace(/\s+/g, ' ') // Collapse multiple whitespace/newlines
    .trim();
}

/**
 * Transcribes audio using NCAIR1/N-ATLaS hosted on Hugging Face.
 * Falls back to Whisper if the HF token is missing or if the endpoint is rate-limited.
 */
export async function transcribeWithNCAIR(
  audioBuffer: Buffer,
  filename: string = 'recording.wav',
  mimeType: string = 'audio/wav'
): Promise<TranscriptionResult> {
  const modelId = process.env.NCAIR_MODEL_ID || 'NCAIR1/N-ATLaS';
  const hfToken = process.env.HF_TOKEN;

  if (hfToken) {
    try {
      // Hugging Face Serverless / Dedicated Router Inference API
      const hfUrl = `https://router.huggingface.co/hf-inference/models/${modelId}`;

      const response = await fetch(hfUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${hfToken}`,
          'Content-Type': mimeType
        },
        body: audioBuffer,
        signal: AbortSignal.timeout(20000) // 20-second timeout for cold starts
      });

      if (response.ok) {
        const data = await response.json();
        // HF ASR models return { text: "..." }
        const transcript = (typeof data === 'object' && data.text) ? data.text : (Array.isArray(data) && data[0]?.text) ? data[0].text : '';

        if (transcript.trim()) {
          const normalized = transcript.normalize('NFC').trim();
          return {
            text: normalized,
            detectedLanguage: /[ẹọṣáàéèóòíìúù]/i.test(normalized) ? 'yo' : 'yo', // Prioritize Yoruba dialect
            engine: 'ncair-n-atlas'
          };
        }
      } else {
        const errorBody = await response.text();
        console.warn(`Hugging Face N-ATLaS returned HTTP ${response.status}: ${errorBody}`);
      }
    } catch (err) {
      console.warn('NCAIR N-ATLaS HF request failed, falling back to secondary engine:', err);
    }
  }

  // Fallback: Whisper primed with Osun agricultural terminology
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY || 'dummy-key'
  });

  const file = new File([audioBuffer], filename, { type: mimeType });

  const whisperRes = await openai.audio.transcriptions.create({
    file,
    model: 'whisper-1',
    prompt: 'Àgbàdo, gbágùdá, iṣu, kòkó, ajílẹ̀ Urea, NPK 15:15:15, egbòogi kòkòrò, Ìpínlẹ̀ Ọ̀ṣun.',
    temperature: 0.0
  });

  const text = whisperRes.text.normalize('NFC').trim();

  return {
    text,
    detectedLanguage: /[ẹọṣáàéèóòíìúù]/i.test(text) ? 'yo' : 'en',
    engine: 'whisper-fallback'
  };
}

export async function synthesizeTTS(text: string, voice: string = 'alloy'): Promise<Buffer> {
  const cleanText = stripMarkdownForTTS(text);
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY || 'dummy-key'
  });

  const response = await openai.audio.speech.create({
    model: 'tts-1',
    voice: voice as any,
    input: cleanText
  });

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}