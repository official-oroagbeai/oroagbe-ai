import {
  AGRONOMIC_SAFETY_ENVELOPES,
  WEATHER_SAFETY_THRESHOLDS,
  AgronomicViolation,
  detectLanguage,
  containsSprayingAdvice
} from './agronomic_rules.js';
import { WeatherPayload } from './weather.js';

export interface VerificationResult {
  isValid: boolean;
  violations: AgronomicViolation[];
  sanitizedText: string;
}

export interface VerifyOptions {
  text: string;
  crop?: string;
  weather?: WeatherPayload;
}

interface ExtractedDosage {
  type: 'urea' | 'npk';
  value: number;
}

function extractFertilizerDosages(text: string): ExtractedDosage[] {
  const results: ExtractedDosage[] = [];
  const normalized = text.toLowerCase();

  // Pattern 1: Keyword followed by number & unit (e.g., "Urea at 500 kg/ha", "NPK ní ìwọ̀n 450 kg")
  const keywordFirstRegex = /(?:npk(?:\s+15:15:15)?|urea)[\s\p{L}\p{M},:-]{0,40}?(\d+(?:\.\d+)?)\s*(?:kg\/ha|kg|kilograms?)/giu;
  let match: RegExpExecArray | null;

  while ((match = keywordFirstRegex.exec(normalized)) !== null) {
    const fullMatch = match[0];
    const val = parseFloat(match[1]);
    const type: 'urea' | 'npk' = fullMatch.includes('urea') ? 'urea' : 'npk';
    results.push({ type, value: val });
  }

  // Pattern 2: Number & unit followed by keyword (e.g., "500 kg/ha of Urea", "450 kg of NPK")
  const numberFirstRegex = /(\d+(?:\.\d+)?)\s*(?:kg\/ha|kg|kilograms?)[\s\p{L}\p{M},:-]{0,40}?(?:npk(?:\s+15:15:15)?|urea)/giu;
  while ((match = numberFirstRegex.exec(normalized)) !== null) {
    const fullMatch = match[0];
    const val = parseFloat(match[1]);
    const type: 'urea' | 'npk' = fullMatch.includes('urea') ? 'urea' : 'npk';
    results.push({ type, value: val });
  }

  return results;
}

export function verifyAgronomicResponse(options: VerifyOptions): VerificationResult {
  const { text, weather } = options;
  const violations: AgronomicViolation[] = [];
  const normalizedText = text.normalize('NFC');
  const lang = detectLanguage(normalizedText);

  // 1. Evaluate Fertilizer Dosages (NPK & Urea)
  const dosages = extractFertilizerDosages(normalizedText);

  for (const dosage of dosages) {
    if (dosage.type === 'urea') {
      const envelope = AGRONOMIC_SAFETY_ENVELOPES['urea_dosage'];
      if (dosage.value > envelope.max) {
        violations.push({
          code: 'FERTILIZER_OVERDOSE',
          severity: 'CRITICAL',
          entity: 'Urea',
          observedValue: dosage.value,
          expectedRange: { min: envelope.min, max: envelope.max, unit: envelope.unit },
          messageEn: `Dangerous Urea rate detected: ${dosage.value} kg/ha exceeds safe maximum (${envelope.max} kg/ha). ${envelope.advisoryEn}`,
          messageYo: `Ìwọ̀n ajílẹ̀ Urea tó lékenkà: ${dosage.value} kg/ha ti ju ìwọ̀n tó dájú lọ (${envelope.max} kg/ha). ${envelope.advisoryYo}`
        });
      }
    } else if (dosage.type === 'npk') {
      const envelope = AGRONOMIC_SAFETY_ENVELOPES['npk_dosage'];
      if (dosage.value > envelope.max) {
        violations.push({
          code: 'FERTILIZER_OVERDOSE',
          severity: 'CRITICAL',
          entity: 'NPK',
          observedValue: dosage.value,
          expectedRange: { min: envelope.min, max: envelope.max, unit: envelope.unit },
          messageEn: `Excessive NPK dosage detected: ${dosage.value} kg/ha exceeds safe threshold (${envelope.max} kg/ha). ${envelope.advisoryEn}`,
          messageYo: `Ìwọ̀n ajílẹ̀ NPK tó ga jù: ${dosage.value} kg/ha ti kọjá ààlà ààbò (${envelope.max} kg/ha). ${envelope.advisoryYo}`
        });
      }
    }
  }

  // 2. Cassava Stem Cutting Length Check
  const cassavaRegex = /(?:cassava|gbágùdá|gbaguda)[\s\p{L}\p{M},:-]{0,40}?(\d+(?:\.\d+)?)\s*cm/giu;
  let cassavaMatch: RegExpExecArray | null;
  while ((cassavaMatch = cassavaRegex.exec(normalizedText)) !== null) {
    const val = parseFloat(cassavaMatch[1]);
    const envelope = AGRONOMIC_SAFETY_ENVELOPES['cassava_stem_length'];
    if (val < envelope.min || val > envelope.max) {
      violations.push({
        code: 'DIMENSION_OUT_OF_BOUNDS',
        severity: 'WARNING',
        entity: 'Cassava Stem Length',
        observedValue: val,
        expectedRange: { min: envelope.min, max: envelope.max, unit: envelope.unit },
        messageEn: `Abnormal cutting length: ${val} cm is outside recommended range (${envelope.min}–${envelope.max} cm). ${envelope.advisoryEn}`,
        messageYo: `Gígùn igi gbágùdá tí kò bára mu: ${val} cm kọjá ìwọ̀n tó tọ́ (${envelope.min}–${envelope.max} cm). ${envelope.advisoryYo}`
      });
    }
  }

  // 3. Real-Time Meteorological Spray Safety Check
  if (weather && containsSprayingAdvice(normalizedText)) {
    const precipProb = weather.hourly?.precipitationProbability?.[0] ?? (weather.current.precipitation > 0 ? 80 : 0);
    const windSpeed = weather.current.windSpeed;

    if (precipProb >= WEATHER_SAFETY_THRESHOLDS.maxSprayPrecipitationProbability) {
      violations.push({
        code: 'WEATHER_SPRAY_HAZARD',
        severity: 'CRITICAL',
        entity: 'Chemical Spraying (Precipitation)',
        observedValue: precipProb,
        messageEn: `Rain imminent (${precipProb}% probability). Spraying chemicals now will cause complete wash-off, financial waste, and environmental contamination.`,
        messageYo: `Òjò fẹ́rẹ̀ rọ̀ (ìṣeese òjò jẹ́ ${precipProb}%). Fífún egbòogi ní báyìí yóò fa kí òjò fọ oògùn dànù kí ó sì ba àyíká jẹ́.`
      });
    }

    if (windSpeed >= WEATHER_SAFETY_THRESHOLDS.maxSprayWindSpeed) {
      violations.push({
        code: 'WEATHER_SPRAY_HAZARD',
        severity: 'WARNING',
        entity: 'Chemical Spraying (Wind Drift)',
        observedValue: windSpeed,
        messageEn: `High wind speed detected (${windSpeed} km/h). Chemical spraying risks severe atmospheric drift onto neighboring fields.`,
        messageYo: `Afẹ́fẹ́ ń bọ́ ní agbára (${windSpeed} km/h). Fífún egbòogi nísinsìnyí máa mú kí egbòogi fò lọ sí oko ẹlòmíràn.`
      });
    }
  }

  // 4. Sanitize Output with Mandatory Localized Safety Advisories
  let sanitizedText = normalizedText;
  if (violations.length > 0) {
    const header = lang === 'yo'
      ? '\n\n⚠️ **ÌKILỌ̀ ÀÀBÒ ÀGBẸ̀ (AGRONOMIC SAFETY NOTICE):**'
      : '\n\n⚠️ **AGRONOMIC SAFETY ADVISORY:**';

    const notices = violations.map((v) => {
      const msg = lang === 'yo' ? v.messageYo : v.messageEn;
      return `- [${v.severity}] ${msg}`;
    });

    sanitizedText += `${header}\n${notices.join('\n')}`;
  }

  return {
    isValid: violations.length === 0,
    violations,
    sanitizedText
  };
}