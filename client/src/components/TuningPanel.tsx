import React from 'react';
import { Sliders, HelpCircle, RotateCcw } from 'lucide-react';

interface TuningPanelProps {
  entropyThreshold: number;
  setEntropyThreshold: (val: number) => void;
  minEntropyLength: number;
  setMinEntropyLength: (val: number) => void;
  activeCategories: string[];
  setActiveCategories: (cats: string[]) => void;
}

const CATEGORIES = [
  { id: 'cloud', label: 'Cloud Secrets (AWS, Google)', default: true },
  { id: 'tokens', label: 'API & PATs (GitHub, GitLab, Slack)', default: true },
  { id: 'keys', label: 'Private Keys (RSA, SSH)', default: true },
  { id: 'database', label: 'Database URIs & Credentials', default: true },
  { id: 'passwords', label: 'Generic Passwords & Assignments', default: true },
  { id: 'entropy', label: 'High-Entropy Strings (Shannon)', default: true },
];

export const TuningPanel: React.FC<TuningPanelProps> = ({
  entropyThreshold,
  setEntropyThreshold,
  minEntropyLength,
  setMinEntropyLength,
  activeCategories,
  setActiveCategories,
}) => {
  const toggleCategory = (catId: string) => {
    if (activeCategories.includes(catId)) {
      setActiveCategories(activeCategories.filter((c) => c !== catId));
    } else {
      setActiveCategories([...activeCategories, catId]);
    }
  };

  const resetDefaults = () => {
    setEntropyThreshold(4.2);
    setMinEntropyLength(16);
    setActiveCategories(CATEGORIES.map((c) => c.id));
  };

  return (
    <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-5">
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <Sliders className="w-4 h-4 text-emerald-400" />
          <h4 className="text-sm font-semibold text-white">Detection & Entropy Tuning</h4>
        </div>
        <button
          onClick={resetDefaults}
          className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-emerald-400 transition"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Reset Defaults</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Shannon Entropy Threshold Slider */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <label className="text-xs font-medium text-slate-200">
                Shannon Entropy Threshold
              </label>
              <div
                className="group relative cursor-pointer"
                title="Calculates bits of entropy per character. Default 4.2 filters common code words while catching randomized tokens."
              >
                <HelpCircle className="w-3.5 h-3.5 text-slate-400" />
              </div>
            </div>
            <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
              {entropyThreshold.toFixed(1)} bits/char
            </span>
          </div>
          <input
            type="range"
            min="3.0"
            max="5.5"
            step="0.1"
            value={entropyThreshold}
            onChange={(e) => setEntropyThreshold(parseFloat(e.target.value))}
            className="w-full accent-emerald-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg appearance-none"
          />
          <div className="flex justify-between text-[11px] text-slate-400 font-mono">
            <span>3.0 (More Sensitive)</span>
            <span>4.2 (Balanced)</span>
            <span>5.5 (Strict Crypto)</span>
          </div>
        </div>

        {/* Min Entropy Token Length */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <label className="text-xs font-medium text-slate-200">
                Minimum Token Length Filter
              </label>
              <div
                className="group relative cursor-pointer"
                title="Tokens shorter than this threshold will be skipped to prevent false alarms on short variable names."
              >
                <HelpCircle className="w-3.5 h-3.5 text-slate-400" />
              </div>
            </div>
            <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
              {minEntropyLength} chars
            </span>
          </div>
          <input
            type="range"
            min="12"
            max="32"
            step="2"
            value={minEntropyLength}
            onChange={(e) => setMinEntropyLength(parseInt(e.target.value, 10))}
            className="w-full accent-cyan-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg appearance-none"
          />
          <div className="flex justify-between text-[11px] text-slate-400 font-mono">
            <span>12 chars</span>
            <span>16 chars (Default)</span>
            <span>32 chars</span>
          </div>
        </div>
      </div>

      {/* Pattern Categories */}
      <div className="space-y-2 pt-2 border-t border-slate-800/80">
        <label className="text-xs font-medium text-slate-300 block">
          Active Detection Signatures
        </label>
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((cat) => {
            const isActive = activeCategories.includes(cat.id);
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => toggleCategory(cat.id)}
                className={`text-xs px-3 py-1.5 rounded-lg border transition flex items-center gap-1.5 ${
                  isActive
                    ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300 font-medium'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    isActive ? 'bg-emerald-400' : 'bg-slate-600'
                  }`}
                />
                {cat.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
