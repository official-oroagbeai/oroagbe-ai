import { z } from 'zod';

export const weatherPayloadSchema = z.object({
  temperature: z.number().describe('Temperature in degrees Celsius'),
  relativeHumidity: z.number().min(0).max(100).describe('Relative humidity percentage'),
  precipitationProbability: z.number().min(0).max(100).describe('Precipitation probability percentage'),
  windSpeed: z.number().min(0).describe('Wind speed in km/h'),
  fetchedAt: z.string().datetime().describe('ISO timestamp of the fetch'),
  source: z.enum(['open-meteo', 'nasa-power']).describe('Data provider source')
});

export type WeatherPayload = z.infer<typeof weatherPayloadSchema>;