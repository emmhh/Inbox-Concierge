import client from './client';
import type { Bucket } from '../types';

export async function listBuckets(): Promise<Bucket[]> {
  const { data } = await client.get<Bucket[]>('/buckets');
  return data;
}

export async function createBucket(bucket: {
  name: string;
  description?: string;
  examples?: string[];
}): Promise<Bucket> {
  const { data } = await client.post<Bucket>('/buckets', bucket);
  return data;
}

export async function updateBucket(
  id: number,
  updates: { name?: string; description?: string; examples?: string[] },
): Promise<Bucket> {
  const { data } = await client.put<Bucket>(`/buckets/${id}`, updates);
  return data;
}

export async function deleteBucket(id: number): Promise<void> {
  await client.delete(`/buckets/${id}`);
}
