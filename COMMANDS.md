# Commands

**Profile**

| Command | What it does |
| --- | --- |
| `/setup [--section <name>]` | Builds your profile from `documents/`, a pasted CV, or an interview. Re-runnable; it merges and asks before overwriting. `--section search` re-runs just the search config. |
| `/expand` | Enriches the profile from public sources you already linked in it: repos, portfolio, course syllabi. Discovered competencies land with a source tag. |
| `/reset [profile\|documents\|all]` | Wipes profile data or the documents folder. Shows exactly what goes and makes you type `RESET`. |

**Find**

| Command | What it does |
| --- | --- |
| `/scrape [focus]` | Runs every enabled portal CLI, dedupes against everything ever seen, saves posting text, presents matches sorted by fit. Canonical URL comparison means the same posting under `?utm_source=` or a locale prefix is one entry, not three; postings expire, so the fetched text is saved to `documents/postings/` first. `/scrape health` probes the portals instead of searching. |
| `/rank [--all]` | Batch-scores new postings on five dimensions with parallel agents, vetoes on deal-breakers, flags deadlines, marks dead postings expired. Location is stored as the place the posting names, never as a verdict that throws it away. Pick a number and it hands off to `/apply`. |
| `/add-portal` | Investigates a job board in your market, scaffolds a CLI skill with the same output contract as the shipped ones, and test-runs a live query before registering it. Three Polish portals ship already, plus the market-agnostic LinkedIn and freehire. |

**Apply**

| Command | What it does |
| --- | --- |
| `/apply {url \| text}` | The drafter-reviewer workflow: evaluate fit, draft the tailored CV, spawn a reviewer with a fresh context to research the company and critique it, revise, verify against the profile, ATS-check the keywords. Tailors by cutting the master CV (kept deliberately over-length), never rewriting it; when it overflows a page, the lowest-relevance lines to *this* posting go first. |
| `/outcome [followup]` | Records interview stages, offers, rejections and silence; archives the CV and posting. `followup` surfaces applications gone quiet and drafts a short note, never sends one. `/setup` folds recorded outcomes back into the scoring framework, so ranking calibrates on what actually converted for you. |
| `/interview {company}` | Builds a stage-specific prep pack from that application's own archive: the posting, the CV they actually read, feedback from earlier rounds. Offers a mock interview. |
| `/upskill [url]` | The gap between your profile and your tracked postings, as a prioritized heatmap plus a learning plan with time estimates. |

> [!TIP]
> A posting URL that will not fetch is not a dead end: `/apply <the full job description>` takes pasted text, and the board's **Save posting** dialog files it where `/scrape` would have.
