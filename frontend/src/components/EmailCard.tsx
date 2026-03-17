import { useState } from 'react';
import type { Bucket } from '../types';

interface EmailCardProps {
  id: number;
  subject: string;
  sender: string;
  snippet: string;
  date: string | null;
  bucketIds: number[];
  bucketNames: string[];
  allBuckets: Bucket[];
  onThumbsUp: (emailId: number, bucketId: number) => void;
  onThumbsDown: (emailId: number, bucketId: number, correctBucketIds: number[], reason: string) => void;
  onReclassify: (emailId: number) => Promise<void>;
}

const BUCKET_COLORS = [
  'bg-blue-100 text-blue-700',
  'bg-emerald-100 text-emerald-700',
  'bg-amber-100 text-amber-700',
  'bg-rose-100 text-rose-700',
  'bg-purple-100 text-purple-700',
  'bg-cyan-100 text-cyan-700',
  'bg-orange-100 text-orange-700',
  'bg-teal-100 text-teal-700',
];

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export default function EmailCard({
  id,
  subject,
  sender,
  snippet,
  date,
  bucketIds,
  bucketNames,
  allBuckets,
  onThumbsUp,
  onThumbsDown,
  onReclassify,
}: EmailCardProps) {
  const [openPopover, setOpenPopover] = useState<number | null>(null);
  const [selectedCorrect, setSelectedCorrect] = useState<number[]>([]);
  const [reason, setReason] = useState('');
  const [confirmedUp, setConfirmedUp] = useState<Set<number>>(new Set());
  const [reclassifying, setReclassifying] = useState(false);

  const handleReclassify = async () => {
    setReclassifying(true);
    try {
      await onReclassify(id);
    } finally {
      setReclassifying(false);
    }
  };

  const handleThumbsUp = (bucketId: number) => {
    onThumbsUp(id, bucketId);
    setConfirmedUp((prev) => new Set(prev).add(bucketId));
  };

  const handleOpenThumbsDown = (bucketId: number) => {
    setOpenPopover(bucketId);
    setSelectedCorrect([]);
    setReason('');
  };

  const handleSubmitThumbsDown = (bucketId: number) => {
    onThumbsDown(id, bucketId, selectedCorrect, reason);
    setOpenPopover(null);
  };

  const toggleCorrectBucket = (bid: number) => {
    setSelectedCorrect((prev) =>
      prev.includes(bid) ? prev.filter((x) => x !== bid) : [...prev, bid],
    );
  };

  const senderName = sender.replace(/<.*>/, '').trim() || sender;

  return (
    <div className="px-5 py-3.5 border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="font-semibold text-sm text-slate-900 truncate">
              {senderName}
            </span>
            <span className="text-xs text-slate-400 shrink-0">{formatDate(date)}</span>
          </div>
          <p className="text-sm text-slate-800 truncate">{subject || '(no subject)'}</p>
          <p className="text-xs text-slate-400 truncate mt-0.5">{snippet}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5 mt-2">
        <button
          onClick={handleReclassify}
          disabled={reclassifying}
          className="p-1 rounded hover:bg-slate-200 transition-colors text-slate-400 hover:text-indigo-600 disabled:opacity-50 cursor-pointer shrink-0"
          title="Reclassify this email"
        >
          <svg className={`w-3.5 h-3.5 ${reclassifying ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
        {bucketIds.map((bid, i) => {
          const colorClass = BUCKET_COLORS[bid % BUCKET_COLORS.length];
          const bname = bucketNames[i] || '';
          return (
            <span key={bid} className="inline-flex items-center gap-0.5 relative">
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${colorClass}`}>
                {bname}
              </span>
              <button
                onClick={() => handleThumbsUp(bid)}
                className={`p-0.5 rounded hover:bg-slate-200 transition-colors text-xs cursor-pointer ${
                  confirmedUp.has(bid) ? 'text-green-600' : 'text-slate-400'
                }`}
                title="Confirm classification"
              >
                <svg className="w-3.5 h-3.5" fill={confirmedUp.has(bid) ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
                </svg>
              </button>
              <button
                onClick={() => handleOpenThumbsDown(bid)}
                className="p-0.5 rounded hover:bg-slate-200 transition-colors text-xs text-slate-400 cursor-pointer"
                title="Wrong classification"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14H5.236a2 2 0 01-1.789-2.894l3.5-7A2 2 0 018.736 3h4.018a2 2 0 01.485.06l3.76.94m-7 10v5a2 2 0 002 2h.096c.5 0 .905-.405.905-.904 0-.715.211-1.413.608-2.008L17 13V4m-7 10h2m5-10h2a2 2 0 012 2v6a2 2 0 01-2 2h-2.5" />
                </svg>
              </button>

              {openPopover === bid && (
                <div className="absolute top-full left-0 mt-1 z-50 bg-white rounded-xl shadow-xl border border-slate-200 p-3 w-64">
                  <p className="text-xs font-medium text-slate-700 mb-2">
                    Where should this email go instead?
                  </p>
                  <div className="space-y-1 max-h-32 overflow-y-auto mb-2">
                    {allBuckets
                      .filter((b) => b.id !== bid)
                      .map((b) => (
                        <label
                          key={b.id}
                          className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer hover:bg-slate-50 px-2 py-1 rounded"
                        >
                          <input
                            type="checkbox"
                            checked={selectedCorrect.includes(b.id)}
                            onChange={() => toggleCorrectBucket(b.id)}
                            className="rounded border-slate-300"
                          />
                          {b.name}
                        </label>
                      ))}
                  </div>
                  <input
                    type="text"
                    placeholder="Why is this wrong? (optional)"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    className="w-full text-xs border border-slate-200 rounded-lg px-2 py-1.5 mb-2 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleSubmitThumbsDown(bid)}
                      className="flex-1 text-xs bg-red-600 text-white px-3 py-1.5 rounded-lg hover:bg-red-700 transition-colors cursor-pointer"
                    >
                      Submit
                    </button>
                    <button
                      onClick={() => setOpenPopover(null)}
                      className="text-xs text-slate-500 px-3 py-1.5 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </span>
          );
        })}
      </div>
    </div>
  );
}
