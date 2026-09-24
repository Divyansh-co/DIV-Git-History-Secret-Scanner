import { isPlaceholder } from './patterns.js';
import { Severity } from '../types.js';

/**
 * Calculates Shannon entropy in bits per character.
 * H(X) = -sum( P(c) * log2(P(c)) )
 */
export function calculateShannonEntropy(str: string): number {
  if (!str || str.length === 0) return 0;

  const len = str.length;
  const frequencies = new Map<string, number>();

  for (let i = 0; i < len; i++) {
    const char = str[i];
    frequencies.set(char, (frequencies.get(char) || 0) + 1);
  }

  let entropy = 0;
  for (const count of frequencies.values()) {
    const p = count / len;
    entropy -= p * Math.log2(p);
  }

  return Number(entropy.toFixed(3));
}

export interface EntropyCandidate {
  token: string;
  entropy: number;
  severity: Severity;
  startIndex: number;
}

// Regex to extract candidate secret tokens from a line of code
// Catches strings within quotes, or raw tokens after assignment operators
const QUOTED_TOKEN_REGEX = /["'`]{1}([^"'`\r\n\s]{14,128})["'`]{1}/g;
const ASSIGNMENT_TOKEN_REGEX = /(?:=|:|\s)\s*([A-Za-z0-9_\-\/+=]{16,128})/g;

// Safe patterns that shouldn't trigger entropy alerts
const IGNORE_PATTERNS = [
  /^data:image\//i,
  /^https?:\/\//i,
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, // UUIDs
  /^[0-9a-f]{40}$/i, // Git SHA-1 commit hashes in logs/code
  /^[0-9a-f]{64}$/i, // SHA-256 checksums
  /\.(jpg|png|gif|svg|woff2?|ttf|eot|css|html)$/i, // File extensions
  /^[A-Za-z0-9_-]+\/[A-Za-z0-9_.-]+$/, // GitHub repo names (org/repo)
  /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/, // Email addresses
];

/**
 * Finds high-entropy candidate strings in a given source line.
 */
export function findHighEntropyCandidates(
  line: string,
  threshold: number = 4.2,
  minLength: number = 16
): EntropyCandidate[] {
  const candidates: EntropyCandidate[] = [];
  const seen = new Set<string>();

  const testCandidate = (rawToken: string, index: number) => {
    const token = rawToken.trim();
    if (token.length < minLength || token.length > 128) return;
    if (seen.has(token)) return;

    // Check ignore filters
    for (const pattern of IGNORE_PATTERNS) {
      if (pattern.test(token)) return;
    }

    if (isPlaceholder(token)) return;

    // Calculate Shannon entropy
    const entropy = calculateShannonEntropy(token);

    if (entropy >= threshold) {
      seen.add(token);

      // Determine severity based on entropy and length
      let severity: Severity = 'LOW';
      if (entropy >= 4.6 && token.length >= 24) {
        severity = 'HIGH';
      } else if (entropy >= 4.0 && token.length >= 18) {
        severity = 'MEDIUM';
      }

      candidates.push({
        token,
        entropy,
        severity,
        startIndex: index,
      });
    }
  };

  // 1. Check quoted strings
  let match: RegExpExecArray | null;
  while ((match = QUOTED_TOKEN_REGEX.exec(line)) !== null) {
    if (match[1]) {
      testCandidate(match[1], match.index);
    }
  }

  // 2. Check assignment-like tokens
  while ((match = ASSIGNMENT_TOKEN_REGEX.exec(line)) !== null) {
    if (match[1]) {
      testCandidate(match[1], match.index);
    }
  }

  return candidates;
}
