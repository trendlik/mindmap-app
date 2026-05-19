import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import type { LogEntry } from '../utils/logger';

const isTestMode = () => !!(window as unknown as Record<string, unknown>).__PLAYWRIGHT_TEST_USER__;

export async function saveLogBatch(uid: string, entries: LogEntry[]): Promise<void> {
  if (isTestMode()) return;
  const col = collection(db, 'users', uid, 'logs');
  await addDoc(col, { entries, syncedAt: serverTimestamp() });
}
