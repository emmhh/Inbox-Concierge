import { useCallback, useEffect, useMemo, useState } from 'react';
import type { User } from '../types';
import { useBuckets } from '../hooks/useBuckets';
import { useEmails } from '../hooks/useEmails';
import { useFeedback } from '../hooks/useFeedback';
import BucketSidebar from './BucketSidebar';
import EmailList from './EmailList';
import SettingsPanel from './SettingsPanel';
import Tooltip from './Tooltip';

interface EmailDashboardProps {
  user: User;
  onLogout: () => void;
}

export default function EmailDashboard({ user, onLogout }: EmailDashboardProps) {
  const { buckets, fetchBuckets, addBucket, editBucket, removeBucket } = useBuckets();
  const {
    emails,
    classifying,
    progress,
    summary,
    fetchEmails,
    startClassification,
    reclassifySingle,
  } = useEmails();
  const { thumbsUp, thumbsDown } = useFeedback();

  const [selectedBucketId, setSelectedBucketId] = useState<number | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [toast, setToast] = useState('');
  const [initialLoad, setInitialLoad] = useState(true);

  useEffect(() => {
    fetchBuckets();
    fetchEmails().then(() => {
      setInitialLoad(false);
    });
  }, [fetchBuckets, fetchEmails]);

  const refreshAfterSync = useCallback(() => {
    fetchEmails(selectedBucketId ?? undefined);
    fetchBuckets();
  }, [fetchEmails, fetchBuckets, selectedBucketId]);

  useEffect(() => {
    if (initialLoad || classifying) return;
    if (emails.length === 0) {
      startClassification('/emails/fetch-and-batch-classify');
    } else {
      startClassification('/emails/sync-and-classify', true, refreshAfterSync);
    }
  }, [initialLoad]); // eslint-disable-line react-hooks/exhaustive-deps

  // Refresh bucket counts when emails change
  useEffect(() => {
    if (!classifying && emails.length > 0) {
      fetchBuckets();
    }
  }, [classifying, emails.length, fetchBuckets]);

  const handleThumbsUp = useCallback(
    async (emailId: number, bucketId: number) => {
      await thumbsUp(emailId, bucketId);
      showToast('Feedback recorded — reclassifying...');
      await reclassifySingle(emailId);
    },
    [thumbsUp, reclassifySingle],
  );

  const handleThumbsDown = useCallback(
    async (emailId: number, bucketId: number, correctBucketIds: number[], reason: string) => {
      await thumbsDown(emailId, bucketId, correctBucketIds, reason);
      showToast('Feedback recorded — reclassifying...');
      await reclassifySingle(emailId);
    },
    [thumbsDown, reclassifySingle],
  );

  const handleRefresh = () => {
    startClassification('/emails/fetch-and-batch-classify');
  };

  const handleReclassify = () => {
    startClassification('/emails/reclassify');
  };

  const handleBatchProcess = () => {
    startClassification('/emails/batch-classify');
  };

  const handleReclassifySingle = useCallback(
    async (emailId: number) => {
      await reclassifySingle(emailId);
    },
    [reclassifySingle],
  );

  const bucketCountsFromEmails = useMemo(() => {
    const counts: Record<number, number> = {};
    for (const email of emails) {
      for (const bid of email.bucket_ids) {
        counts[bid] = (counts[bid] || 0) + 1;
      }
    }
    return counts;
  }, [emails]);

  const bucketsWithLiveCounts = useMemo(
    () =>
      buckets.map((b) => ({
        ...b,
        email_count: classifying || emails.length > 0
          ? (bucketCountsFromEmails[b.id] ?? 0)
          : b.email_count,
      })),
    [buckets, bucketCountsFromEmails, classifying, emails.length],
  );

  const handleAddBucketFromSidebar = () => {
    setSettingsOpen(true);
  };

  const handleAddBucket = async (name: string, description: string, examples: string[]) => {
    await addBucket(name, description, examples);
  };

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3500);
  };

  return (
    <div className="h-screen flex flex-col bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-5 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <h1 className="text-lg font-semibold text-slate-900">Inbox Concierge</h1>
        </div>
        <div className="flex items-center gap-2">
          <Tooltip text="Sync latest emails from Gmail and reclassify all (50 per batch)">
            <button
              onClick={handleRefresh}
              disabled={classifying}
              className="flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-900 hover:bg-slate-100 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50 cursor-pointer"
            >
              <svg className={`w-4 h-4 ${classifying ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Sync & Classify
            </button>
          </Tooltip>
          <Tooltip text="Reclassify existing emails without fetching from Gmail (50 per batch)">
            <button
              onClick={handleBatchProcess}
              disabled={classifying}
              className="flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-900 hover:bg-slate-100 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50 cursor-pointer"
            >
              <svg className={`w-4 h-4 ${classifying ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
              Reclassify
            </button>
          </Tooltip>
          <button
            onClick={() => setSettingsOpen(true)}
            className="flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-900 hover:bg-slate-100 px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Settings
          </button>
          <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
            <span className="text-xs text-slate-500">{user.email}</span>
            <button
              onClick={onLogout}
              className="text-xs text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      {/* Progress bar */}
      {classifying && (
        <div className="bg-indigo-50 border-b border-indigo-100 px-5 py-2 flex items-center gap-3 shrink-0">
          <div className="flex-1 bg-indigo-100 rounded-full h-2 overflow-hidden">
            <div
              className="bg-indigo-600 h-full rounded-full transition-all duration-300"
              style={{
                width: progress.total
                  ? `${(progress.current / progress.total) * 100}%`
                  : '0%',
              }}
            />
          </div>
          <span className="text-xs text-indigo-700 font-medium tabular-nums shrink-0">
            Classifying {progress.current}/{progress.total}...
          </span>
        </div>
      )}

      {/* Summary bar */}
      {summary && !classifying && (
        <div className="bg-emerald-50 border-b border-emerald-100 px-5 py-2 flex items-center justify-between shrink-0">
          <span className="text-xs text-emerald-700">
            Classified {summary.classified}/{summary.total}
            {summary.failed > 0 && ` (${summary.failed} failed)`}
          </span>
          <button
            onClick={() => {}}
            className="text-xs text-emerald-600 hover:text-emerald-700 cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        <BucketSidebar
          buckets={bucketsWithLiveCounts}
          selectedBucketId={selectedBucketId}
          onSelectBucket={setSelectedBucketId}
          totalEmails={emails.length}
          onAddBucket={handleAddBucketFromSidebar}
        />
        <EmailList
          emails={emails}
          buckets={buckets}
          selectedBucketId={selectedBucketId}
          onThumbsUp={handleThumbsUp}
          onThumbsDown={handleThumbsDown}
          onReclassify={handleReclassifySingle}
        />
      </div>

      {/* Settings Panel */}
      <SettingsPanel
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        buckets={buckets}
        onEditBucket={editBucket}
        onDeleteBucket={removeBucket}
        onAddBucket={handleAddBucket}
        onReclassify={handleReclassify}
        onBatchProcess={handleBatchProcess}
      />

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-sm px-5 py-3 rounded-xl shadow-xl z-50">
          {toast}
        </div>
      )}
    </div>
  );
}
