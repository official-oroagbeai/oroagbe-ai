/**
 * Simulates a call to an LLM (like Ollama or Llama 3) for the MVP.
 * We will replace this with a real fetch to our Python service later.
 */
export async function generateDraftResponse(userMessage, weatherData, ragContext) {
  console.log(`[LLM] Drafting response for: "${userMessage}"`);
  
  // Extracting safe data to include in the draft
  const temp = weatherData?.current?.temperature_2m || "aimọ";
  const rain = weatherData?.current?.precipitation || "aimọ";
  
  // We are hardcoding a simulated LLM response in Yoruba here.
  // Notice it includes the EXACT numbers from the weather data, so it passes verification.
  const draftAnswer = `Oju-ọjọ lode oni jẹ ${temp}°C, ati pe oṣuwọn ojo jẹ ${rain}mm. Gẹgẹ bi a ti mọ, ma gbin agbado titi ojo yoo fi ro daadaa. Nitorina, ẹ ni suuru diẹ sii.`;
  
  return draftAnswer;
}