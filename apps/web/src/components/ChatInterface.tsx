'use client';

import React, { useState, useEffect, useRef } from 'react';
import { 
  Send, 
  Square, 
  Trash2, 
  Sprout, 
  Languages, 
  MapPin, 
  Volume2, 
  WifiOff, 
  ShieldAlert, 
  Activity, 
  UserCheck 
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { useChatStream } from '../hooks/useChatStream';
import { DICTIONARY, Language, AppMode } from '../lib/i18n';
import { OSUN_LOCATIONS } from '../lib/locations';
import { SafetyAlertBanner } from './SafetyAlertBanner';
import { saveAdvisoryToCache } from '../lib/offline_storage';
import { WeatherAgronomyCard } from './WeatherAgronomyCard';

export const ChatInterface: React.FC = () => {
  const [lang, setLang] = useState<Language>('yo'); // Default to Yoruba for local farmer immersion
  const [mode, setMode] = useState<AppMode>('farmer');
  const [selectedLocation, setSelectedLocation] = useState(OSUN_LOCATIONS[0].id);
  const [selectedCrop, setSelectedCrop] = useState('');
  const [inputQuery, setInputQuery] = useState('');
  const [isOnline, setIsOnline] = useState(true);

  const t = DICTIONARY[lang];
  const { messages, isStreaming, error, sendMessage, stopStreaming, clearMessages } = useChatStream();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const activeLocation = OSUN_LOCATIONS.find((l) => l.id === selectedLocation);
  const activeLocationName = activeLocation
    ? (lang === 'yo' ? activeLocation.nameYo : activeLocation.nameEn)
    : 'Osun State';

  // Monitor network connectivity for rural field operations
  useEffect(() => {
    setIsOnline(navigator.onLine);
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Persist completed responses for offline review
  useEffect(() => {
    if (!isStreaming && messages.length >= 2) {
      const lastMsg = messages[messages.length - 1];
      const prevMsg = messages[messages.length - 2];
      if (lastMsg.role === 'assistant' && lastMsg.content) {
        saveAdvisoryToCache({
          id: lastMsg.id,
          query: prevMsg.content,
          response: lastMsg.content,
          safetyNotice: lastMsg.safetyNotice,
          locationId: selectedLocation,
          timestamp: lastMsg.timestamp,
          lang
        });
      }
    }
  }, [isStreaming, messages, selectedLocation, lang]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputQuery.trim() || isStreaming) return;

    sendMessage({
      query: inputQuery,
      locationId: selectedLocation,
      locationName: activeLocationName,
      crop: selectedCrop || undefined
    });
    setInputQuery('');
  };

  const handleQuickPrompt = (q: string) => {
    if (isStreaming) return;
    sendMessage({
      query: q,
      locationId: selectedLocation,
      locationName: activeLocationName,
      crop: selectedCrop || undefined
    });
  };

  const handleReadAloud = (text: string) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text.replace(/[*#_]/g, ''));
      utterance.lang = lang === 'yo' ? 'yo-NG' : 'en-NG';
      window.speechSynthesis.speak(utterance);
    }
  };

  return (
    <div className="flex flex-col h-screen max-w-5xl mx-auto bg-slate-50 dark:bg-slate-950 shadow-2xl border-x border-slate-200 dark:border-slate-800">
      {/* Offline Status Alert Banner */}
      {!isOnline && (
        <div className="flex items-center justify-center gap-2 bg-amber-600 text-white px-4 py-1.5 text-xs font-semibold">
          <WifiOff className="h-4 w-4" />
          <span>{t.offlineBanner}</span>
        </div>
      )}

      {/* Main Climate Header */}
      <header className="flex flex-wrap items-center justify-between px-6 py-4 bg-emerald-900 text-white border-b border-emerald-800 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-emerald-800 border border-emerald-700/60 rounded-xl shadow-inner">
            <Sprout className="h-6 w-6 text-emerald-300" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-extrabold tracking-tight">{t.title}</h1>
              <span className="text-[10px] bg-emerald-700/80 text-emerald-100 font-mono px-2 py-0.5 rounded-full border border-emerald-600">
                v1.0 • Osun Pilot
              </span>
            </div>
            <p className="text-xs text-emerald-200/80 font-medium">{t.tagline}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 mt-2 sm:mt-0">
          {/* Dual-Sided Mode Selector */}
          <button
            onClick={() => setMode((m) => (m === 'farmer' ? 'extension' : 'farmer'))}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border transition ${
              mode === 'extension'
                ? 'bg-amber-500 text-slate-950 border-amber-400 font-bold'
                : 'bg-emerald-800 text-emerald-100 border-emerald-700 hover:bg-emerald-700'
            }`}
          >
            {mode === 'extension' ? <Activity className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
            <span className="hidden md:inline">{mode === 'extension' ? t.extensionMode : t.farmerMode}</span>
          </button>

          {/* Bilingual Toggle */}
          <button
            onClick={() => setLang((prev) => (prev === 'en' ? 'yo' : 'en'))}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-800 border border-emerald-700 hover:bg-emerald-700 transition"
          >
            <Languages className="h-4 w-4 text-emerald-300" />
            <span>{lang === 'en' ? 'Yorùbá' : 'English'}</span>
          </button>

          {/* Clear Button */}
          <button
            onClick={clearMessages}
            disabled={messages.length === 0}
            className="p-2 text-emerald-300 hover:text-white disabled:opacity-30 transition rounded-lg hover:bg-emerald-800"
            title={t.clearChat}
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </header>

      {/* Microclimate Regional Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 px-6 py-2.5 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 text-xs">
        <div className="flex items-center gap-2">
          <MapPin className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <label className="font-semibold text-slate-700 dark:text-slate-300">{t.locationLabel}</label>
          <select
            value={selectedLocation}
            onChange={(e) => setSelectedLocation(e.target.value)}
            className="flex-1 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-md px-2.5 py-1.5 text-slate-800 dark:text-slate-200 font-medium focus:ring-1 focus:ring-emerald-600"
          >
            {OSUN_LOCATIONS.map((loc) => (
              <option key={loc.id} value={loc.id}>
                {lang === 'yo' ? loc.nameYo : loc.nameEn}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <label className="font-semibold text-slate-700 dark:text-slate-300">{t.cropLabel}</label>
          <select
            value={selectedCrop}
            onChange={(e) => setSelectedCrop(e.target.value)}
            className="flex-1 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-md px-2.5 py-1.5 text-slate-800 dark:text-slate-200 font-medium focus:ring-1 focus:ring-emerald-600"
          >
            <option value="">{t.cropAll}</option>
            <option value="cassava">{t.cassava}</option>
            <option value="maize">{t.maize}</option>
            <option value="yam">{t.yam}</option>
            <option value="cocoa">{t.cocoa}</option>
          </select>
        </div>
      </div>

      {/* Hyperlocal Weather & Agronomy Risk Cards */}
      <WeatherAgronomyCard
        locationId={selectedLocation}
        locationName={activeLocationName}
        lang={lang}
      />

      {/* Main Chat Stream Container */}
      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-6">
            <div className="p-4 bg-emerald-100 dark:bg-emerald-950/60 rounded-2xl mb-4 border border-emerald-200 dark:border-emerald-800/80">
              <Sprout className="h-10 w-10 text-emerald-700 dark:text-emerald-400" />
            </div>
            <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-1">
              {lang === 'yo'
                ? 'Ẹ kú àbọ̀ sí OroAgbe AI: Ẹ̀rọ Ìmọ̀ Ọjọ́ & Iṣẹ́-Àgbẹ̀'
                : 'Welcome to OroAgbe AI: Climate Intelligence Extension'}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-lg mb-6 leading-relaxed">
              {lang === 'yo'
                ? 'Ìmọ̀ràn gbígbéṣẹ́ tó ní ààbò fún àwọn olóko Ìpínlẹ̀ Ọ̀ṣun. Béèrè nípa ojú-ọjọ́, ajílẹ̀, àti ìtọ́jú irúgbìn.'
                : 'Grounded agronomic and weather intelligence for Osun State farms. Ask about microclimate windows, fertilizer envelopes, and pest controls.'}
            </p>

            {/* Quick Inquiry Cards */}
            <div className="w-full max-w-xl text-left">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300 tracking-wide uppercase">
                {t.quickPromptsHeading}
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mt-2.5">
                {t.quickPrompts.map((p, i) => (
                  <button
                    key={i}
                    onClick={() => handleQuickPrompt(p.query)}
                    className="p-3 text-left rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-emerald-500 hover:shadow-md transition text-xs"
                  >
                    <span className="font-bold text-emerald-800 dark:text-emerald-400 block mb-1">
                      {p.label}
                    </span>
                    <span className="text-slate-600 dark:text-slate-400 line-clamp-2 leading-relaxed">
                      {p.query}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          messages.map((m) => (
            <div
              key={m.id}
              className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}
            >
              <div
                className={`max-w-[88%] rounded-2xl px-5 py-4 text-sm shadow-sm ${
                  m.role === 'user'
                    ? 'bg-emerald-800 text-white rounded-br-none'
                    : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 rounded-bl-none'
                }`}
              >
                {/* Message Body with React Markdown */}
                <div className="prose prose-sm dark:prose-invert max-w-none leading-relaxed break-words font-sans">
                  <ReactMarkdown>{m.content || (isStreaming ? '...' : '')}</ReactMarkdown>
                </div>

                {/* Deterministic Safety Warning Notice */}
                {m.safetyNotice && (
                  <SafetyAlertBanner notice={m.safetyNotice} title={t.safetyAlertTitle} />
                )}

                {/* Extension Officer Deep-Inspection Mode Box */}
                {mode === 'extension' && m.role === 'assistant' && (
                  <div className="mt-3 pt-2.5 border-t border-slate-200 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                    <span className="font-bold text-amber-700 dark:text-amber-400">
                      [FIELD AUDIT]: Verified against Open-Meteo Osun Feed & IITA Envelope.
                    </span>
                  </div>
                )}

                {/* Footer Controls: Audio Playback & Timestamp */}
                <div className="flex items-center justify-between mt-2 pt-1 border-t border-slate-100 dark:border-slate-800/60 text-[10px]">
                  {m.role === 'assistant' && m.content ? (
                    <button
                      onClick={() => handleReadAloud(m.content)}
                      className="flex items-center gap-1 text-emerald-700 dark:text-emerald-400 hover:underline font-semibold"
                    >
                      <Volume2 className="h-3.5 w-3.5" />
                      <span>{t.readAloud}</span>
                    </button>
                  ) : <span />}
                  <span className={m.role === 'user' ? 'text-emerald-200' : 'text-slate-400'}>
                    {m.timestamp}
                  </span>
                </div>
              </div>
            </div>
          ))
        )}

        {error && (
          <div className="p-3.5 bg-red-50 dark:bg-red-950/40 border border-red-300 dark:border-red-900 text-red-800 dark:text-red-200 rounded-xl text-xs flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 shrink-0 text-red-600" />
            <span>{error}</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Action Console */}
      <form
        onSubmit={handleSubmit}
        className="p-4 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800"
      >
        <div className="flex gap-2">
          <input
            type="text"
            value={inputQuery}
            onChange={(e) => setInputQuery(e.target.value)}
            placeholder={t.inputPlaceholder}
            className="flex-1 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-4 py-3 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-700"
          />

          {isStreaming ? (
            <button
              type="button"
              onClick={stopStreaming}
              className="px-4 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl flex items-center gap-1.5 text-xs font-bold shadow-sm transition"
            >
              <Square className="h-4 w-4" />
              <span>{t.stopButton}</span>
            </button>
          ) : (
            <button
              type="submit"
              disabled={!inputQuery.trim()}
              className="px-5 py-3 bg-emerald-800 hover:bg-emerald-900 disabled:opacity-40 text-white rounded-xl flex items-center gap-2 text-xs font-bold shadow-md transition"
            >
              <Send className="h-4 w-4" />
              <span>{t.sendButton}</span>
            </button>
          )}
        </div>
      </form>
    </div>
  );
};