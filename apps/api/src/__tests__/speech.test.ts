import { describe, it, expect, vi, beforeEach } from 'vitest';
import { stripMarkdownForTTS, transcribeWithNCAIR } from '../services/speech.js';

describe('Task 18: Voice Pipeline with NCAIR1/N-ATLaS ASR', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('correctly cleans Markdown and formats warnings for audio synthesis', () => {
    const raw = '⚠️ **ÌKILỌ̀ ÀÀBÒ ÀGBẸ̀:** [CRITICAL] Ìwọ̀n Urea: 500 kg/ha!';
    const cleaned = stripMarkdownForTTS(raw);

    expect(cleaned).not.toContain('⚠️');
    expect(cleaned).not.toContain('**');
    expect(cleaned).not.toContain('[');
    expect(cleaned).not.toContain(']');
    expect(cleaned).toContain('Ìkìlọ̀:');
    expect(cleaned).toContain('CRITICAL: Ìwọ̀n Urea: 500 kg/ha!');
  });

  it('transcribes successfully via NCAIR1/N-ATLaS Hugging Face endpoint', async () => {
    process.env.HF_TOKEN = 'hf_mock_token_for_tests';
    process.env.NCAIR_MODEL_ID = 'NCAIR1/N-ATLaS';

    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        text: 'Báwo ni mo ṣe lè gbin gbágùdá lórí ebe?'
      })
    } as Response);

    const dummyBuffer = Buffer.from('mock-audio-bytes');
    const result = await transcribeWithNCAIR(dummyBuffer, 'recording.wav', 'audio/wav');

    expect(result.engine).toBe('ncair-n-atlas');
    expect(result.detectedLanguage).toBe('yo');
    expect(result.text).toBe('Báwo ni mo ṣe lè gbin gbágùdá lórí ebe?'.normalize('NFC'));
  });
});