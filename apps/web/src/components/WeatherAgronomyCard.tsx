'use client';

import React, { useState, useEffect } from 'react';
import { 
  CloudRain, 
  Wind, 
  Thermometer, 
  Droplets, 
  AlertTriangle, 
  CheckCircle2, 
  XCircle, 
  Sun, 
  RefreshCw 
} from 'lucide-react';
import { computeAgronomicIndices, ClimateIntelligenceReport, WeatherTelemetry } from '../lib/climate_index';
import { Language } from '../lib/i18n';

interface WeatherAgronomyCardProps {
  locationId: string;
  locationName: string;
  lang: Language;
}

export const WeatherAgronomyCard: React.FC<WeatherAgronomyCardProps> = ({
  locationId,
  locationName,
  lang
}) => {
  const [report, setReport] = useState<ClimateIntelligenceReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchWeatherTelemetry = async () => {
    setLoading(true);
    setError(null);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const res = await fetch(`${apiUrl}/api/weather/${locationId}`);
      if (!res.ok) {
        throw new Error(`Weather feed HTTP ${res.status}`);
      }
      const data = await res.json();
      
      const rainProb = data.hourly?.precipitationProbability?.[0] ?? (data.current.precipitation > 0 ? 80 : 10);
      const forecast24h = data.daily?.precipitationSum?.[0] ?? 0;

      const telemetry: WeatherTelemetry = {
        temperature: data.current.temperature ?? 28,
        relativeHumidity: data.current.relativeHumidity ?? 65,
        precipitation: data.current.precipitation ?? 0,
        precipitationProbability: rainProb,
        windSpeed: data.current.windSpeed ?? 8,
        weatherCode: data.current.weatherCode ?? 1,
        forecastRainSum24h: forecast24h
      };

      setReport(computeAgronomicIndices(telemetry));
    } catch (err: any) {
      // Graceful fallback defaults for Osun State microclimate
      const fallbackTelemetry: WeatherTelemetry = {
        temperature: 29,
        relativeHumidity: 70,
        precipitation: 0,
        precipitationProbability: 15,
        windSpeed: 9,
        weatherCode: 1,
        forecastRainSum24h: 0
      };
      setReport(computeAgronomicIndices(fallbackTelemetry));
      setError(lang === 'yo' ? 'Àgbéyẹ̀wò orí-ẹ̀rọ (Offline fallback)' : 'Using cached regional baseline');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWeatherTelemetry();
  }, [locationId]);

  if (!report && loading) {
    return (
      <div className="mx-6 mt-3 p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 animate-pulse flex items-center justify-between text-xs text-slate-500">
        <span>{lang === 'yo' ? 'Ń gba ojú-ọjọ́ gidi...' : 'Fetching live hyperlocal telemetry...'}</span>
      </div>
    );
  }

  if (!report) return null;

  const { telemetry, sprayWindow, nitrogenWindow, dryingIndex } = report;

  const getBadgeStyle = (level: string) => {
    if (level === 'SAFE') return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800';
    if (level === 'WARNING') return 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border-amber-300 dark:border-amber-800';
    return 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300 border-red-300 dark:border-red-800';
  };

  const getBadgeIcon = (level: string) => {
    if (level === 'SAFE') return <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />;
    if (level === 'WARNING') return <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400" />;
    return <XCircle className="h-3.5 w-3.5 shrink-0 text-red-600 dark:text-red-400" />;
  };

  return (
    <div className="mx-6 mt-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm p-4 text-xs">
      {/* Top Telemetry Strip */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <span className="font-bold text-slate-800 dark:text-slate-200 text-sm">{locationName}</span>
          <span className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-2 py-0.5 rounded-full font-mono">
            {telemetry.temperature}°C
          </span>
          {error && <span className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">({error})</span>}
        </div>

        {/* Real-time Atmospheric Readings */}
        <div className="flex items-center gap-4 text-slate-600 dark:text-slate-400">
          <div className="flex items-center gap-1" title="Precipitation Probability">
            <CloudRain className="h-3.5 w-3.5 text-blue-500" />
            <span className="font-semibold">{telemetry.precipitationProbability}%</span>
          </div>
          <div className="flex items-center gap-1" title="Wind Velocity">
            <Wind className="h-3.5 w-3.5 text-slate-500" />
            <span className="font-semibold">{telemetry.windSpeed} km/h</span>
          </div>
          <div className="flex items-center gap-1" title="Relative Humidity">
            <Droplets className="h-3.5 w-3.5 text-cyan-500" />
            <span className="font-semibold">{telemetry.relativeHumidity}%</span>
          </div>
          <button 
            onClick={fetchWeatherTelemetry} 
            disabled={loading}
            className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded text-slate-400 hover:text-slate-600 transition"
            title="Refresh weather"
          >
            <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* 3 Agronomic Climate Risk Indicator Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 mt-3">
        {/* Spray Window Indicator */}
        <div className="p-2.5 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/40 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-1 mb-1.5">
              <span className="font-semibold text-slate-700 dark:text-slate-300">
                {lang === 'yo' ? 'Fífún Oògùn' : 'Spray Window'}
              </span>
              <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-bold ${getBadgeStyle(sprayWindow.level)}`}>
                {getBadgeIcon(sprayWindow.level)}
                <span>{lang === 'yo' ? sprayWindow.badgeYo : sprayWindow.badgeEn}</span>
              </span>
            </div>
            <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-tight">
              {lang === 'yo' ? sprayWindow.advisoryYo : sprayWindow.advisoryEn}
            </p>
          </div>
        </div>

        {/* Nitrogen / Fertilizer Application Indicator */}
        <div className="p-2.5 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/40 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-1 mb-1.5">
              <span className="font-semibold text-slate-700 dark:text-slate-300">
                {lang === 'yo' ? 'Lílò Ajílẹ̀' : 'Fertilizer Timing'}
              </span>
              <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-bold ${getBadgeStyle(nitrogenWindow.level)}`}>
                {getBadgeIcon(nitrogenWindow.level)}
                <span>{lang === 'yo' ? nitrogenWindow.badgeYo : nitrogenWindow.badgeEn}</span>
              </span>
            </div>
            <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-tight">
              {lang === 'yo' ? nitrogenWindow.advisoryYo : nitrogenWindow.advisoryEn}
            </p>
          </div>
        </div>

        {/* Produce Sun-Drying Indicator */}
        <div className="p-2.5 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/40 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-1 mb-1.5">
              <span className="font-semibold text-slate-700 dark:text-slate-300">
                {lang === 'yo' ? 'Gbígbẹ Kòkó/Láfún' : 'Sun-Drying Index'}
              </span>
              <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-bold ${getBadgeStyle(dryingIndex.level)}`}>
                {getBadgeIcon(dryingIndex.level)}
                <span>{lang === 'yo' ? dryingIndex.badgeYo : dryingIndex.badgeEn}</span>
              </span>
            </div>
            <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-tight">
              {lang === 'yo' ? dryingIndex.advisoryYo : dryingIndex.advisoryEn}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};