import React from 'react';
import { ScanProgress } from '../types';
import { ShieldAlert, GitCommit } from 'lucide-react';

interface ScanningRadarProps {
  progress: ScanProgress;
}

export const ScanningRadar: React.FC<ScanningRadarProps> = ({ progress }) => {
  const percent =
    progress.totalCommits > 0
      ? Math.round((progress.scannedCommits / progress.totalCommits) * 100)
      : 15;

  return (
    <div className="glass-card p-8 text-center space-y-6 max-w-2xl mx-auto border-emerald-500/30 shadow-[0_0_50px_rgba(16,185,129,0.15)]">
      {/* Radar Animation Container */}
      <div className="relative w-44 h-44 mx-auto flex items-center justify-center">
        {/* Outer Ring */}
        <div className="absolute inset-0 rounded-full border border-emerald-500/20" />
        {/* Middle Ring */}
        <div className="absolute inset-4 rounded-full border border-emerald-500/30 border-dashed" />
        {/* Inner Ring */}
        <div className="absolute inset-12 rounded-full border border-emerald-500/40" />

        {/* Center glowing core */}
        <div className="w-6 h-6 rounded-full bg-emerald-400 shadow-[0_0_20px_#10b981] z-10" />

        {/* Radar beam rotating sweep */}
        <svg className="absolute inset-0 w-full h-full radar-beam" viewBox="0 0 100 100">
          <defs>
            <linearGradient id="radarSweep" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="rgba(16, 185, 129, 0.45)" />
              <stop offset="100%" stopColor="rgba(16, 185, 129, 0)" />
            </linearGradient>
          </defs>
          <path d="M 50 50 L 100 50 A 50 50 0 0 0 50 0 Z" fill="url(#radarSweep)" />
        </svg>
      </div>

      {/* Status details */}
      <div className="space-y-2">
        <h3 className="text-xl font-extrabold text-white tracking-tight flex items-center justify-center gap-2">
          <span>Scanning Git History</span>
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
        </h3>
        <p className="text-sm text-slate-300 max-w-md mx-auto">
          {progress.message || 'Extracting commit tree and analyzing unified diffs...'}
        </p>
      </div>

      {/* Progress Bar */}
      <div className="space-y-1.5 max-w-md mx-auto">
        <div className="flex justify-between text-xs font-mono text-slate-400">
          <span className="flex items-center gap-1">
            <GitCommit className="w-3.5 h-3.5 text-emerald-400" />
            <span>
              Commit {progress.scannedCommits} of {progress.totalCommits || '...'}
            </span>
          </span>
          <span className="text-emerald-400 font-bold">{percent}%</span>
        </div>
        <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden border border-slate-700">
          <div
            className="bg-gradient-to-r from-emerald-500 to-cyan-400 h-full rounded-full transition-all duration-300"
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>

      {/* Live Counter Badges */}
      <div className="flex justify-center items-center gap-4 text-xs font-mono">
        <div className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 flex items-center gap-2">
          <span className="text-slate-400">Current Commit:</span>
          <span className="text-cyan-300 font-bold">
            {progress.currentCommitHash || 'HEAD'}
          </span>
        </div>
        <div className="px-3 py-1.5 rounded-lg bg-rose-500/10 border border-rose-500/30 flex items-center gap-2">
          <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
          <span className="text-rose-300 font-bold">
            {progress.findingsCount} secrets flagged
          </span>
        </div>
      </div>
    </div>
  );
};
