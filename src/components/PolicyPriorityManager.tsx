import React, { useState } from 'react';
import { PolicyPriority } from '../types/legislative';
import { 
  Sliders, 
  Plus, 
  Trash2, 
  RotateCcw, 
  CheckCircle2, 
  AlertCircle, 
  Sparkles,
  Save,
  ArrowRight
} from 'lucide-react';

interface PolicyPriorityManagerProps {
  priorities: PolicyPriority[];
  onSavePriorities: (updated: PolicyPriority[]) => Promise<void>;
  onResetDefaults: () => void;
  onNavigateToFeed: () => void;
}

export const PolicyPriorityManager: React.FC<PolicyPriorityManagerProps> = ({
  priorities,
  onSavePriorities,
  onResetDefaults,
  onNavigateToFeed,
}) => {
  const [localPriorities, setLocalPriorities] = useState<PolicyPriority[]>(priorities);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  
  // New priority form state
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newDirective, setNewDirective] = useState<'Defend' | 'Promote' | 'Oppose'>('Defend');
  const [newKeywords, setNewKeywords] = useState('');
  const [newWeight, setNewWeight] = useState(8);

  const handleToggleActive = (id: string) => {
    setLocalPriorities((prev) =>
      prev.map((p) => (p.id === id ? { ...p, isActive: !p.isActive } : p))
    );
  };

  const handleWeightChange = (id: string, weight: number) => {
    setLocalPriorities((prev) =>
      prev.map((p) => (p.id === id ? { ...p, weight } : p))
    );
  };

  const handleDirectiveChange = (id: string, stanceDirective: 'Defend' | 'Promote' | 'Oppose') => {
    setLocalPriorities((prev) =>
      prev.map((p) => (p.id === id ? { ...p, stanceDirective } : p))
    );
  };

  const handleDeletePriority = (id: string) => {
    setLocalPriorities((prev) => prev.filter((p) => p.id !== id));
  };

  const handleAddPriority = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    const newPriority: PolicyPriority = {
      id: `custom-${Date.now()}`,
      title: newTitle.trim(),
      description: newDescription.trim() || 'Custom priority defined by user.',
      weight: newWeight,
      stanceDirective: newDirective,
      keywords: newKeywords.split(',').map((k) => k.trim()).filter(Boolean),
      isActive: true,
    };

    setLocalPriorities((prev) => [newPriority, ...prev]);
    setNewTitle('');
    setNewDescription('');
    setNewKeywords('');
    setShowAddForm(false);
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSaveSuccess(false);
    try {
      await onSavePriorities(localPriorities);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      
      {/* Policy Tuning Header */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
            <Sliders className="w-5 h-5 text-amber-400" />
            <span>Political Priorities & Alignment Weights</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Configure your political goals, importance weights, and keywords. The engine uses these to classify bills as SUPPORT / OPPOSE and score urgency.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center gap-1.5 transition"
          >
            <Plus className="w-3.5 h-3.5 text-amber-400" />
            <span>Add Goal</span>
          </button>

          <button
            onClick={onResetDefaults}
            className="px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 border border-slate-700 flex items-center gap-1.5 transition"
            title="Reset to default Texas policy criteria"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset</span>
          </button>

          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-4 py-1.5 text-xs font-bold rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 flex items-center gap-1.5 shadow-sm transition disabled:opacity-50"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{isSaving ? 'Recalculating...' : 'Recalculate All Bills'}</span>
          </button>
        </div>
      </div>

      {/* Success Notification */}
      {saveSuccess && (
        <div className="bg-emerald-950/40 border border-emerald-800/60 text-emerald-300 p-4 rounded-xl flex items-center justify-between animate-fade-in text-xs font-medium">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>Priorities saved! All bills in the database have been re-evaluated and re-scored.</span>
          </div>
          <button
            onClick={onNavigateToFeed}
            className="text-amber-400 hover:text-amber-300 font-bold flex items-center gap-1 underline underline-offset-4"
          >
            <span>View Updated Feed</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Add New Custom Priority Drawer */}
      {showAddForm && (
        <form onSubmit={handleAddPriority} className="bg-slate-900 border border-amber-500/40 rounded-xl p-5 space-y-4 shadow-lg animate-fade-in">
          <h3 className="text-sm font-bold text-amber-400">Add Custom Policy Priority</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-mono text-slate-400 uppercase">Goal Title</label>
              <input
                type="text"
                required
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="e.g. Artificial Intelligence Regulatory Guardrails"
                className="mt-1 w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500/60"
              />
            </div>

            <div>
              <label className="text-xs font-mono text-slate-400 uppercase">Directive</label>
              <select
                value={newDirective}
                onChange={(e) => setNewDirective(e.target.value as any)}
                className="mt-1 w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500/60"
              >
                <option value="Defend">Defend (Strict Protection)</option>
                <option value="Promote">Promote (Proactive Expansion)</option>
                <option value="Oppose">Oppose (Halt or Repeal)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs font-mono text-slate-400 uppercase">Policy Description & Criteria</label>
            <textarea
              rows={2}
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              placeholder="Describe what statutory changes advance or undermine this objective..."
              className="mt-1 w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500/60"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-mono text-slate-400 uppercase">Keywords (comma-separated)</label>
              <input
                type="text"
                value={newKeywords}
                onChange={(e) => setNewKeywords(e.target.value)}
                placeholder="e.g. artificial intelligence, algorithm, facial recognition, autonomous"
                className="mt-1 w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500/60"
              />
            </div>

            <div>
              <label className="text-xs font-mono text-slate-400 uppercase">Importance Weight: {newWeight}/10</label>
              <input
                type="range"
                min="1"
                max="10"
                value={newWeight}
                onChange={(e) => setNewWeight(Number(e.target.value))}
                className="mt-2 w-full accent-amber-400 cursor-pointer"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 text-xs font-bold rounded-lg bg-amber-500 text-slate-950 hover:bg-amber-400"
            >
              Add Priority
            </button>
          </div>
        </form>
      )}

      {/* Priorities List */}
      <div className="space-y-4">
        {localPriorities.map((priority) => (
          <div
            key={priority.id}
            className={`p-5 rounded-xl border transition-all ${
              priority.isActive
                ? 'bg-slate-900 border-slate-800 shadow-sm'
                : 'bg-slate-950/60 border-slate-850 opacity-60'
            }`}
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-800/80 gap-3">
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={priority.isActive}
                  onChange={() => handleToggleActive(priority.id)}
                  className="w-4 h-4 rounded bg-slate-950 border-slate-700 text-amber-500 focus:ring-amber-500/30 accent-amber-500 cursor-pointer"
                />
                <div>
                  <h3 className="font-bold text-slate-100 text-sm">{priority.title}</h3>
                  <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                    Directive: <span className="font-bold text-amber-400">{priority.stanceDirective}</span> • Weight: <span className="font-mono tabular-nums text-slate-200">{priority.weight}/10</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <select
                  value={priority.stanceDirective}
                  onChange={(e) => handleDirectiveChange(priority.id, e.target.value as any)}
                  className="bg-slate-950 border border-slate-800 text-xs text-slate-300 rounded px-2.5 py-1 focus:outline-none focus:border-amber-500/60"
                >
                  <option value="Defend">Defend</option>
                  <option value="Promote">Promote</option>
                  <option value="Oppose">Oppose</option>
                </select>

                <button
                  onClick={() => handleDeletePriority(priority.id)}
                  className="p-1.5 text-slate-500 hover:text-rose-400 transition"
                  title="Remove priority"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            <p className="text-xs text-slate-300 mt-3 leading-relaxed">
              {priority.description}
            </p>

            {/* Weight Slider */}
            <div className="mt-4 pt-3 border-t border-slate-800/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3 w-full sm:w-2/3">
                <span className="text-xs font-mono text-slate-400 uppercase shrink-0">Weight:</span>
                <input
                  type="range"
                  min="1"
                  max="10"
                  value={priority.weight}
                  onChange={(e) => handleWeightChange(priority.id, Number(e.target.value))}
                  className="w-full accent-amber-400 cursor-pointer"
                />
                <span className="font-mono text-xs font-bold text-amber-400 tabular-nums shrink-0">
                  {priority.weight} / 10
                </span>
              </div>

              <div className="flex flex-wrap gap-1 text-[10px] font-mono text-slate-400">
                {priority.keywords.slice(0, 4).map((kw, idx) => (
                  <span key={idx} className="px-1.5 py-0.5 rounded bg-slate-950 border border-slate-800">
                    {kw}
                  </span>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

    </div>
  );
};
