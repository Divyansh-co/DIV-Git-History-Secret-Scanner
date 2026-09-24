import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { rateLimit } from 'express-rate-limit';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import { v4 as uuidv4 } from 'uuid';
import { RepoManager } from './sandbox/repoManager.js';
import { GitScanner } from './scanner/gitScanner.js';
import { DemoRepoGenerator } from './sandbox/demoRepo.js';
import { RemediationGenerator } from './remediation/remediationGenerator.js';
import { ScanProgress, ScanResult, SecretFinding } from './types.js';
import { sendSafeError } from './middleware/errorHandler.js';

const app = express();
const PORT = process.env.PORT || 3001;

// --- CORS ---
// In production set ALLOWED_ORIGINS="https://yourdomain.com" in the environment.
// Falls back to localhost for local dev.
const rawOrigins = process.env.ALLOWED_ORIGINS;
const allowedOrigins: string[] = rawOrigins
  ? rawOrigins.split(',').map((o) => o.trim())
  : ['http://localhost:5173', 'http://localhost:3001'];

app.use(
  cors({
    origin: (origin, callback) => {
      // allow server-to-server calls (no Origin header) or matching origins
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    methods: ['GET', 'POST'],
  })
);
app.use(express.json({ limit: '10mb' }));

// --- Rate limiters ---
const scanLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many scan requests. Please wait a minute and try again.' },
});

const looseLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests.' },
});

// --- Input validation helpers ---
const KNOWN_CATEGORIES = new Set(['cloud', 'tokens', 'keys', 'database', 'passwords', 'entropy']);

function parseEntropyThreshold(raw: unknown): number | null {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 1.0 || n > 8.0) return null;
  return n;
}

function parseMinEntropyLength(raw: unknown): number | null {
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 4 || n > 512) return null;
  return n;
}

function parseCategories(raw: unknown): string[] | null {
  const arr: unknown[] = Array.isArray(raw)
    ? raw
    : typeof raw === 'string'
    ? (() => { try { return JSON.parse(raw); } catch { return null; } })()
    : null;
  if (!Array.isArray(arr)) return null;
  for (const item of arr) {
    if (typeof item !== 'string' || !KNOWN_CATEGORIES.has(item)) return null;
  }
  return arr as string[];
}

// --- Multer ---
const upload = multer({
  dest: path.join(os.tmpdir(), 'sentrascan_uploads'),
  limits: { fileSize: 60 * 1024 * 1024 },
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

// SSE progress map: jobId -> subscriber callback
const activeProgressStreams = new Map<string, (p: ScanProgress) => void>();

// --- Health ---
app.get('/api/health', looseLimiter, (_req, res) => {
  res.json({ status: 'ok', service: 'SentraScan', version: '1.0.0' });
});

// --- SSE progress stream ---
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
  req.on('close', () => activeProgressStreams.delete(jobId));
});

// --- Scan via URL ---
app.post('/api/scan/url', scanLimiter, async (req, res) => {
  const { url, branch, jobId = uuidv4() } = req.body;

  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'A valid git repository URL is required.' });
  }

  const entropyThreshold = parseEntropyThreshold(req.body.entropyThreshold ?? 4.2);
  const minEntropyLength = parseMinEntropyLength(req.body.minEntropyLength ?? 16);
  const activeCategories = parseCategories(req.body.activeCategories ?? []);

  if (entropyThreshold === null) {
    return res.status(400).json({ error: 'entropyThreshold must be a number between 1.0 and 8.0.' });
  }
  if (minEntropyLength === null) {
    return res.status(400).json({ error: 'minEntropyLength must be an integer between 4 and 512.' });
  }
  if (activeCategories === null) {
    return res.status(400).json({ error: `activeCategories must be an array of known categories: ${[...KNOWN_CATEGORIES].join(', ')}.` });
  }

  // Derive repo name from URL before cloning
  const repoName = deriveRepoNameFromUrl(url);

  const ephemeralDir = RepoManager.createEphemeralDir();
  const abortController = new AbortController();
  const scanTimeout = setTimeout(() => abortController.abort(), 90_000);

  try {
    const notifyProgress = makeNotifier(jobId);

    notifyProgress({
      status: 'cloning',
      totalCommits: 0,
      scannedCommits: 0,
      findingsCount: 0,
      message: 'Cloning repository...',
    });

    await RepoManager.cloneRemoteRepo(url, ephemeralDir, branch);

    const scanner = new GitScanner(
      ephemeralDir,
      { entropyThreshold, minEntropyLength, activeCategories },
      abortController
    );

    const results = await scanner.scan(notifyProgress);
    results.summary.repoName = repoName;
    res.json(results);
  } catch (err: unknown) {
    sendSafeError(res, err, 'Scan failed. Please check the repository URL and try again.');
  } finally {
    clearTimeout(scanTimeout);
    await RepoManager.cleanup(ephemeralDir);
  }
});

// --- Scan via ZIP upload ---
app.post('/api/scan/upload', scanLimiter, upload.single('repoZip'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Please upload a valid .zip repository file.' });
  }

  const uploadedZipPath = req.file.path;
  const { jobId = uuidv4() } = req.body;

  const entropyThreshold = parseEntropyThreshold(req.body.entropyThreshold ?? 4.2);
  const minEntropyLength = parseMinEntropyLength(req.body.minEntropyLength ?? 16);
  const activeCategories = parseCategories(req.body.activeCategories ?? []);

  if (entropyThreshold === null) {
    return res.status(400).json({ error: 'entropyThreshold must be a number between 1.0 and 8.0.' });
  }
  if (minEntropyLength === null) {
    return res.status(400).json({ error: 'minEntropyLength must be an integer between 4 and 512.' });
  }
  if (activeCategories === null) {
    return res.status(400).json({ error: `activeCategories must be an array of known categories: ${[...KNOWN_CATEGORIES].join(', ')}.` });
  }

  // Derive repo name from the uploaded filename (strip .zip extension)
  const repoName = path
    .basename(req.file.originalname, '.zip')
    .replace(/[^a-zA-Z0-9._-]/g, '-') || 'uploaded-repo';

  const ephemeralDir = RepoManager.createEphemeralDir();
  const abortController = new AbortController();
  const scanTimeout = setTimeout(() => abortController.abort(), 90_000);

  try {
    const notifyProgress = makeNotifier(jobId);

    notifyProgress({
      status: 'extracting',
      totalCommits: 0,
      scannedCommits: 0,
      findingsCount: 0,
      message: 'Extracting repository archive...',
    });

    const repoWorkingDir = await RepoManager.extractZipRepo(uploadedZipPath, ephemeralDir);

    const scanner = new GitScanner(
      repoWorkingDir,
      { entropyThreshold, minEntropyLength, activeCategories },
      abortController
    );

    const results = await scanner.scan(notifyProgress);
    results.summary.repoName = repoName;
    res.json(results);
  } catch (err: unknown) {
    sendSafeError(res, err, 'Could not process the uploaded archive. Make sure it contains a valid git repository.');
  } finally {
    clearTimeout(scanTimeout);
    if (fs.existsSync(uploadedZipPath)) {
      try { fs.unlinkSync(uploadedZipPath); } catch { /* already gone */ }
    }
    await RepoManager.cleanup(ephemeralDir);
  }
});

// --- Demo scan ---
app.post('/api/scan/demo', scanLimiter, async (req, res) => {
  const { jobId = uuidv4() } = req.body;

  const entropyThreshold = parseEntropyThreshold(req.body.entropyThreshold ?? 4.2);
  const minEntropyLength = parseMinEntropyLength(req.body.minEntropyLength ?? 16);
  const activeCategories = parseCategories(req.body.activeCategories ?? []);

  if (entropyThreshold === null) {
    return res.status(400).json({ error: 'entropyThreshold must be a number between 1.0 and 8.0.' });
  }
  if (minEntropyLength === null) {
    return res.status(400).json({ error: 'minEntropyLength must be an integer between 4 and 512.' });
  }
  if (activeCategories === null) {
    return res.status(400).json({ error: `activeCategories must be an array of known categories: ${[...KNOWN_CATEGORIES].join(', ')}.` });
  }

  const ephemeralDir = await DemoRepoGenerator.createDemoRepository();
  const abortController = new AbortController();
  const scanTimeout = setTimeout(() => abortController.abort(), 60_000);

  try {
    const notifyProgress = makeNotifier(jobId);
    const scanner = new GitScanner(
      ephemeralDir,
      { entropyThreshold, minEntropyLength, activeCategories },
      abortController
    );

    const results = await scanner.scan(notifyProgress);
    results.summary.repoName = 'sentrascan-demo-vulnerable-repo';
    res.json(results);
  } catch (err: unknown) {
    sendSafeError(res, err, 'Demo scan failed. Please try again.');
  } finally {
    clearTimeout(scanTimeout);
    await RepoManager.cleanup(ephemeralDir);
  }
});

// --- Remediation recipe generator ---
app.post('/api/remediation', looseLimiter, (req, res) => {
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

// --- Static client bundle ---
const clientDistPath = path.resolve(process.cwd(), '../client/dist');
const altClientDistPath = path.resolve(process.cwd(), 'client/dist');
const distToServe = fs.existsSync(clientDistPath)
  ? clientDistPath
  : fs.existsSync(altClientDistPath)
  ? altClientDistPath
  : null;

if (distToServe) {
  app.use(express.static(distToServe));
  app.get('*', (_req, res) => res.sendFile(path.join(distToServe, 'index.html')));
}

app.listen(PORT, () => {
  console.log(`[SentraScan] Server running on http://localhost:${PORT}`);
});

// --- Helpers ---

function makeNotifier(jobId: string) {
  return (p: ScanProgress) => {
    const cb = activeProgressStreams.get(jobId);
    if (cb) cb(p);
  };
}

/** Extracts a readable repo name from a git URL like https://github.com/org/name.git */
function deriveRepoNameFromUrl(rawUrl: string): string {
  try {
    const url = new URL(rawUrl.trim());
    const segments = url.pathname.split('/').filter(Boolean);
    const last = segments[segments.length - 1] ?? 'repo';
    return last.replace(/\.git$/i, '');
  } catch {
    return 'repo';
  }
}
