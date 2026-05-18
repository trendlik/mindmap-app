import { useEffect, useRef, useState } from 'react';
import { useLLMSettings } from '../hooks/useLLMSettings';
import type { LLMSettings } from '../hooks/useLLMSettings';
import styles from './SettingsPanel.module.css';

interface Props {
  onClose: () => void;
}

export default function SettingsPanel({ onClose }: Props) {
  const { settings, saveSettings } = useLLMSettings();
  const [form, setForm] = useState<LLMSettings>(settings);
  const closeRef = useRef<HTMLButtonElement>(null);
  const returnFocusRef = useRef<Element | null>(null);

  useEffect(() => {
    returnFocusRef.current = document.activeElement;
    closeRef.current?.focus();
    return () => {
      (returnFocusRef.current as HTMLElement | null)?.focus?.();
    };
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  function handleSave() {
    saveSettings(form);
    onClose();
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
        onClick={e => e.stopPropagation()}
      >
        <div className={styles.header}>
          <span id="settings-title" className={styles.title}>LLM Settings</span>
          <button ref={closeRef} className={styles.close} onClick={onClose} aria-label="Close">×</button>
        </div>
        <div className={styles.body}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="llm-provider">Provider</label>
            <select
              id="llm-provider"
              className={styles.select}
              value={form.provider}
              onChange={e => setForm(f => ({ ...f, provider: e.target.value as LLMSettings['provider'] }))}
            >
              <option value="claude">Claude (Anthropic)</option>
              <option value="openai">OpenAI</option>
            </select>
          </div>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="llm-apikey">API Key</label>
            <input
              id="llm-apikey"
              className={styles.input}
              type="password"
              value={form.apiKey}
              onChange={e => setForm(f => ({ ...f, apiKey: e.target.value }))}
              placeholder="Paste your API key…"
              autoComplete="off"
            />
          </div>
        </div>
        <div className={styles.footer}>
          <button className={styles.cancelBtn} onClick={onClose}>Cancel</button>
          <button className={styles.saveBtn} onClick={handleSave}>Save</button>
        </div>
      </div>
    </div>
  );
}
