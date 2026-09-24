import { SecretFinding } from '../types.js';

export interface RemediationRecipe {
  title: string;
  summary: string;
  tool: 'git-filter-repo' | 'git-filter-branch' | 'bfg';
  steps: Array<{
    title: string;
    description: string;
    command?: string;
  }>;
  revocationNotes: string[];
  warning: string;
}

export class RemediationGenerator {
  /**
   * Generates safe git history rewrite instructions for local execution.
   * NOTE: Server-side execution is strictly prohibited.
   */
  public static generateForFinding(finding: SecretFinding): RemediationRecipe {
    const escapedSecret = finding.secretValue.replace(/"/g, '\\"');
    const safePath = finding.filePath.replace(/"/g, '\\"');

    const steps = [
      {
        title: '1. Backup Your Local Repository',
        description: 'Always clone a fresh mirror backup before modifying git history.',
        command: 'cp -r . ../repo-backup-before-purge',
      },
      {
        title: '2. Install git-filter-repo (Recommended tool)',
        description: 'git-filter-repo is the modern, Git-recommended tool for rewriting repository history.',
        command: 'pip install git-filter-repo',
      },
      {
        title: '3. Option A: Redact the Secret Value Across All Commits (Preserves File)',
        description:
          'Replaces every occurrence of this secret string across all commits and commits ago without deleting the file.',
        command: `echo "${escapedSecret}==>***REDACTED_SECRET***" > expressions.txt\ngit filter-repo --replace-text expressions.txt --force\nrm expressions.txt`,
      },
      {
        title: '4. Option B: Completely Purge the Compromised File from All Commits',
        description:
          'If the entire file should never have been committed (e.g., .env or credentials.json):',
        command: `git filter-repo --invert-paths --path "${safePath}" --force`,
      },
      {
        title: '5. Fallback: Using Standard git filter-branch (No Python dependency required)',
        description: 'If git-filter-repo is not installed, use standard git filter-branch:',
        command: `git filter-branch --force --index-filter 'git rm --cached --ignore-unmatch "${safePath}"' --prune-empty --tag-name-filter cat -- --all`,
      },
      {
        title: '6. Push Rewritten History to Remote Repository',
        description: 'Force-push all rewritten branches and tags to remote:',
        command: 'git push origin --force --all\ngit push origin --force --tags',
      },
    ];

    const revocationNotes = [
      `Critical: Removing the secret from Git history DOES NOT revoke or invalidate the credential at the provider.`,
      `Finding Category: ${(finding.patternCategory || 'secret').toUpperCase()} - ${finding.matchedPatternName || 'Credential'}.`,
      `Action: ${finding.recommendation || 'Revoke and rotate credentials at provider.'}`,
      `Coordinate with your team: Force-pushing rewrites commit SHAs; teammates must re-clone or rebase their local branches.`,
    ];

    return {
      title: `Remediation Plan for ${finding.matchedPatternName} in ${finding.filePath}`,
      summary: `Found secret in commit ${finding.shortHash} (${finding.commitsAgo} commits ago). Follow the recipe below to purge this credential from Git history.`,
      tool: 'git-filter-repo',
      steps,
      revocationNotes,
      warning:
        'SAFEGUARD: SentraScan never executes rewrite commands on the server. Always test these commands on a separate backup branch or clone before running force-push.',
    };
  }

  /**
   * Generates a batch remediation script for all findings in a scan
   */
  public static generateBatchScript(findings: SecretFinding[]): {
    expressionsFile: string;
    filterRepoCommand: string;
    filterBranchCommand: string;
  } {
    const uniqueSecrets = Array.from(new Set(findings.map((f) => f.secretValue)));
    const uniqueFiles = Array.from(new Set(findings.map((f) => f.filePath)));

    const expressions = uniqueSecrets
      .map((sec) => `${sec}==>***REDACTED_SECRET***`)
      .join('\n');

    const filePathsArgs = uniqueFiles.map((p) => `--path "${p}"`).join(' ');

    const filterRepoCommand = `# 1. Replace all secrets with redacted placeholders across all history:\ncat << 'EOF' > purge_secrets.txt\n${expressions}\nEOF\ngit filter-repo --replace-text purge_secrets.txt --force\nrm purge_secrets.txt`;

    const filterBranchCommand = `# Fallback: purge files with standard git filter-branch\ngit filter-branch --force --index-filter 'git rm --cached --ignore-unmatch ${uniqueFiles.map((f) => `"${f}"`).join(' ')}' --prune-empty --tag-name-filter cat -- --all`;

    return {
      expressionsFile: expressions,
      filterRepoCommand,
      filterBranchCommand,
    };
  }
}
