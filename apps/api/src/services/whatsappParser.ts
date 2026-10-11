export interface ParsedWhatsAppMessage {
  from: string;
  senderName: string;
  messageId: string;
  timestamp: string;
  type: 'text' | 'audio' | 'unsupported';
  text?: string;
  audio?: {
    id: string;
    mimeType: string;
    isVoiceNote: boolean;
  };
}

export function parseWhatsAppWebhook(body: any): ParsedWhatsAppMessage[] {
  const parsedMessages: ParsedWhatsAppMessage[] = [];

  const entry = body?.entry?.[0];
  const changes = entry?.changes?.[0];
  const value = changes?.value;

  // Ignore delivery receipts, read statuses, and billing events
  if (!value || !value.messages || !Array.isArray(value.messages)) {
    return parsedMessages;
  }

  const contactProfile = value.contacts?.[0];
  const senderName = contactProfile?.profile?.name || 'Farmer';

  for (const message of value.messages) {
    const base = {
      from: message.from,
      senderName,
      messageId: message.id,
      timestamp: message.timestamp,
    };

    if (message.type === 'text') {
      parsedMessages.push({
        ...base,
        type: 'text',
        text: message.text?.body?.trim() || '',
      });
    } else if (message.type === 'audio') {
      parsedMessages.push({
        ...base,
        type: 'audio',
        audio: {
          id: message.audio?.id,
          mimeType: message.audio?.mime_type,
          isVoiceNote: Boolean(message.audio?.voice),
        },
      });
    } else {
      parsedMessages.push({
        ...base,
        type: 'unsupported',
      });
    }
  }

  return parsedMessages;
}