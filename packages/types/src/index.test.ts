import { describe, it, expect } from 'vitest';
import { Location, WeatherPayload, ChatMessage, VerificationResult } from './index';

describe('Shared Type Definitions', () => {
  it('should validate a complete ChatMessage structure', () => {
    const mockVerification: VerificationResult = {
      passed: true,
      hallucinations_detected: []
    };

    const mockMessage: ChatMessage = {
      id: '123',
      role: 'user',
      text: 'Bawo ni oju ojo se ri loni?',
      locationId: 'loc-456',
      timestamp: new Date().toISOString(),
      verification: mockVerification
    };

    expect(mockMessage.role).toBe('user');
    expect(mockMessage.verification?.passed).toBe(true);
  });
});