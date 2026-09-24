import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { v4 as uuidv4 } from 'uuid';
import AdmZip from 'adm-zip';

const execFileAsync = promisify(execFile);

const MAX_ZIP_UNCOMPRESSED_BYTES = 150 * 1024 * 1024; // 150 MB
const MAX_ZIP_ENTRIES = 8000;
const CLONE_TIMEOUT_MS = 60 * 1000; // 60 seconds

export class RepoManager {
  public static validateGitUrl(rawUrl: string): { valid: boolean; reason?: string } {
    try {
      const url = new URL(rawUrl.trim());
      if (url.protocol !== 'https:' && url.protocol !== 'http:') {
        return { valid: false, reason: 'Only HTTP/HTTPS git protocols are permitted.' };
      }

      const hostname = url.hostname.toLowerCase();

      if (
        hostname === 'localhost' ||
        hostname === '127.0.0.1' ||
        hostname === '::1' ||
        hostname.startsWith('127.') ||
        hostname.startsWith('10.') ||
        hostname.startsWith('192.168.') ||
        hostname === '169.254.169.254'
      ) {
        return { valid: false, reason: 'Private or local IP addresses are blocked for security.' };
      }

      // Check 172.16.0.0 - 172.31.255.255
      const match172 = /^172\.(\d+)\./.exec(hostname);
      if (match172) {
        const octet = parseInt(match172[1], 10);
        if (octet >= 16 && octet <= 31) {
          return { valid: false, reason: 'Private RFC1918 subnets are blocked for security.' };
        }
      }

      return { valid: true };
    } catch {
      return { valid: false, reason: 'Invalid URL format.' };
    }
  }

  public static createEphemeralDir(): string {
    const dir = path.join(os.tmpdir(), `sentrascan_${uuidv4()}`);
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
    return dir;
  }

  public static async cleanup(targetDir: string): Promise<void> {
    if (!targetDir || !targetDir.includes('sentrascan_')) return;
    try {
      if (fs.existsSync(targetDir)) {
        await fs.promises.rm(targetDir, { recursive: true, force: true });
      }
    } catch (err: unknown) {
      console.warn(`[RepoManager] cleanup error for ${targetDir}:`, err);
    }
  }

  public static async cloneRemoteRepo(
    repoUrl: string,
    targetDir: string,
    branch?: string
  ): Promise<void> {
    const validation = this.validateGitUrl(repoUrl);
    if (!validation.valid) {
      throw new Error(`Disallowed URL: ${validation.reason}`);
    }

    const args = [
      '-c', 'core.hooksPath=/dev/null',
      '-c', 'core.pager=cat',
      '-c', 'safe.directory=*',
      'clone',
      '--single-branch',
    ];

    if (branch && branch.trim().length > 0) {
      // Validate branch name against command injection
      if (!/^[a-zA-Z0-9/_.\-]+$/.test(branch.trim())) {
        throw new Error('Invalid branch name provided.');
      }
      args.push('--branch', branch.trim());
    }

    args.push(repoUrl.trim(), targetDir);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), CLONE_TIMEOUT_MS);

    try {
      await execFileAsync('git', args, {
        signal: controller.signal,
        timeout: CLONE_TIMEOUT_MS,
        env: {
          ...process.env,
          GIT_TERMINAL_PROMPT: '0',
          GIT_ASKPASS: 'echo',
        },
      });
    } catch (err: unknown) {
      if (controller.signal.aborted) {
        throw new Error(`Git clone timed out after ${CLONE_TIMEOUT_MS / 1000}s.`);
      }
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(`Git clone failed: ${message}`);
    } finally {
      clearTimeout(timeout);
    }
  }

  // Safely unpacks an uploaded ZIP, checks for path traversal, size limits, and presence of .git.
  public static async extractZipRepo(zipFilePath: string, targetDir: string): Promise<string> {
    const zip = new AdmZip(zipFilePath);
    const zipEntries = zip.getEntries();

    if (zipEntries.length > MAX_ZIP_ENTRIES) {
      throw new Error(
        `Zip file contains ${zipEntries.length} entries, exceeding max limit of ${MAX_ZIP_ENTRIES}.`
      );
    }

    let totalUncompressedSize = 0;
    const resolvedTargetDir = path.resolve(targetDir);

    // Zip-Slip and size inspection
    for (const entry of zipEntries) {
      totalUncompressedSize += entry.header.size;
      if (totalUncompressedSize > MAX_ZIP_UNCOMPRESSED_BYTES) {
        throw new Error(
          `Zip uncompressed size exceeds maximum allowed limit (${MAX_ZIP_UNCOMPRESSED_BYTES / (1024 * 1024)}MB).`
        );
      }

      // Check destination path traversal
      const destPath = path.resolve(targetDir, entry.entryName);
      if (!destPath.startsWith(resolvedTargetDir + path.sep) && destPath !== resolvedTargetDir) {
        throw new Error(`Potential Zip-Slip attack detected in entry: ${entry.entryName}`);
      }
    }

    // Extract entries
    zip.extractAllTo(targetDir, true);

    // Locate the .git folder (might be directly in targetDir or in a single root subfolder like repo-main/.git)
    if (fs.existsSync(path.join(targetDir, '.git'))) {
      return targetDir;
    }

    const subdirs = fs
      .readdirSync(targetDir, { withFileTypes: true })
      .filter((d) => d.isDirectory());

    for (const d of subdirs) {
      const candidate = path.join(targetDir, d.name);
      if (fs.existsSync(path.join(candidate, '.git'))) {
        return candidate;
      }
    }

    throw new Error(
      'The uploaded zip file must contain a valid .git repository directory (.git/ was not found).'
    );
  }
}
