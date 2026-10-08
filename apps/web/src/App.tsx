import { useState, useRef, useEffect } from 'react';
import { Send, Mic, Square } from 'lucide-react';
import { ChatMessage } from '@oroagbe/types';

export default function App() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { 
      id: '1', 
      role: 'assistant', 
      text: 'Ẹ ku dede asiko yii! Emi ni OroAgbeAI. Bawo ni mo ṣe le ran yin lọwọ lori iṣẹ agbẹ yin loni?',
      locationId: 'system',
      timestamp: new Date().toISOString()
    }
  ]);
  const [input, setInput] = useState<string>('');
  const [isTyping, setIsTyping] = useState<boolean>(false);
  
  // Voice Recording States
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [isTranscribing, setIsTranscribing] = useState<boolean>(false);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<BlobPart[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const quickReplies: string[] = [
    "Bawo ni oju ojo se ri loni?",
    "Akoko wo ni mo le gbin agbado?",
    "Nigba wo ni ki n lo ajile?"
  ];

  // --- VOICE RECORDING LOGIC --- //
  const startRecording = async (): Promise<void> => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event: BlobEvent) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        await sendAudioToASR(audioBlob);
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error("Microphone access denied or failed:", error);
      alert("Please allow microphone access to use voice features.");
    }
  };

  const stopRecording = (): void => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      setIsRecording(false);
    }
  };

  const sendAudioToASR = async (audioBlob: Blob): Promise<void> => {
    setIsTranscribing(true);
    const formData = new FormData();
    formData.append('audio', audioBlob, 'voice_note.webm');

    try {
      const response = await fetch('https://oroagbeai-api.onrender.com/api/asr', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) throw new Error('Transcription failed');

      const data = await response.json();
      setInput(data.transcript);
    } catch (error) {
      console.error("ASR Error:", error);
      alert("Aṣiṣe waye ninu gbigbọ ohùn yin. (Voice error).");
    } finally {
      setIsTranscribing(false);
    }
  };

  // --- CHAT LOGIC --- //
  const sendMessage = async (text: string): Promise<void> => {
    if (!text.trim()) return;

    const userMsg: ChatMessage = { 
      id: Date.now().toString(), 
      role: 'user', 
      text,
      locationId: '3c30a6ef-bfee-4ee4-b8e4-eb00568d2374',
      timestamp: new Date().toISOString()
    };
    
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);

    const assistantMsgId = (Date.now() + 1).toString();
    setMessages(prev => [...prev, { 
      id: assistantMsgId, 
      role: 'assistant', 
      text: '',
      locationId: '3c30a6ef-bfee-4ee4-b8e4-eb00568d2374',
      timestamp: new Date().toISOString()
    }]);

    try {
      const response = await fetch('https://oroagbeai-api.onrender.com/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          locationId: '3c30a6ef-bfee-4ee4-b8e4-eb00568d2374',
          conversationId: 'conv-123'
        }),
      });

      if (!response.body) throw new Error("No response body");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');
        
        for (const line of lines) {
          if (line.startsWith('data: ') && line !== 'data: [DONE]') {
            const data = JSON.parse(line.replace('data: ', ''));
            setMessages(prev => prev.map(msg => 
              msg.id === assistantMsgId ? { ...msg, text: msg.text + data.text } : msg
            ));
          }
        }
      }
    } catch (error) {
      console.error("Chat error:", error);
      setMessages(prev => [...prev, { 
        id: Date.now().toString(), 
        role: 'assistant', 
        text: 'Aforiji, asise die waye. E jowo e tun gbiyanju.',
        locationId: 'system',
        timestamp: new Date().toISOString()
      }]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="flex flex-col h-screen max-w-md mx-auto bg-gray-50 font-sans">
      <header className="bg-green-700 text-white p-4 flex items-center shadow-md">
        <img 
          src="/oroagbeai-logo.png" 
          alt="OroAgbeAI Logo" 
        />
        
      </header>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] rounded-2xl p-3 shadow-sm ${
              msg.role === 'user' 
                ? 'bg-green-600 text-white rounded-tr-none' 
                : 'bg-white text-gray-800 border border-gray-200 rounded-tl-none'
            }`}>
              {msg.text}
            </div>
          </div>
        ))}
        {isTyping && (
          <div className="flex justify-start">
            <div className="bg-gray-200 rounded-2xl p-3 rounded-tl-none animate-pulse">
              <span className="text-gray-500">O n kọ...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="px-4 pb-2 flex overflow-x-auto space-x-2 no-scrollbar">
        {quickReplies.map((reply, idx) => (
          <button 
            key={idx}
            onClick={() => sendMessage(reply)}
            className="whitespace-nowrap bg-green-100 text-green-800 px-3 py-1.5 rounded-full text-sm font-medium border border-green-200 active:bg-green-200 transition-colors"
          >
            {reply}
          </button>
        ))}
      </div>

      <div className="p-4 bg-white border-t border-gray-200 flex items-center space-x-2">
        {isRecording ? (
          <button 
            onClick={stopRecording}
            className="p-3 text-white bg-red-500 rounded-full hover:bg-red-600 animate-pulse"
          >
            <Square className="w-5 h-5 fill-current" />
          </button>
        ) : (
          <button 
            onClick={startRecording}
            className="p-3 text-white bg-green-600 rounded-full hover:bg-green-700 transition-colors"
            disabled={isTranscribing}
          >
            <Mic className="w-5 h-5" />
          </button>
        )}

        <input
          type="text"
          value={isTranscribing ? "N gbo ohun rẹ... (Transcribing...)" : input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && sendMessage(input)}
          placeholder="Tẹ ibeere rẹ nibi..."
          disabled={isTranscribing}
          className="flex-1 border border-gray-300 rounded-full px-4 py-2 focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 disabled:bg-gray-100"
        />
        
        <button 
          onClick={() => sendMessage(input)}
          disabled={isTranscribing || !input.trim()}
          className="p-3 text-green-600 rounded-full hover:bg-green-50 transition-colors disabled:opacity-50"
        >
          <Send className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}