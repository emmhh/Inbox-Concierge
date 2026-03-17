import { useEffect, useState } from 'react';
import type { Bucket } from '../types';
import { getPreferences, updatePreferences } from '../api/feedback';
import BucketManager from './BucketManager';
import Tooltip from './Tooltip';

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  buckets: Bucket[];
  onEditBucket: (id: number, updates: { name?: string; description?: string; examples?: string[] }) => Promise<void>;
  onDeleteBucket: (id: number) => Promise<void>;
  onAddBucket: (name: string, description: string, examples: string[]) => Promise<void>;
  onReclassify: () => void;
  onBatchProcess: () => void;
}

export default function SettingsPanel({
  isOpen,
  onClose,
  buckets,
  onEditBucket,
  onDeleteBucket,
  onAddBucket,
  onReclassify,
  onBatchProcess,
}: SettingsPanelProps) {
  const [importance, setImportance] = useState('');
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');

  useEffect(() => {
    if (isOpen) {
      getPreferences().then((data) => {
        setImportance(data.importance_context || '');
      });
    }
  }, [isOpen]);

  const handleSaveAndReclassify = async () => {
    setSaving(true);
    try {
      await updatePreferences(importance);
      onReclassify();
      setToast('Preferences saved. Reclassification started.');
      setTimeout(() => setToast(''), 3000);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const handleSaveOnly = async () => {
    setSaving(true);
    try {
      await updatePreferences(importance);
      setToast('Preferences saved.');
      setTimeout(() => setToast(''), 3000);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAndBatch = async () => {
    setSaving(true);
    try {
      await updatePreferences(importance);
      onBatchProcess();
      setToast('Preferences saved. Batch processing started.');
      setTimeout(() => setToast(''), 3000);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative ml-auto w-full max-w-lg bg-white shadow-2xl flex flex-col h-full">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-900">Settings</h2>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
          >
            <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div>
            <h3 className="text-sm font-semibold text-slate-700 mb-2">Email Preferences</h3>
            <textarea
              value={importance}
              onChange={(e) => setImportance(e.target.value)}
              rows={4}
              placeholder="What do you use this email for? What do you like to focus on? What kind of emails are most important to you?"
              className="w-full text-sm border border-slate-200 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            />
            <p className="text-xs text-slate-400 mt-1">
              This helps the AI understand what matters to you when classifying emails.
            </p>
          </div>

          <div className="border-t border-slate-100 pt-4">
            <BucketManager
              buckets={buckets}
              onEdit={onEditBucket}
              onDelete={onDeleteBucket}
              onAdd={onAddBucket}
            />
          </div>
        </div>

        <div className="px-6 py-4 border-t border-slate-200 flex gap-2">
          <Tooltip text="Save preferences without reclassifying" position="top">
            <button
              onClick={handleSaveOnly}
              disabled={saving}
              className="bg-slate-600 text-white py-2.5 px-4 rounded-xl font-medium hover:bg-slate-700 disabled:opacity-50 transition-colors cursor-pointer text-sm"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          </Tooltip>
          <Tooltip text="Classify emails one-by-one — slower but more accurate" position="top">
            <button
              onClick={handleSaveAndReclassify}
              disabled={saving}
              className="bg-indigo-600 text-white py-2.5 px-4 rounded-xl font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors cursor-pointer text-sm"
            >
              {saving ? 'Saving...' : 'Save & Reclassify'}
            </button>
          </Tooltip>
          <Tooltip text="Classify 50 emails per LLM call — faster" position="top">
            <button
              onClick={handleSaveAndBatch}
              disabled={saving}
              className="bg-emerald-600 text-white py-2.5 px-4 rounded-xl font-medium hover:bg-emerald-700 disabled:opacity-50 transition-colors cursor-pointer text-sm"
            >
              {saving ? 'Saving...' : 'Save & Batch'}
            </button>
          </Tooltip>
        </div>

        {toast && (
          <div className="absolute bottom-20 left-6 right-6 bg-emerald-600 text-white text-sm px-4 py-2.5 rounded-xl shadow-lg">
            {toast}
          </div>
        )}
      </div>
    </div>
  );
}
