import React, { useState, useRef } from 'react';
import { Header } from './components/Header';
import { ScanInputCard } from './components/ScanInputCard';
import { ScanningRadar } from './components/ScanningRadar';
import { FindingsDashboard } from './components/FindingsDashboard';
import { RemediationModal } from './components/RemediationModal';
import { BatchRemediationModal } from './components/BatchRemediationModal';
import { ScanProgress, ScanResult, SecretFinding } from './types';
import { ShieldCheck, Lock, Terminal, AlertTriangle } from 'lucide-react';

export const App: React.FC = () => {
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [progress, setProgress] = useState<ScanProgress>({
    status: 'initializing',
    totalCommits: 0,
    scannedCommits: 0,
    findingsCount: 0,
    message: '',
  });
  const [activeFindingForRemediation, setActiveFindingForRemediation] =
    useState<SecretFinding | null>(null);
  const [showBatchRemediation, setShowBatchRemediation] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);

  // Detection and Entropy Tuning State
  const [entropyThreshold, setEntropyThreshold] = useState<number>(4.2);
  const [minEntropyLength, setMinEntropyLength] = useState<number>(16);
  const [activeCategories, setActiveCategories] = useState<string[]>([
    'cloud',
    'tokens',
    'keys',
    'database',
    'passwords',
    'entropy',
  ]);

  const eventSourceRef = useRef<EventSource | null>(null);

  const startSseListener = (jobId: string) => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const sse = new EventSource(`/api/scan/progress/${jobId}`);
    eventSourceRef.current = sse;

    sse.onmessage = (event) => {
      try {
        const data: ScanProgress = JSON.parse(event.data);
        setProgress(data);
      } catch (e) {
        console.error('Failed to parse SSE payload:', e);
      }
    };

    sse.onerror = () => {
      sse.close();
    };
  };

  const closeSse = () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
  };

  // Scan via URL
  const handleScanUrl = async (url: string, branch?: string) => {
    const jobId = crypto.randomUUID();
    setIsScanning(true);
    setScanError(null);
    setProgress({
      status: 'cloning',
      totalCommits: 0,
      scannedCommits: 0,
      findingsCount: 0,
      message: 'Connecting to repository and cloning in ephemeral sandbox...',
    });

    startSseListener(jobId);

    try {
      const response = await fetch('/api/scan/url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url,
          branch,
          entropyThreshold,
          minEntropyLength,
          activeCategories,
          jobId,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to scan repository.');
      }

      setScanResult(data);
    } catch (err: any) {
      setScanError(err.message || 'An error occurred during repository scan.');
    } finally {
      setIsScanning(false);
      closeSse();
    }
  };

  // Scan via uploaded .zip
  const handleScanZip = async (file: File) => {
    const jobId = crypto.randomUUID();
    setIsScanning(true);
    setScanError(null);
    setProgress({
      status: 'extracting',
      totalCommits: 0,
      scannedCommits: 0,
      findingsCount: 0,
      message: 'Extracting and verifying .git repository tree...',
    });

    startSseListener(jobId);

    const formData = new FormData();
    formData.append('repoZip', file);
    formData.append('entropyThreshold', entropyThreshold.toString());
    formData.append('minEntropyLength', minEntropyLength.toString());
    formData.append('activeCategories', JSON.stringify(activeCategories));
    formData.append('jobId', jobId);

    try {
      const response = await fetch('/api/scan/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to process repository archive.');
      }

      setScanResult(data);
    } catch (err: any) {
      setScanError(err.message || 'An error occurred during zip archive scan.');
    } finally {
      setIsScanning(false);
      closeSse();
    }
  };

  // Scan Demo Repo
  const handleScanDemo = async () => {
    const jobId = crypto.randomUUID();
    setIsScanning(true);
    setScanError(null);
    setProgress({
      status: 'scanning',
      totalCommits: 5,
      scannedCommits: 0,
      findingsCount: 0,
      message: 'Spinning up ephemeral demo repository with historical secret commits...',
    });

    startSseListener(jobId);

    try {
      const response = await fetch('/api/scan/demo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entropyThreshold,
          minEntropyLength,
          activeCategories,
          jobId,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to scan demo repository.');
      }

      setScanResult(data);
    } catch (err: any) {
      setScanError(err.message || 'An error occurred during demo scan.');
    } finally {
      setIsScanning(false);
      closeSse();
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#070b12] text-slate-100 font-sans selection:bg-emerald-500/30 selection:text-emerald-300">
      <Header />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Error Alert Banner */}
        {scanError && (
          <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/40 text-rose-200 text-sm flex items-start gap-3 shadow-lg">
            <AlertTriangle className="w-5 h-5 text-rose-400 flex-shrink-0 mt-0.5" />
            <div className="space-y-1">
              <strong className="font-bold block text-white">Scan Failed</strong>
              <p>{scanError}</p>
            </div>
          </div>
        )}

        {/* View State Logic */}
        {isScanning ? (
          <ScanningRadar progress={progress} />
        ) : scanResult ? (
          <FindingsDashboard
            scanResult={scanResult}
            onOpenRemediation={(f) => setActiveFindingForRemediation(f)}
            onOpenBatchRemediation={() => setShowBatchRemediation(true)}
            onNewScan={() => setScanResult(null)}
          />
        ) : (
          <div className="space-y-8">
            {/* Hero Section */}
            <div className="text-center space-y-3 max-w-3xl mx-auto pt-4 pb-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Scans full commit history, not just HEAD</span>
              </div>
              <h1 className="text-4xl sm:text-5xl font-black tracking-tight text-white">
                Find secrets in your{' '}
                <span className="bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 bg-clip-text text-transparent">
                  git history
                </span>
              </h1>
              <p className="text-base text-slate-400 leading-relaxed">
                Deleting a secret in a later commit doesn't remove it from git. SentraScan walks every commit in a repo's history and flags API keys, tokens, and high-entropy strings — including ones that were removed commits ago.
              </p>
            </div>

            {/* Input Form Card */}
            <ScanInputCard
              onScanUrl={handleScanUrl}
              onScanZip={handleScanZip}
              onScanDemo={handleScanDemo}
              isScanning={isScanning}
              entropyThreshold={entropyThreshold}
              setEntropyThreshold={setEntropyThreshold}
              minEntropyLength={minEntropyLength}
              setMinEntropyLength={setMinEntropyLength}
              activeCategories={activeCategories}
              setActiveCategories={setActiveCategories}
            />

            {/* Trust & Architecture Features Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4">
              <div className="glass-card p-5 space-y-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                  <Terminal className="w-5 h-5" />
                </div>
                <h3 className="text-sm font-bold text-white">Full History Reconstruction</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Walks the commit log using <code className="text-emerald-400 font-mono">git rev-list</code> to calculate relative depth (<code className="text-slate-300">X commits ago</code>) and exact ±3 lines context.
                </p>
              </div>

              <div className="glass-card p-5 space-y-2.5">
                <div className="w-9 h-9 rounded-xl bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <h3 className="text-sm font-bold text-white">Pattern Matching & Entropy</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Dual-layer detection: high-fidelity regex for AWS, Google, GitHub, Slack, and private keys + Shannon entropy scoring with customizable thresholds.
                </p>
              </div>

              <div className="glass-card p-5 space-y-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
                  <Lock className="w-5 h-5" />
                </div>
                <h3 className="text-sm font-bold text-white">Safe Local Remediation</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Generates ready-to-run <code className="text-amber-300 font-mono">git filter-repo</code> recipes for your terminal. The server never executes any history rewrites.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Remediation Modals */}
        {activeFindingForRemediation && (
          <RemediationModal
            finding={activeFindingForRemediation}
            onClose={() => setActiveFindingForRemediation(null)}
          />
        )}

        {showBatchRemediation && scanResult && (
          <BatchRemediationModal
            findings={scanResult.findings}
            onClose={() => setShowBatchRemediation(false)}
          />
        )}
      </main>

      <footer className="border-t border-slate-900 bg-slate-950/60 py-6 text-center text-xs text-slate-400 font-mono">
        <p>SentraScan • Ephemeral Sandboxed Git Secret Scanner • Production Ready</p>
      </footer>
    </div>
  );
};
