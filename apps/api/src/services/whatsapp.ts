import { Buffer } from 'node:buffer';

export interface InteractiveButton {
  id: string;
  title: string; // Max 20 characters (Meta restriction)
}

export interface InteractiveListRow {
  id: string;
  title: string; // Max 24 characters
  description?: string; // Max 72 characters
}

export interface InteractiveListSection {
  title: string;
  rows: InteractiveListRow[];
}

export interface MediaDownloadResult {
  buffer: Buffer;
  mimeType: string;
}

export class WhatsAppClient {
  private token: string;
  private phoneNumberId: string;
  private apiVersion: string;
  private baseUrl: string;

  constructor(token?: string, phoneNumberId?: string, apiVersion: string = 'v21.0') {
    this.token = token || process.env.WHATSAPP_ACCESS_TOKEN || '';
    this.phoneNumberId = phoneNumberId || process.env.WHATSAPP_PHONE_NUMBER_ID || '';
    this.apiVersion = process.env.META_GRAPH_VERSION || apiVersion;
    this.baseUrl = `https://graph.facebook.com/${this.apiVersion}`;
  }

  private getHeaders(contentType: string = 'application/json'): Record<string, string> {
    return {
      Authorization: `Bearer ${this.token}`,
      'Content-Type': contentType
    };
  }

  /**
   * Dispatches an outbound WhatsApp text message to a farmer's phone number.
   * Format: E.164 without '+' or leading zeros (e.g., '2348012345678').
   */
  async sendTextMessage(to: string, text: string): Promise<any> {
    const cleanTo = to.replace(/[^0-9]/g, '');
    const url = `${this.baseUrl}/${this.phoneNumberId}/messages`;

    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: cleanTo,
      type: 'text',
      text: {
        preview_url: false,
        body: text.normalize('NFC')
      }
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const errBody = await res.text();
      throw new Error(`WhatsApp sendTextMessage failed (HTTP ${res.status}): ${errBody}`);
    }

    return res.json();
  }

  /**
   * Uploads an audio buffer to Meta Cloud API and sends it as an audio message.
   */
  async sendAudioMessage(
    to: string,
    audioBuffer: Buffer,
    mimeType: string = 'audio/mpeg',
    filename: string = 'advisory.mp3'
  ): Promise<any> {
    const cleanTo = to.replace(/[^0-9]/g, '');

    // Step 1: Upload media to Meta Media endpoint
    const mediaId = await this.uploadMedia(audioBuffer, mimeType, filename);

    // Step 2: Send audio message using the uploaded media ID
    const url = `${this.baseUrl}/${this.phoneNumberId}/messages`;
    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: cleanTo,
      type: 'audio',
      audio: {
        id: mediaId
      }
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const errBody = await res.text();
      throw new Error(`WhatsApp sendAudioMessage failed (HTTP ${res.status}): ${errBody}`);
    }

    return res.json();
  }

  /**
   * Uploads raw binary media to Meta's Cloud API media repository.
   */
  async uploadMedia(
    buffer: Buffer,
    mimeType: string,
    filename: string = 'media_payload'
  ): Promise<string> {
    const url = `${this.baseUrl}/${this.phoneNumberId}/media`;

    const formData = new FormData();
    const blob = new Blob([buffer], { type: mimeType });
    formData.append('file', blob, filename);
    formData.append('messaging_product', 'whatsapp');
    formData.append('type', mimeType);

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.token}`
      },
      body: formData
    });

    if (!res.ok) {
      const errBody = await res.text();
      throw new Error(`WhatsApp uploadMedia failed (HTTP ${res.status}): ${errBody}`);
    }

    const data = await res.json();
    if (!data.id) {
      throw new Error('Meta did not return a valid media ID');
    }

    return data.id;
  }

  /**
   * Downloads incoming farmer media (e.g., voice note) using Meta's two-step procedure:
   * 1. Query GET /{media_id} to obtain the temporary download URL.
   * 2. Fetch the binary payload using Bearer auth.
   */
  async downloadMedia(mediaId: string): Promise<MediaDownloadResult> {
    // Step 1: Retrieve media metadata URL
    const metaUrl = `${this.baseUrl}/${mediaId}`;
    const metaRes = await fetch(metaUrl, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${this.token}`
      }
    });

    if (!metaRes.ok) {
      const errBody = await metaRes.text();
      throw new Error(`Failed to query media metadata (HTTP ${metaRes.status}): ${errBody}`);
    }

    const metaData = await metaRes.json();
    const downloadUrl = metaData.url;
    const mimeType = metaData.mime_type || 'audio/ogg';

    if (!downloadUrl) {
      throw new Error('No download URL present in Meta media metadata');
    }

    // Step 2: Download raw binary stream
    const fileRes = await fetch(downloadUrl, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${this.token}`
      }
    });

    if (!fileRes.ok) {
      throw new Error(`Failed to download media file (HTTP ${fileRes.status})`);
    }

    const arrayBuffer = await fileRes.arrayBuffer();
    return {
      buffer: Buffer.from(arrayBuffer),
      mimeType
    };
  }

  /**
   * Sends up to 3 interactive quick-reply buttons (ideal for low-literacy choices).
   */
  async sendInteractiveButtons(
    to: string,
    bodyText: string,
    buttons: InteractiveButton[],
    headerText?: string,
    footerText?: string
  ): Promise<any> {
    const cleanTo = to.replace(/[^0-9]/g, '');
    const url = `${this.baseUrl}/${this.phoneNumberId}/messages`;

    if (buttons.length > 3) {
      throw new Error('WhatsApp limits interactive button messages to a maximum of 3 buttons.');
    }

    const payload: any = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: cleanTo,
      type: 'interactive',
      interactive: {
        type: 'button',
        body: {
          text: bodyText.normalize('NFC')
        },
        action: {
          buttons: buttons.map((btn) => ({
            type: 'reply',
            reply: {
              id: btn.id,
              title: btn.title.slice(0, 20).normalize('NFC')
            }
          }))
        }
      }
    };

    if (headerText) {
      payload.interactive.header = {
        type: 'text',
        text: headerText.normalize('NFC')
      };
    }

    if (footerText) {
      payload.interactive.footer = {
        text: footerText.normalize('NFC')
      };
    }

    const res = await fetch(url, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const errBody = await res.text();
      throw new Error(`WhatsApp sendInteractiveButtons failed (HTTP ${res.status}): ${errBody}`);
    }

    return res.json();
  }

  /**
   * Sends an interactive List message (ideal for LGA and crop selection menus, up to 10 rows).
   */
  async sendInteractiveList(
    to: string,
    bodyText: string,
    buttonLabel: string,
    sections: InteractiveListSection[],
    headerText?: string,
    footerText?: string
  ): Promise<any> {
    const cleanTo = to.replace(/[^0-9]/g, '');
    const url = `${this.baseUrl}/${this.phoneNumberId}/messages`;

    const payload: any = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: cleanTo,
      type: 'interactive',
      interactive: {
        type: 'list',
        body: {
          text: bodyText.normalize('NFC')
        },
        action: {
          button: buttonLabel.slice(0, 20).normalize('NFC'),
          sections: sections.map((sec) => ({
            title: sec.title.slice(0, 24).normalize('NFC'),
            rows: sec.rows.map((row) => ({
              id: row.id,
              title: row.title.slice(0, 24).normalize('NFC'),
              description: row.description ? row.description.slice(0, 72).normalize('NFC') : undefined
            }))
          }))
        }
      }
    };

    if (headerText) {
      payload.interactive.header = {
        type: 'text',
        text: headerText.normalize('NFC')
      };
    }

    if (footerText) {
      payload.interactive.footer = {
        text: footerText.normalize('NFC')
      };
    }

    const res = await fetch(url, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const errBody = await res.text();
      throw new Error(`WhatsApp sendInteractiveList failed (HTTP ${res.status}): ${errBody}`);
    }

    return res.json();
  }

  /**
   * Helper: Dispatches an interactive 8-LGA selection menu for Osun State onboarding.
   */
  async sendOsunLgaPicker(to: string, lang: 'yo' | 'en' = 'yo'): Promise<any> {
    const isYo = lang === 'yo';

    const bodyText = isYo
      ? 'Ẹ káàbọ̀ sí OroAgbe AI! Jọ̀wọ́ yan agbègbè / Ìjọba Ìbílẹ̀ (LGA) ti oko rẹ wà ní Ìpínlẹ̀ Ọ̀ṣun:'
      : 'Welcome to OroAgbe AI! Please select your agricultural zone / LGA in Osun State:';

    const buttonLabel = isYo ? 'Yan Agbègbè Rẹ' : 'Select Your LGA';

    const lgaRows: InteractiveListRow[] = [
      { id: 'lga_osogbo', title: isYo ? 'Òṣogbo' : 'Osogbo', description: isYo ? 'Agbègbè Olú-ìlú' : 'Capital Zone' },
      { id: 'lga_ile-ife', title: isYo ? 'Ilé-Ifẹ̀' : 'Ile-Ife', description: isYo ? 'Agbègbè Àárín' : 'Central Zone' },
      { id: 'lga_ilesa', title: isYo ? 'Iléṣà' : 'Ilesa', description: isYo ? 'Agbègbè Ìlà-Oòrùn' : 'East Zone' },
      { id: 'lga_ede', title: isYo ? 'Ẹdẹ' : 'Ede', description: isYo ? 'Agbègbè Gúúsù-Ìwọ̀-Oòrùn' : 'South-West Zone' },
      { id: 'lga_ikirun', title: isYo ? 'Ìkìrun' : 'Ikirun', description: isYo ? 'Agbègbè Àríwá' : 'North Zone' },
      { id: 'lga_iwo', title: isYo ? 'Ìwó' : 'Iwo', description: isYo ? 'Agbègbè Ìwọ̀-Oòrùn' : 'West Zone' },
      { id: 'lga_ejigbo', title: isYo ? 'Ẹlẹ́jìgbò' : 'Ejigbo', description: isYo ? 'Àgbègbè Ẹ̀jìgbò' : 'Ejigbo Zone' },
      { id: 'lga_ila', title: isYo ? 'Ìlá Ọ̀ràngún' : 'Ila Orangun', description: isYo ? 'Agbègbè Àríwá-Ìlà-Oòrùn' : 'North-East Zone' }
    ];

    return this.sendInteractiveList(
      to,
      bodyText,
      buttonLabel,
      [{ title: isYo ? 'Àwọn Ìjọba Ìbílẹ̀ Ọ̀ṣun' : 'Osun State LGAs', rows: lgaRows }],
      'OroAgbe AI • Climate Intelligence',
      'IITA & NCRI Verified'
    );
  }
}

export interface SendTextMessageParams {
  to: string;
  text: string;
  previewUrl?: boolean;
}

export const whatsappClient = new WhatsAppClient();