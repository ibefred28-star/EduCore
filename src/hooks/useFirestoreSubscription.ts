import { useEffect, useRef, useState } from 'react';
import {
  Query,
  DocumentReference,
  onSnapshot,
  QuerySnapshot,
  DocumentSnapshot,
  FirestoreError,
  SnapshotOptions
} from 'firebase/firestore';

export interface UseFirestoreSubscriptionOptions {
  /**
   * Whether to include metadata changes (such as fromCache / hasPendingWrites)
   * Defaults to false to minimize unnecessary re-renders
   */
  includeMetadataChanges?: boolean;
  /**
   * If true, subscription will not attach until enabled becomes true
   */
  enabled?: boolean;
  /**
   * Custom error handler callback
   */
  onError?: (error: FirestoreError) => void;
}

export interface UseFirestoreSubscriptionResult<T> {
  data: T | null;
  loading: boolean;
  error: FirestoreError | null;
}

/**
 * Reusable React hook that accepts a Firestore Query or DocumentReference and callback,
 * establishing a live Firestore onSnapshot listener that automatically unsubscribes on unmount.
 *
 * @param target Query or DocumentReference (or null/undefined to idle)
 * @param onUpdate Callback receiving the snapshot data or snapshot itself
 * @param options Subscription configuration (enabled, onError, includeMetadataChanges)
 * @returns Cleanup unsubscribe function or unsubscribe reference
 */
export function useFirestoreSubscription<T = any>(
  target: Query | DocumentReference | null | undefined,
  onUpdate: (snapshot: any) => void,
  options: UseFirestoreSubscriptionOptions = {}
): () => void {
  const { enabled = true, includeMetadataChanges = false, onError } = options;
  const onUpdateRef = useRef(onUpdate);
  onUpdateRef.current = onUpdate;
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  const unsubscribeRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    // Teardown any existing listener before attaching a new one
    if (unsubscribeRef.current) {
      unsubscribeRef.current();
      unsubscribeRef.current = null;
    }

    if (!target || !enabled) {
      return;
    }

    try {
      const snapshotOptions = { includeMetadataChanges };
      const unsub = onSnapshot(
        target as any,
        snapshotOptions,
        (snapshot: QuerySnapshot | DocumentSnapshot) => {
          if (onUpdateRef.current) {
            onUpdateRef.current(snapshot);
          }
        },
        (error: FirestoreError) => {
          if (onErrorRef.current) {
            onErrorRef.current(error);
          } else {
            console.warn('useFirestoreSubscription listener error:', error);
          }
        }
      );

      unsubscribeRef.current = unsub;
    } catch (err: any) {
      console.warn('Failed to subscribe to Firestore query/doc:', err);
    }

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    };
  }, [target, enabled, includeMetadataChanges]);

  // Return a stable cleanup function
  return () => {
    if (unsubscribeRef.current) {
      unsubscribeRef.current();
      unsubscribeRef.current = null;
    }
  };
}

/**
 * State-managing helper hook that wraps useFirestoreSubscription and directly returns
 * typed document or collection data, loading state, and error.
 */
export function useFirestoreQueryData<T = any>(
  queryOrRef: Query | null | undefined,
  options: UseFirestoreSubscriptionOptions = {}
): UseFirestoreSubscriptionResult<T[]> {
  const [data, setData] = useState<T[] | null>(null);
  const [loading, setLoading] = useState<boolean>(options.enabled !== false && !!queryOrRef);
  const [error, setError] = useState<FirestoreError | null>(null);

  useFirestoreSubscription(
    queryOrRef,
    (snapshot: QuerySnapshot) => {
      const items: T[] = [];
      snapshot.forEach(docSnap => {
        items.push({ id: docSnap.id, ...docSnap.data() } as unknown as T);
      });
      setData(items);
      setLoading(false);
      setError(null);
    },
    {
      ...options,
      onError: (err) => {
        setError(err);
        setLoading(false);
        if (options.onError) options.onError(err);
      }
    }
  );

  return { data, loading, error };
}

/**
 * State-managing helper hook that wraps useFirestoreSubscription for a single DocumentReference.
 */
export function useFirestoreDocData<T = any>(
  docRef: DocumentReference | null | undefined,
  options: UseFirestoreSubscriptionOptions = {}
): UseFirestoreSubscriptionResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState<boolean>(options.enabled !== false && !!docRef);
  const [error, setError] = useState<FirestoreError | null>(null);

  useFirestoreSubscription(
    docRef,
    (snapshot: DocumentSnapshot) => {
      if (snapshot.exists()) {
        setData({ id: snapshot.id, ...snapshot.data() } as unknown as T);
      } else {
        setData(null);
      }
      setLoading(false);
      setError(null);
    },
    {
      ...options,
      onError: (err) => {
        setError(err);
        setLoading(false);
        if (options.onError) options.onError(err);
      }
    }
  );

  return { data, loading, error };
}
