import { useState } from 'react';
import type { Bucket } from '../types';

interface BucketManagerProps {
  buckets: Bucket[];
  onEdit: (id: number, updates: { name?: string; description?: string; examples?: string[] }) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
  onAdd: (name: string, description: string, examples: string[]) => Promise<void>;
}

export default function BucketManager({ buckets, onEdit, onDelete, onAdd }: BucketManagerProps) {
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newExamples, setNewExamples] = useState('');
  const [adding, setAdding] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);
  const [editingField, setEditingField] = useState<{ id: number; field: string } | null>(null);

  const handleAdd = async () => {
    if (!newName.trim()) return;
    await onAdd(
      newName.trim(),
      newDesc.trim(),
      newExamples
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean),
    );
    setNewName('');
    setNewDesc('');
    setNewExamples('');
    setAdding(false);
  };

  const handleDelete = async (id: number) => {
    await onDelete(id);
    setConfirmDelete(null);
  };

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-slate-700">Buckets</h3>

      {buckets.map((bucket) => (
        <div key={bucket.id} className="border border-slate-200 rounded-xl p-3 space-y-2">
          <div className="flex items-center justify-between">
            {editingField?.id === bucket.id && editingField.field === 'name' ? (
              <input
                autoFocus
                className="text-sm font-medium border-b border-indigo-400 outline-none px-1 py-0.5 flex-1"
                defaultValue={bucket.name}
                onBlur={(e) => {
                  onEdit(bucket.id, { name: e.target.value });
                  setEditingField(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                }}
              />
            ) : (
              <span
                className="text-sm font-medium text-slate-800 cursor-pointer hover:text-indigo-600"
                onClick={() => setEditingField({ id: bucket.id, field: 'name' })}
              >
                {bucket.name}
              </span>
            )}
            {confirmDelete === bucket.id ? (
              <div className="flex gap-1">
                <button
                  onClick={() => handleDelete(bucket.id)}
                  className="text-xs text-red-600 hover:bg-red-50 px-2 py-1 rounded cursor-pointer"
                >
                  Confirm
                </button>
                <button
                  onClick={() => setConfirmDelete(null)}
                  className="text-xs text-slate-500 hover:bg-slate-50 px-2 py-1 rounded cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmDelete(bucket.id)}
                className="text-xs text-red-400 hover:text-red-600 hover:bg-red-50 p-1 rounded cursor-pointer"
                title="Delete bucket"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            )}
          </div>

          {editingField?.id === bucket.id && editingField.field === 'description' ? (
            <textarea
              autoFocus
              className="w-full text-xs border border-slate-200 rounded-lg p-2 focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none"
              rows={2}
              defaultValue={bucket.description}
              onBlur={(e) => {
                onEdit(bucket.id, { description: e.target.value });
                setEditingField(null);
              }}
            />
          ) : (
            <p
              className="text-xs text-slate-500 cursor-pointer hover:text-slate-700"
              onClick={() => setEditingField({ id: bucket.id, field: 'description' })}
            >
              {bucket.description || 'Click to add description...'}
            </p>
          )}

          {editingField?.id === bucket.id && editingField.field === 'examples' ? (
            <textarea
              autoFocus
              className="w-full text-xs border border-slate-200 rounded-lg p-2 focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none"
              rows={3}
              placeholder="One example per line"
              defaultValue={(bucket.examples || []).join('\n')}
              onBlur={(e) => {
                onEdit(bucket.id, {
                  examples: e.target.value
                    .split('\n')
                    .map((s) => s.trim())
                    .filter(Boolean),
                });
                setEditingField(null);
              }}
            />
          ) : (
            <div
              className="cursor-pointer hover:bg-slate-50 rounded p-1"
              onClick={() => setEditingField({ id: bucket.id, field: 'examples' })}
            >
              {bucket.examples && bucket.examples.length > 0 ? (
                <div className="space-y-0.5">
                  <span className="text-xs text-slate-400">Examples:</span>
                  {bucket.examples.map((ex, i) => (
                    <p key={i} className="text-xs text-slate-500 italic truncate">
                      "{ex}"
                    </p>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-400 italic">Click to add examples...</p>
              )}
            </div>
          )}
        </div>
      ))}

      {adding ? (
        <div className="border-2 border-dashed border-indigo-300 rounded-xl p-3 space-y-2">
          <input
            autoFocus
            type="text"
            placeholder="Bucket name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="w-full text-sm font-medium border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
          <textarea
            placeholder="Describe what kind of emails belong here"
            value={newDesc}
            onChange={(e) => setNewDesc(e.target.value)}
            rows={2}
            className="w-full text-xs border border-slate-200 rounded-lg p-2 focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none"
          />
          <textarea
            placeholder="Example emails (one per line, optional)"
            value={newExamples}
            onChange={(e) => setNewExamples(e.target.value)}
            rows={2}
            className="w-full text-xs border border-slate-200 rounded-lg p-2 focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none"
          />
          <div className="flex gap-2">
            <button
              onClick={handleAdd}
              disabled={!newName.trim()}
              className="text-xs bg-indigo-600 text-white px-4 py-1.5 rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors cursor-pointer"
            >
              Add
            </button>
            <button
              onClick={() => setAdding(false)}
              className="text-xs text-slate-500 px-4 py-1.5 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="w-full flex items-center justify-center gap-1.5 border-2 border-dashed border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-500 hover:border-indigo-300 hover:text-indigo-600 transition-colors cursor-pointer"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Bucket
        </button>
      )}
    </div>
  );
}
