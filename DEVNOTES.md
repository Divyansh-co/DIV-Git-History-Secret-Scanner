# DEVNOTES

Developer notes for SentraScan — architecture decisions, known quirks, contributing guidelines.

---

## How it works (architecture)

The app is a monorepo: `client/` (React 19 + Vite) and `server/` (Express + TypeScript, ESM).

In development the frontend dev server proxies `/api/*` to `localhost:3001`. In production the Express server serves the built client bundle from `client/dist/`.

**Request flow:**

1. Client submits a scan (URL, ZIP upload, or demo)
2. Express validates inputs (rate limit, CORS, input schema)
3. `RepoManager` either clones the repo or extracts the ZIP into a UUID-named temp dir
4. `GitScanner.scan()` runs `git rev-list`, then `git show --unified=3` for each commit
5. Each added line is checked against `SECRET_PATTERNS` (regex) and then `findHighEntropyCandidates` (Shannon entropy)
6. Progress events are pushed to the client over SSE while scanning
7. On completion, the full result JSON is returned in the HTTP response body
8. The ephemeral temp dir is deleted in a `finally` block

The client also has a separate POST to `/api/remediation` that generates a `git filter-repo` shell script/recipe for a specific finding. The server never runs those commands — it just builds the text.

---

## Key decisions

**Why `git rev-list` instead of walking the git object store directly?**
Walking via libgit2 or similar would require a native binding and add complexity. `git rev-list` + `git show` via `execFile` is simple, auditable, and fast enough for reasonable repo sizes (up to 1000 commits by default).

**Why Shannon entropy as a fallback?**
Regex patterns only cover known token formats. Entropy catches proprietary or internal tokens that don't match a known pattern. The default threshold (4.2 bits/char) is tunable — lower it to catch more, raise it to reduce noise.

**Why `git filter-repo` in remediation recipes?**
`git filter-branch` is officially deprecated and extremely slow on large repos. `git filter-repo` is the recommended replacement. We still generate a `git filter-branch` fallback in case it's not installed.

**Why not run rewrites on the server?**
The server operates on a temporary clone; rewriting and force-pushing from there would require the user's credentials. More importantly, it's a destructive operation that should always have a human in the loop with a local backup.

**Shell escaping in remediation commands:**
Generated commands use POSIX single-quote escaping (`shellSingleQuote` in `remediationGenerator.ts`) so values containing `$`, backticks, backslashes, or semicolons can't break out of the shell context.

**Rate limiting:**
Scan endpoints (URL/upload/demo) are limited to 5 requests/minute/IP to prevent abuse. Health and remediation endpoints are looser (60/min).

**CORS:**
In production, set `ALLOWED_ORIGINS=https://yourdomain.com` in the environment. Defaults to localhost origins for dev.

---

## Codebase conventions

- All git subprocess calls go through `GitScanner.runGit()` or the equivalent in `RepoManager`. Direct `execFile` calls on untrusted paths are not allowed elsewhere.
- `execFile` (not `exec`) is always used — arguments are passed as arrays, never interpolated into a shell string.
- Catch blocks in route handlers call `sendSafeError()` from `middleware/errorHandler.ts` — never forward `err.message` or stack traces to the client.
- Ephemeral directories are always created via `RepoManager.createEphemeralDir()` and cleaned in `finally`. Don't create temp dirs manually.

---

## Running locally

```bash
npm --prefix server install
npm --prefix client install

# backend
npm --prefix server run dev

# frontend (separate terminal)
npm --prefix client run dev
```

Environment variables (see `.env.example`):
- `PORT` — server port (default 3001)
- `ALLOWED_ORIGINS` — comma-separated list of allowed CORS origins

---

## Tests

```bash
npm --prefix server test
```

The test file is `server/test/scanner.test.ts`. It's a plain async runner (no framework dependency), runs via `tsx`.

Current coverage:
- Shannon entropy: zero-entropy strings, low-entropy English, high-entropy base64 tokens
- Pattern matching: AWS key ID, GitHub PAT, Google API key, private key header
- SSRF validation: loopback, private subnet, metadata endpoint, valid public URL
- Full history scan: 5-commit demo repo, verifies detection of a key deleted in commit 3
- repoName: verify URL-derived names and upload-derived names are set correctly
- Input validation: reject non-numeric entropyThreshold, out-of-range values, bad category strings

---

## Known limitations / future work

- Max 1000 commits scanned by default (configurable via `maxCommits` in `ScanOptions`). Very large repos will be truncated to the most recent commits.
- Binary files and minified JS/CSS are skipped (see `SKIP_FILE_EXTENSIONS` in `gitScanner.ts`)
- No branch scanning beyond the default branch (the `scanAllBranches` option exists but is exposed only via the API, not the UI)
- The demo repo uses placeholder secret values to avoid GitHub push protection triggering on source code

Possible future additions:
- GitHub App / webhook integration to auto-scan on PR open
- Pre-commit hook generator
- SARIF export for GitHub Code Scanning integration
- Custom rule builder UI
