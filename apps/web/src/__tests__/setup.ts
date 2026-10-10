import '@testing-library/jest-dom';

// Mock scrollIntoView for chat message auto-scroll
window.HTMLElement.prototype.scrollIntoView = function () {};

// Mock SpeechSynthesis API
Object.defineProperty(window, 'speechSynthesis', {
  value: {
    speak: () => {},
    cancel: () => {},
    pause: () => {},
    resume: () => {},
    getVoices: () => []
  },
  writable: true
});