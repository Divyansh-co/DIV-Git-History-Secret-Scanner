import React, { useState } from 'react';
import { SecretFinding } from '../types';
import { X, Copy, Check, Terminal, ShieldAlert, FileText } from 'lucide-react';

interface BatchRemediationModalProps {
  findings: SecretFinding[];
  onClose: () => void;
}

export const BatchRemediationModal: React.FC<BatchRemediationModalProps> = ({ findings, onClose }) => {
  const [copied, setCopied] = useState(false);

  const uniqueSecrets = Array.from(new Set(findings.map((f) => f.secretValue)));
  const uniqueFiles = Array.from(new Set(findings.map((f) => f.filePath)));

  const expressionsText = uniqueSecrets
    .map((s) => `${s.replace(/"/g, '\\"')}==>***REDACTED_SECRET***`)
    .join('\n');

  const batchScript = `#!/usr/bin/env bash
# ==============================================================================
# SentraScan Automated History Remediation Script (git-filter-repo)
# ==============================================================================
# SAFEGUARD: This script must be executed on your local workstation clone.
# NEVER run history rewrites without taking a backup first.

set -e

echo "==> Step 1: Creating safety backup clone..."
git clone --mirror . ../repo-backup-before-filter.git

echo "==> Step 2: Creating secret redaction expression file..."
cat << 'EOF' > sentrascan_replace.txt
${expressionsText}
EOF

echo "==> Step 3: Rewriting history with git-filter-repo (Redacting ${uniqueSecrets.length} secrets)..."
git filter-repo --replace-text sentrascan_replace.txt --force
rm sentrascan_replace.txt

echo "==> Step 4: Verification complete! You can inspect git log to verify redaction."
echo "==> When verified, force push to remote:"
echo "    git push origin --force --all"
echo "    git push origin --force --tags"
`;

  const handleCopy = () => {
    navigator.clipboard.writeText(batchScript);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-3xl w-full p-6 shadow-2xl space-y-5 my-8">
        <div className="flex items-start justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Terminal className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Batch Git History Purge Script</h3>
              <p className="text-xs text-slate-400">
                Redact all {uniqueSecrets.length} exposed secrets across {uniqueFiles.length} files in all past commits
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

        {/* Server Safeguard Alert */}
        <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center gap-3 text-xs text-rose-300">
          <ShieldAlert className="w-5 h-5 text-rose-400 flex-shrink-0" />
          <div>
            <strong className="text-rose-200">Zero Server Execution Guarantee: </strong>
            SentraScan produces this script strictly for your offline terminal. It will never run destructive git rewrite commands on the server.
          </div>
        </div>

        {/* Script Block */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-emerald-400" />
              <span>purge_history.sh</span>
            </span>
            <button
              onClick={handleCopy}
              className="cyber-button-primary text-xs px-3.5 py-1.5 font-semibold"
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied Script!' : 'Copy Shell Script'}</span>
            </button>
          </div>
          <pre className="p-4 rounded-xl bg-slate-950 font-mono text-xs text-slate-200 overflow-x-auto border border-slate-800 max-h-80">
            {batchScript}
          </pre>
        </div>

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
