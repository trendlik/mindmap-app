import { useEffect, useRef } from 'react';
import styles from './KeyboardShortcutsModal.module.css';

interface Props {
  onClose: () => void;
}

const SHORTCUTS = [
  {
    group: 'Node Actions',
    items: [
      { keys: ['Tab'], description: 'Add child node' },
      { keys: ['Shift', 'Enter'], description: 'Add sibling node' },
      { keys: ['Delete'], description: 'Delete selected node' },
      { keys: ['L'], description: 'Create custom link' },
      { keys: ['Space'], description: 'Collapse / uncollapse node (requires children)' },
    ],
  },
  {
    group: 'Navigation',
    items: [
      { keys: ['↑', '↓', '←', '→'], description: 'Navigate between nodes' },
    ],
  },
  {
    group: 'Canvas',
    items: [
      { keys: ['⌘', 'F'], description: 'Search in map' },
      { keys: ['⌘', 'Z'], description: 'Undo' },
      { keys: ['⌘', '⇧', 'Z'], description: 'Redo' },
      { keys: ['Esc'], description: 'Close / deselect' },
      { keys: ['?'], description: 'Show shortcuts' },
      { keys: ['+'], description: 'Zoom in (or =)' },
      { keys: ['−'], description: 'Zoom out' },
      { keys: ['0'], description: 'Reset zoom to 100%' },
    ],
  },
];

export default function KeyboardShortcutsModal({ onClose }: Props) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const returnFocusRef = useRef<Element | null>(null);

  useEffect(() => {
    returnFocusRef.current = document.activeElement;
    closeRef.current?.focus();
    return () => {
      (returnFocusRef.current as HTMLElement | null)?.focus?.();
    };
  }, []);

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="shortcuts-title"
        onClick={e => e.stopPropagation()}
      >
        <div className={styles.header}>
          <span id="shortcuts-title" className={styles.title}>Keyboard Shortcuts</span>
          <button ref={closeRef} className={styles.close} onClick={onClose} aria-label="Close">×</button>
        </div>
        <div className={styles.body}>
          {SHORTCUTS.map(section => (
            <div key={section.group} className={styles.group}>
              <div className={styles.groupLabel}>{section.group}</div>
              {section.items.map(item => (
                <div key={item.description} className={styles.row}>
                  <div className={styles.keys}>
                    {item.keys.map((k, i) => (
                      <span key={i}>
                        <kbd className={styles.kbd}>{k}</kbd>
                        {i < item.keys.length - 1 && <span className={styles.plus}>+</span>}
                      </span>
                    ))}
                  </div>
                  <span className={styles.desc}>{item.description}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
