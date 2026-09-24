# Project Tasks & Execution Roadmap

## Overview
This document outlines the phased engineering roadmap for **SentraScan** (`DIV-Git-History-Secret-Scanner`). All tasks adhere to the strict implementation workflow: Specification → Implementation → Automated Verification → Review.

---

## Phase 1: Project Setup & Core Infrastructure

- [x] **TASK-001**: Initialize monorepo workspace configuration (`package.json`, `client/`, `server/`).
- [x] **TASK-002**: Configure NodeNext TypeScript configuration for backend (`server/tsconfig.json`).
- [x] **TASK-003**: Configure React 19, TypeScript, and Vite 6 for frontend (`client/vite.config.ts`, `client/tsconfig.json`).
- [x] **TASK-004**: Define TypeScript domain interfaces (`CommitInfo`, `SecretFinding`, `ScanOptions`, `ScanResult`, `RemediationRecipe`).
- [x] **TASK-005**: Set up `.gitignore` and `.env.example` templates.

---

## Phase 2: Detection Engine & Pattern Matching

- [x] **TASK-006**: Implement signature regex catalog covering AWS IAM, GitHub PATs, Google Cloud API Keys, Slack tokens, Stripe keys, OpenAI tokens, and Private Keys (`server/src/scanner/patterns.ts`).
- [x] **TASK-007**: Implement Shannon Entropy calculation engine ($H(X) = -\sum P(x) \log_2 P(x)$) with character frequency histograms and length thresholds (`server/src/scanner/entropy.ts`).
- [x] **TASK-008**: Build unit tests for Shannon entropy verifying low-entropy vs high-entropy string differentiation (`server/test/scanner.test.ts`).
- [x] **TASK-009**: Build unit tests verifying pattern detection across known secret families (`server/test/scanner.test.ts`).

---

## Phase 3: Git History Inspection Engine

- [x] **TASK-010**: Implement commit history walker traversing `git rev-list --reverse HEAD` (`server/src/scanner/gitScanner.ts`).
- [x] **TASK-011**: Implement relative commit depth calculator (`X commits ago` relative to branch tip).
- [x] **TASK-012**: Extract unified diffs using `git show --unified=3` with line numbers and surrounding context.
- [x] **TASK-013**: Associate author name, email, commit timestamp, and commit subject with each finding.

---

## Phase 4: Ephemeral Sandbox & Hardened Ingestion

- [x] **TASK-014**: Build SSRF validator blocking private IP subnets, loopbacks (`127.0.0.1`), and cloud metadata (`169.254.169.254`) (`server/src/sandbox/repoManager.ts`).
- [x] **TASK-015**: Implement secure remote Git cloner enforcing `-c core.hooksPath=/dev/null` anti-RCE.
- [x] **TASK-016**: Implement ZIP archive extractor with Zip-Slip path traversal protection and 150MB uncompressed ceiling.
- [x] **TASK-017**: Build in-memory 5-commit test repository generator simulating historical secret commits and deletions (`server/src/sandbox/demoRepo.ts`).
- [x] **TASK-018**: Guarantee ephemeral UUID temporary directory destruction in `finally` blocks.

---

## Phase 5: Remediation Recipe Generator

- [x] **TASK-019**: Build `git filter-repo --invert-paths --path <file>` recipe builder (`server/src/remediation/remediationGenerator.ts`).
- [x] **TASK-020**: Build string replacement recipe generator using `git filter-repo --replace-text`.
- [x] **TASK-021**: Add fallback `git filter-branch` command generation.
- [x] **TASK-022**: Add provider-specific credential revocation guidance (AWS, GitHub, Google, Slack, Stripe).
- [x] **TASK-023**: Enforce strict server-side non-execution invariant.

---

## Phase 6: Cyber Web UI & Observability

- [x] **TASK-024**: Implement Cyber Dark CSS design system with CSS tokens and elevation layers (`client/src/App.css`).
- [x] **TASK-025**: Build Header with live Ephemeral Sandbox status indicator (`client/src/components/Header.tsx`).
- [x] **TASK-026**: Build Scan Input Deck with Demo 1-click button, URL clone input, and ZIP dropzone (`client/src/components/ScanForm.tsx`).
- [x] **TASK-027**: Implement Shannon entropy slider and pattern toggles inside collapsible drawer.
- [x] **TASK-028**: Build real-time animated radar and commit progress indicator (`client/src/components/ScanProgress.tsx`).
- [x] **TASK-029**: Build Finding Card with blur-to-reveal secret masking and ±3 lines context diff viewer (`client/src/components/FindingCard.tsx`).
- [x] **TASK-030**: Build Remediation Modal with copyable command recipes (`client/src/components/RemediationModal.tsx`).

---

## Phase 7: Automated Testing & Deployment

- [x] **TASK-031**: Build automated test suite for entropy, pattern matching, SSRF defense, and full history traversal (`npm --prefix server test`).
- [x] **TASK-032**: Verify detection of historical secret deletion across 5-commit demo repository.
- [x] **TASK-033**: Create production multi-stage `Dockerfile` with unprivileged non-root user and Git pre-installed.
- [x] **TASK-034**: Create `docker-compose.yml` with CPU (1.0) and memory (512MB) limits.
- [x] **TASK-035**: Create comprehensive engineering governance suite (PRD, ARCHITECTURE, DESIGN, RULES, DECISIONS, MEMORY, TEST_PLAN, SECURITY).
