import { WeatherPayload } from './weather.js';

export interface NumericRange {
  min: number;
  max: number;
  unit: string;
  advisoryEn: string;
  advisoryYo: string;
}

export const AGRONOMIC_SAFETY_ENVELOPES: Record<string, NumericRange> = {
  'urea_dosage': {
    min: 50,
    max: 150,
    unit: 'kg/ha',
    advisoryEn: 'Standard Urea recommendation for cereals is 80–120 kg/ha. Excessive application burns crop roots and causes nitrogen leaching.',
    advisoryYo: 'Ìwọ̀n ajílẹ̀ Urea tó tọ́ fún àgbàdo jẹ́ 80–120 kg fún hẹ́kíútà kan. Lílò rẹ̀ púpọ̀jù máa ń jó gbòǹgbò irúgbìn.'
  },
  'npk_dosage': {
    min: 100,
    max: 300,
    unit: 'kg/ha',
    advisoryEn: 'Standard NPK (15:15:15) application rate is 150–250 kg/ha. Dosages over 300 kg/ha risk toxic chemical burn and soil acidification.',
    advisoryYo: 'Ìwọ̀n ajílẹ̀ NPK (15:15:15) tó tọ́ jẹ́ 150–250 kg fún hẹ́kíútà kan. Ìwọ̀n tó ju 300 kg lọ máa ń bà ilẹ̀ jẹ́.'
  },
  'cassava_stem_length': {
    min: 15,
    max: 35,
    unit: 'cm',
    advisoryEn: 'Cassava stem cuttings should be 20–25 cm in length with 4–6 viable nodes.',
    advisoryYo: 'Gígùn igi gbágùdá tí a fẹ́ gbin gbọ́dọ̀ jẹ́ 20–25 cm pẹ̀lú ojú oró 4 sí 6.'
  },
  'yam_ridge_height': {
    min: 0.5,
    max: 1.5,
    unit: 'm',
    advisoryEn: 'Yam heaps/ridges should be approximately 0.75–1.2 m high to facilitate optimal tuber bulking.',
    advisoryYo: 'Gíga ebe iṣu gbọ́dọ̀ jẹ́ bíi 0.75 sí 1.2 mítà láti jẹ́ kí iṣu le sùn dáadáa.'
  }
};

export const WEATHER_SAFETY_THRESHOLDS = {
  maxSprayPrecipitationProbability: 40, // %
  maxSprayWindSpeed: 15, // km/h
  minSprayTemperature: 15, // °C
  maxSprayTemperature: 35 // °C
};

export interface AgronomicViolation {
  code: 'FERTILIZER_OVERDOSE' | 'FERTILIZER_UNDERDOSE' | 'DIMENSION_OUT_OF_BOUNDS' | 'WEATHER_SPRAY_HAZARD';
  severity: 'WARNING' | 'CRITICAL';
  entity: string;
  observedValue?: number;
  expectedRange?: { min: number; max: number; unit: string };
  messageEn: string;
  messageYo: string;
}

export function detectLanguage(text: string): 'yo' | 'en' {
  const yorubaDiacritics = /[ẹọṣáàéèóòíìúù]/i;
  const yorubaKeywords = /\b(gbin|ajilẹ|ajílẹ̀|àgbàdo|gbágùdá|iṣu|kòkó|olóko|ile|ilẹ̀|òjò|ojo)\b/i;
  return yorubaDiacritics.test(text) || yorubaKeywords.test(text) ? 'yo' : 'en';
}

export function containsSprayingAdvice(text: string): boolean {
  const sprayPatterns = /\b(spray|spraying|fungicide|pesticide|herbicide|apply chemical|fún egbòogi|fún oògùn|bọ́ oògùn|wọ́ egbòogi)\b/i;
  return sprayPatterns.test(text);
}