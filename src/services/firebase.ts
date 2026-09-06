import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { 
  getFirestore, 
  doc, 
  getDocFromServer, 
  setDoc, 
  updateDoc, 
  collection, 
  getDocs, 
  onSnapshot, 
  query, 
  orderBy, 
  limit,
  writeBatch
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { NFT, NFTCollection, TransactionRecord, RoyaltyPayoutRecord, BridgeTransaction } from '../types';

// Initialize Firebase App
const app = initializeApp(firebaseConfig);

// CRITICAL: Initialize Firestore with firestoreDatabaseId from firebase-applet-config.json
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const FIRESTORE_REGION = 'us-east1';
export const FIRESTORE_DB_ID = firebaseConfig.firestoreDatabaseId;

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Connection test on boot
export async function testConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('Firestore: the client is offline or still connecting.');
      return false;
    }
    // Non-existent document is a successful connection test
    return true;
  }
}

// Utility to clean undefined values before saving to Firestore
function sanitizePayload<T>(obj: T): T {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizePayload(item)) as unknown as T;
  }
  if (typeof obj === 'object') {
    const cleaned: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      if (value !== undefined) {
        cleaned[key] = sanitizePayload(value);
      }
    }
    return cleaned as T;
  }
  return obj;
}

// Firestore operations for NFTs
export async function saveNftToFirestore(nft: NFT): Promise<void> {
  const path = `nfts/${nft.id}`;
  try {
    const data = sanitizePayload(nft);
    await setDoc(doc(db, 'nfts', nft.id), data, { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function updateNftInFirestore(nftId: string, updates: Partial<NFT>): Promise<void> {
  const path = `nfts/${nftId}`;
  try {
    const data = sanitizePayload(updates);
    await updateDoc(doc(db, 'nfts', nftId), data);
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

// Firestore operations for Collections
export async function saveCollectionToFirestore(collectionItem: NFTCollection): Promise<void> {
  const path = `collections/${collectionItem.id}`;
  try {
    const data = sanitizePayload(collectionItem);
    await setDoc(doc(db, 'collections', collectionItem.id), data, { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function updateCollectionInFirestore(collectionId: string, updates: Partial<NFTCollection>): Promise<void> {
  const path = `collections/${collectionId}`;
  try {
    const data = sanitizePayload(updates);
    await updateDoc(doc(db, 'collections', collectionId), data);
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

// Firestore operations for Transactions
export async function saveTransactionToFirestore(tx: TransactionRecord): Promise<void> {
  const path = `transactions/${tx.id}`;
  try {
    const data = sanitizePayload(tx);
    await setDoc(doc(db, 'transactions', tx.id), data);
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
  }
}

// Firestore operations for Royalty logs
export async function saveRoyaltyToFirestore(royalty: RoyaltyPayoutRecord): Promise<void> {
  const path = `royalties/${royalty.id}`;
  try {
    const data = sanitizePayload(royalty);
    await setDoc(doc(db, 'royalties', royalty.id), data);
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
  }
}

// Firestore operations for Bridge transactions
export async function saveBridgeTxToFirestore(bridgeTx: BridgeTransaction): Promise<void> {
  const path = `bridge_transactions/${bridgeTx.id}`;
  try {
    const data = sanitizePayload(bridgeTx);
    await setDoc(doc(db, 'bridge_transactions', bridgeTx.id), data, { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

// Seed initial documents if Firestore collections are empty
export async function seedInitialFirestoreData(
  initialNfts: NFT[], 
  initialCollections: NFTCollection[],
  initialTransactions: TransactionRecord[],
  initialRoyalties: RoyaltyPayoutRecord[],
  initialBridgeTxs: BridgeTransaction[]
): Promise<void> {
  try {
    const nftsSnapshot = await getDocs(query(collection(db, 'nfts'), limit(1)));
    if (nftsSnapshot.empty && initialNfts.length > 0) {
      console.log('Seeding initial NFTs to Firestore...');
      const batch = writeBatch(db);
      for (const item of initialNfts) {
        const ref = doc(db, 'nfts', item.id);
        batch.set(ref, sanitizePayload(item));
      }
      await batch.commit();
    }

    const colSnapshot = await getDocs(query(collection(db, 'collections'), limit(1)));
    if (colSnapshot.empty && initialCollections.length > 0) {
      console.log('Seeding initial Collections to Firestore...');
      const batch = writeBatch(db);
      for (const item of initialCollections) {
        const ref = doc(db, 'collections', item.id);
        batch.set(ref, sanitizePayload(item));
      }
      await batch.commit();
    }

    const txSnapshot = await getDocs(query(collection(db, 'transactions'), limit(1)));
    if (txSnapshot.empty && initialTransactions.length > 0) {
      console.log('Seeding initial Transactions to Firestore...');
      const batch = writeBatch(db);
      for (const item of initialTransactions) {
        const ref = doc(db, 'transactions', item.id);
        batch.set(ref, sanitizePayload(item));
      }
      await batch.commit();
    }

    const roySnapshot = await getDocs(query(collection(db, 'royalties'), limit(1)));
    if (roySnapshot.empty && initialRoyalties.length > 0) {
      console.log('Seeding initial Royalties to Firestore...');
      const batch = writeBatch(db);
      for (const item of initialRoyalties) {
        const ref = doc(db, 'royalties', item.id);
        batch.set(ref, sanitizePayload(item));
      }
      await batch.commit();
    }

    const bridgeSnapshot = await getDocs(query(collection(db, 'bridge_transactions'), limit(1)));
    if (bridgeSnapshot.empty && initialBridgeTxs.length > 0) {
      console.log('Seeding initial Bridge Transactions to Firestore...');
      const batch = writeBatch(db);
      for (const item of initialBridgeTxs) {
        const ref = doc(db, 'bridge_transactions', item.id);
        batch.set(ref, sanitizePayload(item));
      }
      await batch.commit();
    }
  } catch (error) {
    console.warn('Initial Firestore seed skipped or deferred:', error);
  }
}

// Subscriptions with handleFirestoreError callbacks
export function subscribeNfts(onData: (nfts: NFT[]) => void): () => void {
  const path = 'nfts';
  return onSnapshot(
    collection(db, path),
    (snapshot) => {
      const items: NFT[] = [];
      snapshot.forEach(docSnap => {
        items.push(docSnap.data() as NFT);
      });
      if (items.length > 0) {
        onData(items);
      }
    },
    (err) => {
      handleFirestoreError(err, OperationType.GET, path);
    }
  );
}

export function subscribeCollections(onData: (cols: NFTCollection[]) => void): () => void {
  const path = 'collections';
  return onSnapshot(
    collection(db, path),
    (snapshot) => {
      const items: NFTCollection[] = [];
      snapshot.forEach(docSnap => {
        items.push(docSnap.data() as NFTCollection);
      });
      if (items.length > 0) {
        onData(items);
      }
    },
    (err) => {
      handleFirestoreError(err, OperationType.GET, path);
    }
  );
}

export function subscribeTransactions(onData: (txs: TransactionRecord[]) => void): () => void {
  const path = 'transactions';
  return onSnapshot(
    collection(db, path),
    (snapshot) => {
      const items: TransactionRecord[] = [];
      snapshot.forEach(docSnap => {
        items.push(docSnap.data() as TransactionRecord);
      });
      if (items.length > 0) {
        items.sort((a, b) => b.timestamp - a.timestamp);
        onData(items);
      }
    },
    (err) => {
      handleFirestoreError(err, OperationType.GET, path);
    }
  );
}

export function subscribeRoyalties(onData: (royalties: RoyaltyPayoutRecord[]) => void): () => void {
  const path = 'royalties';
  return onSnapshot(
    collection(db, path),
    (snapshot) => {
      const items: RoyaltyPayoutRecord[] = [];
      snapshot.forEach(docSnap => {
        items.push(docSnap.data() as RoyaltyPayoutRecord);
      });
      if (items.length > 0) {
        items.sort((a, b) => b.timestamp - a.timestamp);
        onData(items);
      }
    },
    (err) => {
      handleFirestoreError(err, OperationType.GET, path);
    }
  );
}

export function subscribeBridgeTransactions(onData: (bridgeTxs: BridgeTransaction[]) => void): () => void {
  const path = 'bridge_transactions';
  return onSnapshot(
    collection(db, path),
    (snapshot) => {
      const items: BridgeTransaction[] = [];
      snapshot.forEach(docSnap => {
        items.push(docSnap.data() as BridgeTransaction);
      });
      if (items.length > 0) {
        items.sort((a, b) => b.timestamp - a.timestamp);
        onData(items);
      }
    },
    (err) => {
      handleFirestoreError(err, OperationType.GET, path);
    }
  );
}
