export type RiskLevel = 'SAFE' | 'WARNING' | 'HAZARDOUS';

export interface WeatherTelemetry {
  temperature: number; // °C
  relativeHumidity: number; // %
  precipitation: number; // mm
  precipitationProbability: number; // %
  windSpeed: number; // km/h
  weatherCode: number;
  forecastRainSum24h?: number; // mm
}

export interface AgronomicIndicator {
  level: RiskLevel;
  badgeEn: string;
  badgeYo: string;
  advisoryEn: string;
  advisoryYo: string;
}

export interface ClimateIntelligenceReport {
  telemetry: WeatherTelemetry;
  sprayWindow: AgronomicIndicator;
  nitrogenWindow: AgronomicIndicator;
  dryingIndex: AgronomicIndicator;
}

export function computeAgronomicIndices(telemetry: WeatherTelemetry): ClimateIntelligenceReport {
  const { precipitationProbability, windSpeed, relativeHumidity, forecastRainSum24h = 0, temperature } = telemetry;

  // 1. Chemical Spray Window Calculation
  let sprayWindow: AgronomicIndicator;
  if (precipitationProbability >= 40 || windSpeed >= 15 || temperature >= 35) {
    sprayWindow = {
      level: 'HAZARDOUS',
      badgeEn: 'Unsafe to Spray',
      badgeYo: 'Léwu: Má Fún Oògùn',
      advisoryEn: `High risk: Rain chance (${precipitationProbability}%) or wind speed (${windSpeed} km/h) exceeds safe spraying thresholds. Chemical runoff or atmospheric drift will occur.`,
      advisoryYo: `Ewu ńlá: Ìṣeese òjò (${precipitationProbability}%) tàbí afẹ́fẹ́ (${windSpeed} km/h) kọjá ààlà ààbò. Òjò yóò fọ oògùn dànù tàbí kí afẹ́fẹ́ gbé e fò.`
    };
  } else if (precipitationProbability >= 20 || windSpeed >= 12 || temperature >= 32) {
    sprayWindow = {
      level: 'WARNING',
      badgeEn: 'Marginal Window',
      badgeYo: 'Ìkìlọ̀: Ṣọ́ra Fún Oògùn',
      advisoryEn: `Marginal conditions: Moderate wind (${windSpeed} km/h) or precipitation risk (${precipitationProbability}%). Spray only with coarse nozzles early morning.`,
      advisoryYo: `Ṣọ́ra fún lílo oògùn: Afẹ́fẹ́ (${windSpeed} km/h) tàbí ìrọ̀rọ̀ òjò (${precipitationProbability}%). Lo oògùn ní kùtùkùtù òwúrọ̀ nìkan.`
    };
  } else {
    sprayWindow = {
      level: 'SAFE',
      badgeEn: 'Safe to Spray',
      badgeYo: 'Àìléwu: Lè Fún Oògùn',
      advisoryEn: 'Optimal spray window: Calm winds and minimal precipitation probability ensure maximum chemical efficacy.',
      advisoryYo: 'Àkókò tó dára: Afẹ́fẹ́ rọlẹ̀, kò sì sí ewu òjò. Oògùn yóò jẹ́ lórí ewé dáadáa.'
    };
  }

  // 2. Nitrogen / Fertilizer Top-Dressing Window
  let nitrogenWindow: AgronomicIndicator;
  if (forecastRainSum24h >= 15 || precipitationProbability >= 65) {
    nitrogenWindow = {
      level: 'HAZARDOUS',
      badgeEn: 'Leaching Hazard',
      badgeYo: 'Léwu: Omi Máa Fọ Ajílẹ̀ Dànù',
      advisoryEn: `Heavy rain projected (>= 15mm or ${precipitationProbability}% chance). Urea/NPK applied now will suffer complete nitrate leaching into runoff.`,
      advisoryYo: `Òjò ńlá ń bọ̀. Tí o bá da Urea tàbí NPK sínú oko báyìí, omi yóò fọ gbogbo ajílẹ̀ dànù.`
    };
  } else if (precipitationProbability >= 35 || forecastRainSum24h >= 5) {
    nitrogenWindow = {
      level: 'WARNING',
      badgeEn: 'Moderate Risk',
      badgeYo: 'Ìkìlọ̀: Ṣọ́ra Da Ajílẹ̀',
      advisoryEn: 'Moderate moisture: Incorporate fertilizer into soil rather than broadcasting openly to reduce volatilization and erosion.',
      advisoryYo: 'Ọ̀rinrin wà níbẹ̀: Bo ajílẹ̀ mọ́lẹ̀ dípò kí o kàn fún un ká kí afẹ́fẹ́ tàbí omi má baà gbé e lọ.'
    };
  } else {
    nitrogenWindow = {
      level: 'SAFE',
      badgeEn: 'Safe Application Window',
      badgeYo: 'Àìléwu: Lè Da Ajílẹ̀',
      advisoryEn: 'Soil moisture adequate for nutrient uptake without surface runoff.',
      advisoryYo: 'Ilẹ̀ tutù tó fún gbòǹgbò láti fa oúnjẹ láìsí ewu ìbàjẹ́.'
    };
  }

  // 3. Post-Harvest Sun-Drying Index (Cocoa Beans / Cassava Chips)
  let dryingIndex: AgronomicIndicator;
  if (relativeHumidity >= 80 || precipitationProbability >= 40) {
    dryingIndex = {
      level: 'HAZARDOUS',
      badgeEn: 'Poor Drying Conditions',
      badgeYo: 'Kò Dára Fún Gbígbẹ Kòkó/Gbágùdá',
      advisoryEn: `High ambient humidity (${relativeHumidity}%) and rain risk. High risk of mould/mycotoxin growth on sun-drying cocoa or cassava chips.`,
      advisoryYo: `Ọ̀rinrin pọ̀jù (${relativeHumidity}%), ewu òjò sì wà. Egbò kòkó tàbí láfún lè ní eéwú (mould).`
    };
  } else if (relativeHumidity >= 65) {
    dryingIndex = {
      level: 'WARNING',
      badgeEn: 'Moderate Drying',
      badgeYo: 'Gbígbẹ Kọ̀ọ̀kan',
      advisoryEn: 'Slow evaporation rate. Frequent turning of cocoa beans required on raised platforms.',
      advisoryYo: 'Òòrùn kò lágbára púpọ̀. Yi kòkó padà léraléra lórí àtẹ.'
    };
  } else {
    dryingIndex = {
      level: 'SAFE',
      badgeEn: 'Optimal Sun Drying',
      badgeYo: 'Àkókò Tó Dára Fún Gbígbẹ',
      advisoryEn: 'Clear conditions with low relative humidity. Rapid and safe drying for harvested produce.',
      advisoryYo: 'Oòrùn wà dáadáa, ọ̀rinrin sì kéré. Ọjà oko yóò gbẹ kíákíá láìní eéwú.'
    };
  }

  return {
    telemetry,
    sprayWindow,
    nitrogenWindow,
    dryingIndex
  };
}