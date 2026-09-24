# Test Plan & Quality Assurance Matrix

## Overview
This document defines the automated and manual verification strategy for **SentraScan** (`DIV-Git-History-Secret-Scanner`). It guarantees detection accuracy, sandboxing security, and UI stability across edge cases and high-stress scenarios.

---

## 🧪 Automated Test Suite (`npm --prefix server test`)

All automated test suites are implemented in `server/test/scanner.test.ts` and can be executed via:
```bash
npm --prefix server test
```

### 1. Shannon Entropy Engine Tests
| Test Case ID | Input Vector | Expected Entropy $H(X)$ | Validation Criterion |
|---|---|---|---|
| **TEST-ENT-001** | Repetitive string (`"AAAAAAAAAAAAAAAAAAAAAAAA"`) | $H = 0.00$ bits/char | Must NOT flag as high-entropy |
| **TEST-ENT-002** | English sentence (`"The quick brown fox jumps over the lazy dog"`) | $H \approx 3.70$ bits/char | Below 4.2 threshold; NOT flagged |
| **TEST-ENT-003** | High-entropy Base64 cryptographic token (`"dGhpcyBpcyBhIHZlcnkgc2VjcmV0IHRva2VuIDEyMzQ1Ng=="`) | $H \ge 4.50$ bits/char | Correctly classified as High-Entropy |
| **TEST-ENT-004** | Short random string (< 15 chars) | N/A | Filtered out by minimum length threshold |

### 2. Pattern Matcher Tests
| Test Case ID | Target Secret Family | Sample Token Tested | Expected Outcome |
|---|---|---|---|
| **TEST-PAT-001** | AWS Access Key ID | `AKIAIOSFODNN7EXAMPLE` | Matches `AWS Access Key ID`, Severity Critical |
| **TEST-PAT-002** | GitHub Classic PAT | `ghp_1234567890abcdefghijklmnopqrstuv` | Matches `GitHub Personal Access Token`, Severity Critical |
| **TEST-PAT-003** | Google Cloud API Key | `AIzaSyD-1234567890abcdefghijklmnopqrst` | Matches `Google Cloud API Key`, Severity High |
| **TEST-PAT-004** | Private Key Block | `-----BEGIN RSA PRIVATE KEY-----` | Matches `Private Key Header`, Severity Critical |
| **TEST-PAT-005** | Slack Bot Token | `xoxb-1234567890-abcdef123456` | Matches `Slack Bot Token`, Severity High |
| **TEST-PAT-006** | False Positive Guard | `TODO: insert_api_key_here` | Ignored, no false positive |

### 3. Ephemeral Sandbox Security Tests
| Test Case ID | Attack Vector | Test Input | Expected Defense Action |
|---|---|---|---|
| **TEST-SEC-001** | SSRF (Loopback) | `http://127.0.0.1:8080/repo.git` | Request rejected with 400 Bad Request |
| **TEST-SEC-002** | SSRF (Cloud Metadata) | `http://169.254.169.254/latest/meta-data` | Request rejected with 400 Bad Request |
| **TEST-SEC-003** | SSRF (File URI Scheme) | `file:///etc/passwd` | Scheme rejected; only `http/https` allowed |
| **TEST-SEC-004** | Zip-Slip Path Traversal | ZIP containing `../../etc/shadow` | Extraction aborted with path traversal error |
| **TEST-SEC-005** | Anti-RCE Git Hooks | Bare repo with executable `hooks/post-checkout` | Hook never invoked (`-c core.hooksPath=/dev/null`) |
| **TEST-SEC-006** | Ephemeral Wiping | Complete scan lifecycle | Temp directory verified completely deleted |

### 4. Git History Traversal & Historical Deletion Test
| Test Case ID | Test Scenario | Expected Result |
|---|---|---|
| **TEST-GIT-001** | 5-Commit Demo Repository | Secret committed in Commit #1, deleted in Commit #3 |
| **TEST-GIT-002** | Historical Recall | Scanner successfully detects secret in Commit #1 despite absence in Commit #5 (`HEAD`) |
| **TEST-GIT-003** | Context Extraction | Line number, file path, author, and ±3 lines of context extracted correctly |
| **TEST-GIT-004** | Relative Depth | Correctly calculates `4 commits ago` relative to branch tip |

---

## 📱 Responsive & UI Verification Checklist

| Viewport Width | Device Target | Key Verification Checklist |
|---|---|---|
| **375px** | Mobile (iPhone SE / Android) | - Header items collapse cleanly without overlapping<br>- Scan Deck tabs stack or wrap comfortably<br>- Finding cards fit screen width with horizontal scroll for wide code diffs<br>- Blur/reveal toggle buttons remain accessible with $\ge 44$px touch targets |
| **768px** | Tablet (iPad Mini / Portrait) | - Multi-column summary stats (Critical, High, Medium, Entropy)<br>- Tuning drawer slider responds smoothly to touch<br>- Remediation modal fits without clipping viewport bounds |
| **1440px** | Desktop (MacBook / FHD Monitor) | - Full cyber dark widescreen dashboard<br>- Real-time radar animation smoothly rotates<br>- Contextual diff viewer renders clean line number column |

---

## 🔒 Safe Remediation Verification
- [x] Verify that clicking "Remediate" generates `git filter-repo --invert-paths --path <file>`.
- [x] Verify that the server **never executes** any git filter or rewrite command.
- [x] Verify that copy buttons work cleanly and update visual feedback (<kbd>Copied!</kbd>).
