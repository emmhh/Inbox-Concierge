import type { Bucket, Email } from '../types';
import EmailCard from './EmailCard';

interface EmailListProps {
  emails: Email[];
  buckets: Bucket[];
  selectedBucketId: number | null;
  onThumbsUp: (emailId: number, bucketId: number) => void;
  onThumbsDown: (emailId: number, bucketId: number, correctBucketIds: number[], reason: string) => void;
  onReclassify: (emailId: number) => Promise<void>;
}

export default function EmailList({
  emails,
  buckets,
  selectedBucketId,
  onThumbsUp,
  onThumbsDown,
  onReclassify,
}: EmailListProps) {
  const filtered =
    selectedBucketId != null
      ? emails.filter((e) => e.bucket_ids.includes(selectedBucketId))
      : emails;

  if (filtered.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-slate-400 text-sm">
        No emails in this bucket
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      {filtered.map((email) => (
        <EmailCard
          key={email.id}
          id={email.id}
          subject={email.subject}
          sender={email.sender}
          snippet={email.snippet}
          date={email.date}
          bucketIds={email.bucket_ids}
          bucketNames={email.bucket_names}
          allBuckets={buckets}
          onThumbsUp={onThumbsUp}
          onThumbsDown={onThumbsDown}
          onReclassify={onReclassify}
        />
      ))}
    </div>
  );
}
