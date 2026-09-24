import React, { useState } from 'react';
import { SecretFinding, Severity } from '../types';
import { DiffViewer } from './DiffViewer';
import {
  ShieldAlert,
  GitCommit,
  Clock,
  User,
  Eye,
  EyeOff,
  Copy,
  Check,
  Terminal,
  Activity,
  FileCode,
} from 'lucide-react';

interface FindingCardProps {
  finding: SecretFinding;
  onOpenRemediation: (finding: SecretFinding) => void;
}

export const FindingCard: React.FC<FindingCardProps> = ({ finding, onOpenRemediation }) => {
  const [isBlurred, setIsBlurred] = useState(true);
  const [copiedHash, setCopiedHash] = useState(false);
  const [copiedSecret, setCopiedSecret] = useState(false);

  const getSeverityBadgeClass = (sev: Severity) => {
    switch (sev) {
      case 'CRITICAL':
        return 'badge-critical';
      case 'HIGH':
        return 'badge-high';
      case 'MEDIUM':
        return 'badge-medium';
      case 'LOW':
        return 'badge-low';
    }
  };

  const copyToClipboard = (text: string, type: 'hash' | 'secret') => {
    navigator.clipboard.writeText(text);
    if (type === 'hash') {
      setCopiedHash(true);
      setTimeout(() => setCopiedHash(false), 2000);
    } else {
      setCopiedSecret(true);
      setTimeout(() => setCopiedSecret(false), 2000);
    }
  };

  const formattedDate = new Date(finding.commitDate).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className="glass-card glass-card-interactive p-5 space-y-4 border border-slate-800">
      {/* Card Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`text-xs font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider ${getSeverityBadgeClass(
                finding.severity
              )}`}
            >
              {finding.severity}
            </span>

            <span className="text-sm font-bold text-white tracking-tight">
              {finding.matchedPatternName}
            </span>

            {/* Commits Ago Highlight */}
            <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-300 border border-cyan-500/30">
              {finding.commitsAgo === 0 ? 'Tip of branch (HEAD)' : `${finding.commitsAgo} commits ago`}
            </span>

            {/* Shannon Entropy Pill */}
            <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-violet-500/10 text-violet-300 border border-violet-500/30 flex items-center gap-1">
              <Activity className="w-3 h-3" />
              <span>H = {finding.entropyScore}</span>
            </span>
          </div>

          <div className="flex items-center gap-1.5 text-xs text-slate-300 font-mono">
            <FileCode className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-slate-100 font-semibold">{finding.filePath}</span>
            <span className="text-slate-500">:</span>
            <span className="text-emerald-400 font-bold">{finding.lineNumber}</span>
          </div>
        </div>

        {/* Remediation Action */}
        <button
          onClick={() => onOpenRemediation(finding)}
          className="cyber-button-secondary text-xs px-3 py-1.5 font-semibold text-amber-300 hover:text-amber-200 border-amber-500/30 hover:border-amber-400/60 shadow-[0_0_10px_rgba(245,158,11,0.1)]"
        >
          <Terminal className="w-3.5 h-3.5 text-amber-400" />
          <span>Remediation Recipe</span>
        </button>
      </div>

      {/* Secret Token & Masking Control */}
      <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800/80 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 overflow-hidden">
          <span className="text-xs text-slate-400 select-none">Exposed Token:</span>
          <code
            className={`font-mono text-xs px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-rose-300 transition-all ${
              isBlurred ? 'secret-blur' : ''
            }`}
          >
            {finding.secretValue}
          </code>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsBlurred(!isBlurred)}
            className="p-1 rounded-md text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition"
            title={isBlurred ? 'Reveal secret' : 'Hide secret'}
          >
            {isBlurred ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
          </button>
          <button
            onClick={() => copyToClipboard(finding.secretValue, 'secret')}
            className="p-1 rounded-md text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition"
            title="Copy secret to clipboard"
          >
            {copiedSecret ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Commit Metadata Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs text-slate-400 bg-slate-900/40 p-2.5 rounded-xl border border-slate-800/60">
        <div className="flex items-center gap-1.5 font-mono">
          <GitCommit className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
          <span className="text-slate-200">{finding.shortHash}</span>
          <button
            onClick={() => copyToClipboard(finding.commitHash, 'hash')}
            className="hover:text-white"
            title={`Copy full SHA: ${finding.commitHash}`}
          >
            {copiedHash ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
          </button>
        </div>

        <div className="flex items-center gap-1.5 truncate">
          <User className="w-3.5 h-3.5 text-cyan-400 flex-shrink-0" />
          <span className="truncate" title={`${finding.authorName} <${finding.authorEmail}>`}>
            {finding.authorName}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
          <span>{formattedDate}</span>
        </div>

        {finding.commitMessage && (
          <div className="col-span-full pt-1 text-slate-300 italic text-[11px] truncate border-t border-slate-800/40">
            "{finding.commitMessage}"
          </div>
        )}
      </div>

      {/* Code Diff Context Viewer (3 lines before/after) */}
      <DiffViewer
        lineNumber={finding.lineNumber}
        lineContent={finding.lineContent}
        contextBefore={finding.contextBefore}
        contextAfter={finding.contextAfter}
        secretValue={finding.secretValue}
        isBlurred={isBlurred}
      />
    </div>
  );
};
