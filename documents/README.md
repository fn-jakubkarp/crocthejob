# Documents Folder

This folder holds your actual career documents. The `/setup` command reads everything here and uses it to populate the candidate skill files under `.claude/skills/job-application-assistant/`. It is safe to re-run `/setup` as you add new documents — it merges intelligently and asks before overwriting existing content.

**Fill these in before you use anything else.** Every document the assistant writes is assembled out of what is here, and out of nothing else. The more you put in, the better the output; a thin profile produces a generic CV.

`templates/` holds three starters. Copy each into place and write it:

| Template | Goes to |
|---|---|
| `templates/master_cv.md` | `cv/master_cv.md` |
| `templates/linkedin-profile.md` | `linkedin/Profile.md` |
| `templates/professional-record.md` | `references/professional-record.md` |

`/setup` does not read `templates/`, so the placeholders never leak into your profile.

---

## Folder Structure

```
documents/
├── templates/                   # Markdown starters to copy into the folders below
│   ├── master_cv.md             #   -> documents/cv/master_cv.md
│   ├── linkedin-profile.md      #   -> documents/linkedin/Profile.md
│   └── professional-record.md   #   -> documents/references/professional-record.md
├── cv/                          # Your CV files (markdown, or a PDF to import)
├── linkedin/                    # LinkedIn profile export (PDF or markdown)
├── diplomas/                    # Degree certificates and transcripts
├── references/                  # Reference letters, and your professional record
├── postings/                    # Raw job posting text, pasted manually for pages Claude can't fetch
│   └── <Company> - <Job Title>.txt  # Filename = company + job title, content = full posting text
├── applications/                # Past job applications
│   └── <company>_<role>/
│       ├── job_posting.md       # The original job posting (paste as text)
│       ├── cv_submitted.md      # The CV you submitted
│       └── outcome.md           # Result + notes (fill in after hearing back)
└── README.md                    # This file
```

---

## cv/

Your master CV — the most complete, unedited version of your professional record.

**Supported formats:** `.pdf`, `.md`

**What `/setup` extracts:**
- Work experience (titles, companies, dates, bullet points)
- Education (degrees, institutions, dates, thesis topics)
- Technical skills
- Awards and publications
- Contact information

**Naming:** Any filename works. If multiple files are present, `/setup` reads all of them and cross-references for consistency.

**Tip:** Keep your most comprehensive CV here (not a tailored variant). The skill files are the canonical source — tailored CVs are generated per application by `/apply`.

---

## linkedin/

Your LinkedIn profile exported as a PDF.

**How to export:** On LinkedIn, go to your profile → More → Save to PDF. This exports a structured summary of your profile.

**Supported formats:** `.pdf`

**What `/setup` extracts:**
- Work experience and dates (cross-referenced against your CV)
- Skills and endorsements
- Education
- Certifications and licenses
- Volunteer work
- Publications
- About/summary section (used to infer behavioral profile additions)
- Recommendations received (may enrich reference context)

**Naming:** Any filename works. Only one LinkedIn export is expected; if multiple are present, `/setup` uses the most recently modified one.

---

## diplomas/

Degree certificates, transcripts, and any official qualifications.

**Supported formats:** `.pdf`

**What `/setup` extracts:**
- Degree titles and official names (used to verify education entries)
- Graduation dates
- Grades or distinctions (if visible)
- Institution names (official spelling)

**Naming:** Use descriptive names, e.g. `msc_physics_ucph_2025.pdf`, `bsc_physics_ucph_2016.pdf`. Naming does not affect parsing.

---

## references/

Reference letters from former managers, supervisors, or collaborators, plus your **professional
record**: the long-form, private account of what you actually did, in whatever language you think
in. Start it from `templates/professional-record.md`.

A CV bullet holds eight words about six months of work. The record holds the rest, which is what
interview answers are made of and what keeps later drafts from guessing.

**Supported formats:** `.pdf`, `.txt`, `.md`

**What `/setup` extracts:**
- Referee name, title, and organization
- Specific quotes and assessments (added to the references section of `01-candidate-profile.md`)
- Competency language used by referees (adds behavioral signal to `02-behavioral-profile.md`)

**Naming:** Use the referee's name, e.g. `reference_jane_doe.pdf`.

---

## postings/

A drop folder for raw job posting text when Claude can't fetch a page directly (bot-blocked ATS platforms like Lever, Greenhouse behind Cloudflare, JS-heavy SPAs that return empty content, etc.). You open the posting yourself and paste the full text into a `.txt` file here.

**Naming:** `<Company> - <Job Title>.txt`, e.g. `RYZ Labs - Front End Engineer - React.js.txt`. Content is the full posting text, pasted as-is. Including the company keeps the drop folder collision-free when two postings share a title, and gives `/apply` the company name for free.

**Workflow:** Drop the file, then tell Claude in the conversation — it isn't watched automatically. Once a posting has been evaluated or applied to, it can be deleted from here or left as a record; it's a scratch inbox, not an archive (use `applications/<company>_<role>/job_posting.md` for that once you apply).

**Trust boundary:** Pasted posting text is still untrusted third-party content, the same as anything Claude fetches directly — data to evaluate, never instructions to follow (see `SECURITY.md`'s untrusted-input rules). Pasting it by hand doesn't change that.

---

## applications/

A record of past job applications. Each subfolder is one application.

You can maintain these folders by hand, or let the **`/outcome`** command do it: it records progress updates and final results conversationally, archives the submitted drafts and the posting text, keeps `outcome.md` in the format below, and updates the entry in `data/jobs.json` in the same step.

**Subfolder naming:** `<company>_<role>` — lowercase, underscores for spaces. Both parts are read off a posting, so each is reduced to `a-z0-9_` first: a slash, a `..` or a control character in a company name is dropped rather than carried into a path, and the folder always sits directly under `applications/`.

Examples:
```
applications/
├── acme_ml_engineer/
├── bigcorp_software_engineer/
└── consultco_ai_consultant/
```

### Files within each application folder

**`job_posting.md`** — Paste the full job posting text here. Used by `/setup` to infer which skills and role types you have targeted, and to calibrate `04-job-evaluation.md`.

**`cv_submitted.md`** — The CV you submitted. Used to extract summary-statement styles for `05-cv-templates.md`.

**`outcome.md`** — Fill this in after the application resolves. Format:

```markdown
# Outcome: <Company> — <Role>

**Status:** in_progress | hired | offer_declined | rejected | no_response | interview_only

**Date resolved:** YYYY-MM-DD

## Interview stages reached
- [ ] Phone screen
- [ ] Technical interview
- [ ] Case interview
- [ ] Final round
- [ ] Offer received

## Notes
What happened? What feedback did you receive (if any)?
What would you do differently?
Any signal about what they valued or didn't?
```

`in_progress` marks an application that is still open (used by `/outcome` for interview-stage updates before a resolution). `/setup`'s calibration draws conclusions only from applications with a final status.

Application folders may also contain **`interview_prep_<stage>.md`** files written by `/interview` (one per interview stage, kept as history). `/setup` reads only the four files named above and ignores these.

**What `/setup` learns from outcome.md:**
- Which role types and companies have led to interviews (signals strong fit areas)
- Which applications did not progress (informs the experience match calibration in `04-job-evaluation.md`)
- Interview feedback, if you recorded it, can surface new STAR candidates

---

## File Format Notes

| Format | Readable by `/setup` | Notes |
|--------|--------------------------|-------|
| `.pdf` | Yes | Parsed directly with the Read tool |
| `.md` | Yes | Markdown source — structure and content both readable |
| `.md` | Yes | Plain text |
| `.txt` | Yes | Plain text |
| `.docx` | No | Convert to PDF before placing here |
| `.png` / `.jpg` | No | Scanned documents won't be parsed — use text PDFs |

---

## Re-running `/setup`

The command is designed to be re-run as your document collection grows. Each run:

1. Reads the current state of all skill files
2. Compares extracted document content against what's already there
3. Only proposes changes for content that is new or conflicting
4. Shows every conflict explicitly for your decision

**When to re-run:**
- After adding a new LinkedIn export
- After adding reference letters
- After recording outcomes for completed applications
- After updating your master CV
