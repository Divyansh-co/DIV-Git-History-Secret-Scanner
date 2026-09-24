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

/**
 * Escapes a string for safe embedding in a POSIX single-quoted shell argument.
 * The only character that cannot appear inside single quotes is a single quote
 * itself — we close the quote, insert an escaped quote, then reopen.
 *
 * e.g.  it's fine  →  'it'"'"'s fine'
 */
function shellSingleQuote(value: string): string {
  return `'${value.replace(/'/g, "'\"'\"'")}'`;
}

export class RemediationGenerator {
  public static generateForFinding(finding: SecretFinding): RemediationRecipe {
    const quotedSecret = shellSingleQuote(finding.secretValue);
    const quotedPath = shellSingleQuote(finding.filePath);

    const steps = [
      {
        title: '1. Back up the repository',
        description: 'Make a mirror clone before touching history. If something goes wrong you can restore from it.',
        command: 'cp -r . ../repo-backup-before-purge',
      },
      {
        title: '2. Install git-filter-repo',
        description: 'The modern replacement for git filter-branch. Much faster and safer.',
        command: 'pip install git-filter-repo',
      },
      {
        title: '3. Option A — redact the secret value across all commits',
        description:
          'Replaces every occurrence of this exact string across all past commits. The file stays; only the secret value is overwritten.',
        command: `printf '%s' ${quotedSecret}' ==>***REDACTED***' > expressions.txt\ngit filter-repo --replace-text expressions.txt --force\nrm expressions.txt`,
      },
      {
        title: '4. Option B — remove the entire file from history',
        description:
          'Use this if the file should never have been committed at all (e.g. a .env or credentials file).',
        command: `git filter-repo --invert-paths --path ${quotedPath} --force`,
      },
      {
        title: '5. Fallback — git filter-branch (no Python needed)',
        description: 'Only use this if git-filter-repo is unavailable.',
        command: `git filter-branch --force --index-filter \\\n  'git rm --cached --ignore-unmatch ${quotedPath}' \\\n  --prune-empty --tag-name-filter cat -- --all`,
      },
      {
        title: '6. Force-push the rewritten history',
        description:
          'After verifying locally (git log --all | grep <secret>), push. Teammates will need to re-clone.',
        command: 'git push origin --force --all\ngit push origin --force --tags',
      },
    ];

    const revocationNotes = [
      `Removing the secret from git history does NOT revoke the credential at the provider. Rotate it immediately.`,
      `Category: ${(finding.patternCategory || 'secret').toUpperCase()} — ${finding.matchedPatternName || 'Credential'}`,
      finding.recommendation || 'Revoke and rotate this credential at the provider dashboard.',
      `Force-pushing rewrites commit SHAs. Coordinate with your team — everyone needs to re-clone or rebase.`,
    ];

    return {
      title: `Remediation: ${finding.matchedPatternName} in ${finding.filePath}`,
      summary: `Detected in commit ${finding.shortHash} (${finding.commitsAgo} commits ago). Steps below will purge it from history.`,
      tool: 'git-filter-repo',
      steps,
      revocationNotes,
      warning:
        'SentraScan does not run any rewrite commands on the server. All commands below run locally on your own machine.',
    };
  }

  public static generateBatchScript(findings: SecretFinding[]): {
    expressionsFile: string;
    filterRepoCommand: string;
    filterBranchCommand: string;
  } {
    const uniqueSecrets = Array.from(new Set(findings.map((f) => f.secretValue)));
    const uniqueFiles = Array.from(new Set(findings.map((f) => f.filePath)));

    // git-filter-repo replace-text format: literal ==> replacement (no shell escaping needed here,
    // this is written to a file via heredoc so the content is taken verbatim)
    const expressions = uniqueSecrets
      .map((sec) => `${sec}==>***REDACTED***`)
      .join('\n');

    const filterRepoCommand =
      `cat << 'EOF' > purge_secrets.txt\n${expressions}\nEOF\n` +
      `git filter-repo --replace-text purge_secrets.txt --force\n` +
      `rm purge_secrets.txt`;

    const quotedFilePaths = uniqueFiles.map((f) => shellSingleQuote(f)).join(' ');
    const filterBranchCommand =
      `git filter-branch --force --index-filter \\\n` +
      `  'git rm --cached --ignore-unmatch ${quotedFilePaths}' \\\n` +
      `  --prune-empty --tag-name-filter cat -- --all`;

    return { expressionsFile: expressions, filterRepoCommand, filterBranchCommand };
  }
}
