import { useCallback, useState } from 'react';
import { listEmails, reclassifySingleEmail, streamClassification } from '../api/emails';
import type { Email, SSEEvent } from '../types';

export function useEmails() {
  const [emails, setEmails] = useState<Email[]>([]);
  const [loading, setLoading] = useState(false);
  const [classifying, setClassifying] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [summary, setSummary] = useState<{ classified: number; failed: number; total: number } | null>(null);

  const fetchEmails = useCallback(async (bucketId?: number) => {
    setLoading(true);
    try {
      const data = await listEmails(bucketId);
      setEmails(data);
    } finally {
      setLoading(false);
    }
  }, []);

  const startClassification = useCallback(
    (
      endpoint: '/emails/fetch-and-classify' | '/emails/reclassify' | '/emails/batch-classify' | '/emails/fetch-and-batch-classify' | '/emails/sync-and-classify',
      keepExisting = false,
    ) => {
      setClassifying(true);
      setProgress({ current: 0, total: 0 });
      setSummary(null);
      if (!keepExisting) {
        setEmails([]);
      }

      const cancel = streamClassification(
        endpoint,
        (event: SSEEvent) => {
          if (event.event === 'classified') {
            const d = event.data;
            setEmails((prev) => {
              const existing = prev.find((e) => e.id === d.email_id);
              if (existing) {
                return prev.map((e) =>
                  e.id === d.email_id
                    ? { ...e, bucket_ids: d.bucket_ids, bucket_names: d.bucket_names }
                    : e,
                );
              }
              return [
                ...prev,
                {
                  id: d.email_id,
                  thread_id: d.thread_id,
                  subject: d.subject,
                  sender: d.sender,
                  snippet: d.snippet,
                  date: d.date,
                  bucket_ids: d.bucket_ids,
                  bucket_names: d.bucket_names,
                },
              ];
            });
            setProgress({ current: d.progress, total: d.total });
          } else if (event.event === 'error') {
            setProgress({ current: event.data.progress, total: event.data.total });
          } else if (event.event === 'done') {
            if (!event.data.skipped) {
              setSummary(event.data);
            }
            setClassifying(false);
          }
        },
        () => {
          setClassifying(false);
        },
      );

      return cancel;
    },
    [],
  );

  const removeBucketFromEmail = useCallback((emailId: number, bucketId: number) => {
    setEmails((prev) =>
      prev
        .map((e) => {
          if (e.id !== emailId) return e;
          return {
            ...e,
            bucket_ids: e.bucket_ids.filter((id) => id !== bucketId),
            bucket_names: e.bucket_names.filter(
              (_, i) => e.bucket_ids[i] !== bucketId,
            ),
          };
        })
        .filter((e) => e.bucket_ids.length > 0),
    );
  }, []);

  const reclassifySingle = useCallback(async (emailId: number) => {
    const updated = await reclassifySingleEmail(emailId);
    setEmails((prev) =>
      prev.map((e) =>
        e.id === emailId
          ? { ...e, bucket_ids: updated.bucket_ids, bucket_names: updated.bucket_names }
          : e,
      ),
    );
    return updated;
  }, []);

  return {
    emails,
    loading,
    classifying,
    progress,
    summary,
    fetchEmails,
    startClassification,
    removeBucketFromEmail,
    reclassifySingle,
  };
}
