# SentraScan

A tool for finding secrets — API keys, tokens, credentials — that got committed to a git repo at some point and never really left, even if they were "deleted" in a later commit.

That's the part people forget: deleting a line from a file doesn't delete it from git. It's still sitting in the history, reachable by anyone who clones the repo and runs `git log -p`. SentraScan walks the full commit history, diffs every commit, and flags anything that looks like a leaked credential — whether it's still in the code today or was scrubbed three commits ago.

## How it works

You give it a repo — a public git URL, a zip upload, or the built-in demo repo — and it:

1. Clones/extracts it into an isolated temp directory
2. Walks every commit with `git rev-list --reverse HEAD`
3. Diffs each commit and runs two detectors over the changes:
   - **Pattern matching** for known formats: AWS keys, GitHub/GitLab tokens, Slack tokens and webhooks, Stripe keys, OpenAI keys, Google API keys/OAuth secrets, JWTs, private key headers, database connection strings with embedded credentials, and generic `password =` / `secret =` assignments.
   - **Shannon entropy** scoring for everything else — catches custom or unrecognized tokens that don't match a known pattern but are clearly random-looking strings, with a tunable threshold (default 4.2 bits/char, min length 16-20 chars) so it doesn't flag every UUID and hash in your codebase.
4. Streams progress back to the UI over SSE as it works through commits
5. Shows each finding with a few lines of surrounding context, blurred by default so you're not flashing live credentials on a screen share

It does **not** try to fix anything for you automatically. For each finding it generates the exact `git filter-repo` / `git filter-branch` commands you'd need to scrub it — but you copy those and run them yourself, locally. The server never rewrites your git history. That was a deliberate line I didn't want to cross: a tool that can rewrite a stranger's repo history on their behalf is a much scarier thing to run than one that just tells you what to do.

## Stack

- **Backend**: Node.js + Express + TypeScript, talks to `git` directly via `execFile` (no wrapper libraries)
- **Frontend**: React 19 + Vite + TypeScript
- **No database** — everything is scanned in an ephemeral temp directory and thrown away when the request finishes

## Running it

You need Node 20+ and `git` on your `PATH`.

```bash
git clone https://github.com/Divyansh-co/DIV-Git-History-Secret-Scanner.git
cd DIV-Git-History-Secret-Scanner

npm --prefix server install
npm --prefix client install

# terminal 1
npm --prefix server run dev

# terminal 2
npm --prefix client run dev
```

Open `http://localhost:5173`.

For a single-port production build:

```bash
npm run build
npm start
```

Or with Docker (this is the version I'd actually trust with a stranger's repo — see below for why):

```bash
docker compose up --build
```

Either way it comes up on `http://localhost:3001`. There's a one-click demo repo baked in if you want to see it work without pointing it at anything real.

## Security posture

This tool's entire job is taking arbitrary URLs and zip files from users and running `git` against them, so I spent more time on containment than on features. What's actually in place:

- **No git hooks, ever.** Every clone runs with `-c core.hooksPath=/dev/null`. A malicious repo can't smuggle a `post-checkout` script that executes on your machine.
- **SSRF filtering on the URL input.** Before anything is cloned, the hostname is checked against loopback addresses, RFC1918 private ranges, and the `169.254.169.254` cloud metadata endpoint. `http://localhost:3001` or `http://169.254.169.254/latest/meta-data` gets rejected before a connection is ever made.
- **Zip-Slip protection on uploads.** Every entry's resolved destination path is checked against the extraction root before anything is written to disk — a zip with `../../etc/whatever` in an entry name gets rejected outright.
- **Size and entry-count limits on zips**, plus a 150MB uncompressed ceiling, so a small malicious zip can't decompress into something that fills the disk.
- **Timeouts everywhere.** Clones and scans are capped (60–90s) and aborted if they run long, so a huge or intentionally slow repo can't tie up the server indefinitely.
- **Ephemeral by design.** Every scan gets its own UUID-named temp directory, and it's wiped in a `finally` block regardless of whether the scan succeeded, failed, or timed out. Nothing you scan is meant to outlive the request.
- **Runs as a non-root user with resource caps** when deployed via the included Docker setup — capped CPU/memory, `no-new-privileges`, and `/tmp` mounted as a `noexec` tmpfs.

What it deliberately does **not** do: rate limiting on the API endpoints, authentication, or request logging beyond console output. It's built to be run by one person against repos they already have a reason to look at — their own, a client's, something they're auditing — not deployed as a public-facing service that strangers hit directly. If you're going to expose this beyond localhost, put it behind something that handles auth and rate limiting for you (a reverse proxy, an internal gateway, whatever your setup already uses).

## What this isn't

- It's not a replacement for GitHub's native secret scanning or a tool like gitleaks/trufflehog — it's a smaller, self-contained version of the same idea, built to actually understand end to end rather than configure.
- Entropy detection has false positives. Long hashes, base64 blobs, and some UUIDs will get flagged. That's the tradeoff for catching things pattern matching alone would miss — tune the threshold if it's too noisy for a given repo.
- If a secret shows up as a finding, **it's already been exposed to anyone who's cloned the repo.** Treat every hit as "revoke and rotate this key," not "quietly remove it and move on." Deleting it from history with `git filter-repo` only helps future clones — it doesn't undo any exposure that already happened.

## Testing

```bash
npm --prefix server test
```

Covers entropy scoring, pattern matching against known formats, SSRF/URL validation, and zip-slip rejection.

## Author

Divyansh Mishra — [@Divyansh-co](https://github.com/Divyansh-co) — `divyanshmishra.python@gmail.com`

Found a security issue? Please email me directly instead of opening a public issue.
