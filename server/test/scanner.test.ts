import assert from 'node:assert';
import { calculateShannonEntropy, findHighEntropyCandidates } from '../src/scanner/entropy.js';
import { SECRET_PATTERNS } from '../src/scanner/patterns.js';
import { DemoRepoGenerator } from '../src/sandbox/demoRepo.js';
import { GitScanner } from '../src/scanner/gitScanner.js';
import { RepoManager } from '../src/sandbox/repoManager.js';
import { RemediationGenerator } from '../src/remediation/remediationGenerator.js';

async function runTests() {
  console.log('--- [1] Testing Shannon Entropy ---');
  const zeroEntropy = calculateShannonEntropy('aaaaaaa');
  console.log(`Entropy('aaaaaaa') = ${zeroEntropy}`);
  assert(zeroEntropy === 0, 'Repetitive string should have 0 entropy');

  const englishEntropy = calculateShannonEntropy('hello world this is a test');
  console.log(`Entropy('hello world this is a test') = ${englishEntropy}`);
  assert(englishEntropy < 3.8, 'Standard english text should have lower entropy');

  const secretToken = 'dGVzdC1oaWdoLWVudHJvcHktc2VjcmV0LWtleS1leGFtcGxlLTIwMjY=';
  const secretEntropy = calculateShannonEntropy(secretToken);
  console.log(`Entropy('${secretToken}') = ${secretEntropy}`);
  assert(secretEntropy >= 4.0, 'High-entropy secret should have entropy >= 4.0');

  const candidates = findHighEntropyCandidates(`const KEY = "${secretToken}";`, 4.0, 16);
  assert(candidates.length > 0, 'Should detect high-entropy candidate');
  console.log('✓ Shannon Entropy tests passed!\n');

  console.log('--- [2] Testing Pattern Matchers ---');
  const testCases = [
    {
      code: 'const awsKey = "AKIAIOSFODNN7EXAMPLE";',
      expectedPattern: 'AWS Access Key ID',
      expectedSeverity: 'CRITICAL',
    },
    {
      code: 'GITHUB_TOKEN=ghp_9kF20dL47jQ8zM1vW5yR3sT6uP0oI8eA4bC2',
      expectedPattern: 'GitHub Personal Access Token (Classic)',
      expectedSeverity: 'CRITICAL',
    },
    {
      code: 'const gkey = "AIzaSyD-1234567890abcdefghijklmnopqrst";',
      expectedPattern: 'Google API Key',
      expectedSeverity: 'HIGH',
    },
    {
      code: 'export const PRIVATE_KEY = "-----BEGIN RSA PRIVATE KEY-----";',
      expectedPattern: 'Private Key Header',
      expectedSeverity: 'CRITICAL',
    },
  ];

  for (const tc of testCases) {
    const matched = SECRET_PATTERNS.filter((p) => {
      p.regex.lastIndex = 0;
      return p.regex.test(tc.code);
    });
    assert(matched.length > 0, `Pattern should match for ${tc.code}`);
    assert(
      matched.some((m) => m.name === tc.expectedPattern),
      `Expected ${tc.expectedPattern}, got ${matched.map((m) => m.name).join(', ')}`
    );
    console.log(`✓ Matched ${tc.expectedPattern} successfully`);
  }
  console.log('✓ Pattern matcher tests passed!\n');

  console.log('--- [3] Testing SSRF and URL Sanitization ---');
  assert(!RepoManager.validateGitUrl('file:///etc/passwd').valid, 'Should block file://');
  assert(!RepoManager.validateGitUrl('http://127.0.0.1:8080/repo.git').valid, 'Should block localhost/loopback');
  assert(!RepoManager.validateGitUrl('http://169.254.169.254/latest/meta-data').valid, 'Should block AWS metadata');
  assert(!RepoManager.validateGitUrl('https://10.0.0.1/repo.git').valid, 'Should block private 10.x.x.x');
  assert(RepoManager.validateGitUrl('https://github.com/torvalds/linux.git').valid, 'Should allow public GitHub https URL');
  console.log('✓ SSRF security validation tests passed!\n');

  console.log('--- [4] Testing Git History Scanner with Multi-Commit Demo Repo ---');
  let demoDir = '';
  try {
    demoDir = await DemoRepoGenerator.createDemoRepository();
    console.log(`Generated demo repo at: ${demoDir}`);

    const scanner = new GitScanner(demoDir, { entropyThreshold: 3.8 });
    const results = await scanner.scan((p) => {
      if (p.scannedCommits > 0) {
        console.log(`  [Progress] ${p.scannedCommits}/${p.totalCommits} commits scanned (${p.findingsCount} findings)`);
      }
    });

    console.log('\n--- Scan Summary ---');
    console.log(`Total commits scanned: ${results.summary.totalCommitsScanned}`);
    console.log(`Total findings: ${results.summary.totalFindings}`);
    console.log(`Findings by severity:`, results.summary.findingsBySeverity);

    assert(results.summary.totalCommitsScanned === 5, 'Should have scanned all 5 commits');
    assert(results.findings.length >= 5, 'Should have found at least 5 leaked secrets in history');

    // Verify detection of the AWS key which was DELETED in commit 3!
    const awsFinding = results.findings.find((f) => f.matchedPatternName === 'AWS Access Key ID');
    assert(awsFinding, 'CRITICAL: Must detect AWS Access Key committed in history even after deletion!');
    assert(awsFinding.commitsAgo > 0, `AWS key was committed in history (${awsFinding.commitsAgo} commits ago)`);
    assert(awsFinding.contextBefore !== undefined && awsFinding.contextAfter !== undefined, 'Must provide 3 lines context before & after');

    console.log(`✓ Successfully caught historically deleted AWS key: ${awsFinding.secretValue} (${awsFinding.commitsAgo} commits ago)`);

    // Verify remediation recipe generation
    const recipe = RemediationGenerator.generateForFinding(awsFinding);
    assert(recipe.steps.length > 0, 'Should generate remediation steps');
    assert(recipe.steps.some((s) => s.command?.includes('git-filter-repo')), 'Recipe should include git filter-repo');
    console.log('✓ Remediation generator test passed!\n');
  } finally {
    if (demoDir) {
      await RepoManager.cleanup(demoDir);
      console.log('✓ Ephemeral demo directory cleaned up.');
    }
  }

  console.log('\n========================================');
  console.log('ALL SENTRASCAN ENGINE TESTS PASSED SUCCESSFULLY!');
  console.log('========================================\n');
}

runTests().catch((err) => {
  console.error('Test failed with error:', err);
  process.exit(1);
});
