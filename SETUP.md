# Setup Guide

Step-by-step instructions for getting Croc the Job running.

## 1. Prerequisites

### Claude Code

Install Claude Code (Anthropic's CLI for Claude):

```bash
npm install -g @anthropic-ai/claude-code
```

You'll need an Anthropic API key or a Claude Pro/Team subscription. See the [Claude Code docs](https://docs.anthropic.com/en/docs/claude-code) for details.

The portal skills also work from Codex, OpenCode and the Gemini CLI (see [`AGENTS.md`](AGENTS.md)).

### Python

Python 3.10+ is required for the lint and guard scripts. Check with:

```bash
python3 --version
```

On Windows, `py --version` is often the most reliable check. If your system exposes Python as `python` instead of `python3`, use `python` in the commands below.

### Bun (for job search tools)

The job portal CLIs (three Polish portals plus the market-agnostic `linkedin-search` and `freehire-search`) are written in TypeScript and run with Bun. Bun also runs the web app under `studio/`.

- macOS/Linux:

```bash
curl -fsSL https://bun.sh/install | bash
```

- Windows PowerShell:

```powershell
powershell -ExecutionPolicy Bypass -c "irm https://bun.sh/install.ps1 | iex"
```

If you prefer a package manager, `winget install Oven-sh.Bun` also works on Windows.

### Document format

`/apply` produces **markdown CVs**. You build the final document in whatever layout you prefer
and export the PDF yourself.

### Optional: pdftotext (for the ATS check)

`/apply` runs an ATS parseability check on your exported CV: it extracts the PDF's text layer and verifies contact details, reading order, and keyword coverage the way an applicant-tracking system sees them. This uses `pdftotext` from [poppler](https://poppler.freedesktop.org/):

- **macOS:** `brew install poppler`
- **Debian/Ubuntu:** `sudo apt install poppler-utils`
- **Windows:** `choco install poppler`

If `pdftotext` is missing, `/apply` skips the mechanical check with a warning and falls back to a visual keyword review — everything else works normally.

## 2. Fork and clone

Fork [fn-jakubkarp/crocthejob](https://github.com/fn-jakubkarp/crocthejob) on GitHub, then clone
your fork:

```bash
git clone git@github.com:YOUR-GITHUB-USERNAME/crocthejob.git
cd crocthejob
```

Your fork holds your own profile and job-search history once `/setup` runs. Keep it private.

## 3. Install dependencies

From the repository root, on any platform:

```bash
bun install
```

The root is a bun workspace covering the web app and all five portal CLIs, so that installs
everything at once.

Outside Poland, generate a search skill for your local job board with `/add-portal`. It
investigates the portal, scaffolds the same CLI structure, and test-runs a live query before
registering anything.

### Verify the install

```bash
python3 tools/lint_skills.py                      # needs pyyaml
python3 tools/security_guards.py
python3 -m unittest discover -s tests -t .
bun run ci && bun run test
```

## 4. Fill in your documents

`documents/templates/` holds three starters. Copy each into place and write it. This is the step
that decides output quality, and it is the one people skip.

| Template | Goes to | What it is |
| --- | --- | --- |
| `master_cv.md` | `documents/cv/master_cv.md` | The one strong CV every tailored version is cut from |
| `linkedin-profile.md` | `documents/linkedin/Profile.md` | What your profile says today, recommendations included |
| `professional-record.md` | `documents/references/professional-record.md` | The long-form private account of what you actually did |

The professional record is the one worth the evening. A CV bullet holds eight words about six
months of work; an interview answer needs the situation, the constraint and the outcome that the
bullet dropped. Write it messy, ask Claude to sort it out, come back to it. It gets written
several times, not once.

You can skip this step and go straight to `/setup` below; it will ask for the same information
interactively. Filling the templates first just gives it more to work with up front.

## 5. Run the setup interview

Start Claude Code in the repository:

```bash
claude
```

Then run the onboarding:

```
/setup
```

Claude will offer three paths:

- **Path A (documents folder):** Add your CV, LinkedIn export, diplomas, references, or past applications under `documents/` (the templates from step 4, or anything else). Claude reads and cross-references them before proposing profile updates. This is best when you have several source files.
- **Path B (single CV import):** Share one CV/resume by mentioning the file with `@` or pasting the text. Claude extracts it and asks follow-up questions for anything missing.
- **Path C (interview mode):** Answer structured interview questions section by section.

All three paths produce the same result: fully populated profile files.

### What gets populated

| File | Content |
|------|---------|
| `CLAUDE.md` | Your full candidate profile |
| `.claude/skills/job-application-assistant/01-candidate-profile.md` | Structured education, experience, skills |
| `.claude/skills/job-application-assistant/02-behavioral-profile.md` | Behavioral assessment |
| `.claude/skills/job-application-assistant/04-job-evaluation.md` | Personalized skill match areas and career goals |
| `.claude/skills/job-application-assistant/05-cv-templates.md` | Profile statement templates for your background |
| `.claude/skills/job-application-assistant/06-interview-prep.md` | STAR examples from your experience |
| `documents/cv/master_cv.md` | Your master CV in markdown |
| `.claude/skills/job-scraper/search-queries.md` | Job search queries for `/scrape` |

### Re-running setup

You can update specific sections later:

```
/setup --section skills
/setup --section experience
/setup --section search
```

The `--section search` option is especially useful as your priorities evolve. It re-runs the search configuration interview and suggests role types you may not have considered based on your full profile.

## 6. Open the board

```bash
bun run dev        # http://localhost:5173
```

The board reads and writes `data/jobs.json`, the same file `/scrape` and `/rank` use. It opens
empty on a fresh clone and fills as postings arrive.

It runs under `bun run dev` only: the write path is a Vite dev-server plugin, so a built bundle
loads nothing and saves nothing.

## 7. Test the workflow

Find a job posting you're interested in, then:

```
/apply https://justjoin.it/offers/example-qa-engineer
```

Or paste the job description directly:

```
/apply [paste job posting text here]
```

Claude will:
1. Evaluate the fit against your profile
2. Ask if you want to proceed
3. Draft a tailored CV in markdown
4. Have a reviewer agent critique the drafts
5. Revise and present the final output

## 8. Export your document

`/apply` writes a tailored CV in markdown to
`documents/applications/<company>_<role>/cv_<company>.md`, plus an edit summary in chat listing
what was cut, moved and reworded. Paste the content into your own layout and export the PDF from
there. If you want the ATS text-layer check run against that export, say so and hand over the PDF.

## Troubleshooting

### Job search CLI tools not working
Make sure Bun is installed and you ran `bun install` in each CLI directory. The tools require network access to fetch job listings.

### The board shows no jobs
Check where it is reading from. `studio/packages/jobs-data/store.ts` resolves the file as
`JOBS_FILE`, then `../data/jobs.json` next to `studio/`, then `studio/data/jobs.json`. A missing
file reads as empty rather than as an error, so an empty board can mean the wrong path.

### The board loads but nothing saves
You are running a built bundle. The write path only exists under `bun run dev`.
