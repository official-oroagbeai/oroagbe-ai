export interface Location {
    id: string;
    name_yo: string;
    lat: number;
    lon: number;
}
export interface WeatherPayload {
    temperature: number;
    humidity: number;
    precipitation_chance: number;
    forecast_date: string;
}
export interface VerificationResult {
    passed: boolean;
    hallucinations_detected: string[];
    safe_response?: string;
}
export interface ChatMessage {
    id: string;
    role: 'user' | 'assistant';
    text: string;
    locationId: string;
    timestamp: string;
    verification?: VerificationResult;
}
