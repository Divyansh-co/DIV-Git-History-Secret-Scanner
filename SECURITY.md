# Security Policy & Architecture Guide

## Overview
**SentraScan** (`DIV-Git-History-Secret-Scanner`) processes untrusted Git repositories, arbitrary user-submitted URLs, and external ZIP archives. This document outlines the threat model, mitigation strategies, and security policies governing the application.

---

## 1. Threat Model & Mitigations

| Threat Vector | Risk Description | Architectural Mitigation |
|---|---|---|
| **Remote Code Execution (RCE) via Git Hooks** | Untrusted Git repositories containing malicious hook scripts (`post-checkout`, `pre-push`, `commit-msg`) designed to execute during clone/checkout | Clones and Git invocations strictly enforce `-c core.hooksPath=/dev/null` or `-c core.hooksPath=""`. Bare clones or direct object inspection are utilized without checking out untrusted worktrees. |
| **Server-Side Request Forgery (SSRF)** | Attacker submits URLs targeting local services (`http://127.0.0.1:3001`), intranet addresses, or cloud metadata endpoints (`169.254.169.254`) | Hostname and IP validator checks all URLs against a strict public IP protocol filter, blocking RFC 1918 subnets, loopbacks, link-local IPs, and non-HTTP schemes. |
| **Zip-Slip Path Traversal** | Malicious ZIP archive containing relative path sequences (`../../../../etc/shadow`) designed to overwrite host files during extraction | Canonical destination path resolution rejects any archive entry whose target directory does not start with the designated extraction sandbox root. |
| **Zip Bomb / Resource Exhaustion** | Tiny compressed file that decompresses into hundreds of gigabytes, exhausting disk space | Hard uncompressed size limit (150MB) and max entry count ceiling enforced during stream decompression. |
| **Accidental Repository Corruption** | Automated rewrite scripts mutating remote branches or destroying uncommitted code | Strict invariant: **The server never executes git rewrite commands**. All commands (`git filter-repo`) are output purely as copyable text recipes for local execution by the user. |
| **Host Data Persistence / Leakage** | Scanned repositories lingering on host disk after scan completion | Unique UUID-keyed workspace directories allocated in `/tmp/sentrascan_<uuid>` are guaranteed to be purged inside `finally` blocks. |
| **Shoulder Surfing / Secondary Credential Leak** | Plain-text display of detected production secrets on screen shares or recordings | All detected credentials are blurred by default (`filter: blur(5px)`). The user must intentionally toggle unmasking per finding card. |

---

## 2. Hardened Subprocess Isolation

When invoking Git CLI commands, SentraScan isolates execution:

```typescript
// server/src/sandbox/repoManager.ts - Anti-RCE Subprocess Invocation
const gitArgs = [
  '-c', 'core.hooksPath=/dev/null',
  '-c', 'safe.directory=*',
  'clone',
  '--bare',
  '--single-branch',
  targetUrl,
  targetDir
];

await execFileAsync('git', gitArgs, {
  timeout: 90000,
  maxBuffer: 50 * 1024 * 1024,
  env: {
    ...process.env,
    GIT_TERMINAL_PROMPT: '0', // Disable interactive prompts
    GIT_ASKPASS: 'echo'
  }
});
```

---

## 3. Ephemeral Sandbox Lifecycle

```
[Incoming Scan Request]
         │
         ▼
[Allocate UUID Temp Directory (/tmp/sentrascan_<uuid>)]
         │
         ▼
    ┌────┴────┐
    │  try {  │
    │   Scan  │ ──> [SSRF Check] ──> [Safe Clone/Extract] ──> [Git History Walk]
    │  }      │
    └────┬────┘
         │
         ▼
    ┌────┴────┐
    │ finally │ ──> [Recursive fs.rmdirSync on UUID Temp Directory]
    └─────────┘
         │
         ▼
[Zero Host Residue]
```

---

## 4. Reporting Security Vulnerabilities
If you discover a security vulnerability within SentraScan, please report it privately:
- **Email**: `divyanshmishra.python@gmail.com`
- **Response SLA**: Initial triage within 24 hours; patch deployment within 72 hours.
- Please do not open public GitHub issues for undisclosed security vulnerabilities.
