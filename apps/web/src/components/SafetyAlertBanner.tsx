import React from 'react';
import { AlertTriangle } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

interface SafetyAlertBannerProps {
  notice: string;
  title: string;
}

export const SafetyAlertBanner: React.FC<SafetyAlertBannerProps> = ({ notice, title }) => {
  if (!notice) return null;

  return (
    <div className="mt-4 rounded-lg border-2 border-amber-500 bg-amber-50 dark:bg-amber-950/40 p-4 text-amber-900 dark:text-amber-200 shadow-sm animate-pulse-subtle">
      <div className="flex items-center gap-2 font-bold text-sm tracking-wide text-amber-800 dark:text-amber-300">
        <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0" />
        <span>{title}</span>
      </div>
      <div className="mt-2 text-sm leading-relaxed prose prose-sm dark:prose-invert max-w-none">
        <ReactMarkdown>{notice}</ReactMarkdown>
      </div>
    </div>
  );
};