# SentraScan — Git History Secret Scanner

> I built this because deleting a secret in a later commit doesn't actually remove it. Anyone who clones the repo can still read it from the history. Standard CI checks only look at HEAD. SentraScan goes through every commit.

![Tests](https://img.shields.io/badge/Tests-Passing-10b981?style=flat-square)
![TypeScript](https://img.shields.io/badge/TypeScript-NodeNext-3178c6?style=flat-square)
![React 19](https://img.shields.io/badge/React-19-61dafb?style=flat-square)

---

## What it does

- Walks every commit in a repository's history (`git rev-list --reverse HEAD`)
- Detects API keys, tokens, and credentials using regex patterns (AWS, GitHub, Google, Slack, Stripe, OpenAI, JWTs, private keys, DB URIs)
- Falls back to Shannon entropy scoring for tokens that don't match known patterns
- Shows exactly where the leak is — file, line number, ±3 lines of context, commit author, relative depth ("4 commits ago")
- Generates copy-pasteable `git filter-repo` commands to rewrite history locally. The server never runs rewrite commands itself.
- Works via public Git URL clone, uploaded `.zip`, or a built-in 5-commit demo repo

---

## Quick start

**Requirements:** Node.js v20+, Git in PATH, npm v10+

```bash
git clone https://github.com/Divyansh-co/DIV-Git-History-Secret-Scanner.git
cd DIV-Git-History-Secret-Scanner

npm --prefix server install
npm --prefix client install

# Terminal 1: backend on port 3001
npm --prefix server run dev

# Terminal 2: frontend on port 5173
npm --prefix client run dev
```

Open [http://localhost:5173](http://localhost:5173).

**With Docker:**
```bash
docker compose up --build
```
Open [http://localhost:3001](http://localhost:3001).

---

## Running tests

```bash
npm --prefix server test
```

Covers: entropy math, pattern matching, SSRF blocking, full history scan across a 5-commit demo repo, repoName extraction, and input validation.

---

## Project structure

```
├── client/           React 19 + Vite frontend
│   └── src/
│       ├── App.tsx
│       ├── components/
│       └── types.ts
├── server/           Express + TypeScript backend
│   └── src/
│       ├── index.ts              routes, rate limiting, input validation
│       ├── middleware/
│       │   └── errorHandler.ts   shared safe-error helper
│       ├── scanner/
│       │   ├── gitScanner.ts     commit walker + diff analyzer
│       │   ├── patterns.ts       regex catalog
│       │   └── entropy.ts        Shannon entropy engine
│       ├── sandbox/
│       │   ├── repoManager.ts    SSRF guard, zip extraction, ephemeral dirs
│       │   └── demoRepo.ts       5-commit test repo generator
│       └── remediation/
│           └── remediationGenerator.ts  git filter-repo recipe builder
├── Dockerfile
├── docker-compose.yml
└── DEVNOTES.md       architecture notes, decisions, known limitations
```

---

## Security notes

- All git operations run with `-c core.hooksPath=/dev/null` so cloned repos can't execute hooks
- SSRF: URL validation blocks loopbacks, RFC 1918 subnets, and the AWS metadata endpoint
- Uploaded zips are checked for path traversal and decompression bomb (150 MB limit)
- Scan and upload routes are rate-limited to 5 requests/minute/IP
- Ephemeral temp dirs are wiped in `finally` blocks regardless of scan outcome
- The `/api/health` endpoint doesn't expose runtime details

---

## Author

**Divyansh Mishra** — [@Divyansh-co](https://github.com/Divyansh-co) — divyanshmishra.python@gmail.com
