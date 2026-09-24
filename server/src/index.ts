import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import { v4 as uuidv4 } from 'uuid';
import { RepoManager } from './sandbox/repoManager.js';
import { GitScanner } from './scanner/gitScanner.js';
import { DemoRepoGenerator } from './sandbox/demoRepo.js';
import { RemediationGenerator } from './remediation/remediationGenerator.js';
import { ScanProgress, ScanResult, SecretFinding } from './types.js';

const app = express();
const PORT = process.env.PORT || 3001;

// Global Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Multer storage for uploaded zip archives
const upload = multer({
  dest: path.join(os.tmpdir(), 'sentrascan_uploads'),
  limits: {
    fileSize: 60 * 1024 * 1024, // 60MB max zip upload
  },
  fileFilter: (_req, file, cb) => {
    if (
      file.mimetype === 'application/zip' ||
      file.mimetype === 'application/x-zip-compressed' ||
      file.originalname.endsWith('.zip')
    ) {
      cb(null, true);
    } else {
      cb(new Error('Only .zip files containing a Git repository are allowed.'));
    }
  },
});

// In-memory active progress tracker for SSE streaming
const activeProgressStreams = new Map<string, (p: ScanProgress) => void>();

// Health check endpoint
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'SentraScan Git History Secret Scanner',
    version: '1.0.0',
    nodeVersion: process.version,
    platform: process.platform,
    sandboxMode: 'Ephemeral Temp Isolation with Anti-RCE & Hook Blocking',
  });
});

/**
 * SSE endpoint for live scanning telemetry
 */
app.get('/api/scan/progress/:jobId', (req, res) => {
  const { jobId } = req.params;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const listener = (progress: ScanProgress) => {
    res.write(`data: ${JSON.stringify(progress)}\n\n`);
  };

  activeProgressStreams.set(jobId, listener);

  req.on('close', () => {
    activeProgressStreams.delete(jobId);
  });
});

/**
 * Scan via Public Git URL (GitHub, GitLab, etc.)
 */
app.post('/api/scan/url', async (req, res) => {
  const {
    url,
    branch,
    entropyThreshold = 4.2,
    minEntropyLength = 16,
    activeCategories = [],
    jobId = uuidv4(),
  } = req.body;

  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'A valid git repository URL is required.' });
  }

  const ephemeralDir = RepoManager.createEphemeralDir();
  const abortController = new AbortController();

  // Enforce scan timeout limit (90 seconds max)
  const scanTimeout = setTimeout(() => abortController.abort(), 90000);

  try {
    const notifyProgress = (p: ScanProgress) => {
      const streamCb = activeProgressStreams.get(jobId);
      if (streamCb) streamCb(p);
    };

    notifyProgress({
      status: 'cloning',
      totalCommits: 0,
      scannedCommits: 0,
      findingsCount: 0,
      message: `Cloning repository in secure ephemeral sandbox...`,
    });

    await RepoManager.cloneRemoteRepo(url, ephemeralDir, branch);

    const scanner = new GitScanner(
      ephemeralDir,
      {
        entropyThreshold: parseFloat(String(entropyThreshold)),
        minEntropyLength: parseInt(String(minEntropyLength), 10),
        activeCategories,
      },
      abortController
    );

    const results = await scanner.scan(notifyProgress);
    res.json(results);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Scan failed' });
  } finally {
    clearTimeout(scanTimeout);
    // GUARANTEED EPHEMERAL CLEANUP
    await RepoManager.cleanup(ephemeralDir);
  }
});

/**
 * Scan via Uploaded .ZIP file containing a .git repository
 */
app.post('/api/scan/upload', upload.single('repoZip'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Please upload a valid .zip repository file.' });
  }

  const uploadedZipPath = req.file.path;
  const ephemeralDir = RepoManager.createEphemeralDir();
  const abortController = new AbortController();
  const scanTimeout = setTimeout(() => abortController.abort(), 90000);

  const {
    entropyThreshold = 4.2,
    minEntropyLength = 16,
    activeCategories = [],
    jobId = uuidv4(),
  } = req.body;

  try {
    const notifyProgress = (p: ScanProgress) => {
      const streamCb = activeProgressStreams.get(jobId);
      if (streamCb) streamCb(p);
    };

    notifyProgress({
      status: 'extracting',
      totalCommits: 0,
      scannedCommits: 0,
      findingsCount: 0,
      message: `Safely extracting repository archive (Zip-Slip checked)...`,
    });

    const repoWorkingDir = await RepoManager.extractZipRepo(uploadedZipPath, ephemeralDir);

    const scanner = new GitScanner(
      repoWorkingDir,
      {
        entropyThreshold: parseFloat(String(entropyThreshold)),
        minEntropyLength: parseInt(String(minEntropyLength), 10),
        activeCategories: typeof activeCategories === 'string' ? JSON.parse(activeCategories) : activeCategories,
      },
      abortController
    );

    const results = await scanner.scan(notifyProgress);
    res.json(results);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Zip extraction or scan failed.' });
  } finally {
    clearTimeout(scanTimeout);
    // Remove the uploaded raw zip file
    if (fs.existsSync(uploadedZipPath)) {
      try {
        fs.unlinkSync(uploadedZipPath);
      } catch {}
    }
    // Remove the unpacked ephemeral folder
    await RepoManager.cleanup(ephemeralDir);
  }
});

/**
 * One-click Demo Scan: Instantly tests an ephemeral git repository
 * with realistic secrets across multiple commits (including historical deletions)
 */
app.post('/api/scan/demo', async (req, res) => {
  const {
    entropyThreshold = 4.2,
    minEntropyLength = 16,
    activeCategories = [],
    jobId = uuidv4(),
  } = req.body;

  const ephemeralDir = await DemoRepoGenerator.createDemoRepository();
  const abortController = new AbortController();
  const scanTimeout = setTimeout(() => abortController.abort(), 60000);

  try {
    const notifyProgress = (p: ScanProgress) => {
      const streamCb = activeProgressStreams.get(jobId);
      if (streamCb) streamCb(p);
    };

    const scanner = new GitScanner(
      ephemeralDir,
      {
        entropyThreshold: parseFloat(String(entropyThreshold)),
        minEntropyLength: parseInt(String(minEntropyLength), 10),
        activeCategories,
      },
      abortController
    );

    const results = await scanner.scan(notifyProgress);
    results.summary.repoName = 'sentrascan-demo-vulnerable-repo';
    res.json(results);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Demo scan failed.' });
  } finally {
    clearTimeout(scanTimeout);
    await RepoManager.cleanup(ephemeralDir);
  }
});

/**
 * Generate remediation commands for a finding (strictly local instructions, never runs on server)
 */
app.post('/api/remediation', (req, res) => {
  const { finding, findings } = req.body;

  if (finding) {
    const recipe = RemediationGenerator.generateForFinding(finding as SecretFinding);
    return res.json(recipe);
  }

  if (findings && Array.isArray(findings)) {
    const batch = RemediationGenerator.generateBatchScript(findings as SecretFinding[]);
    return res.json(batch);
  }

  res.status(400).json({ error: 'Provide either a finding or array of findings.' });
});

// Serve client production bundle if available
const clientDistPath = path.resolve(process.cwd(), '../client/dist');
const altClientDistPath = path.resolve(process.cwd(), 'client/dist');

const distToServe = fs.existsSync(clientDistPath)
  ? clientDistPath
  : fs.existsSync(altClientDistPath)
  ? altClientDistPath
  : null;

if (distToServe) {
  app.use(express.static(distToServe));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(distToServe, 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`[SentraScan Server] Running on http://localhost:${PORT}`);
});

