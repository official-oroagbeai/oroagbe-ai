"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
(0, vitest_1.describe)('Shared Type Definitions', () => {
    (0, vitest_1.it)('should validate a complete ChatMessage structure', () => {
        const mockVerification = {
            passed: true,
            hallucinations_detected: []
        };
        const mockMessage = {
            id: '123',
            role: 'user',
            text: 'Bawo ni oju ojo se ri loni?',
            locationId: 'loc-456',
            timestamp: new Date().toISOString(),
            verification: mockVerification
        };
        (0, vitest_1.expect)(mockMessage.role).toBe('user');
        (0, vitest_1.expect)(mockMessage.verification?.passed).toBe(true);
    });
});
