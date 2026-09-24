export type Severity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export type PatternCategory =
  | 'cloud'
  | 'tokens'
  | 'keys'
  | 'database'
  | 'passwords'
  | 'entropy'
  | 'other';

export interface ContextLine {
  lineNumber: number;
  content: string;
}

export interface SecretFinding {
  id: string;
  commitHash: string;
  shortHash: string;
  authorName: string;
  authorEmail: string;
  commitDate: string;
  commitMessage: string;
  commitsAgo: number;
  filePath: string;
  lineNumber: number;
  lineContent: string;
  contextBefore: ContextLine[];
  contextAfter: ContextLine[];
  matchedPatternName: string;
  patternCategory: PatternCategory;
  secretValue: string;
  entropyScore: number;
  severity: Severity;
  recommendation: string;
  isHighEntropyOnly: boolean;
}

export interface ScanSummary {
  repoName: string;
  branch: string;
  totalCommitsScanned: number;
  totalFindings: number;
  findingsBySeverity: {
    CRITICAL: number;
    HIGH: number;
    MEDIUM: number;
    LOW: number;
  };
  findingsByCategory: Record<string, number>;
  scanDurationMs: number;
  topCompromisedFiles: Array<{ filePath: string; count: number }>;
}

export interface ScanResult {
  scanId: string;
  summary: ScanSummary;
  findings: SecretFinding[];
}

export interface ScanProgress {
  status: 'initializing' | 'cloning' | 'extracting' | 'scanning' | 'completed' | 'error';
  totalCommits: number;
  scannedCommits: number;
  currentCommitHash?: string;
  findingsCount: number;
  message?: string;
}

export interface RemediationRecipe {
  title: string;
  summary: string;
  tool: string;
  steps: Array<{
    title: string;
    description: string;
    command?: string;
  }>;
  revocationNotes: string[];
  warning: string;
}
