import { useCallback, useState } from 'react';
import * as bucketsApi from '../api/buckets';
import type { Bucket } from '../types';

export function useBuckets() {
  const [buckets, setBuckets] = useState<Bucket[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchBuckets = useCallback(async () => {
    setLoading(true);
    try {
      const data = await bucketsApi.listBuckets();
      setBuckets(data);
    } finally {
      setLoading(false);
    }
  }, []);

  const addBucket = useCallback(
    async (name: string, description = '', examples: string[] = []) => {
      const bucket = await bucketsApi.createBucket({ name, description, examples });
      setBuckets((prev) => [...prev, bucket]);
      return bucket;
    },
    [],
  );

  const editBucket = useCallback(
    async (id: number, updates: { name?: string; description?: string; examples?: string[] }) => {
      const updated = await bucketsApi.updateBucket(id, updates);
      setBuckets((prev) => prev.map((b) => (b.id === id ? { ...updated, email_count: b.email_count } : b)));
    },
    [],
  );

  const removeBucket = useCallback(async (id: number) => {
    await bucketsApi.deleteBucket(id);
    setBuckets((prev) => prev.filter((b) => b.id !== id));
  }, []);

  return { buckets, loading, fetchBuckets, addBucket, editBucket, removeBucket };
}
