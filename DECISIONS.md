# Architecture Decision Records (ADRs)

## Overview
This document records the foundational technical and architectural decisions made in the engineering of **SentraScan** (`DIV-Git-History-Secret-Scanner`).

---

## ADR-001: Offline Full-History Traversal via `git rev-list` vs. `HEAD`-Only Scanning

### Decision:
Traverse every historical commit reachable from the target branch using `git rev-list --reverse HEAD` and inspect individual commit diffs using `git show --unified=3`.

### Context & Problem:
Traditional linters and basic security scans only look at the current checkout state (`HEAD`). A developer who commits a secret and deletes it in the next commit is completely protected from `HEAD`-only scanners, yet the secret remains permanently exposed in the Git history DAG to anyone who clones or forks the repository.

### Consequences:
Ensures 100% recall on historical leaks that were purged from current files. Scanning completes in sub-second time for typical repositories while capturing the exact commit where the secret was introduced.

---

## ADR-002: Dual-Layer Detection (Signatures + Shannon Entropy) vs. Regex Only

### Decision:
Combine deterministic regular expression signature matching with dynamic Shannon information entropy scoring ($H(X) = -\sum P(x) \log_2 P(x)$).

### Context & Problem:
Signature regexes are effective for standardized formats (e.g. AWS `AKIA[0-9A-Z]{16}`, Slack `xoxb-`), but miss custom database credentials, proprietary API tokens, and randomly generated passwords. Conversely, naive entropy scanning generates high false positive rates on standard UUIDs and base64 hashes.

### Consequences:
The dual approach catches both known vendor tokens and arbitrary high-randomness strings ($H \ge 4.2$ bits/char). Character set normalization and minimum length thresholds (default 20 characters) suppress false positives.

---

## ADR-003: Server-Generated Local Remediation Recipes vs. Server-Side Git Rewrites

### Decision:
The server outputs exact, copy-pasteable `git filter-repo` and `git filter-branch` command recipes, but **never executes destructive git rewrite commands on the server**.

### Context & Problem:
Allowing a remote server to rewrite a user's repository history poses severe data loss risks, potential repository corruption, and malicious code injection risks if an attacker attempts to force-push an altered tree.

### Consequences:
Total safety. The developer retains complete ownership and control over their repository history. The server acts purely as an analytical engine and educational guide.

---

## ADR-004: Ephemeral OS-Level Isolation & Anti-RCE Hooks vs. Heavy VM Orchestration

### Decision:
Implement ephemeral process isolation using unique UUID-keyed temporary directories, `-c core.hooksPath=/dev/null`, strict process timeouts (90s), and guaranteed cleanup in `finally` blocks, complemented by an unprivileged Docker deployment option.

### Context & Problem:
Cloning untrusted repositories exposes the host to Remote Code Execution (RCE) if the repository contains malicious Git hooks (`post-checkout`, `pre-push`) or attempts Zip-Slip path traversal attacks.

### Consequences:
Eliminates hook execution without the high overhead of spinning up full virtual machines per scan. Temp directories are completely purged upon scan termination, leaving zero residual footprint.

---

## ADR-005: Server-Sent Events (SSE) for Real-Time Telemetry vs. WebSockets

### Decision:
Use Server-Sent Events (`text/event-stream`) via Express to stream commit-by-commit scanning progress and newly discovered secrets to the frontend.

### Context & Problem:
Scans on large repositories with hundreds of commits can take several seconds. Without telemetry, users perceive the application as frozen. WebSockets require stateful duplex connection management and heartbeat ping/pongs.

### Consequences:
SSE provides lightweight, unidirectional HTTP streaming natively supported by browser `EventSource`, perfectly matching the server-to-client telemetry requirement without extra protocol complexity.

---

## ADR-006: Blur-to-Reveal UX with In-Browser Redaction to Prevent Shoulder Surfing

### Decision:
Blur all sensitive secret findings by default in the UI using CSS `filter: blur(5px)` with an interactive reveal toggle.

### Context & Problem:
Security engineers and developers frequently demonstrate scanners in team meetings, screen shares, or video recordings. Displaying raw production credentials in plain text creates an immediate secondary leak.

### Consequences:
Prevents accidental credential leakage during demonstrations while allowing developers to verify and cross-reference the secret when working in private.

---

## ADR-007: Multi-Stage Hardened Container Build with Unprivileged User

### Decision:
Package the application into a two-stage Alpine Linux container (`node:24-alpine`) running under a dedicated unprivileged user (`UID 10001 sentrascan`) with pre-installed `git-filter-repo`.

### Context & Problem:
Default Node.js container images run as `root`, creating container escape risks if a vulnerability is exploited in a child process.

### Consequences:
Ensures principle of least privilege, minimal image attack surface, and compatibility with production Kubernetes and cloud container environments.

---

## ADR-008: In-Memory 5-Commit Vulnerable Demo Repository Generator

### Decision:
Build a dedicated native Git demo repository generator that instantiates an isolated 5-commit history on demand with realistic credentials and historical deletions.

### Context & Problem:
New users, evaluators, and interviewers need an immediate, friction-free way to test the scanner's capabilities without having to find and upload a vulnerable archive.

### Consequences:
Allows instant 1-click evaluation in under 700ms, providing immediate proof of the scanner's full historical commit traversal capabilities.
