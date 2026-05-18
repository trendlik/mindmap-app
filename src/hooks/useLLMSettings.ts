import { useState, useCallback } from 'react';

const STORAGE_KEY = 'mindmap-llm-settings';

export interface LLMSettings {
  provider: 'claude' | 'openai';
  apiKey: string;
}

const DEFAULT_SETTINGS: LLMSettings = {
  provider: 'claude',
  apiKey: '',
};

function load(): LLMSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function useLLMSettings() {
  const [settings, setSettings] = useState<LLMSettings>(load);

  const saveSettings = useCallback((s: LLMSettings) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
    setSettings(s);
  }, []);

  return { settings, saveSettings };
}
