# Project Memory & Operational State

## Overview
This document records the current project state, active capabilities, completed milestones, technical debt notes, and forward roadmap for **SentraScan** (`DIV-Git-History-Secret-Scanner`).

---

## 🟢 Active Operational State
- **Core Engine Status**: Operational and tested.
- **Frontend Status**: Compiled, styled with Cyber Dark aesthetic, verified with Vite.
- **Backend Status**: Express server with SSE telemetry and sandboxed child process execution operational on port 3001.
- **Automated Tests**: 100% passing (`npm --prefix server test`), verifying entropy calculations, regex signatures, SSRF validation, multi-commit history traversal, and historical secret deletion detection.
- **Containerization**: Production multi-stage `Dockerfile` and `docker-compose.yml` verified.

---

## 🏆 Completed Milestones
1. **Full History Git Scanner (`server/src/scanner/gitScanner.ts`)**:
   - Walks complete commit history using `git rev-list`.
   - Computes `X commits ago` relative to branch tip.
   - Extracts ±3 lines of context surrounding each leak.
2. **Dual-Layer Secret Detection Engine (`server/src/scanner/`)**:
   - `patterns.ts`: AWS, GitHub, GitLab, Google Cloud, Slack, Stripe, OpenAI, Private Keys, JWTs, DB connection strings.
   - `entropy.ts`: Pure Shannon entropy calculation with frequency histograms and character normalization.
3. **Ephemeral Sandbox & Ingestion (`server/src/sandbox/`)**:
   - `repoManager.ts`: SSRF defense, Zip-Slip defense, 150MB uncompressed limit, UUID temp dirs with guaranteed `finally` cleanup.
   - `demoRepo.ts`: 5-commit realistic repository generator with historical deletions.
4. **Safe Local Remediation Engine (`server/src/remediation/`)**:
   - `remediationGenerator.ts`: Generates safe `git filter-repo` and `git filter-branch` command recipes.
5. **Modern Cyber Web Interface (`client/src/`)**:
   - Cyber Dark design system, Animated Radar sweep, Finding Cards with blur-to-reveal toggle, Remediation modal, and real-time SSE progress streaming.
6. **Documentation & Governance Suite**:
   - Complete set of 10 engineering specification files (`PRD.md`, `ARCHITECTURE.md`, `DESIGN.md`, `RULES.md`, `TASKS.md`, `DECISIONS.md`, `MEMORY.md`, `TEST_PLAN.md`, `SECURITY.md`, `.env.example`).

---

## 💡 Key Architectural Patterns & Conventions
- **Subprocess Safety**: Always pass arguments as arrays to `child_process.execFile`. Never invoke `exec()` with string templates.
- **Anti-RCE**: Always prepend `-c core.hooksPath=/dev/null` to any Git command running against untrusted repositories.
- **Ephemeral Sandbox**: Always wrap temp directory allocations in `try...finally` to ensure cleanup runs even on error or cancellation.
- **Frontend Blur**: Always default `isSecretRevealed` to `false` on finding cards to protect credentials from shoulder surfing.

---

## 🔮 Future Roadmap
- **GitHub App & Webhook Integration**: Trigger automatic secret scans on incoming PRs and commit pushes.
- **Pre-Commit Hook Generator**: Export a local Git `pre-commit` hook script to block secrets from being committed in the first place.
- **SARIF & JSON Export**: Export findings in standard OASIS SARIF format for integration into GitHub Code Scanning alerts.
- **Custom Rule Builder**: Web UI for adding company-specific custom regular expressions and entropy rules.
