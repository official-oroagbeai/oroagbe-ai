export interface CachedAdvisory {
  id: string;
  query: string;
  response: string;
  safetyNotice?: string;
  locationId: string;
  timestamp: string;
  lang: 'en' | 'yo';
}

const STORAGE_KEY = 'oroagbe_advisory_cache_v1';

export function saveAdvisoryToCache(advisory: CachedAdvisory): void {
  try {
    const existing = getCachedAdvisories();
    const updated = [advisory, ...existing.slice(0, 49)]; // Store last 50 advisories
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (e) {
    console.warn('LocalStorage unavailable for offline advisory caching', e);
  }
}

export function getCachedAdvisories(): CachedAdvisory[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}