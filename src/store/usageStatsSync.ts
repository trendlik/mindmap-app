import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import type { UsageStats } from '../contexts/UsageStatsContext';
import { logger } from '../utils/logger';

const isTestMode = () => !!window.__PLAYWRIGHT_TEST_USER__;

export async function loadUsageStats(uid: string): Promise<UsageStats | null> {
  if (isTestMode()) return null;
  const ref = doc(db, 'users', uid, 'meta', 'usage');
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return snap.data() as UsageStats;
}

export async function saveUsageStats(uid: string, stats: UsageStats): Promise<void> {
  if (isTestMode()) return;
  const ref = doc(db, 'users', uid, 'meta', 'usage');
  await setDoc(ref, stats);
}
