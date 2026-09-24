import React, { useState } from 'react';
import { SecretFinding, RemediationRecipe } from '../types';
import { X, Copy, Check, Terminal, ShieldAlert, KeyRound, ExternalLink } from 'lucide-react';

interface RemediationModalProps {
  finding: SecretFinding;
  onClose: () => void;
}

export const RemediationModal: React.FC<RemediationModalProps> = ({ finding, onClose }) => {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);

  const escapedSecret = finding.secretValue.replace(/"/g, '\\"');
  const safePath = finding.filePath.replace(/"/g, '\\"');

  const steps = [
    {
      title: '1. Backup Your Local Repository',
      description: 'Clone a complete mirror copy first before rewriting history.',
      command: `git clone --mirror . ../repo-backup-before-purge.git`,
    },
    {
      title: '2. Install git-filter-repo (Recommended)',
      description: 'The official modern Git tool for purging secrets from commit history.',
      command: `pip install git-filter-repo`,
    },
    {
      title: '3. Option A: Redact Secret String from History (Keeps File)',
      description:
        'Replaces the exact leaked secret string with a redacted placeholder across all commits and branches.',
      command: `echo "${escapedSecret}==>***REDACTED_SECRET***" > replace.txt\ngit filter-repo --replace-text replace.txt --force\nrm replace.txt`,
    },
    {
      title: '4. Option B: Completely Purge File from All Commits',
      description:
        'If this file should never have been in version control (e.g. .env or credentials.json):',
      command: `git filter-repo --invert-paths --path "${safePath}" --force`,
    },
    {
      title: '5. Fallback: Using Standard git filter-branch',
      description: 'Built-in vanilla Git command (slower, but requires no Python dependencies):',
      command: `git filter-branch --force --index-filter 'git rm --cached --ignore-unmatch "${safePath}"' --prune-empty --tag-name-filter cat -- --all`,
    },
    {
      title: '6. Force-Push Cleaned History to Remote',
      description: 'Overwrite remote history and tags once verified locally:',
      command: `git push origin --force --all\ngit push origin --force --tags`,
    },
  ];

  const fullScript = steps
    .filter((s) => s.command)
    .map((s) => `# ${s.title}\n${s.command}`)
    .join('\n\n');

  const handleCopy = (text: string, index?: number) => {
    navigator.clipboard.writeText(text);
    if (index !== undefined) {
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 2000);
    } else {
      setCopiedAll(true);
      setTimeout(() => setCopiedAll(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-3xl w-full p-6 shadow-2xl space-y-6 my-8">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Terminal className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Safe Git History Remediation Guide</h3>
              <p className="text-xs text-slate-400">
                Purge <span className="text-amber-300 font-mono">{finding.matchedPatternName}</span> from{' '}
                <span className="text-slate-200 font-mono">{finding.filePath}</span> (Commit {finding.shortHash})
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Server Safeguard Banner */}
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-start gap-3 text-xs text-rose-300">
          <ShieldAlert className="w-5 h-5 text-rose-400 flex-shrink-0 mt-0.5" />
          <div className="space-y-1">
            <span className="font-bold uppercase tracking-wider block text-rose-200">
              Server-Side Execution Safeguard
            </span>
            <p>
              SentraScan <strong>never</strong> runs git history rewrite commands on the server. History rewrites alter commit hashes permanently. Copy these safe recipes and execute them in your local workstation terminal.
            </p>
          </div>
        </div>

        {/* Revocation Warning */}
        <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2 text-xs">
          <div className="flex items-center gap-2 text-amber-300 font-bold">
            <KeyRound className="w-4 h-4" />
            <span>Step 0: Mandatory Credential Invalidation</span>
          </div>
          <p className="text-slate-300">
            Removing a credential from Git history <span className="text-white font-semibold">DOES NOT</span> invalidate it at the provider. If this secret was ever pushed to a public or shared remote, consider it compromised.
          </p>
          <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 font-medium text-emerald-400">
            {finding.recommendation}
          </div>
        </div>

        {/* Steps */}
        <div className="space-y-4 max-h-[420px] overflow-y-auto pr-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
              Local Git Commands Recipe
            </span>
            <button
              onClick={() => handleCopy(fullScript)}
              className="cyber-button-secondary text-xs px-3 py-1.5"
            >
              {copiedAll ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedAll ? 'Copied Full Script!' : 'Copy Entire Recipe'}</span>
            </button>
          </div>

          {steps.map((step, idx) => (
            <div key={idx} className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-200">{step.title}</span>
                {step.command && (
                  <button
                    onClick={() => handleCopy(step.command!, idx)}
                    className="text-xs text-slate-400 hover:text-emerald-400 flex items-center gap-1 transition"
                  >
                    {copiedIndex === idx ? (
                      <Check className="w-3 h-3 text-emerald-400" />
                    ) : (
                      <Copy className="w-3 h-3" />
                    )}
                    <span>{copiedIndex === idx ? 'Copied' : 'Copy'}</span>
                  </button>
                )}
              </div>
              <p className="text-[11px] text-slate-400">{step.description}</p>
              {step.command && (
                <pre className="p-2.5 rounded-lg bg-slate-900 font-mono text-xs text-slate-200 overflow-x-auto border border-slate-800">
                  {step.command}
                </pre>
              )}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="flex justify-end pt-2 border-t border-slate-800">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold transition"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
