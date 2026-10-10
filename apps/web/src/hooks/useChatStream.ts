import { useState, useRef, useCallback } from 'react';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  safetyNotice?: string;
  timestamp: string;
}

interface SendMessageOptions {
  query: string;
  locationId: string;
  locationName: string;
  crop?: string;
}

export function useChatStream() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const stopStreaming = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setIsStreaming(false);
    }
  }, []);

  const clearMessages = useCallback(() => {
    stopStreaming();
    setMessages([]);
    setError(null);
  }, [stopStreaming]);

  const sendMessage = useCallback(
    async ({ query, locationId, locationName, crop }: SendMessageOptions) => {
      if (!query.trim()) return;

      stopStreaming();
      setError(null);

      const userMsgId = `user-${Date.now()}`;
      const assistantMsgId = `asst-${Date.now()}`;
      const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      // Add user message immediately
      setMessages((prev) => [
        ...prev,
        {
          id: userMsgId,
          role: 'user',
          content: query.trim().normalize('NFC'),
          timestamp
        },
        {
          id: assistantMsgId,
          role: 'assistant',
          content: '',
          timestamp
        }
      ]);

      setIsStreaming(true);

      const controller = new AbortController();
      abortControllerRef.current = controller;

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

      try {
        const response = await fetch(`${apiUrl}/api/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query: query.trim().normalize('NFC'),
            locationId,
            locationName,
            crop: crop || undefined
          }),
          signal: controller.signal
        });

        if (!response.ok) {
          throw new Error(`Server returned HTTP ${response.status}: ${response.statusText}`);
        }

        if (!response.body) {
          throw new Error('ReadableStream not supported by the response.');
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder('utf-8');
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n\n');
          buffer = lines.pop() || ''; // Keep partial line in buffer

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith('data:')) continue;

            const payloadStr = trimmed.slice(5).trim();
            if (payloadStr === '[DONE]') {
              setIsStreaming(false);
              return;
            }

            try {
              const data = JSON.parse(payloadStr);

              if (data.error) {
                setError(data.error);
                continue;
              }

              if (data.safetyNotice && data.text) {
                // Attach safety advisory to the assistant message
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === assistantMsgId
                      ? { ...msg, safetyNotice: (msg.safetyNotice || '') + data.text }
                      : msg
                  )
                );
              } else if (data.text) {
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === assistantMsgId
                      ? { ...msg, content: (msg.content + data.text).normalize('NFC') }
                      : msg
                  )
                );
              }
            } catch {
              // Ignore partial JSON chunks
            }
          }
        }
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          setError(err.message || 'Error occurred while streaming the response.');
        }
      } finally {
        setIsStreaming(false);
        abortControllerRef.current = null;
      }
    },
    [stopStreaming]
  );

  return {
    messages,
    isStreaming,
    error,
    sendMessage,
    stopStreaming,
    clearMessages
  };
}