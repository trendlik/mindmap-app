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

type MapsRecord = Record<string, MindMap>;

function mapsCollection(uid: string) {
  return collection(db, 'users', uid, 'maps');
}

export function subscribeToMaps(
  uid: string,
  callback: (maps: MapsRecord) => void,
): Unsubscribe {
  return onSnapshot(mapsCollection(uid), (snapshot) => {
    const maps: MapsRecord = {};
    snapshot.forEach((d) => {
      const data = d.data() as MindMap;
      maps[d.id] = data;
    });
    callback(maps);
  });
}

export async function saveMapToFirestore(uid: string, map: MindMap): Promise<void> {
  const ref = doc(db, 'users', uid, 'maps', map.id);
  await setDoc(ref, map);
}

export async function deleteMapFromFirestore(uid: string, mapId: string): Promise<void> {
  const ref = doc(db, 'users', uid, 'maps', mapId);
  await deleteDoc(ref);
}

export async function saveAllMapsToFirestore(uid: string, maps: MapsRecord): Promise<void> {
  const promises = Object.values(maps).map((m) => saveMapToFirestore(uid, m));
  await Promise.all(promises);
}
