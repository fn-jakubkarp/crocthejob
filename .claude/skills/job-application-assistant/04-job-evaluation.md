# Job Evaluation Framework

<!-- SETUP: Skill match areas and career goals are personalized by running /setup -->

## Eligibility Gate — run before scoring

If the candidate is not a citizen or permanent resident of the country they are applying in, run this first. It is a hard filter, not a scoring dimension, and it is separate from work-permit *timing*: timing asks "can they work the required hours yet?", eligibility asks "are they permitted to hold this job at all?". A candidate can pass timing and still be categorically excluded.

Read the posting's eligibility / work rights / "who can apply" section **verbatim** and classify:

| Posting wording | Verdict |
|-----------------|---------|
| Names a **citizenship or permanent-residency requirement** ("must be a citizen of X", "permanent resident", "PR required", "full working rights" where the employer means citizen/PR) | **FAIL — hard stop.** Do not score, do not draft. Quote the exact wording back to the user. |
| Requires a **security clearance** at any level | **FAIL** in most countries, since clearance is normally gated on citizenship. Verify the specific scheme rather than assuming. |
| **Explicitly names** the candidate's permit class, or says "international applicants welcome", "visa holders considered", "we sponsor" | **PASS** — verified acceptance. Worth noting as a positive in the application. |
| **Silent** on citizenship or residency | **PROCEED, but mark unverified.** Check the employer's own careers or international-applicant page before drafting. |

**Two rules that are easy to get wrong:**

1. **Silence is not permission.** Large graduate programs frequently gate eligibility on their own website rather than in the job ad. Highest-risk categories: professional-services firms, government and defence, banking, telecommunications, and anything touching critical infrastructure.
2. **A company-wide "we accept international applicants" statement is not role-level permission.** The common pattern is a general welcome followed by a *named list* of the specific programs or service lines it covers. Confirm the **specific posting or stream** appears on that list before drafting.

**Report an eligibility failure to the user with the quoted source** rather than silently dropping the role. They may know something about their own status that the profile does not record.

If the candidate's permit also constrains *hours* or *start date* (a student visa with a term-time cap, a permit that begins on graduation), record that as a second gate under this section during `/setup`, with the specific dates. Do not merge it with the eligibility question above — they fail for different reasons and need different answers.

A role that fails this gate is not scored and not drafted. Everything below applies only to roles that pass it.

<!-- SETUP: /setup records the citizenship and work-authorization situation here. Where the
     candidate is a citizen or permanent resident of the country they apply in, this gate is
     skipped silently for domestic postings and stays live for foreign ones. -->

## Scoring Dimensions

Evaluate each job posting against these five dimensions:

### 1. Technical Skills Match (0-100)
How well do the required/preferred skills align with the candidate's capabilities?

| Score | Meaning |
|-------|---------|
| 80-100 | Core requirements are primary skills |
| 60-79 | Most requirements match, 1-2 gaps that are learnable |
| 40-59 | Partial match, significant upskilling needed |
| 0-39 | Fundamental mismatch |

<!-- SETUP: /setup fills these three lines from 01-candidate-profile.md. Where an employer has
     named a gap in a rejection, record it on the weak line with the employer, so no later draft
     blurs the same distinction twice. -->

**Strong match areas:** [YOUR_PRIMARY_SKILLS]
**Moderate match areas:** [real but shallower, or used on one project rather than daily]
**Weak match areas:** [the honest gap list, including anything an employer has named in a rejection]

### 2. Experience Match (0-100)
Does work history align with what they're looking for?

| Score | Meaning |
|-------|---------|
| 80-100 | Direct experience in the same domain and role type |
| 60-79 | Related experience, transferable skills clear |
| 40-59 | Adjacent experience, would need to make the case |
| 0-39 | Unrelated experience |

**Strong:** [the role types your history maps onto directly].

Read `CLAUDE.md`'s Target Sectors before scoring. If domain is not a filter there, score the role
content and never the sector, in either direction: domain overlap is not a bonus and an unfamiliar
domain is not a penalty.

**Moderate:** [role types you can make the case for, with the caveat that makes the case honest]

**Entry-level:** [areas with real but shallow exposure, each stated at its real size]. Apply at
**junior level or as an explicit bridge role**, never at the level the deeper areas support; see
Calibration below.

**Total experience:** [N] years ([start date] to present), [continuous or with gaps].

### 3. Behavioral/Culture Fit (0-100)
Does the role and company culture match the behavioral profile?

| Score | Meaning |
|-------|---------|
| 80-100 | Culture strongly matches behavioral preferences |
| 60-79 | Mixed signals but mostly compatible |
| 40-59 | Some friction areas |
| 0-39 | Significant culture mismatch |

**Red flags to research:** Department disorganization, work dominated by maintenance over development, poor chemistry with leadership, culture mismatches. Check reviews, media coverage, LinkedIn connections, and network contacts for insider perspective.

### 4. Location & Logistics (Pass/Fail + Notes)
- Within commute range: PASS
- Remote with occasional office: PASS
- Requires relocation: FAIL (deal-breaker)
- Frequent international travel: FLAG (discuss with user)

### 5. Career Alignment & Motivation (0-100)
Does this role advance career goals and contain tasks that energize?

| Score | Meaning |
|-------|---------|
| 80-100 | Strongly aligned with career direction, clear growth path |
| 60-79 | Good role but only partially aligned with long-term goals |
| 40-59 | Decent job but doesn't build toward career goals |
| 0-39 | Dead end or backwards step |

**Career goals:**
- **Now:** [the role you are actually applying for, at the level you are applying at].
- **Bridge:** [roles that grow the missing half of the CV on the job rather than after hours].
- **Target, next few years:** [where this is going, and the honest gap between here and there].
- [What to consolidate rather than add.]
- [Study and certifications in flight, with dates.]

**Motivation filter:** Evaluate not just whether you *can* do the tasks, but whether the tasks will *energize* you. Consider:
- **Tasks that energize:** [the work you would do unprompted].
- **Tasks that drain:** [the work that makes a well-paid role a bad one]. A posting built mostly
  from this list scores low on this dimension however well it scores on skills.
- Non-task factors: leadership style, department culture, company values, degree of autonomy

**Life situation alignment:** Consider personal constraints:
- **Security**: [the current situation, and whether it is a floor to beat or a baseline to match].
- **Compensation target**: [range and contract type]. [What is acceptable for a strong fit, and the point below which the answer is a plain "this is a step sideways".] [Where the current arrangement is not a like-for-like comparison, say so, so a quoted figure gets translated rather than compared raw.]
- **Flexibility**: [study, caring, or other commitments, with their dates]. [Location and remote preferences.] [Which posting demands conflict with them - FLAG.]
- **Professional development**: [the growth a role has to offer to be worth taking]. Training budget, certification support and exposure to the tools you are moving toward are real positives worth scoring.

## Calibration from Past Applications

<!-- SETUP: this section stays empty until a few applications resolve. /setup then writes it from
     data/jobs.json and documents/applications/*/outcome.md. It is the highest-value section in
     the file, because it is the only part grounded in what actually happened rather than in what
     the profile claims. -->

Once there is outcome data, record:

1. **Which role types and levels converted, and which produced silence.** Split the search into
   phases if it changed direction, and give volume and result per phase. A role family that
   produces rejections is doing better than one that produces nothing: a rejection means the
   profile was legible.
2. **Which channels converted.** Recruiter-initiated contact, direct application, one-click
   apply, referral. Weight the effort accordingly rather than by what feels productive.
3. **Whether volume is the bottleneck.** It usually is not. If a large number of applications has
   produced no offer, the constraint is targeting and level, and answering it with more volume
   makes it worse.
4. **Gaps employers named explicitly**, with the employer and the role. These become scoring
   rules: a gap named twice caps the Skills Match on postings that require it.
5. **Process-hygiene outcomes** - recruitment put on hold, role filled before the process began -
   kept separate. They are not candidate-quality signals and must not be read as rejections.

Each finding becomes a scoring rule above, not just a note. A calibration section that does not
change how a posting scores is a diary.

### 6. Salary Benchmark (Optional)

If the posting states a range, compare it against the compensation target in the profile and say
plainly whether it clears the floor. If it states nothing, say so and leave the section at that.
Do not guess a market rate from a company name.

## Output Format

Present the evaluation as:

```
## Job Fit Evaluation: [Role] at [Company]

| Dimension | Score | Notes |
|-----------|-------|-------|
| Technical Skills | XX/100 | [brief note] |
| Experience Match | XX/100 | [brief note] |
| Behavioral Fit | XX/100 | [brief note] |
| Location | PASS/FAIL | [brief note] |
| Career Alignment | XX/100 | [brief note] |

**Overall Score: XX/100** (weighted average of scored dimensions)

### Verdict: [Strong Fit / Good Fit / Moderate Fit / Weak Fit / Poor Fit]

### Key Strengths for This Role
- [bullet points]

### Gaps to Address
- [bullet points]

### Recommendation
[1-2 sentences: apply/skip/apply with caveats]

### Company Research Checklist
- [ ] Checked company website (mission, values, recent news)
- [ ] Checked review sites (Glassdoor and the equivalent for your market)
- [ ] Checked LinkedIn for team size, recent hires, connections
- [ ] Checked media for restructuring, growth, or workplace issues
- [ ] Identified network contacts who may know the team/manager
```

## Weighting
- Technical Skills: 30%
- Experience Match: 30%
- Behavioral Fit: 15%
- Career Alignment: 25%

(Location is pass/fail, not weighted)

## Thresholds
- **Strong Fit** (75+): Definitely apply, tailor everything
- **Good Fit** (60-74): Apply, and prepare an honest bridge for the gaps as interview material
- **Moderate Fit** (45-59): Consider carefully, discuss with user
- **Weak Fit** (30-44): Probably skip unless strategic reasons
- **Poor Fit** (<30): Skip

## Pre-Application: Call the Employer (Best Practice)

Before writing the application, consider whether the candidate should call the contact person listed in the posting. **Only call if there are substantive questions** - never call just to "be remembered."

### When to Suggest Calling
- The posting has unclear or ambiguous requirements
- It's unclear which competencies are essential vs. nice-to-have
- The role description is vague about day-to-day tasks
- There's a named contact person who invites questions

### Good Questions to Ask
- "What are the primary challenges in this role?"
- "How is time typically divided across the listed responsibilities?"
- "Which competencies are most critical for success in this position?"
- "What does success look like in the first 6-12 months?"

### Rules for the Call
- Prepare a 30-second "elevator pitch" about your background in case they ask
- The call's purpose is **gathering information**, not delivering a pitch
- Take notes - use what you learn to tailor the application
- Reference the conversation naturally in the application email or portal message ("After speaking with [name], I was especially drawn to...")
