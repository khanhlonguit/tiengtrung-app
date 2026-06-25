/**
 * useTTS - Web Speech API hook for Chinese TTS
 * Uses the browser's built-in SpeechSynthesis with zh-TW / zh-CN voice.
 */

let selectedVoice: SpeechSynthesisVoice | null = null;

function getChineseVoice(): SpeechSynthesisVoice | null {
  if (selectedVoice) return selectedVoice;
  const voices = window.speechSynthesis.getVoices();
  // Prefer zh-TW, then zh-CN, then any zh voice
  selectedVoice =
    voices.find(v => v.lang === 'zh-TW') ||
    voices.find(v => v.lang === 'zh-CN') ||
    voices.find(v => v.lang.startsWith('zh')) ||
    null;
  return selectedVoice;
}

export function speak(text: string, rate = 0.85) {
  if (typeof window === 'undefined' || !window.speechSynthesis) return;

  // Cancel any ongoing speech
  window.speechSynthesis.cancel();

  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = 'zh-TW';
  utter.rate = rate;
  utter.pitch = 1;

  const voice = getChineseVoice();
  if (voice) utter.voice = voice;

  window.speechSynthesis.speak(utter);
}

/** Call this once on app mount to pre-load voices */
export function initVoices() {
  if (typeof window === 'undefined' || !window.speechSynthesis) return;
  // Voices may load async
  window.speechSynthesis.onvoiceschanged = () => {
    selectedVoice = null; // reset so next speak() picks best voice
    getChineseVoice();
  };
  getChineseVoice();
}
