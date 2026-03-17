import client from './client';
import type { Feedback } from '../types';

export async function submitFeedback(feedback: {
  email_id: number;
  bucket_id: number;
  is_positive: boolean;
  correct_bucket_ids?: number[];
  reason?: string;
}): Promise<Feedback> {
  const { data } = await client.post<Feedback>('/feedback', feedback);
  return data;
}

export async function updatePreferences(importance_context: string): Promise<void> {
  await client.put('/preferences', { importance_context });
}

export async function getPreferences(): Promise<{ importance_context: string | null }> {
  const { data } = await client.get('/preferences');
  return data;
}
