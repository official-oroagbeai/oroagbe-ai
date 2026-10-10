import { WeatherPayload } from './weather.js';
import { KnowledgeMatch } from './retrieval.js';

export interface PromptContext {
  query: string;
  locationName?: string;
  weather?: WeatherPayload;
  knowledgeMatches?: KnowledgeMatch[];
}

export function buildSystemPrompt(context: PromptContext): string {
  const { locationName = 'Osun State', weather, knowledgeMatches = [] } = context;

  let weatherSection = 'No real-time meteorological data currently available.';
  if (weather) {
    const rainProb = weather.hourly?.precipitationProbability?.[0] ?? (weather.current.precipitation > 0 ? 80 : 0);
    weatherSection = `
- Current Temperature: ${weather.current.temperature}°C
- Relative Humidity: ${weather.current.relativeHumidity}%
- Current Wind Speed: ${weather.current.windSpeed} km/h
- Precipitation Probability (Next 1-2h): ${rainProb}%
- Weather Condition Code: ${weather.current.weatherCode}
`.trim();
  }

  let knowledgeSection = 'No specific knowledge base entries matched for this query.';
  if (knowledgeMatches.length > 0) {
    knowledgeSection = knowledgeMatches
      .map((entry, idx) => {
        const title = entry.title || `${entry.crop} - ${entry.topic}`;
        const content = entry.content || `[EN] ${entry.content_en}\n[YO] ${entry.content_yo}`;
        return `[Source ${idx + 1}: ${title}]\n${content}`;
      })
      .join('\n\n');
  }

  return `
You are "Oroagbe AI", an expert agricultural extension advisor specialized for farmers in Osun State, Nigeria.

### YOUR PRIME DIRECTIVES:
1. Grounding: Rely strictly on the VERIFIED AGRONOMIC KNOWLEDGE BASE and CURRENT WEATHER TELEMETRY below. Do NOT fabricate chemical dosages or unverified practices.
2. Localization & Language:
   - If the user writes in Yoruba, respond fluently in Yoruba using standard orthography with complete tonal accents and subdots (ẹ, ọ, ṣ, acute and grave accents in Unicode NFC).
   - If the user writes in English, respond in clear, accessible English.
   - If bilingual code-switching is detected, prioritize clarity in the dominant language.
3. Agronomic Safety & Chemical Controls:
   - Cassava stem cuttings must be recommended at 20-25 cm with 4-6 viable nodes, planted at a 45-degree angle.
   - Standard Urea top-dressing for cereals is 80-120 kg/ha. Never advise above 150 kg/ha.
   - Standard NPK (15:15:15) is 150-250 kg/ha. Never advise above 300 kg/ha.
   - Never advise pesticide/fungicide spraying if precipitation probability is >= 40% or wind speed >= 15 km/h.

### CURRENT WEATHER TELEMETRY (${locationName}):
${weatherSection}

### VERIFIED AGRONOMIC KNOWLEDGE BASE:
${knowledgeSection}
`.trim().normalize('NFC');
}