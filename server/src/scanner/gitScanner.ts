import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { v4 as uuidv4 } from 'uuid';
import {
  ContextLine,
  ScanOptions,
  ScanProgress,
  ScanResult,
  ScanSummary,
  SecretFinding,
  Severity,
} from '../types.js';
import { SECRET_PATTERNS } from './patterns.js';
import { calculateShannonEntropy, findHighEntropyCandidates } from './entropy.js';

const execFileAsync = promisify(execFile);

// Files typically producing noise or binary blobs
const SKIP_FILE_EXTENSIONS = new Set([
  '.lock',
  '.lockb',
  '.min.js',
  '.min.css',
  '.map',
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.svg',
  '.ico',
  '.pdf',
  '.zip',
  '.tar',
  '.gz',
  '.woff',
  '.woff2',
  '.ttf',
  '.eot',
]);

interface ParsedHunkLine {
  type: 'add' | 'del' | 'context';
  rawText: string;
  newLineNumber?: number;
}

export class GitScanner {
  private repoDir: string;
  private options: ScanOptions;
  private abortController: AbortController;

  constructor(repoDir: string, options: ScanOptions = {}, abortController = new AbortController()) {
    this.repoDir = repoDir;
    this.options = {
      entropyThreshold: options.entropyThreshold ?? 4.2,
      minEntropyLength: options.minEntropyLength ?? 16,
      scanAllBranches: options.scanAllBranches ?? false,
      maxCommits: options.maxCommits ?? 1000,
      activeCategories: options.activeCategories ?? [],
    };
    this.abortController = abortController;
  }

  private async runGit(args: string[], maxBuffer = 10 * 1024 * 1024): Promise<string> {
    const safeArgs = [
      '-c', 'core.hooksPath=/dev/null',
      '-c', 'core.pager=cat',
      '-c', 'safe.directory=*',
      ...args,
    ];

    const { stdout } = await execFileAsync('git', safeArgs, {
      cwd: this.repoDir,
      maxBuffer,
      signal: this.abortController.signal,
      env: {
        ...process.env,
        GIT_TERMINAL_PROMPT: '0',
        LC_ALL: 'C',
      },
    });

    return stdout;
  }

  public async scan(onProgress?: (p: ScanProgress) => void, repoName?: string): Promise<ScanResult> {
    const startTime = Date.now();
    const scanId = uuidv4();

    // 1. Verify valid git repository
    try {
      await this.runGit(['rev-parse', '--is-inside-work-tree']);
    } catch {
      throw new Error('Target folder does not contain a valid Git repository (.git not found or corrupt).');
    }

    // Get the active branch name (used for the summary, not as repoName)
    let branchName = 'HEAD';
    try {
      branchName = (await this.runGit(['rev-parse', '--abbrev-ref', 'HEAD'])).trim();
    } catch {
      branchName = 'main';
    }

    // 3. Get ordered commit hashes (from oldest to newest)
    const revArgs = this.options.scanAllBranches
      ? ['rev-list', '--reverse', '--all']
      : ['rev-list', '--reverse', 'HEAD'];

    const revListOutput = await this.runGit(revArgs);
    let commitHashes = revListOutput
      .split('\n')
      .map((h) => h.trim())
      .filter((h) => h.length > 0);

    if (commitHashes.length === 0) {
      return {
        scanId,
        summary: {
          repoName: repoName ?? 'empty-repository',
          branch: branchName,
          totalCommitsScanned: 0,
          totalFindings: 0,
          findingsBySeverity: { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 },
          findingsByCategory: {},
          scanDurationMs: Date.now() - startTime,
          topCompromisedFiles: [],
        },
        findings: [],
      };
    }

    if (this.options.maxCommits && commitHashes.length > this.options.maxCommits) {
      // If repository exceeds max limit, take the most recent N commits
      commitHashes = commitHashes.slice(-this.options.maxCommits);
    }

    const totalCommits = commitHashes.length;
    const findings: SecretFinding[] = [];
    const seenSecretKeys = new Set<string>();

    onProgress?.({
      status: 'scanning',
      totalCommits,
      scannedCommits: 0,
      findingsCount: 0,
      message: `Starting scan across ${totalCommits} commits...`,
    });

    // 4. Iterate over commits
    for (let i = 0; i < totalCommits; i++) {
      if (this.abortController.signal.aborted) {
        throw new Error('Scan operation cancelled or timed out.');
      }

      const commitHash = commitHashes[i];
      const commitsAgo = totalCommits - 1 - i; // 0 for HEAD (tip), 1 for commit before HEAD, etc.

      // Fetch metadata: Hash, ShortHash, AuthorName, AuthorEmail, Date, Subject
      let metaStr = '';
      try {
        metaStr = await this.runGit([
          'show',
          '-s',
          '--format=%H|%h|%an|%ae|%aI|%s',
          commitHash,
        ]);
      } catch {
        continue;
      }

      const [fullHash, shortHash, authorName, authorEmail, commitDate, ...subjectParts] =
        metaStr.trim().split('|');
      const commitMessage = subjectParts.join('|');

      // Fetch diff for this commit
      let diffOutput = '';
      try {
        diffOutput = await this.runGit([
          'show',
          '--unified=3',
          '--no-color',
          '--no-ext-diff',
          '-M',
          commitHash,
        ]);
      } catch {
        continue;
      }

      this.analyzeDiff(
        diffOutput,
        {
          commitHash: fullHash || commitHash,
          shortHash: shortHash || commitHash.substring(0, 8),
          authorName: authorName || 'Unknown Author',
          authorEmail: authorEmail || 'unknown@example.com',
          commitDate: commitDate || new Date().toISOString(),
          commitMessage: commitMessage || '',
          commitsAgo,
        },
        findings,
        seenSecretKeys
      );

      if (i % 5 === 0 || i === totalCommits - 1) {
        onProgress?.({
          status: 'scanning',
          totalCommits,
          scannedCommits: i + 1,
          currentCommitHash: shortHash || commitHash.substring(0, 8),
          findingsCount: findings.length,
          message: `Inspecting commit ${i + 1}/${totalCommits} (${shortHash})`,
        });
      }
    }

    // Sort findings: CRITICAL first, then HIGH, then MEDIUM, then LOW; then most recent commits ago
    const severityRank: Record<Severity, number> = {
      CRITICAL: 4,
      HIGH: 3,
      MEDIUM: 2,
      LOW: 1,
    };

    findings.sort((a, b) => {
      const diff = severityRank[b.severity] - severityRank[a.severity];
      if (diff !== 0) return diff;
      return a.commitsAgo - b.commitsAgo;
    });

    // Build Summary
    const findingsBySeverity = {
      CRITICAL: 0,
      HIGH: 0,
      MEDIUM: 0,
      LOW: 0,
    };
    const findingsByCategory: Record<string, number> = {};
    const fileCounts = new Map<string, number>();

    for (const f of findings) {
      findingsBySeverity[f.severity]++;
      findingsByCategory[f.patternCategory] = (findingsByCategory[f.patternCategory] || 0) + 1;
      fileCounts.set(f.filePath, (fileCounts.get(f.filePath) || 0) + 1);
    }

    const topCompromisedFiles = Array.from(fileCounts.entries())
      .map(([filePath, count]) => ({ filePath, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    onProgress?.({
      status: 'completed',
      totalCommits,
      scannedCommits: totalCommits,
      findingsCount: findings.length,
      message: `Completed scan. Discovered ${findings.length} secrets.`,
    });

    return {
      scanId,
      summary: {
        repoName: repoName ?? branchName,
        branch: branchName,
        totalCommitsScanned: totalCommits,
        totalFindings: findings.length,
        findingsBySeverity,
        findingsByCategory,
        scanDurationMs: Date.now() - startTime,
        topCompromisedFiles,
      },
      findings,
    };
  }

  private analyzeDiff(
    diffText: string,
    meta: {
      commitHash: string;
      shortHash: string;
      authorName: string;
      authorEmail: string;
      commitDate: string;
      commitMessage: string;
      commitsAgo: number;
    },
    findings: SecretFinding[],
    seenKeys: Set<string>
  ): void {
    const lines = diffText.split('\n');
    let currentFilePath = '';
    let isSkippedFile = false;

    let i = 0;
    while (i < lines.length) {
      const line = lines[i];

      // Detect diff file header: diff --git a/foo b/foo
      if (line.startsWith('diff --git ')) {
        const parts = line.split(' ');
        if (parts.length >= 4) {
          currentFilePath = parts[3].replace(/^b\//, '');
        } else {
          currentFilePath = 'unknown_file';
        }

        // Check if file is in skip list
        isSkippedFile = Array.from(SKIP_FILE_EXTENSIONS).some((ext) =>
          currentFilePath.toLowerCase().endsWith(ext)
        );
        i++;
        continue;
      }

      if (line.startsWith('+++ b/')) {
        currentFilePath = line.substring(6);
        isSkippedFile = Array.from(SKIP_FILE_EXTENSIONS).some((ext) =>
          currentFilePath.toLowerCase().endsWith(ext)
        );
        i++;
        continue;
      }

      if (isSkippedFile) {
        i++;
        continue;
      }

      // Detect hunk header: @@ -10,5 +15,7 @@
      if (line.startsWith('@@ ')) {
        const match = /@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(line);
        let newLineNumber = match ? parseInt(match[1], 10) : 1;
        i++;

        // Collect lines in this hunk
        const hunkLines: ParsedHunkLine[] = [];

        while (i < lines.length && !lines[i].startsWith('@@ ') && !lines[i].startsWith('diff --git ')) {
          const hunkLine = lines[i];

          if (hunkLine.startsWith('+')) {
            hunkLines.push({
              type: 'add',
              rawText: hunkLine.substring(1),
              newLineNumber,
            });
            newLineNumber++;
          } else if (hunkLine.startsWith('-')) {
            hunkLines.push({
              type: 'del',
              rawText: hunkLine.substring(1),
            });
          } else {
            // Context line (starts with space or empty)
            hunkLines.push({
              type: 'context',
              rawText: hunkLine.startsWith(' ') ? hunkLine.substring(1) : hunkLine,
              newLineNumber,
            });
            newLineNumber++;
          }
          i++;
        }

        // Now inspect each added line in the hunk
        for (let idx = 0; idx < hunkLines.length; idx++) {
          const item = hunkLines[idx];
          if (item.type !== 'add' || item.newLineNumber === undefined) continue;

          const text = item.rawText;
          if (!text || text.trim().length === 0) continue;

          // 3-line surrounding context before and after
          const contextBefore: ContextLine[] = [];
          for (let b = Math.max(0, idx - 3); b < idx; b++) {
            const ctxItem = hunkLines[b];
            if (ctxItem.newLineNumber !== undefined) {
              contextBefore.push({
                lineNumber: ctxItem.newLineNumber,
                content: ctxItem.rawText,
              });
            }
          }

          const contextAfter: ContextLine[] = [];
          for (let a = idx + 1; a <= Math.min(hunkLines.length - 1, idx + 3); a++) {
            const ctxItem = hunkLines[a];
            if (ctxItem.newLineNumber !== undefined) {
              contextAfter.push({
                lineNumber: ctxItem.newLineNumber,
                content: ctxItem.rawText,
              });
            }
          }

          // Scan line against known patterns
          let matchedKnownPattern = false;

          for (const pat of SECRET_PATTERNS) {
            // Filter by active category if selected
            if (
              this.options.activeCategories &&
              this.options.activeCategories.length > 0 &&
              !this.options.activeCategories.includes(pat.category)
            ) {
              continue;
            }

            // Reset regex
            pat.regex.lastIndex = 0;
            let match: RegExpExecArray | null;

            while ((match = pat.regex.exec(text)) !== null) {
              const matchedSecret = match[1] || match[0];
              if (!matchedSecret || matchedSecret.length < 6) continue;

              const dedupKey = `${meta.commitHash}:${currentFilePath}:${item.newLineNumber}:${pat.name}`;
              if (seenKeys.has(dedupKey)) continue;
              seenKeys.add(dedupKey);
              matchedKnownPattern = true;

              const entropy = calculateShannonEntropy(matchedSecret);

              findings.push({
                id: uuidv4(),
                commitHash: meta.commitHash,
                shortHash: meta.shortHash,
                authorName: meta.authorName,
                authorEmail: meta.authorEmail,
                commitDate: meta.commitDate,
                commitMessage: meta.commitMessage,
                commitsAgo: meta.commitsAgo,
                filePath: currentFilePath,
                lineNumber: item.newLineNumber,
                lineContent: text,
                contextBefore,
                contextAfter,
                matchedPatternName: pat.name,
                patternCategory: pat.category,
                secretValue: matchedSecret,
                entropyScore: entropy,
                severity: pat.severity,
                recommendation: pat.recommendation,
                isHighEntropyOnly: false,
              });
            }
          }

          // If no known pattern matched, run Shannon Entropy Detection
          if (!matchedKnownPattern) {
            const candidates = findHighEntropyCandidates(
              text,
              this.options.entropyThreshold,
              this.options.minEntropyLength
            );

            for (const cand of candidates) {
              const dedupKey = `${meta.commitHash}:${currentFilePath}:${item.newLineNumber}:${cand.token}`;
              if (seenKeys.has(dedupKey)) continue;
              seenKeys.add(dedupKey);

              findings.push({
                id: uuidv4(),
                commitHash: meta.commitHash,
                shortHash: meta.shortHash,
                authorName: meta.authorName,
                authorEmail: meta.authorEmail,
                commitDate: meta.commitDate,
                commitMessage: meta.commitMessage,
                commitsAgo: meta.commitsAgo,
                filePath: currentFilePath,
                lineNumber: item.newLineNumber,
                lineContent: text,
                contextBefore,
                contextAfter,
                matchedPatternName: 'High-Entropy Secret',
                patternCategory: 'entropy',
                secretValue: cand.token,
                entropyScore: cand.entropy,
                severity: cand.severity,
                recommendation:
                  'Verify if this high-entropy token is an active credential or secret key and remove it from source control.',
                isHighEntropyOnly: true,
              });
            }
          }
        }
        continue;
      }

      i++;
    }
  }
}
