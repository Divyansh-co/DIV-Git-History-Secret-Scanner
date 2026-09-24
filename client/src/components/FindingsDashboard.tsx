import React, { useState, useMemo } from 'react';
import { ScanResult, SecretFinding, Severity } from '../types';
import { FindingCard } from './FindingCard';
import {
  ShieldAlert,
  Search,
  Download,
  Terminal,
  FileSpreadsheet,
  CheckCircle2,
  GitCommit,
  Clock,
  Layers,
  Sparkles,
} from 'lucide-react';

interface FindingsDashboardProps {
  scanResult: ScanResult;
  onOpenRemediation: (finding: SecretFinding) => void;
  onOpenBatchRemediation: () => void;
  onNewScan: () => void;
}

export const FindingsDashboard: React.FC<FindingsDashboardProps> = ({
  scanResult,
  onOpenRemediation,
  onOpenBatchRemediation,
  onNewScan,
}) => {
  const { summary, findings } = scanResult;

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSeverity, setSelectedSeverity] = useState<Severity | 'ALL'>('ALL');
  const [sortOrder, setSortOrder] = useState<'severity' | 'commitsAgoDesc' | 'commitsAgoAsc'>('severity');

  // Filter and sort findings
  const filteredFindings = useMemo(() => {
    return findings
      .filter((f) => {
        if (selectedSeverity !== 'ALL' && f.severity !== selectedSeverity) {
          return false;
        }
        if (searchQuery.trim().length > 0) {
          const q = searchQuery.toLowerCase();
          return (
            f.filePath.toLowerCase().includes(q) ||
            f.matchedPatternName.toLowerCase().includes(q) ||
            f.shortHash.toLowerCase().includes(q) ||
            f.authorName.toLowerCase().includes(q) ||
            f.secretValue.toLowerCase().includes(q) ||
            f.commitMessage.toLowerCase().includes(q)
          );
        }
        return true;
      })
      .sort((a, b) => {
        if (sortOrder === 'commitsAgoAsc') {
          return a.commitsAgo - b.commitsAgo;
        }
        if (sortOrder === 'commitsAgoDesc') {
          return b.commitsAgo - a.commitsAgo;
        }
        const rank: Record<Severity, number> = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
        const diff = rank[b.severity] - rank[a.severity];
        if (diff !== 0) return diff;
        return a.commitsAgo - b.commitsAgo;
      });
  }, [findings, selectedSeverity, searchQuery, sortOrder]);

  // Export handlers
  const exportJson = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(scanResult, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `sentrascan-report-${summary.repoName}-${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const exportMarkdown = () => {
    let md = `# SentraScan Security Audit Report\n\n`;
    md += `- **Repository / Branch**: ${summary.repoName} (${summary.branch})\n`;
    md += `- **Total Commits Scanned**: ${summary.totalCommitsScanned}\n`;
    md += `- **Total Secrets Discovered**: ${summary.totalFindings}\n`;
    md += `- **Scan Duration**: ${(summary.scanDurationMs / 1000).toFixed(2)}s\n\n`;
    md += `## Severity Breakdown\n`;
    md += `- **CRITICAL**: ${summary.findingsBySeverity.CRITICAL}\n`;
    md += `- **HIGH**: ${summary.findingsBySeverity.HIGH}\n`;
    md += `- **MEDIUM**: ${summary.findingsBySeverity.MEDIUM}\n`;
    md += `- **LOW / HIGH-ENTROPY**: ${summary.findingsBySeverity.LOW}\n\n`;
    md += `## Findings Detail\n\n`;

    findings.forEach((f, idx) => {
      md += `### ${idx + 1}. [${f.severity}] ${f.matchedPatternName}\n`;
      md += `- **File**: \`${f.filePath}:${f.lineNumber}\`\n`;
      md += `- **Commit**: \`${f.shortHash}\` (${f.commitsAgo} commits ago)\n`;
      md += `- **Author**: ${f.authorName} <${f.authorEmail}>\n`;
      md += `- **Date**: ${f.commitDate}\n`;
      md += `- **Entropy Score**: ${f.entropyScore}\n`;
      md += `- **Recommendation**: ${f.recommendation}\n\n`;
      md += `\`\`\`\n${f.lineContent}\n\`\`\`\n\n`;
    });

    const dataStr = 'data:text/markdown;charset=utf-8,' + encodeURIComponent(md);
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `sentrascan-report-${summary.repoName}-${Date.now()}.md`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <div className="space-y-6">
      {/* Executive KPI Header */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5">
        <div className="glass-card p-4 space-y-1">
          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <GitCommit className="w-3.5 h-3.5 text-emerald-400" />
            <span>Commits Scanned</span>
          </div>
          <p className="text-2xl font-black text-white">{summary.totalCommitsScanned}</p>
          <span className="text-[11px] text-slate-500 font-mono">Full tree history</span>
        </div>

        <div className="glass-card p-4 space-y-1">
          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
            <span>Total Secrets</span>
          </div>
          <p className="text-2xl font-black text-rose-400">{summary.totalFindings}</p>
          <span className="text-[11px] text-slate-500 font-mono">
            {summary.findingsBySeverity.CRITICAL} Critical • {summary.findingsBySeverity.HIGH} High
          </span>
        </div>

        <div className="glass-card p-4 space-y-1">
          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <Layers className="w-3.5 h-3.5 text-amber-400" />
            <span>Medium / Entropy</span>
          </div>
          <p className="text-2xl font-black text-amber-400">
            {summary.findingsBySeverity.MEDIUM + summary.findingsBySeverity.LOW}
          </p>
          <span className="text-[11px] text-slate-500 font-mono">Shannon scored</span>
        </div>

        <div className="glass-card p-4 space-y-1">
          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <Clock className="w-3.5 h-3.5 text-cyan-400" />
            <span>Scan Duration</span>
          </div>
          <p className="text-2xl font-black text-cyan-400">
            {(summary.scanDurationMs / 1000).toFixed(2)}s
          </p>
          <span className="text-[11px] text-slate-500 font-mono">Ephemeral sandbox</span>
        </div>

        <div className="glass-card p-4 space-y-2 col-span-2 lg:col-span-1 flex flex-col justify-center">
          <button
            onClick={onNewScan}
            className="cyber-button-primary text-xs py-2 w-full font-bold"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>New Scan</span>
          </button>
          <button
            onClick={onOpenBatchRemediation}
            className="cyber-button-secondary text-xs py-2 w-full font-bold text-amber-300 border-amber-500/30"
          >
            <Terminal className="w-3.5 h-3.5 text-amber-400" />
            <span>Batch Fix Script</span>
          </button>
        </div>
      </div>

      {/* Top Compromised Files Pills */}
      {summary.topCompromisedFiles.length > 0 && (
        <div className="glass-card p-4 flex flex-wrap items-center gap-2 text-xs">
          <span className="text-slate-400 font-semibold mr-1">Hotspot Files:</span>
          {summary.topCompromisedFiles.map((f) => (
            <span
              key={f.filePath}
              className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 font-mono text-slate-300 flex items-center gap-1.5"
            >
              <span>{f.filePath}</span>
              <span className="px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-300 text-[10px] font-bold">
                {f.count}
              </span>
            </span>
          ))}
        </div>
      )}

      {/* Search & Filter Deck */}
      <div className="glass-card p-4 flex flex-wrap items-center justify-between gap-4">
        {/* Search */}
        <div className="relative flex-1 min-w-[240px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by file, secret, pattern, author, commit..."
            className="w-full bg-slate-900/90 border border-slate-700 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500 font-mono"
          />
        </div>

        {/* Severity Filter Chips */}
        <div className="flex items-center gap-1.5">
          {(['ALL', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] as const).map((sev) => {
            const isActive = selectedSeverity === sev;
            return (
              <button
                key={sev}
                onClick={() => setSelectedSeverity(sev)}
                className={`text-xs px-3 py-1.5 rounded-lg font-semibold transition ${
                  isActive
                    ? 'bg-emerald-500 text-slate-950 shadow-[0_0_12px_rgba(16,185,129,0.4)]'
                    : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
                }`}
              >
                {sev}
              </button>
            );
          })}
        </div>

        {/* Export Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={exportJson}
            className="cyber-button-secondary text-xs px-3 py-1.5"
            title="Download full scan data in JSON"
          >
            <Download className="w-3.5 h-3.5 text-emerald-400" />
            <span>JSON</span>
          </button>
          <button
            onClick={exportMarkdown}
            className="cyber-button-secondary text-xs px-3 py-1.5"
            title="Download audit report in Markdown format"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-cyan-400" />
            <span>Markdown</span>
          </button>
        </div>
      </div>

      {/* Findings List */}
      <div className="space-y-4">
        {filteredFindings.length === 0 ? (
          <div className="glass-card p-12 text-center space-y-3">
            <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto" />
            <h3 className="text-lg font-bold text-white">No Matching Secrets Found</h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              {findings.length === 0
                ? 'Great news! No credentials or high-entropy secrets were detected across the entire scanned history.'
                : 'No secrets match the current search query and severity filters.'}
            </p>
          </div>
        ) : (
          filteredFindings.map((finding) => (
            <FindingCard
              key={finding.id}
              finding={finding}
              onOpenRemediation={onOpenRemediation}
            />
          ))
        )}
      </div>
    </div>
  );
};
