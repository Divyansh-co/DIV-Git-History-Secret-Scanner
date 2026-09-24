# Development Rules & AI Engineering Guidelines

## Overview
This document defines the core development standards, security invariants, and coding guidelines for the **SentraScan** (`DIV-Git-History-Secret-Scanner`) codebase. All contributors and AI assistants must follow these rules without exception.

---

## 1. Non-Negotiable Security Invariants

### 1.1 Zero Server-Side History Modification
- **STRICT RULE**: The server MUST NEVER execute destructive Git history rewriting commands (`git filter-repo`, `git filter-branch`, `git reset --hard`, `git push --force`, `git rebase`).
- Remediation recipes must be rendered strictly as copy-pasteable instructions for the repository owner to execute locally on their machine.

### 1.2 Subprocess Isolation & Anti-RCE
- Every invocation of `git` against untrusted repositories must explicitly set:
  `-c core.hooksPath=/dev/null` or `-c core.hooksPath=""`
- Never check out working copies of untrusted repositories; use bare clones (`--bare`) or inspection commands (`git rev-list`, `git show`) to eliminate the risk of executing malicious hooks or scripts.
- Never use shell string interpolation (`exec("git " + userInput)`); use explicit argument vectors with `child_process.execFile`.

### 1.3 Strict SSRF Prevention
- URLs supplied by users must be validated with the standard protocol whitelist (`https://`, `http://`).
- Block connection attempts to:
  - Private IPv4 addresses (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`).
  - Loopbacks (`127.0.0.1`, `localhost`, `::1`).
  - Link-local and cloud metadata addresses (`169.254.169.254`).

### 1.4 Guaranteed Ephemeral Cleanup
- Cloned repositories and extracted ZIP directories must exist in isolated temporary directories keyed by `uuidv4()`.
- Every temporary directory MUST be recursively purged inside a `finally` block to ensure no user code persists on the host.

---

## 2. Code Quality & Type Safety

### 2.1 Strict TypeScript Standards
- TypeScript strict mode must remain enabled (`"strict": true` in both `client/tsconfig.json` and `server/tsconfig.json`).
- Avoid using `any` types. Define explicit interfaces in `server/src/types.ts` and `client/src/types.ts`.
- Maintain unified models between backend scanner outputs and frontend state consumers.

### 2.2 Functional Architecture & Modularity
- Scanner modules (`entropy.ts`, `patterns.ts`, `gitScanner.ts`) must remain pure and decoupled from Express HTTP request handling.
- Input validation logic must precede any subprocess execution.

---

## 3. Frontend & UX Guidelines

### 3.1 Shoulder-Surfing Protection
- All detected secret values rendered on finding cards must be masked or blurred by default.
- Users must manually click a reveal button to unmask the raw token.

### 3.2 Error & State Completeness
- Every asynchronous operation (scanning, uploading, cloning) must handle four explicit states:
  1. **Idle**: Clean initial state with instructions.
  2. **Loading / Scanning**: Live radar sweep with commit progress counters.
  3. **Empty / Clean**: Clear celebratory state ("0 secrets found in history").
  4. **Error**: User-friendly, informative error message explaining the failure reason.
