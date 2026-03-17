import { useCallback } from 'react';
import { submitFeedback } from '../api/feedback';

export function useFeedback() {
  const thumbsUp = useCallback(async (emailId: number, bucketId: number) => {
    await submitFeedback({
      email_id: emailId,
      bucket_id: bucketId,
      is_positive: true,
    });
  }, []);

  const thumbsDown = useCallback(
    async (
      emailId: number,
      bucketId: number,
      correctBucketIds: number[],
      reason: string,
    ) => {
      await submitFeedback({
        email_id: emailId,
        bucket_id: bucketId,
        is_positive: false,
        correct_bucket_ids: correctBucketIds,
        reason,
      });
    },
    [],
  );

  return { thumbsUp, thumbsDown };
}
