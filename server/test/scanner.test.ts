import assert from 'node:assert';
import path from 'node:path';
import { calculateShannonEntropy, findHighEntropyCandidates } from '../src/scanner/entropy.js';
import { SECRET_PATTERNS } from '../src/scanner/patterns.js';
import { DemoRepoGenerator } from '../src/sandbox/demoRepo.js';
import { GitScanner } from '../src/scanner/gitScanner.js';
import { RepoManager } from '../src/sandbox/repoManager.js';
import { RemediationGenerator } from '../src/remediation/remediationGenerator.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const KNOWN_CATEGORIES = new Set(['cloud', 'tokens', 'keys', 'database', 'passwords', 'entropy']);

function parseEntropyThreshold(raw: unknown): number | null {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 1.0 || n > 8.0) return null;
  return n;
}

function parseMinEntropyLength(raw: unknown): number | null {
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 4 || n > 512) return null;
  return n;
}

function parseCategories(raw: unknown): string[] | null {
  const arr: unknown[] = Array.isArray(raw) ? raw : [];
  for (const item of arr) {
    if (typeof item !== 'string' || !KNOWN_CATEGORIES.has(item)) return null;
  }
  return arr as string[];
}

function deriveRepoNameFromUrl(rawUrl: string): string {
  try {
    const url = new URL(rawUrl.trim());
    const segments = url.pathname.split('/').filter(Boolean);
    const last = segments[segments.length - 1] ?? 'repo';
    return last.replace(/\.git$/i, '');
  } catch {
    return 'repo';
  }
}

// ---------------------------------------------------------------------------

async function runTests() {
  // -------------------------------------------------------------------------
  console.log('--- [1] Shannon entropy ---');
  // -------------------------------------------------------------------------

  assert(calculateShannonEntropy('aaaaaaa') === 0, 'repetitive string → 0 entropy');
  assert(calculateShannonEntropy('hello world this is a test') < 3.8, 'natural english → low entropy');

  const b64token = 'DEMO_HIGH_ENTROPY_KEY_ZXhhbXBsZS1lbmNyeXB0aW9uLWtleS1mb3ItZGVtby0yMDI2';
  assert(calculateShannonEntropy(b64token) >= 4.0, 'base64 token → high entropy');

  const candidates = findHighEntropyCandidates(`const KEY = "${b64token}";`, 4.0, 16);
  assert(candidates.length > 0, 'should detect high-entropy candidate in a line');

  console.log('✓ entropy\n');

  // -------------------------------------------------------------------------
  console.log('--- [2] Pattern matchers ---');
  // -------------------------------------------------------------------------

  const patternTests = [
    { code: 'const k = "AKIAIOSFODNN7EXAMPLE";', name: 'AWS Access Key ID', sev: 'CRITICAL' },
    { code: 'GITHUB_TOKEN=ghp_9kF20dL47jQ8zM1vW5yR3sT6uP0oI8eA4bC2', name: 'GitHub Personal Access Token (Classic)', sev: 'CRITICAL' },
    { code: 'const g = "AIzaSyD-1234567890abcdefghijklmnopqrst";', name: 'Google API Key', sev: 'HIGH' },
    { code: 'export const PK = "-----BEGIN RSA PRIVATE KEY-----";', name: 'Private Key Header', sev: 'CRITICAL' },
  ];

  for (const tc of patternTests) {
    const matched = SECRET_PATTERNS.filter((p) => { p.regex.lastIndex = 0; return p.regex.test(tc.code); });
    assert(matched.length > 0, `should match something in: ${tc.code}`);
    assert(matched.some((m) => m.name === tc.name), `expected "${tc.name}", got: ${matched.map((m) => m.name).join(', ')}`);
    console.log(`  ✓ ${tc.name}`);
  }

  console.log('✓ pattern matchers\n');

  // -------------------------------------------------------------------------
  console.log('--- [3] SSRF / URL validation ---');
  // -------------------------------------------------------------------------

  assert(!RepoManager.validateGitUrl('file:///etc/passwd').valid, 'should block file://');
  assert(!RepoManager.validateGitUrl('http://127.0.0.1:8080/repo.git').valid, 'should block loopback');
  assert(!RepoManager.validateGitUrl('http://169.254.169.254/latest/meta-data').valid, 'should block metadata IP');
  assert(!RepoManager.validateGitUrl('https://10.0.0.1/repo.git').valid, 'should block private 10.x');
  assert(!RepoManager.validateGitUrl('https://172.20.0.1/repo.git').valid, 'should block 172.16-31.x');
  assert(RepoManager.validateGitUrl('https://github.com/torvalds/linux.git').valid, 'should allow public github');

  console.log('✓ SSRF validation\n');

  // -------------------------------------------------------------------------
  console.log('--- [4] Input validation (new) ---');
  // -------------------------------------------------------------------------

  // entropyThreshold
  assert(parseEntropyThreshold(4.2) === 4.2, 'valid float accepted');
  assert(parseEntropyThreshold('4.2') === 4.2, 'numeric string accepted');
  assert(parseEntropyThreshold('abc') === null, 'non-numeric string rejected');
  assert(parseEntropyThreshold(NaN) === null, 'NaN rejected');
  assert(parseEntropyThreshold(0.5) === null, 'below 1.0 rejected');
  assert(parseEntropyThreshold(9.0) === null, 'above 8.0 rejected');
  assert(parseEntropyThreshold(undefined) === null, 'undefined rejected');
  assert(parseEntropyThreshold(null) === null, 'null rejected');

  // minEntropyLength
  assert(parseMinEntropyLength(16) === 16, 'valid integer accepted');
  assert(parseMinEntropyLength('16') === 16, 'integer string accepted');
  assert(parseMinEntropyLength(3) === null, 'below 4 rejected');
  assert(parseMinEntropyLength(513) === null, 'above 512 rejected');
  assert(parseMinEntropyLength(4.5) === null, 'non-integer rejected');
  assert(parseMinEntropyLength('foo') === null, 'non-numeric string rejected');
  assert(parseMinEntropyLength(NaN) === null, 'NaN rejected');

  // activeCategories
  assert(parseCategories(['cloud', 'tokens']) !== null, 'valid categories accepted');
  assert(parseCategories([]) !== null, 'empty array accepted');
  assert(parseCategories(['cloud', 'unknown_cat']) === null, 'unknown category rejected');
  assert(parseCategories(['cloud', 42]) === null, 'non-string element rejected');

  console.log('✓ input validation\n');

  // -------------------------------------------------------------------------
  console.log('--- [5] repoName extraction (new) ---');
  // -------------------------------------------------------------------------

  assert(
    deriveRepoNameFromUrl('https://github.com/Divyansh-co/DIV-Git-History-Secret-Scanner.git') === 'DIV-Git-History-Secret-Scanner',
    'should strip .git suffix and return repo name'
  );
  assert(
    deriveRepoNameFromUrl('https://github.com/Divyansh-co/my-repo') === 'my-repo',
    'should work without .git suffix'
  );
  assert(
    deriveRepoNameFromUrl('not-a-url') === 'repo',
    'invalid URL falls back to "repo"'
  );

  // Verify repoName in scan result is not the branch name
  let demoDir = '';
  try {
    demoDir = await DemoRepoGenerator.createDemoRepository();
    const scanner = new GitScanner(demoDir, { entropyThreshold: 3.8 });
    const results = await scanner.scan(undefined, 'sentrascan-demo-vulnerable-repo');
    assert(
      results.summary.repoName === 'sentrascan-demo-vulnerable-repo',
      `repoName should be the passed name, got: ${results.summary.repoName}`
    );
    assert(
      results.summary.repoName !== results.summary.branch,
      'repoName must not be copied from branch name'
    );
    console.log(`  ✓ repoName="${results.summary.repoName}", branch="${results.summary.branch}"`);
  } finally {
    if (demoDir) await RepoManager.cleanup(demoDir);
  }

  console.log('✓ repoName extraction\n');

  // -------------------------------------------------------------------------
  console.log('--- [6] Full history scan (5-commit demo repo) ---');
  // -------------------------------------------------------------------------

  let scanDir = '';
  try {
    scanDir = await DemoRepoGenerator.createDemoRepository();
    const scanner = new GitScanner(scanDir, { entropyThreshold: 3.8 });
    const results = await scanner.scan((p) => {
      if (p.scannedCommits > 0) {
        process.stdout.write(`\r  scanning ${p.scannedCommits}/${p.totalCommits} commits...`);
      }
    });
    console.log();

    assert(results.summary.totalCommitsScanned === 5, `expected 5 commits, got ${results.summary.totalCommitsScanned}`);
    assert(results.findings.length >= 5, `expected ≥5 findings, got ${results.findings.length}`);

    // The AWS key was committed in commit 1 and deleted in commit 3 —
    // if we don't detect it here, the whole tool is broken.
    const awsFinding = results.findings.find((f) => f.matchedPatternName === 'AWS Access Key ID');
    assert(awsFinding, 'must detect AWS key that was deleted in a later commit');
    assert(awsFinding.commitsAgo > 0, `AWS key should be in history (commitsAgo > 0)`);
    assert(awsFinding.contextBefore !== undefined && awsFinding.contextAfter !== undefined, 'context lines must be present');
    console.log(`  ✓ detected deleted AWS key: ${awsFinding.secretValue} (${awsFinding.commitsAgo} commits ago)`);

    // Remediation recipe sanity check
    const recipe = RemediationGenerator.generateForFinding(awsFinding);
    assert(recipe.steps.length > 0, 'should produce at least one remediation step');
    assert(recipe.steps.some((s) => s.command?.includes('git-filter-repo') || s.command?.includes('filter-repo')), 'recipe should mention git filter-repo');

    // Shell escaping: a secret containing single quotes and shell metacharacters must be
    // wrapped safely. shellSingleQuote produces: 'value'"'"'s ...' etc.
    // We verify the value is enclosed in single-quotes and the raw unquoted injection form
    // (" ; rm -rf /") does not appear outside of a quoted context.
    const trickyFinding = { ...awsFinding, secretValue: "it's a secret; rm -rf /", filePath: "src/file with 'quotes'.ts" };
    const trickyRecipe = RemediationGenerator.generateForFinding(trickyFinding);
    const allCommands = trickyRecipe.steps.map((s) => s.command ?? '').join('\n');
    // The value should start inside a single-quoted shell word
    assert(allCommands.includes("'it'"), 'secret value should be single-quoted');
    // The unquoted bare form that would cause injection must not exist
    assert(!allCommands.includes(' ; rm -rf /'), 'shell metacharacters must not appear unquoted');

    console.log('  ✓ remediation recipe generated and shell-escape verified');
  } finally {
    if (scanDir) {
      await RepoManager.cleanup(scanDir);
      console.log('  ✓ ephemeral dir cleaned up');
    }
  }

  console.log('\n========================================');
  console.log('ALL TESTS PASSED');
  console.log('========================================\n');
}

runTests().catch((err) => {
  console.error('\nTEST FAILED:', err);
  process.exit(1);
});
