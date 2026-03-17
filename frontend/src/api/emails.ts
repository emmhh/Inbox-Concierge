import client, { API_BASE } from './client';
import type { Email, SSEEvent } from '../types';

export async function listEmails(bucketId?: number): Promise<Email[]> {
  const params = bucketId != null ? { bucket_id: bucketId } : {};
  const { data } = await client.get<Email[]>('/emails', { params });
  return data;
}

export async function reclassifySingleEmail(emailId: number): Promise<Email> {
  const { data } = await client.post<Email>(`/emails/${emailId}/reclassify`);
  return data;
}

export function streamClassification(
  endpoint: '/emails/fetch-and-classify' | '/emails/reclassify' | '/emails/batch-classify' | '/emails/fetch-and-batch-classify' | '/emails/sync-and-classify',
  onEvent: (event: SSEEvent) => void,
  onError: (err: Event) => void,
): () => void {
  const token = localStorage.getItem('token');
  const controller = new AbortController();

  (async () => {
    try {
      const response = await fetch(`${API_BASE}${endpoint}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
      });

      if (!response.ok || !response.body) {
        onError(new Event('error'));
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith('data:')) {
            const jsonStr = trimmed.slice(5).trim();
            if (jsonStr) {
              try {
                const parsed = JSON.parse(jsonStr);
                onEvent(parsed as SSEEvent);
              } catch {
                // skip malformed JSON
              }
            }
          }
        }
      }
    } catch (err) {
      if (!controller.signal.aborted) {
        onError(new Event('error'));
      }
    }
  })();

  return () => controller.abort();
}
