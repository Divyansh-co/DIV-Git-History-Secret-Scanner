import { PatternCategory, Severity } from '../types.js';

export interface SecretPattern {
  name: string;
  category: PatternCategory;
  severity: Severity;
  description: string;
  regex: RegExp;
  recommendation: string;
}

export const SECRET_PATTERNS: SecretPattern[] = [
  // --- AWS Keys ---
  {
    name: 'AWS Access Key ID',
    category: 'cloud',
    severity: 'CRITICAL',
    description: 'AWS IAM access key identifier (starts with AKIA or ASIA)',
    regex: /\b((?:AKIA|ASIA|ABIA|ACCA)[0-9A-Z]{16})\b/g,
    recommendation: 'Deactivate key in AWS IAM Console immediately, rotate credentials, and check AWS CloudTrail for unauthorized activity.',
  },
  {
    name: 'AWS Secret Access Key',
    category: 'cloud',
    severity: 'CRITICAL',
    description: 'AWS Secret Access Key paired with access credentials',
    regex: /(?:aws_secret_access_key|aws_secret_key|secret_access_key)\s*[:=]\s*["']?([A-Za-z0-9\/+=]{40})["']?/gi,
    recommendation: 'Rotate AWS IAM credentials immediately and revoke active access keys.',
  },

  // --- GitHub Tokens ---
  {
    name: 'GitHub Personal Access Token (Classic)',
    category: 'tokens',
    severity: 'CRITICAL',
    description: 'GitHub classic personal access token (ghp_ prefix)',
    regex: /\b(ghp_[0-9a-zA-Z]{36})\b/g,
    recommendation: 'Revoke token at GitHub Settings -> Developer settings -> Personal access tokens.',
  },
  {
    name: 'GitHub Fine-Grained Personal Access Token',
    category: 'tokens',
    severity: 'CRITICAL',
    description: 'GitHub fine-grained PAT (github_pat_ prefix)',
    regex: /\b(github_pat_[0-9a-zA-Z_]{82})\b/g,
    recommendation: 'Revoke immediately in GitHub Settings -> Developer settings -> Personal access tokens.',
  },
  {
    name: 'GitHub OAuth / App Token',
    category: 'tokens',
    severity: 'HIGH',
    description: 'GitHub OAuth Access Token (gho_), User-to-Server (ghu_), or Server-to-Server (ghs_)',
    regex: /\b(gh[ousr]_[0-9a-zA-Z]{36})\b/g,
    recommendation: 'Revoke active GitHub OAuth token or rotate application secrets.',
  },

  // --- GitLab Tokens ---
  {
    name: 'GitLab Personal Access Token',
    category: 'tokens',
    severity: 'CRITICAL',
    description: 'GitLab Personal Access Token (glpat- prefix)',
    regex: /\b(glpat-[0-9a-zA-Z_-]{20,30})\b/g,
    recommendation: 'Revoke token in GitLab User Settings -> Access Tokens.',
  },

  // --- Google Cloud ---
  {
    name: 'Google API Key',
    category: 'cloud',
    severity: 'HIGH',
    description: 'Google Cloud Platform public or private API Key (AIza prefix)',
    regex: /\b(AIza[0-9A-Za-z_-]{34,36})\b/g,
    recommendation: 'Restrict or delete API key in Google Cloud Console -> APIs & Services -> Credentials.',
  },
  {
    name: 'Google OAuth Client Secret',
    category: 'cloud',
    severity: 'CRITICAL',
    description: 'Google Cloud OAuth 2.0 Client Secret',
    regex: /(?:client_secret)\s*[:=]\s*["']?([a-zA-Z0-9\-_]{24,36})["']?/gi,
    recommendation: 'Regenerate OAuth client secret in Google Cloud Console.',
  },

  // --- Slack Tokens ---
  {
    name: 'Slack Token',
    category: 'tokens',
    severity: 'HIGH',
    description: 'Slack Bot, User, App, or Refresh Token (xox[baprs]- prefix)',
    regex: /\b(xox[baprs]-[0-9a-zA-Z]{10,48})\b/g,
    recommendation: 'Revoke token at api.slack.com/apps or your Slack Workspace Admin portal.',
  },
  {
    name: 'Slack Incoming Webhook URL',
    category: 'tokens',
    severity: 'MEDIUM',
    description: 'Slack Incoming Webhook containing workspace secret token',
    regex: /https:\/\/hooks\.slack\.com\/services\/T[0-9A-Z]{8,}\/B[0-9A-Z]{8,}\/[0-9a-zA-Z]{24}/g,
    recommendation: 'Delete webhook in Slack App Configuration and generate a new secure webhook.',
  },

  // --- Stripe API Keys ---
  {
    name: 'Stripe Live Secret Key',
    category: 'tokens',
    severity: 'CRITICAL',
    description: 'Stripe Live Secret Key (sk_live_ or rk_live_)',
    regex: /\b([sr]k_live_[0-9a-zA-Z]{24,34})\b/g,
    recommendation: 'Roll Stripe API key immediately in Stripe Dashboard -> Developers -> API keys.',
  },

  // --- OpenAI / AI Keys ---
  {
    name: 'OpenAI API Key',
    category: 'tokens',
    severity: 'HIGH',
    description: 'OpenAI secret API key (sk- or sk-proj-)',
    regex: /\b(sk-(?:proj-)?[a-zA-Z0-9_-]{32,80})\b/g,
    recommendation: 'Revoke secret key in platform.openai.com/api-keys.',
  },

  // --- Private Key Headers ---
  {
    name: 'Private Key Header',
    category: 'keys',
    severity: 'CRITICAL',
    description: 'Cryptographic Private Key Block (RSA, DSA, EC, OPENSSH, PGP)',
    regex: /-----BEGIN (?:RSA |DSA |EC |OPENSSH |PGP )?PRIVATE KEY-----/g,
    recommendation: 'Replace all cryptographic certificates and revoke matching public keys immediately.',
  },

  // --- JSON Web Tokens (JWT) ---
  {
    name: 'JSON Web Token (JWT)',
    category: 'tokens',
    severity: 'MEDIUM',
    description: 'Raw signed JSON Web Token (Bearer credential)',
    regex: /\b(eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,})\b/g,
    recommendation: 'Invalidate JWT session secret or rotate signing keys; revoke associated user sessions.',
  },

  // --- Database Connection Strings ---
  {
    name: 'Database Connection URI with Credentials',
    category: 'database',
    severity: 'CRITICAL',
    description: 'Database connection URI embedding username and plain password',
    regex: /(?:postgres|postgresql|mysql|mongodb|mongodb\+srv|redis|amqp):\/\/[^:\s'"]+:([^@\s'"]{4,})@[^/\s'"]+/gi,
    recommendation: 'Rotate database user password in database management console and move connection string to secure environment secrets (e.g. AWS Secrets Manager, Vault).',
  },

  // --- Generic Password / Secret Assignments ---
  {
    name: 'Generic Password / Secret Assignment',
    category: 'passwords',
    severity: 'MEDIUM',
    description: 'Hardcoded secret or password variable assignment',
    regex: /(?:password|passwd|secret|api_key|apikey|access_token|auth_token|client_secret|private_key)\s*[:=]\s*["']([^"'\r\n\s]{8,64})["']/gi,
    recommendation: 'Remove hardcoded credentials from source code and load via runtime environment variables.',
  },
];

// List of common non-secret dummy placeholders to filter out
export const PLACEHOLDER_PATTERNS = [
  /your[_-]?api[_-]?key/i,
  /insert[_-]?key[_-]?here/i,
  /change[_-]?me/i,
  /example[_-]?key/i,
  /placeholder/i,
  /dummy/i,
  /test[_-]?password/i,
  /secret[_-]?here/i,
  /replace[_-]?with/i,
  /<[^>]+>/, // e.g. <YOUR_TOKEN>
  /\$\{[^}]+\}/, // e.g. ${API_KEY}
  /process\.env\./,
];

export function isPlaceholder(val: string): boolean {
  if (!val || val.length < 6) return true;
  return PLACEHOLDER_PATTERNS.some((p) => p.test(val));
}
