# CV Templates and Tailoring Guide

<!-- SETUP: Profile statements and section ordering are personalized by running /setup -->

## Format: Markdown

The candidate builds the final document themselves from the markdown.

**Master CV:** `documents/cv/master_cv.md` - the single strong CV, kept slightly
over-length on purpose. Tailoring is subtraction and reordering, not rewriting.

**Output file:** `documents/applications/<company>_<role>/cv_<company>.md`

The application folder is the unit of work. It holds the posting, the tailored CV and any
interview prep for that one application. Lowercase, underscores for spaces, one convention
across `/apply`, `/outcome`, `/interview` and the board.

```
documents/applications/acme_qa_engineer/
    job_posting.md
    cv_submitted.md          <- name it cv_submitted.md once actually sent
    interview_prep_screening.md
```

Deliver the markdown file **and** a short edit summary in chat (what was cut, what moved, what
was reworded and why), so the candidate can apply the same changes to their own layout without
diffing two files.

## Markdown structure

Mirror the master CV's structure exactly, so the candidate's own layout keeps working:

```markdown
# [YOUR_NAME]

[Role] | [City, Country]
[email] | [phone]
[linkedin] | [github] | [website]

## SUMMARY
## WORK EXPERIENCE
### <Role>, <Company>
## SKILLS
## PERSONAL PROJECTS
## EDUCATION
## CERTIFICATIONS
## LANGUAGES
```

Rules that hold regardless of the final layout:

- `##` for sections, `###` for roles and projects, `-` for bullets. No other markup.
- Never use em-dashes. Commas, periods, or restructure. (Repo-wide rule, see `03-writing-style.md`.)
- Section headings are literal English text. Whenever the CV language is not English, translate
  every heading too, not just the prose. A localized summary sitting under `WORK EXPERIENCE`
  reads as sloppy, and it is easy to miss precisely because the prose is the visible part of
  the job. Worked example for Polish: `PODSUMOWANIE`, `DOŚWIADCZENIE ZAWODOWE`, `UMIEJĘTNOŚCI`,
  `WYKSZTAŁCENIE`, `CERTYFIKATY`, `JĘZYKI`.

## How CVs are read

Two findings drive the ordering rules below.

**Screening runs in two stages.** The Ladders 2018 eye-tracking study measured ~7.4 seconds on the
initial screen, heatmaps clustering upper-left: name, current job title, the first bullets under each
role. Treat that number as a triage time, not a reading time. Recruiters self-report 4+ minutes on
CVs that survive triage, and the study itself is thin evidence alone (n=30, unpublished methodology,
run by a company selling job-search services). Front-loading wins the triage pass; the lower sections
are read by whoever advances the candidate, so deprioritize them rather than emptying them.

**The F-pattern is a formatting symptom.** NN/g, who named it, found F-scanning fires on walls of text
with no bolding, bullets or subheadings. Format properly and scanning shifts to a layer-cake pattern,
where the reader hops heading to heading and reads them. Layer-cake favours the candidate, so the
goal is preventing the F rather than designing around it:

- **Cap every paragraph at 3 lines**, summary included. A 5-line block is the wall.
- **Put each bullet's payload in its first 6-8 words.** Bullet openings sit on the left margin where
  the vertical scan runs, so a number or claim landing in position 20 misses the first pass. Move the
  strongest element forward even at some cost to the sentence.
- **Role title before company name.** Current title is the first fixation after the name. Title bold,
  company secondary.
- **Right-align dates.** The observed scan includes a deliberate rightward move to check progression.
- **The first 1-2 bullets per role carry the decision.** Order bullets by relevance to the posting
  rather than by chronology or theme. If only two get read, those two hold the reason to interview.
- **Bold load-bearing phrases only.** Bold is what makes layer-cake possible; bold everything and the
  page reverts to a wall.

## Section-by-Section Tailoring

### Summary

The most important section to customize, and the only one that gets rewritten rather than
trimmed. **3 lines maximum**, functioning as an elevator pitch: why this candidate for *this* role,
framed as what the employer gains.

A summary long enough to look like a paragraph is the one block on the CV that reliably triggers
F-scanning, and it sits where the reader is least committed. **The first sentence has to survive
being the only sentence read**: load it with role, ownership scope and the single strongest number,
in that order, and push everything supporting into sentence two or the bullets. The three statements
below run long as source material; cut each to three lines when drafting.

When the role sits outside the home domain, **lead with the transfer argument.** The sentence
connecting QA release ownership to their problem belongs in the summary's opening. The CV is the
only document being sent, so the summary is the only place it can live. It is the strongest card a
domain-changer holds; play it first.

<!-- SETUP: /setup writes one statement per target role type here, each grounded in
     01-candidate-profile.md and CLAUDE.md. Adapt emphasis per posting, never the facts. Write
     two or three; more than that and they stop being distinct. -->

**For [PRIMARY TARGET ROLE TYPE]:**
> [Role and years] with [the ownership claim], currently [current position and the scope that
> makes it distinctive]. [The single strongest number, with the scope it belongs to.] [One line
> on how you work that a referee would confirm.]

**For [SECOND ROLE TYPE, e.g. the automation-forward version of the same job]:**
> [Same facts, reordered so the artifacts lead: what you built, on what, for whom.]

**For [BRIDGE ROLES, if your search spans two families]:**
> [The honest version of a move in progress: what you have actually done in the new area, stated
> at its real size, plus the credential or study in flight and the transfer argument.]

**Framing rules for all of them:**
- **State self-initiated work at its real size.** "Self-initiated alongside my main
  responsibilities" is not a weakness, it is the reason the claim is credible. Inflating a
  side-project into a job title is the failure mode `/rank` calibration data catches.
- **Never merge two adjacent skills into one claim.** Where a rejection has already turned on
  such a distinction, `01-candidate-profile.md` records it; honour that here.
- Mention **Claude Code** by name wherever AI-assisted delivery appears.
- Where `CLAUDE.md` sets a domain-framing rule, follow it here, including its exception.
- Where `CLAUDE.md` marks something as never-in-writing, it does not appear here either.

Statements labeled *[Used for: <company>_<role>]* were extracted from archived application drafts
by `/setup` Path A. They are **phrasing references, never fact sources**: when drafting from one,
every factual claim still comes from `01-candidate-profile.md`. A past tailored draft does not
vouch for its own accuracy.

### Skills

Reorder and re-group by role, keeping the master's category labels. Put the posting's own core
term at the start of the matching line when it truthfully applies. ATS and skim-reading managers
match literally, and a line beginning "Playwright" outperforms one that buries it in position six.

Cut whole categories that the posting does not touch rather than thinning every line. On a pure
manual-QA posting the CI/CD line can go; on a DevOps-leaning posting the Test Management line can.

A concepts-only credential names its subject in Certifications, not in Skills. Same for anything
on the "Not yet" list in `CLAUDE.md`.

### Work Experience

- Cut and reorder bullets. Do not invent new ones. The master holds the full set for a reason.
- Budget bullets by how much of the story the role carries: 6-8 for the current or most relevant
  role, 4-6 for the one before it, fewer going back. Lead each role with its most
  posting-relevant bullet, which is not always the chronological or the most impressive one.
- **Rank the first two bullets of every role deliberately.** They carry the triage decision. Ask
  directly: if the reader stops after bullet two, is the reason to interview already on the page?
- **Front-load each bullet's payload into its first 6-8 words.** The left margin is where the
  vertical scan runs, so the opening words are the only guaranteed-read part of a long bullet. A
  bullet reading "Write Playwright E2E tests alongside the frontend developers and review every E2E
  pull request before merge, setting the conventions the suite follows" buries its two strongest
  claims, reviewing every PR and owning the conventions, past the scan line. Lead with those.
- **Keep every number exact against `01-candidate-profile.md`.** Escalating one is fabrication,
  and the numbers are the claims most likely to be probed in the interview they win.
- Where a role sits outside the domain the posting hires for, lead it with whichever bullet
  translates. A year in an unfamiliar industry reads as a detour or as continuous experience
  depending entirely on which bullet goes first.
- Never write the items `CLAUDE.md` and `01-candidate-profile.md` mark as interview-only or
  never-in-writing.

#### Check tenure against visible output

Before finalizing, look at each role the way a stranger will: **date span versus how much work is
shown.** A two-year role represented by three bullets reads as low output, whether or not that is
fair. The reader cannot know what filled the time, so they guess, and the guess is unflattering.
If a trim leaves a long role looking thin, restore the highest-relevance cut bullet.

### Personal Projects

Keep 1-2, chosen for the posting: pick the one carrying the signal the posting asks for. Every
project on the CV is presented as finished work; a project that cannot be described that way is
cut instead of disclaimed.

### Education

State in-progress status inside the entry itself: `10/2025 - Exp. 06/2027`, for example. A bare closed range
reads as a finished degree to anyone skimming, and a summary saying "currently completing" does not
fix it, since the education entry is where a reader checks the credential and it has to stand alone.

**Check for agreement:** the summary, the education entry and any availability note all give the
same completion date. A credential claimed before it is held surfaces at transcript or reference
check, later and more expensively than at interview.

### Certifications

One line each, with the credential ID where there is one. A certification that only matters to a
narrow slice of postings is tailored out of the rest rather than carried everywhere.

### Evidence Links

Wherever the CV names a verifiable artifact, carry its link so a reader can check the claim in
one click. A CV whose strongest claims are checkable reads as more credible everywhere else too.

### References

Not on the CV. The referee names and quotes live in the repo for interview use. If a posting
demands references, add a single line: "Available on request."

## Page budget

**Target one page.** Page count reads as a seniority signal before a word is parsed, and at three
years across two roles a second page costs more than it carries. A page two under ~70% full reads as
having run out of content.

Two pages earn their place at roughly 10+ years across 4+ still-relevant roles, on an academic CV
with publications, for a contractor listing many short client engagements, or where a public-sector
form demands full history. None describe this candidate yet.

The candidate's own layout decides the rendered page count, so budget by content. The master CV is
~1000 words and deliberately over-length: a source, not a deliverable. **Target 620-700 words for a
tailored CV**, which lands on one page at 10-10.5pt with 14-15mm margins.

| Section | Budget |
|---------|--------|
| Summary | 3 lines |
| Current / most relevant role | 6-8 bullets |
| Previous role | 4-5 bullets |
| Skills | 3-4 lines, one per category |
| Personal projects | 1 entry |
| Education | 2 entries |
| Certifications | 1-2 entries |
| Languages | 1 line |

**Set 10pt and 15mm margins first, then cut until it fits.** Type below 10pt or margins below 14mm
is the diagnostic that the content is too long, not the remedy: a CV squeezed to 9pt reads as
crammed before it is read at all.

**If in doubt, cut.** A shorter CV that reads clean beats a full one that has to be squeezed.

### Bullets are one source line each

The candidate pastes this markdown into their own builder (FlowCV). Builders import a hard line
break inside a bullet as a literal break, producing mid-sentence breaks and inconsistent indents in
the rendered PDF. **Write every bullet as one unbroken line, however long.** This is the most common
visible defect in exported output, and it is invisible in the markdown itself.

## Relevance-weighted cutting

**Cut by signal, not by section.** Static priority lists ("remove the oldest role first") are
wrong when a relevant lower-priority item competes with an irrelevant higher-priority one. An
older-role bullet that speaks directly to the posting is worth more than a recent-role bullet
that does not.

For every candidate line, score three things:

1. **Relevance to THIS posting.** Does the line hit a named tool, keyword, or stated
   responsibility in the job ad?
2. **Uniqueness.** Is it the only place this claim appears, or is it duplicated elsewhere?
3. **Interview load.** Is it a story the candidate plans to tell in the room, or something an
   application-form field leans on? If so it is load-bearing, since a claim made verbally that is
   absent from the paper reads as inflation.

Cut the lowest total score first, regardless of section.

### Practical order of cuts (easiest to last resort)

1. **Redundancy.** A claim appearing in both Skills and an experience bullet: cut the Skills
   version, since the bullet is the more concrete evidence.
2. **Summary fluff.** A sentence restating what Skills will show anyway.
3. **Low-relevance experience bullets**, wherever they sit. The same bullet is a cut on one
   posting and the lead on another, so score it against this posting rather than by section.
4. **Low-relevance supporting content.** A project that does not touch the posting's stack. A
   certification that only matters to a different industry.
5. **Last-resort structural cuts.** Dropping Personal Projects entirely, or the Bachelor's entry.

### Pitfalls

- Do not cut from the bottom of a static list without checking relevance. "Cut the oldest role
  first" is wrong if that role is literally about the skill the posting asks for.
- Do not cut the one concrete example the interview prep leans on. The rule is no claim in the
  room that is not on the paper.
- Do not cut the ownership framing to save words. Whatever makes the scope distinctive is the
  differentiator, and targeting is the constraint on a job search, not application volume.

## Verification

Re-read the generated markdown and check:

- [ ] Every claim traces to `01-candidate-profile.md`, the master CV, or `CLAUDE.md`'s Candidate
      Profile section. Numbers match exactly.
- [ ] No never-in-writing items (see Work Experience above), and any domain-framing rule in
      `CLAUDE.md` honoured.
- [ ] No em-dashes anywhere.
- [ ] Word count in the 620-700 band, and the content fits one page at 10pt with 15mm margins.
- [ ] Every bullet is a single unbroken line in the markdown source.
- [ ] Summary is 3 lines or fewer, and its first sentence stands alone.
- [ ] First two bullets of each role contain the reason to interview.
- [ ] Heading structure matches the master, and heading language matches the CV language.
- [ ] Contact block present and correct.
- [ ] An in-progress degree states expected completion.
- [ ] Claude Code named wherever AI tooling appears.
- [ ] Posting keywords covered where truthful, genuine gaps left visible and never stuffed.

### ATS keyword check

Keyword screening still applies even though the candidate exports the PDF. Check coverage against
the extracted markdown: match the posting's required and preferred terms, in the posting's
language, and prefer the posting's exact term over a synonym where it truthfully applies, since
ATS matching is often literal. Never add a keyword the profile does not support.

If the candidate supplies their exported PDF, the mechanical parse check is worth running:

```bash
pdftotext -layout <exported>.pdf - | head -60
```

`pdftotext` (poppler) is optional. When present, verify the email and phone appear as literal
text (a contact detail carried only by an icon or a hyperlink is invisible to an ATS), that there
are no `(cid:NNN)` markers or `�` characters, and that the reading order matches the visual
order. Multi-column layouts are where reading order breaks; if it is scrambled, say so plainly:
the layout is trading ATS compatibility for looks.

## Recommended section order

1. Summary
2. Work Experience (reverse chronological)
3. Skills
4. Personal Projects
5. Education
6. Certifications
7. Languages

The observed scan sets this order. Work Experience sits directly under the Summary because the first
fixation after the name is the current job title, and anything placed between them spends the most
valuable position on the page. Skills sits below Work Experience because it is hunted deliberately
rather than skimmed (NN/g's spotted pattern), so it loses nothing lower down and ATS parses it
wherever it lands. Personal Projects drops below Skills for the same reason it is the first cut: it
is the weakest signal on a CV already carrying two real roles.

On an automation-heavy posting, front-load the matching line *inside* Skills and lead with the
relevant experience bullet, keeping the order intact. Where the degree is a hard filter, Education
moves above Work Experience.
