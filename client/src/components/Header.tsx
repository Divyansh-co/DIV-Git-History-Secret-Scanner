import React, { useState } from 'react';
import { Shield, ShieldAlert, Terminal, Lock, Info, X } from 'lucide-react';

export const Header: React.FC = () => {
  const [showInfo, setShowInfo] = useState(false);

  return (
    <header className="border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-md sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 border border-emerald-500/40 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.3)]">
            <Shield className="w-5 h-5" />
            <div className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl font-extrabold tracking-tight bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 bg-clip-text text-transparent">
                SentraScan
              </span>
              <span className="text-[10px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                v1.0 Pro
              </span>
            </div>
            <p className="text-xs text-slate-400 font-medium">Git Commit History Secret Scanner</p>
          </div>
        </div>

        {/* Security Sandbox Indicators */}
        <div className="hidden md:flex items-center gap-2.5 text-xs">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-900 border border-slate-800 text-slate-300">
            <Lock className="w-3.5 h-3.5 text-emerald-400" />
            <span>Ephemeral Sandbox</span>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-900 border border-slate-800 text-slate-300">
            <Terminal className="w-3.5 h-3.5 text-cyan-400" />
            <span>Anti-RCE (No Git Hooks)</span>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-900 border border-slate-800 text-slate-300">
            <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
            <span>Zero Server Rewrites</span>
          </div>
          <button
            onClick={() => setShowInfo(true)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition"
            title="How SentraScan works"
          >
            <Info className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Info Modal */}
      {showInfo && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl relative">
            <button
              onClick={() => setShowInfo(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <Shield className="w-4 h-4" />
              </div>
              <h3 className="text-lg font-bold text-white">How SentraScan Works</h3>
            </div>
            <div className="space-y-3 text-sm text-slate-300 leading-relaxed">
              <p>
                Most vulnerability scanners only check the current working tree (<code className="text-emerald-400 font-mono">HEAD</code>). If a developer committed an AWS key or database password and removed it two commits later, traditional scanners miss it completely.
              </p>
              <p>
                <strong className="text-white">SentraScan scans the entire Git commit log</strong> from the initial commit to the tip, reconstructing unified diffs for every change ever recorded.
              </p>
              <div className="p-3 rounded-lg bg-slate-950/80 border border-slate-800 space-y-1.5 text-xs font-mono text-slate-300">
                <div className="text-emerald-400 font-bold">Hard Security Guarantees:</div>
                <div>• Clone with <span className="text-cyan-300">-c core.hooksPath=/dev/null</span> (blocks hook execution)</div>
                <div>• Complete offline execution during scan analysis</div>
                <div>• Instant ephemeral temp directory deletion</div>
                <div>• Remediation scripts are output for local execution ONLY</div>
              </div>
            </div>
            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setShowInfo(false)}
                className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-sm font-medium transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};
