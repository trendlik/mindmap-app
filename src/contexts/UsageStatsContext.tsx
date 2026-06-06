import { createContext, useContext, useEffect, useRef, useCallback } from 'react';
import { loadUsageStats, saveUsageStats } from '../store/usageStatsSync';
import { logger } from '../utils/logger';
import { saveLogBatch } from '../store/logSync';

export type FeatureKey =
  | 'addChild' | 'addSibling' | 'deleteNode' | 'autoLayout' | 'fitView'
  | 'exportJson' | 'exportSvg' | 'exportMd' | 'createMap' | 'renameMap' | 'deleteMap'
  | 'switchMap' | 'archiveMap' | 'search' | 'nodeDrag' | 'nodeInlineEdit'
  | 'pan' | 'zoom' | 'undo' | 'redo' | 'addLink' | 'reparent'
  | 'toggleNotes' | 'collapseNode' | 'searchInMap' | 'aiChat' | 'llmSettings'
  | 'notesIndent' | 'notesOutdent' | 'aiChatCopy' | 'toggleNumbering' | 'notesPanelResize'
  | 'map_description_edit' | 'copyNodeLink' | 'nodeLineBreak';

export interface FeatureStat {
  count: number;
  lastUsed: string;
}

export interface UsageStats {
  totalActiveMs: number;
  features: Partial<Record<FeatureKey, FeatureStat>>;
  createdAt: string;
}

interface UsageStatsContextValue {
  trackEvent: (feature: FeatureKey) => void;
  getStats: () => UsageStats;
  resetStats: () => void;
}

const UsageStatsContext = createContext<UsageStatsContextValue>({
  trackEvent: () => {},
  getStats: () => emptyStats(),
  resetStats: () => {},
});

export function useUsageStats() {
  return useContext(UsageStatsContext);
}

const HIGH_FREQ: Set<FeatureKey> = new Set(['pan', 'zoom', 'nodeDrag']);
const DEBOUNCE_MS = 500;
const FIRESTORE_DEBOUNCE_MS = 2000;

export function emptyStats(): UsageStats {
  return { totalActiveMs: 0, features: {}, createdAt: new Date().toISOString() };
}

function localKey(uid: string) {
  return `usage_${uid}`;
}

export function UsageStatsProvider({ uid, children }: { uid: string | null; children: React.ReactNode }) {
  const statsRef = useRef<UsageStats>(emptyStats());
  const pendingHighFreq = useRef<Partial<Record<FeatureKey, ReturnType<typeof setTimeout>>>>({});
  const firestoreTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const visibilityStartRef = useRef<number | null>(null);
  const uidRef = useRef(uid);
  uidRef.current = uid;

  const flushToFirestore = useCallback(() => {
    const currentUid = uidRef.current;
    if (!currentUid) return;
    const stats = statsRef.current;
    localStorage.setItem(localKey(currentUid), JSON.stringify(stats));
    saveUsageStats(currentUid, stats).catch((err) => logger.logError('usage_stats_save_failed', err));
  }, []);

  const scheduleFirestoreFlush = useCallback(() => {
    if (firestoreTimer.current) clearTimeout(firestoreTimer.current);
    firestoreTimer.current = setTimeout(flushToFirestore, FIRESTORE_DEBOUNCE_MS);
  }, [flushToFirestore]);

  const trackEvent = useCallback((feature: FeatureKey) => {
    if (HIGH_FREQ.has(feature)) {
      if (pendingHighFreq.current[feature]) return;
      pendingHighFreq.current[feature] = setTimeout(() => {
        delete pendingHighFreq.current[feature];
      }, DEBOUNCE_MS);
    }
    const stats = statsRef.current;
    const existing = stats.features[feature];
    stats.features[feature] = {
      count: (existing?.count ?? 0) + 1,
      lastUsed: new Date().toISOString(),
    };
    scheduleFirestoreFlush();
  }, [scheduleFirestoreFlush]);

  const getStats = useCallback((): UsageStats => {
    return statsRef.current;
  }, []);

  const resetStats = useCallback(() => {
    statsRef.current = emptyStats();
    flushToFirestore();
  }, [flushToFirestore]);

  useEffect(() => {
    if (!uid) return;

    const stored = localStorage.getItem(localKey(uid));
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as UsageStats;
        if (!parsed.createdAt) {
          const dates = Object.values(parsed.features ?? {})
            .map(f => f?.lastUsed)
            .filter((d): d is string => !!d);
          parsed.createdAt = dates.length > 0
            ? dates.reduce((a, b) => (a < b ? a : b))
            : new Date().toISOString();
        }
        statsRef.current = parsed;
      } catch {
        statsRef.current = emptyStats();
      }
    }

    loadUsageStats(uid).then(remote => {
      if (remote) {
        const local = statsRef.current;

        const remoteCreatedAt = remote.createdAt
          ?? (() => {
            const dates = Object.values(remote.features)
              .map(f => f?.lastUsed)
              .filter((d): d is string => !!d);
            return dates.length > 0 ? dates.reduce((a, b) => (a < b ? a : b)) : new Date().toISOString();
          })();
        const localCreatedAt = local.createdAt;
        const mergedCreatedAt = remoteCreatedAt < localCreatedAt ? remoteCreatedAt : localCreatedAt;

        const merged: UsageStats = {
          totalActiveMs: Math.max(remote.totalActiveMs, local.totalActiveMs),
          features: { ...remote.features },
          createdAt: mergedCreatedAt,
        };
        for (const key of Object.keys(local.features) as FeatureKey[]) {
          const lf = local.features[key]!;
          const rf = remote.features[key];
          if (!rf) {
            merged.features[key] = lf;
          } else {
            merged.features[key] = {
              count: Math.max(lf.count, rf.count),
              lastUsed: lf.lastUsed > rf.lastUsed ? lf.lastUsed : rf.lastUsed,
            };
          }
        }
        statsRef.current = merged;
        localStorage.setItem(localKey(uid), JSON.stringify(merged));
        scheduleFirestoreFlush();
      }
    }).catch((err) => logger.logError('usage_stats_load_failed', err));

    if (document.visibilityState === 'visible') {
      visibilityStartRef.current = Date.now();
    }

    function onVisibilityChange() {
      if (document.visibilityState === 'visible') {
        visibilityStartRef.current = Date.now();
      } else {
        if (visibilityStartRef.current !== null) {
          statsRef.current.totalActiveMs += Date.now() - visibilityStartRef.current;
          visibilityStartRef.current = null;
          flushToFirestore();
        }
      }
    }

    function onBeforeUnload() {
      if (visibilityStartRef.current !== null) {
        statsRef.current.totalActiveMs += Date.now() - visibilityStartRef.current;
        visibilityStartRef.current = null;
      }
      flushToFirestore();
      const entries = logger.getUnsyncedEntries();
      if (entries.length > 0) {
        saveLogBatch(uid!, entries);
      }
    }

    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('beforeunload', onBeforeUnload);

    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('beforeunload', onBeforeUnload);
      if (visibilityStartRef.current !== null) {
        statsRef.current.totalActiveMs += Date.now() - visibilityStartRef.current;
        visibilityStartRef.current = null;
      }
      Object.values(pendingHighFreq.current).forEach(t => clearTimeout(t));
      pendingHighFreq.current = {} as Record<FeatureKey, ReturnType<typeof setTimeout>>;
      if (firestoreTimer.current) clearTimeout(firestoreTimer.current);
      flushToFirestore();
    };
  }, [uid, scheduleFirestoreFlush, flushToFirestore]);

  useEffect(() => {
    if (!uid) return;
    const interval = setInterval(() => {
      const entries = logger.getUnsyncedEntries();
      if (entries.length > 0) {
        saveLogBatch(uid, entries)
          .then(() => logger.markAllSynced())
          .catch((err) => logger.logError('log_sync_failed', err));
      }
    }, 60_000);
    return () => clearInterval(interval);
  }, [uid]);

  return (
    <UsageStatsContext.Provider value={{ trackEvent, getStats, resetStats }}>
      {children}
    </UsageStatsContext.Provider>
  );
}
