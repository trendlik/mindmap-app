import {
  collection,
  doc,
  onSnapshot,
  setDoc,
  deleteDoc,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '../firebase';
import type { MindMap } from './useMindMapStore';
import { logger } from '../utils/logger';

type MapsRecord = Record<string, MindMap>;

function mapsCollection(uid: string) {
  return collection(db, 'users', uid, 'maps');
}

const isTestMode = () => !!window.__PLAYWRIGHT_TEST_USER__;

export function subscribeToMaps(
  uid: string,
  callback: (maps: MapsRecord) => void,
): Unsubscribe {
  if (isTestMode()) return () => {};
  return onSnapshot(mapsCollection(uid), (snapshot) => {
    const maps: MapsRecord = {};
    snapshot.forEach((d) => {
      const data = d.data() as MindMap;
      maps[d.id] = data;
    });
    callback(maps);
  }, (err) => {
    logger.logError('firestore_snapshot_error', err);
  });
}

export async function saveMapToFirestore(uid: string, map: MindMap): Promise<void> {
  if (isTestMode()) return;
  const ref = doc(db, 'users', uid, 'maps', map.id);
  await setDoc(ref, map).catch((err) => {
    logger.logError('firestore_save_failed', err, { mapId: map.id });
    throw err;
  });
}

export async function deleteMapFromFirestore(uid: string, mapId: string): Promise<void> {
  if (isTestMode()) return;
  const ref = doc(db, 'users', uid, 'maps', mapId);
  await deleteDoc(ref).catch((err) => {
    logger.logError('firestore_delete_failed', err, { mapId });
    throw err;
  });
}

export async function saveAllMapsToFirestore(uid: string, maps: MapsRecord): Promise<void> {
  if (isTestMode()) return;
  const promises = Object.values(maps).map((m) => saveMapToFirestore(uid, m));
  await Promise.all(promises);
}
