/**
 * Extracts all numeric values (integers and decimals) from a given text.
 * @param {string} text - The text to analyze.
 * @returns {string[]} An array of numbers found as strings.
 */
function extractNumbers(text) {
  // Regex looks for digits, optionally followed by a decimal point and more digits
  const matches = text.match(/\b\d+(\.\d+)?\b/g);
  return matches || [];
}

/**
 * Extracts all numbers from a JSON object by stringifying it first.
 * @param {object} jsonData - The source data payload.
 * @returns {Set<string>} A Set containing all valid numbers.
 */
function extractNumbersFromJson(jsonData) {
  const jsonString = JSON.stringify(jsonData);
  const matches = extractNumbers(jsonString);
  return new Set(matches); // Using a Set for ultra-fast lookups
}

/**
 * Verifies that every number in the generated text exists in the source data.
 * @param {string} generatedText - The LLM's draft answer.
 * @param {object} sourceData - The trusted data payload (e.g., Open-Meteo).
 * @returns {boolean} True if safe, False if a hallucination is detected.
 */
export function verifyNumericFidelity(generatedText, sourceData) {
  const textNumbers = extractNumbers(generatedText);
  
  // If there are no numbers in the text, it passes verification safely
  if (textNumbers.length === 0) return true;

  const validSourceNumbers = extractNumbersFromJson(sourceData);

  // Check every number in the LLM's text against our trusted data pool
  for (const num of textNumbers) {
    if (!validSourceNumbers.has(num)) {
      console.warn(`[Verification Failed] Hallucinated number detected: ${num}`);
      return false; // Mismatch blocks the answer
    }
  }

  return true; // 100% match on automated checks
}

/**
 * Generates a deterministic, templated Yoruba fallback response when verification fails.
 * @param {object} weatherData - The current weather payload.
 * @param {string} locationName - The name of the location.
 * @returns {string} A safe, templated answer.
 */
export function getTemplatedFallback(weatherData, locationName) {
  // Extracting current temperature and precipitation safely from Open-Meteo format
  const temp = weatherData?.current?.temperature_2m || "aimọ (unknown)";
  const rain = weatherData?.current?.precipitation || "aimọ (unknown)";
  
  return `Eku dede asiko yii. Iwọn igbona oju-ọjọ ni ${locationName} jẹ ${temp}°C, ati pe iwọn ojo jẹ ${rain}mm. (Esi yii jẹ ipilẹ nitori aṣiṣe diẹ waye).`;
}