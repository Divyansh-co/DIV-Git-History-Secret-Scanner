import React, { useState, useRef } from 'react';
import { GitBranch, Upload, Sparkles, ChevronDown, ChevronUp, Link as LinkIcon, AlertCircle, FileArchive } from 'lucide-react';
import { TuningPanel } from './TuningPanel';

interface ScanInputCardProps {
  onScanUrl: (url: string, branch?: string) => void;
  onScanZip: (file: File) => void;
  onScanDemo: () => void;
  isScanning: boolean;
  entropyThreshold: number;
  setEntropyThreshold: (v: number) => void;
  minEntropyLength: number;
  setMinEntropyLength: (v: number) => void;
  activeCategories: string[];
  setActiveCategories: (cats: string[]) => void;
}

export const ScanInputCard: React.FC<ScanInputCardProps> = ({
  onScanUrl,
  onScanZip,
  onScanDemo,
  isScanning,
  entropyThreshold,
  setEntropyThreshold,
  minEntropyLength,
  setMinEntropyLength,
  activeCategories,
  setActiveCategories,
}) => {
  const [activeTab, setActiveTab] = useState<'url' | 'zip' | 'demo'>('url');
  const [url, setUrl] = useState('');
  const [branch, setBranch] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [showTuning, setShowTuning] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUrlSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    if (!url.trim()) {
      setErrorMessage('Please enter a Git repository URL (e.g., https://github.com/owner/repo)');
      return;
    }
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      setErrorMessage('Repository URL must start with https:// or http://');
      return;
    }
    onScanUrl(url.trim(), branch.trim() || undefined);
  };

  const handleZipSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    if (!selectedFile) {
      setErrorMessage('Please select or drag a .zip file containing a Git repository.');
      return;
    }
    onScanZip(selectedFile);
  };

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (!file.name.endsWith('.zip')) {
        setErrorMessage('Only .zip files are supported.');
        return;
      }
      setSelectedFile(file);
      setErrorMessage(null);
    }
  };

  return (
    <div className="glass-card p-6 md:p-8 space-y-6 relative overflow-hidden">
      {/* Decorative Background Glow */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />

      {/* Tabs */}
      <div className="flex border-b border-slate-800 gap-2">
        <button
          onClick={() => {
            setActiveTab('url');
            setErrorMessage(null);
          }}
          className={`pb-3 px-4 font-semibold text-sm transition-all flex items-center gap-2 border-b-2 ${
            activeTab === 'url'
              ? 'border-emerald-400 text-emerald-400 font-bold'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <LinkIcon className="w-4 h-4" />
          <span>Public Git URL</span>
        </button>

        <button
          onClick={() => {
            setActiveTab('zip');
            setErrorMessage(null);
          }}
          className={`pb-3 px-4 font-semibold text-sm transition-all flex items-center gap-2 border-b-2 ${
            activeTab === 'zip'
              ? 'border-emerald-400 text-emerald-400 font-bold'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Upload className="w-4 h-4" />
          <span>Upload .ZIP Archive</span>
        </button>

        <button
          onClick={() => {
            setActiveTab('demo');
            setErrorMessage(null);
          }}
          className={`pb-3 px-4 font-semibold text-sm transition-all flex items-center gap-2 border-b-2 ${
            activeTab === 'demo'
              ? 'border-cyan-400 text-cyan-400 font-bold'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Sparkles className="w-4 h-4 text-cyan-400" />
          <span>Demo Vulnerable Repo</span>
        </button>
      </div>

      {/* Tab 1: Git URL Form */}
      {activeTab === 'url' && (
        <form onSubmit={handleUrlSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="md:col-span-3 space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">
                Git Clone URL (GitHub, GitLab, Bitbucket)
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://github.com/username/repository.git"
                  disabled={isScanning}
                  className="w-full bg-slate-900/80 border border-slate-700/80 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 font-mono transition"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">
                Branch (Optional)
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={branch}
                  onChange={(e) => setBranch(e.target.value)}
                  placeholder="main or HEAD"
                  disabled={isScanning}
                  className="w-full bg-slate-900/80 border border-slate-700/80 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 font-mono transition"
                />
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
            <button
              type="button"
              onClick={() => setShowTuning(!showTuning)}
              className="text-xs text-slate-400 hover:text-emerald-400 transition flex items-center gap-1.5"
            >
              <span>Detection & Entropy Tuning</span>
              {showTuning ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>

            <button
              type="submit"
              disabled={isScanning}
              className="cyber-button-primary px-6 py-3 text-sm font-semibold tracking-wide w-full sm:w-auto"
            >
              <GitBranch className="w-4 h-4" />
              <span>{isScanning ? 'Scanning Commit History...' : 'Start Full History Scan'}</span>
            </button>
          </div>
        </form>
      )}

      {/* Tab 2: Upload ZIP */}
      {activeTab === 'zip' && (
        <form onSubmit={handleZipSubmit} className="space-y-4">
          <input
            type="file"
            ref={fileInputRef}
            onChange={(e) => {
              if (e.target.files && e.target.files[0]) {
                setSelectedFile(e.target.files[0]);
                setErrorMessage(null);
              }
            }}
            accept=".zip"
            className="hidden"
          />

          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragOver(true);
            }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={handleFileDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${
              isDragOver
                ? 'border-emerald-400 bg-emerald-500/10'
                : 'border-slate-700 hover:border-slate-500 bg-slate-900/50'
            }`}
          >
            <div className="flex flex-col items-center justify-center space-y-3">
              <div className="w-12 h-12 rounded-xl bg-slate-800 flex items-center justify-center text-emerald-400 border border-slate-700">
                <FileArchive className="w-6 h-6" />
              </div>
              {selectedFile ? (
                <div>
                  <p className="text-sm font-bold text-white">{selectedFile.name}</p>
                  <p className="text-xs text-slate-400">
                    {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB • Ready to scan
                  </p>
                </div>
              ) : (
                <div>
                  <p className="text-sm font-semibold text-slate-200">
                    Drag and drop your Git repository <span className="text-emerald-400">.zip</span> here, or browse
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    Must contain the <code className="text-emerald-300 font-mono">.git</code> folder. Max size: 50MB
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
            <button
              type="button"
              onClick={() => setShowTuning(!showTuning)}
              className="text-xs text-slate-400 hover:text-emerald-400 transition flex items-center gap-1.5"
            >
              <span>Detection & Entropy Tuning</span>
              {showTuning ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>

            <button
              type="submit"
              disabled={isScanning || !selectedFile}
              className="cyber-button-primary px-6 py-3 text-sm font-semibold tracking-wide w-full sm:w-auto"
            >
              <Upload className="w-4 h-4" />
              <span>{isScanning ? 'Extracting & Scanning...' : 'Scan Uploaded Archive'}</span>
            </button>
          </div>
        </form>
      )}

      {/* Tab 3: Demo Repo */}
      {activeTab === 'demo' && (
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2">
            <div className="flex items-center gap-2 text-cyan-300 font-bold text-sm">
              <Sparkles className="w-4 h-4" />
              <span>Instant Test Repository with Historical Secret Leaks</span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              SentraScan will dynamically spin up a 5-commit repository inside the ephemeral sandbox. It includes real-world scenarios: an AWS IAM access key and MongoDB URI committed in commit 1 and "deleted" in commit 3, followed by JWT tokens, Slack webhooks, and Google API keys committed across past commits.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
            <button
              type="button"
              onClick={() => setShowTuning(!showTuning)}
              className="text-xs text-slate-400 hover:text-emerald-400 transition flex items-center gap-1.5"
            >
              <span>Detection & Entropy Tuning</span>
              {showTuning ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>

            <button
              type="button"
              onClick={onScanDemo}
              disabled={isScanning}
              className="cyber-button-primary px-6 py-3 text-sm font-semibold tracking-wide bg-gradient-to-r from-cyan-500 to-emerald-500 hover:from-cyan-400 hover:to-emerald-400 w-full sm:w-auto"
            >
              <Sparkles className="w-4 h-4" />
              <span>{isScanning ? 'Analyzing Demo Repo...' : 'Launch Demo Scan (1-Click)'}</span>
            </button>
          </div>
        </div>
      )}

      {/* Error Banner */}
      {errorMessage && (
        <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Expandable Tuning Panel */}
      {showTuning && (
        <TuningPanel
          entropyThreshold={entropyThreshold}
          setEntropyThreshold={setEntropyThreshold}
          minEntropyLength={minEntropyLength}
          setMinEntropyLength={setMinEntropyLength}
          activeCategories={activeCategories}
          setActiveCategories={setActiveCategories}
        />
      )}
    </div>
  );
};
