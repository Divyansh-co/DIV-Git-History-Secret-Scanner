# Design System & UI/UX Specification

## Overview
**SentraScan** (`DIV-Git-History-Secret-Scanner`) delivers an institutional, cyber-defense dashboard aesthetic tailored for security professionals, developers, and platform engineers. The interface pairs a high-contrast dark palette with glowing status indicators, real-time animated scanning radar, and high-density finding cards.

---

## 🎨 Color Palette & Design Tokens

### Core Neutral & Background Tones
- **Canvas / Body Background**: `#070a13` (Deep Obsidian / Blackout Space)
- **Surface Elevation 1 (Card Base)**: `#0d1322` (Dark Carbon)
- **Surface Elevation 2 (Hover / Active)**: `#141d33` (Elevated Midnight)
- **Border Subtle**: `#1e293b` (Slate 800)
- **Border Interactive / Highlight**: `#334155` (Slate 700)

### Cyber Status & Accent Tokens
- **Cyber Emerald (Safe / System Ready)**: `#10b981` (Glow: `rgba(16, 185, 129, 0.25)`)
- **Electric Cyan (Scanner Radar & Telemetry)**: `#06b6d4` (Glow: `rgba(6, 182, 212, 0.3)`)
- **Critical Crimson / Rose (High & Critical Leaks)**: `#f43f5e` (Glow: `rgba(244, 63, 94, 0.3)`)
- **Warning Amber (Medium & Shannon Entropy)**: `#f59e0b` (Glow: `rgba(245, 158, 11, 0.25)`)
- **Info Blue (Commit Metadata & Hashes)**: `#3b82f6` (Glow: `rgba(59, 130, 246, 0.2)`)

---

## 🔤 Typography & Font Hierarchy

- **Primary Sans-Serif**: `system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Inter, sans-serif`
  - High legibility, crisp rendering on high-DPI displays.
- **Monospace (Code, Diffs, Hashes, Tokens)**: `'JetBrains Mono', 'Fira Code', 'Cascadia Code', Consolas, monospace`
  - Fixed-width alignment for commit SHAs, line numbers, and diff blocks.

### Scale
- **Display Header / Title**: `1.75rem` (28px), Bold (`700`), Letter-spacing `-0.02em`
- **Section Headings**: `1.25rem` (20px), Semi-bold (`600`)
- **Card Titles & Metric Labels**: `0.95rem` (15px), Medium (`500`)
- **Body Text**: `0.875rem` (14px), Regular (`400`), Line-height `1.5`
- **Code & Diff Text**: `0.8125rem` (13px), Regular (`400`), Monospace

---

## 🧩 UI Component Specifications

### 1. Header & Live System Status
- Displays application logo with glowing shield icon.
- Real-time indicator for Ephemeral Sandbox Status (`Active Sandbox: Anti-RCE Enabled`).
- Quick links to GitHub repository and Documentation.

### 2. Scan Input Deck (`ScanForm.tsx`)
- Tabbed interface switching seamlessly between:
  1. **Demo Repository**: Instant 1-click scan loading 5 simulated historical commits.
  2. **Public Git URL**: Input field for HTTPS Git repositories with branch selector.
  3. **ZIP Archive Upload**: Drag-and-drop zone with file size check and visual upload progress.
- Collapsible **Tuning Drawer**:
  - Shannon Entropy threshold slider (`2.5` to `6.0` bits/char, default `4.2`).
  - Minimum token length selector (`10` to `50` chars, default `20`).
  - Pattern categories toggles (AWS, GitHub, Google, Slack, Stripe, Private Keys).

### 3. Real-Time Telemetry HUD (`ScanProgress.tsx`)
- Animated circular radar sweep rotating during active commit traversal.
- Live telemetry badge displaying the current 7-character commit SHA being parsed.
- Progress bar displaying completed commit ratio (`Commit X of Y`).
- Dynamic counters tracking total secrets discovered in real-time.

### 4. Finding Card (`FindingCard.tsx`)
- **Header Bar**:
  - Severity badge (Critical, High, Medium, Entropy).
  - Relative age indicator: **`X commits ago`** badge with commit timestamp and author.
  - File path with line number tag (`config/keys.env:L14`).
  - Short hash with 1-click copy for the full 40-character SHA.
- **Contextual Diff Viewer**:
  - Unified diff format showing **±3 lines of context surrounding the leak**.
  - Added line (`+`) highlighted in subtle amber/rose tint.
  - Line numbers accurately rendered in column format.
  - Matched secret token enclosed in a highlighted border.
- **Blur-to-Reveal Secret Shield**:
  - Sensitive token is blurred by default using CSS filter `blur(5px)`.
  - Toggle button (<kbd>👁️ Show</kbd> / <kbd>🔒 Hide</kbd>) to safely inspect secret without shoulder surfing.
- **Action Button**:
  - Direct "Remediate" trigger opening the tailored `git filter-repo` modal.

### 5. Remediation Modal (`RemediationModal.tsx`)
- Dark glassmorphic modal overlay with focus trap.
- Highlights: **"Server Never Modifies History — Run Locally"** warning badge.
- Pre-filled copyable `git filter-repo --invert-paths --path <file>` and `--replace-text` recipes.
- Provider credential revocation steps for the detected secret type.

---

## 📱 Responsive Layout & Breakpoints

- **Desktop (`>= 1024px`)**: Dual-column layout (Scan Deck on top/left, Findings Grid, Full-width Diff viewer).
- **Tablet (`768px - 1023px`)**: Single-column responsive flow with collapsible tuning options.
- **Mobile (`<= 767px`)**: Stacked cards with horizontal scroll for wide code diff blocks, touch-friendly 44px tap targets.
