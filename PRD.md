# Product Requirements Document (PRD)

## Product
**SentraScan** (`DIV-Git-History-Secret-Scanner`)  
*Engineered by Divyansh Mishra*

---

## Problem
Developers frequently commit sensitive credentials—such as AWS access keys, GitHub personal access tokens, database connection strings, and private cryptographic keys—to Git repositories. When realizing their mistake, the standard response is to delete the secret in a subsequent commit.

However, **Git retains the complete DAG (Directed Acyclic Graph) history indefinitely**. Anyone who clones the repository or inspects past commit snapshots can extract the deleted credential with zero resistance. 

Standard code linters and CI security checks only evaluate the current commit (`HEAD`), leaving historical leaks completely invisible. Existing CLI tools (like TruffleHog or Gitleaks) can be challenging for developers to parse, lack visual context diffs, provide no immediate risk triage, and offer no guidance on safe history rewrites without risking repository corruption.

---

## Target Users
- **Security Engineers & AppSec Teams**: Auditing codebases before open-sourcing or regulatory compliance reviews.
- **Software Engineers & DevOps**: Verifying that private repositories are completely purged of credentials before public release.
- **Engineering Managers & Tech Leads**: Establishing automated commit-history hygiene and preventing credential exfiltration.
- **Students & Open Source Contributors**: Ensuring accidental secret commits are caught and safely scrubbed from public portfolios.

---

## Goal
Build **SentraScan**—a production-ready, full-stack cybersecurity web application that traverses the **entire commit history** of any Git repository (uploaded via `.zip` archive, cloned from public GitHub/GitLab, or simulated in demo mode), flags leaked secrets using both curated regex signatures and Shannon entropy scoring, and outputs copy-pasteable, non-destructive `git filter-repo` remediation commands that execute strictly on the developer's local machine.

---

## Core Features

1. **Full Commit History Traversal (Not Just `HEAD`)**
   - Ingests repositories via drag-and-drop `.zip` or public Git URL (`https://github.com/...`).
   - Traverses every historical commit using sanitized `git rev-list --reverse HEAD`.
   - Computes relative commit age: **`X commits ago`** relative to the branch tip.
   - Extracts complete commit metadata: full 40-character SHA, 7-character short hash, commit author name, email, commit timestamp, and commit subject.

2. **Dual-Layer Secret Detection Engine**
   - **Signature Pattern Catalog**: 10+ high-fidelity regular expression families covering AWS IAM (`AKIA...`, `ASIA...`), GitHub PATs (Classic, Fine-Grained, OAuth), GitLab PATs, Google Cloud API Keys (`AIza...`), Slack tokens (`xoxb-`, `xoxp-`) & webhooks, Stripe live keys (`sk_live_`), OpenAI API tokens (`sk-`), Private Key headers (RSA, EC, DSA, OPENSSH, PGP), JWTs (`eyJ...`), and Database URIs with credentials.
   - **Shannon Entropy Engine**: Computes information entropy $H(X) = -\sum P(x_i) \log_2 P(x_i)$ in bits/char to catch unformatted proprietary tokens and high-randomness secrets that bypass static regexes, with tunable sensitivity thresholds (default 4.2 bits/char) and minimum token length filters.

3. **Contextual Diff Inspector with Blur-to-Reveal**
   - Reconstructs unified diffs (`git show --unified=3`) for each leak.
   - Displays exact file paths, line numbers, and **±3 lines of surrounding code context**.
   - Features **blur-to-reveal secret masking** to protect sensitive credentials from shoulder surfing during live presentations or screen shares.

4. **Guaranteed Ephemeral Sandboxing & Hard Security**
   - **Zero-Hook Execution (Anti-RCE)**: Disables Git hook triggers across all clone and diff operations using `-c core.hooksPath=/dev/null`.
   - **SSRF Prevention**: Strict URL whitelist validating public HTTPS/HTTP protocols and actively blocking RFC 1918 private subnets, loopbacks (`127.0.0.1`), and cloud metadata IP (`169.254.169.254`).
   - **Zip-Slip & Bomb Safeguards**: Canonical path traversal verification rejecting `../` entries, combined with an uncompressed payload ceiling (150MB).
   - **Ephemeral Wiping**: Unique UUID-keyed workspace directories systematically destroyed inside `finally` blocks upon scan completion or abort.

5. **Safe Local Remediation Mode**
   - Generates exact, copy-pasteable `git filter-repo` and `git filter-branch` command recipes tailored to the flagged files.
   - **Zero Server-Side Rewrite Guarantee**: The server **never** executes destructive git history commands; all rewrites are strictly performed locally by the repository owner.
   - Comprehensive credential revocation checklists for AWS, GitHub, Google Cloud, Slack, and Stripe.

6. **Instant 1-Click Demo Repository**
   - Built-in generator creating a realistic 5-commit repository with deliberate historical credential commits and subsequent deletions to verify scanner accuracy without uploading external files.

---

## MVP Scope vs Out of Scope

### In Scope (MVP)
- Full Git history scanning via `git rev-list` and unified diff extraction.
- Dual-layer pattern matching and Shannon entropy scoring.
- ±3 line contextual diff viewer with blur-to-reveal toggle.
- Safe `git filter-repo` remediation recipe generator.
- Drag-and-drop `.zip` upload with Zip-Slip protection.
- Public Git URL clone with SSRF protection.
- 1-Click built-in demo repository.
- Real-time Server-Sent Events (SSE) telemetry progress stream.
- Production multi-stage Dockerfile and docker-compose deployment.

### Out of Scope (Future Releases)
- Automated direct push of rewritten history to remote remotes (violates safety policy).
- Automated revocation API calls to third-party providers (requires user OAuth permissions).
- Binary file AST decompilation (focus is on source code and configuration files).

---

## Success Criteria
1. **100% Historical Recall**: Accurately flags secrets committed in commit 1 and deleted in commit 3 of the test suite.
2. **Sub-Second Execution for Standard Repos**: 5-commit demo scan completes in < 700ms.
3. **Zero RCE / Zero SSRF**: 100% of malicious Git hooks, localhost URLs, and Zip-Slip archives blocked safely.
4. **Zero Server Modification**: Server never modifies or rewrites user repository history.
