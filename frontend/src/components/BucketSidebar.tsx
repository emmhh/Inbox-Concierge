import type { Bucket } from '../types';

interface BucketSidebarProps {
  buckets: Bucket[];
  selectedBucketId: number | null;
  onSelectBucket: (id: number | null) => void;
  totalEmails: number;
  onAddBucket: () => void;
}

export default function BucketSidebar({
  buckets,
  selectedBucketId,
  onSelectBucket,
  totalEmails,
  onAddBucket,
}: BucketSidebarProps) {
  return (
    <aside className="w-56 shrink-0 bg-white border-r border-slate-200 flex flex-col">
      <div className="p-4 border-b border-slate-100">
        <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
          Buckets
        </h2>
      </div>
      <nav className="flex-1 overflow-y-auto p-2">
        <button
          onClick={() => onSelectBucket(null)}
          className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
            selectedBucketId === null
              ? 'bg-indigo-50 text-indigo-700'
              : 'text-slate-600 hover:bg-slate-50'
          }`}
        >
          <span className="flex items-center justify-between">
            <span>All</span>
            <span className="text-xs tabular-nums text-slate-400">{totalEmails}</span>
          </span>
        </button>

        {buckets.map((bucket) => (
          <button
            key={bucket.id}
            onClick={() => onSelectBucket(bucket.id)}
            className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors cursor-pointer ${
              selectedBucketId === bucket.id
                ? 'bg-indigo-50 text-indigo-700 font-medium'
                : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            <span className="flex items-center justify-between">
              <span className="truncate">{bucket.name}</span>
              <span className="text-xs tabular-nums text-slate-400">
                {bucket.email_count}
              </span>
            </span>
          </button>
        ))}
      </nav>

      <div className="p-3 border-t border-slate-100">
        <button
          onClick={onAddBucket}
          className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-sm text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Bucket
        </button>
      </div>
    </aside>
  );
}
