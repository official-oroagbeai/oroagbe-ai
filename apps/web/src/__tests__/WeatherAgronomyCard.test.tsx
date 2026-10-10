// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { WeatherAgronomyCard } from '../components/WeatherAgronomyCard';

describe('Task 17: WeatherAgronomyCard UI Component', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders telemetry and agronomic indices after mock fetch', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        locationId: 'osogbo',
        current: {
          temperature: 28,
          relativeHumidity: 60,
          precipitation: 0,
          windSpeed: 7,
          weatherCode: 1
        },
        hourly: {
          precipitationProbability: [10]
        },
        daily: {
          precipitationSum: [0]
        }
      })
    } as Response);

    render(
      <WeatherAgronomyCard
        locationId="osogbo"
        locationName="Òṣogbo"
        lang="yo"
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Òṣogbo')).toBeDefined();
      expect(screen.getByText('28°C')).toBeDefined();
      expect(screen.getByText('Fífún Oògùn')).toBeDefined();
      expect(screen.getByText('Lílò Ajílẹ̀')).toBeDefined();
    });
  });

  it('renders fallback gracefully on network failure', async () => {
    global.fetch = vi.fn().mockRejectedValueOnce(new Error('Network offline'));

    render(
      <WeatherAgronomyCard
        locationId="ile-ife"
        locationName="Ile-Ife"
        lang="en"
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Ile-Ife')).toBeDefined();
      // Match substring with regex to account for the surrounding parentheses
      expect(screen.getByText(/Using cached regional baseline/i)).toBeDefined();
      expect(screen.getByText('Spray Window')).toBeDefined();
      expect(screen.getByText('Fertilizer Timing')).toBeDefined();
    });
  });
});