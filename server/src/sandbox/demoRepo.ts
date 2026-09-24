import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { RepoManager } from './repoManager.js';

const execFileAsync = promisify(execFile);

export class DemoRepoGenerator {
  /**
   * Generates a realistic mock Git repository with secrets committed across history,
   * including secrets that were subsequently deleted in later commits.
   */
  public static async createDemoRepository(): Promise<string> {
    const tempDir = RepoManager.createEphemeralDir();

    const run = async (args: string[]) => {
      await execFileAsync('git', ['-c', 'core.hooksPath=/dev/null', '-c', 'safe.directory=*', ...args], {
        cwd: tempDir,
        env: {
          ...process.env,
          GIT_AUTHOR_NAME: 'Alice Dev',
          GIT_AUTHOR_EMAIL: 'alice@sentrascan.io',
          GIT_COMMITTER_NAME: 'Alice Dev',
          GIT_COMMITTER_EMAIL: 'alice@sentrascan.io',
        },
      });
    };

    // 1. Initialize repo
    await run(['init', '-b', 'main']);

    // Commit 1: Initial commit with hardcoded AWS keys and MongoDB URI
    const configDir = path.join(tempDir, 'src', 'config');
    fs.mkdirSync(configDir, { recursive: true });
    fs.writeFileSync(
      path.join(configDir, 'aws.js'),
      `// AWS Configuration
const AWS = require('aws-sdk');

// Credentials for S3 file storage
const AWS_ACCESS_KEY_ID = "AKIAIOSFODNN7EXAMPLE";
const AWS_SECRET_ACCESS_KEY = "demoSecretKey/EXAMPLEONLY+NotReal/ForDemoUseOnly";

const MONGO_URI = "mongodb://demo_admin:DEMO_PASS_EXAMPLE_123@cluster0.example.mongodb.net/prod";

module.exports = { AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, MONGO_URI };
`
    );

    await run(['add', '.']);
    await run([
      'commit',
      '-m',
      'Initial commit: scaffold backend and AWS S3 storage service',
      '--date',
      '2026-03-01T10:00:00Z',
    ]);

    // Commit 2: Bob adds auth and JWT + High-Entropy API token
    const authDir = path.join(tempDir, 'src', 'auth');
    fs.mkdirSync(authDir, { recursive: true });
    fs.writeFileSync(
      path.join(authDir, 'jwt.ts'),
      `// Authentication service
export const JWT_SECRET_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJERU1PLVVTRVIiLCJuYW1lIjoiU2VudHJhU2Nhbi1ERU1PIiwiaWF0IjoxNjAwMDAwMDAwfQ.DEMO_SIGNATURE_EXAMPLE_ONLY_NOT_REAL";

// Internal service encryption secret (High-Entropy token)
export const INTERNAL_ENCRYPTION_KEY = "DEMO_HIGH_ENTROPY_KEY_ZXhhbXBsZS1lbmNyeXB0aW9uLWtleS1mb3ItZGVtby0yMDI2";
`
    );

    await run(['add', '.']);
    await execFileAsync('git', ['-c', 'safe.directory=*', 'commit', '-m', 'Add authentication middleware and JWT support', '--date', '2026-03-05T14:30:00Z'], {
      cwd: tempDir,
      env: {
        ...process.env,
        GIT_AUTHOR_NAME: 'Bob Developer',
        GIT_AUTHOR_EMAIL: 'bob@sentrascan.io',
        GIT_COMMITTER_NAME: 'Bob Developer',
        GIT_COMMITTER_EMAIL: 'bob@sentrascan.io',
      },
    });

    // Commit 3: Alice attempts to "remove" the secret from HEAD, thinking it is deleted!
    fs.writeFileSync(
      path.join(configDir, 'aws.js'),
      `// AWS Configuration
const AWS = require('aws-sdk');

// FIXED: Cleaned credentials, loaded from process.env!
const AWS_ACCESS_KEY_ID = process.env.AWS_ACCESS_KEY_ID;
const AWS_SECRET_ACCESS_KEY = process.env.AWS_SECRET_ACCESS_KEY;
const MONGO_URI = process.env.MONGO_URI;

module.exports = { AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, MONGO_URI };
`
    );

    await run(['add', '.']);
    await run([
      'commit',
      '-m',
      'SECURITY FIX: Removed AWS credentials and MongoDB URI from config file (cleaned HEAD)',
      '--date',
      '2026-03-10T09:15:00Z',
    ]);

    // Commit 4: Charlie adds GitHub PAT and Slack Webhook in CI/CD pipeline
    const githubDir = path.join(tempDir, '.github', 'workflows');
    fs.mkdirSync(githubDir, { recursive: true });
    fs.writeFileSync(
      path.join(githubDir, 'deploy.yml'),
      `name: Production Deploy
on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Notify Slack
        run: |
          curl -X POST -H 'Content-type: application/json' \\
            --data '{"text":"Deploying to prod"}' \\
            https://hooks.slack.com/services/T0EXAMPLE/B0EXAMPLE/DEMO_WEBHOOK_REPLACE_ME_12345
      - name: Deploy to Cloud
        env:
          GITHUB_TOKEN: ghp_DEMO1234567890ExampleTokenForSentraScanDemo
        run: npm run deploy
`
    );

    await run(['add', '.']);
    await execFileAsync('git', ['-c', 'safe.directory=*', 'commit', '-m', 'Add Slack webhook and CI/CD workflow', '--date', '2026-03-15T18:00:00Z'], {
      cwd: tempDir,
      env: {
        ...process.env,
        GIT_AUTHOR_NAME: 'Charlie SecOps',
        GIT_AUTHOR_EMAIL: 'charlie@sentrascan.io',
        GIT_COMMITTER_NAME: 'Charlie SecOps',
        GIT_COMMITTER_EMAIL: 'charlie@sentrascan.io',
      },
    });

    // Commit 5: Dave adds Google API key and finishes release (HEAD)
    fs.writeFileSync(
      path.join(tempDir, 'src', 'maps.ts'),
      `// Google Maps integration
export const GOOGLE_MAPS_API_KEY = "AIzaDEMO-SentraScanExampleKey1234567890";
`
    );
    fs.writeFileSync(
      path.join(tempDir, 'README.md'),
      `# SentraScan Demo Vulnerable Repository
This repository demonstrates secrets leaked throughout Git history across 5 commits.
Notice that the AWS keys and MongoDB URI were removed in Commit 3, but remain in the Git history!
`
    );

    await run(['add', '.']);
    await execFileAsync('git', ['-c', 'safe.directory=*', 'commit', '-m', 'Release v1.0.0 - Production ready with Google Maps', '--date', '2026-03-20T11:20:00Z'], {
      cwd: tempDir,
      env: {
        ...process.env,
        GIT_AUTHOR_NAME: 'Dave Lead',
        GIT_AUTHOR_EMAIL: 'dave@sentrascan.io',
        GIT_COMMITTER_NAME: 'Dave Lead',
        GIT_COMMITTER_EMAIL: 'dave@sentrascan.io',
      },
    });

    return tempDir;
  }
}
