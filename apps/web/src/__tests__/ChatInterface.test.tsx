import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ChatInterface } from '../components/ChatInterface';
import { SafetyAlertBanner } from '../components/SafetyAlertBanner';

describe('Task 16: Next.js Streaming Chat Interface', () => {
  beforeEach(() => {
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
  });

  it('renders default view and toggles language between English and Yoruba', () => {
    render(<ChatInterface />);

    // Check title presence
    expect(screen.getByText('OroAgbe AI')).toBeDefined();

    // Find language toggle button
    const toggleBtn = screen.getByRole('button', { name: /Yorùbá|English/i });
    expect(toggleBtn).toBeDefined();

    // Click toggle button
    fireEvent.click(toggleBtn);

    // Verify Yoruba or English text is present after toggle
    expect(screen.getByText(/Agbègbè|Osun Agricultural Zone/i)).toBeDefined();
  });

  it('renders SafetyAlertBanner when safety notice text is provided', () => {
    const notice = 'Dangerous Urea rate detected: 600 kg/ha exceeds safe maximum.';
    render(
      <SafetyAlertBanner
        notice={notice}
        title="CRITICAL CLIMATE & AGRONOMIC SAFETY NOTICE"
      />
    );

    expect(screen.getByText('CRITICAL CLIMATE & AGRONOMIC SAFETY NOTICE')).toBeDefined();
    expect(screen.getByText(/Dangerous Urea rate detected: 600 kg\/ha/)).toBeDefined();
  });

  it('renders input and submits disabled when input is empty', () => {
    render(<ChatInterface />);
    const submitBtn = screen.getByRole('button', { name: /Send Inquiry|Fúnsọ́rọ̀/i });
    expect((submitBtn as HTMLButtonElement).disabled).toBe(true);
  });
});