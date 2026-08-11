# Security Policy

## Reporting a vulnerability

Report security findings privately through **GitHub private vulnerability reporting** on this
repository (Security tab → Report a vulnerability) rather than a public issue. You will get a
response within a few days, credit in the fix unless you prefer otherwise, and disclosure
coordinated with the patch.

If the private form is unavailable, open a public issue describing the *class* of problem without
a working recipe, and note that you have details to share privately.

## Threat model, honestly stated

This is an agentic workflow: a model with file access reads untrusted web content (job postings)
alongside your personal data (CV, profile, application history). That combination is the main
risk surface, and it can be narrowed, not eliminated. What the framework does about it:

- **Untrusted-input rules.** `/apply` and `/rank` treat posting text as data, never instructions.
  Agents are told not to follow directions embedded in postings and not to fetch URLs found
  inside posting text; the posting URL you supplied is the one exception. Reviewer research
  starts from the company identity you confirmed, never from links in the posting body.
- **Permission allowlist.** `.claude/settings.json` pre-approves only the commands the workflow
  needs, and the `security-guards` CI job fails any PR that widens it or adds package-manifest
  lifecycle scripts. Note the allowlist governs Bash commands: the model's native WebFetch and
  WebSearch tools are outside its reach, which is exactly why the instruction-level rules above
  exist.
- **No sync.** There are no external sync commands. Nothing uploads document content anywhere.

Instruction-level defenses raise the bar; they are not a sandbox. Against job boards you do not
trust, review what the agent fetched and wrote before sending anything out.

## The chat pane runs Claude Code with edits pre-approved

`studio/apps/web/server/chat-api.ts` mounts `POST /api/chat` on the Vite dev server and spawns the
local `claude` CLI with the repo root as its working directory and `--permission-mode acceptEdits`.
Any request that reaches that endpoint can write files in the repo without a prompt. There is no
authentication on it.

What keeps that safe is the bind address and nothing else:

- Run the board with plain `bun run dev`. Do not pass `--host`, and do not put it behind a tunnel
  or a reverse proxy.
- Anything with access to your loopback interface has the same power the chat pane does.
- A built bundle has no server and therefore no chat pane; this applies to the dev server only.

`studio/apps/web/PRODUCT.md` states a "no remote calls" principle. That is true of this code. The
Claude Code process it starts does make remote calls, which is the point of it.

## Your data is tracked, by design

Your profile, tracker (`data/jobs.json`) and application archive are committed files, because the
board reads the tracker out of the repo. Keep your fork private. Making it public later does not
undo it: the data is in the git history by then.

## Scope notes

- Portal CLI skills make live requests only when you run them; CI never does.
- `linkedin-search` uses public, unauthenticated endpoints. Automated access is against
  LinkedIn's Terms of Service, so it is personal-use only and volume should stay low.
- A portal skill you generate with `/add-portal` is code that runs on your machine. Read it.
