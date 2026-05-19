import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import type { LogEntry } from '../utils/logger';

const isTestMode = () => !!(window as unknown as Record<string, unknown>).__PLAYWRIGHT_TEST_USER__;

export async function saveErrorLog(uid: string, entries: LogEntry[]): Promise<void> {
  if (isTestMode()) return;
  const capped = entries.slice(-50);
  const ref = doc(db, 'users', uid, 'meta', 'errorLog');
  await setDoc(ref, { entries: capped, updatedAt: serverTimestamp() }, { merge: true });
}
