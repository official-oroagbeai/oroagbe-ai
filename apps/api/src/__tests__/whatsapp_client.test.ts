import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Buffer } from 'node:buffer';
import { WhatsAppClient } from '../services/whatsapp.js';

describe('Task 19: WhatsApp Client Service', () => {
  let client: WhatsAppClient;

  beforeEach(() => {
    vi.restoreAllMocks();
    client = new WhatsAppClient('test_token', '1234567890', 'v21.0');
  });

  it('sends text message with normalized NFC payload', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        messaging_product: 'whatsapp',
        messages: [{ id: 'wamid.HBgLMjM0...' }]
      })
    } as Response);

    const res = await client.sendTextMessage('2348012345678', 'Àgbàdo àti Gbágùdá');

    expect(global.fetch).toHaveBeenCalledTimes(1);
    const [url, options] = (global.fetch as any).mock.calls[0];

    expect(url).toBe('https://graph.facebook.com/v21.0/1234567890/messages');
    expect(options.method).toBe('POST');

    const body = JSON.parse(options.body);
    expect(body.to).toBe('2348012345678');
    expect(body.type).toBe('text');
    expect(body.text.body).toBe('Àgbàdo àti Gbágùdá'.normalize('NFC'));
    expect(res.messages[0].id).toBeDefined();
  });

  it('uploads media buffer and sends an audio message', async () => {
    // 1st fetch: uploadMedia
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'media_id_999' })
      } as Response)
      // 2nd fetch: sendAudioMessage
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          messaging_product: 'whatsapp',
          messages: [{ id: 'wamid.audio_123' }]
        })
      } as Response);

    const dummyAudio = Buffer.from('mock-audio-data');
    const res = await client.sendAudioMessage('2348012345678', dummyAudio, 'audio/mpeg');

    expect(global.fetch).toHaveBeenCalledTimes(2);

    // Verify upload endpoint
    const [uploadUrl, uploadOptions] = (global.fetch as any).mock.calls[0];
    expect(uploadUrl).toBe('https://graph.facebook.com/v21.0/1234567890/media');
    expect(uploadOptions.method).toBe('POST');

    // Verify send audio endpoint
    const [sendUrl, sendOptions] = (global.fetch as any).mock.calls[1];
    expect(sendUrl).toBe('https://graph.facebook.com/v21.0/1234567890/messages');
    const sendBody = JSON.parse(sendOptions.body);
    expect(sendBody.type).toBe('audio');
    expect(sendBody.audio.id).toBe('media_id_999');
    expect(res.messages[0].id).toBe('wamid.audio_123');
  });

  it('downloads incoming farmer voice note via two-step Meta media retrieval', async () => {
    // 1st fetch: metadata lookup
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          url: 'https://lookaside.fbsbx.com/whatsapp_business/attachments/temp123',
          mime_type: 'audio/ogg; codecs=opus'
        })
      } as Response)
      // 2nd fetch: binary download
      .mockResolvedValueOnce({
        ok: true,
        arrayBuffer: async () => new Uint8Array([1, 2, 3, 4]).buffer
      } as Response);

    const result = await client.downloadMedia('media_id_voice_456');

    expect(global.fetch).toHaveBeenCalledTimes(2);

    const [metaUrl] = (global.fetch as any).mock.calls[0];
    expect(metaUrl).toBe('https://graph.facebook.com/v21.0/media_id_voice_456');

    const [downloadUrl] = (global.fetch as any).mock.calls[1];
    expect(downloadUrl).toBe('https://lookaside.fbsbx.com/whatsapp_business/attachments/temp123');

    expect(result.mimeType).toBe('audio/ogg; codecs=opus');
    expect(result.buffer.length).toBe(4);
  });

  it('sends interactive quick reply buttons and enforces 3-button limit', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ messages: [{ id: 'wamid.btn_1' }] })
    } as Response);

    await client.sendInteractiveButtons(
      '2348012345678',
      'Ṣé o fẹ́ fún oògùn lónìí?',
      [
        { id: 'btn_spray', title: 'Fún Oògùn' },
        { id: 'btn_weather', title: 'Ojú-Ọjọ́' }
      ]
    );

    const [, options] = (global.fetch as any).mock.calls[0];
    const body = JSON.parse(options.body);
    expect(body.type).toBe('interactive');
    expect(body.interactive.type).toBe('button');
    expect(body.interactive.action.buttons).toHaveLength(2);

    // Assert validation error if > 3 buttons
    await expect(
      client.sendInteractiveButtons('2348012345678', 'Test', [
        { id: '1', title: '1' },
        { id: '2', title: '2' },
        { id: '3', title: '3' },
        { id: '4', title: '4' }
      ])
    ).rejects.toThrow(/limits interactive button messages to a maximum of 3 buttons/);
  });

  it('sends Osun LGA picker list with all 8 agricultural zones', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ messages: [{ id: 'wamid.list_1' }] })
    } as Response);

    await client.sendOsunLgaPicker('2348012345678', 'yo');

    const [, options] = (global.fetch as any).mock.calls[0];
    const body = JSON.parse(options.body);

    expect(body.type).toBe('interactive');
    expect(body.interactive.type).toBe('list');
    expect(body.interactive.action.sections[0].rows).toHaveLength(8);
    expect(body.interactive.action.sections[0].rows[0].id).toBe('lga_osogbo');
  });
});