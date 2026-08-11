# Search Queries for Job Scraper

<!-- SETUP: this file is a template with the shipped portals filled in and the profile-specific
     parts left blank. Run `/setup --section search` to fill it, or edit it by hand any time your
     priorities change. -->

## Installed portal CLIs (primary for `/scrape`)

`/scrape` discovers every portal skill under `.agents/skills/*/SKILL.md` and runs its CLI first.
A skill whose frontmatter says `enabled: false` is skipped unless named explicitly. Shipped:

**Polish market:**

- **`justjoinit-search`** - justjoin.it, the largest Polish IT board. Salary ranges on most offers, plus `experienceLevel` and `workplaceType`. Server-side keyword and city filtering. **~100 offers per query, no pagination** (the portal only server-renders the first batch), so narrow with `--category` / `--location` rather than paging.
- **`nofluffjobs-search`** - No Fluff Jobs, where every offer publishes its salary range. Paginated (20/page), keyword goes in the path. **Search results carry no date**, so `--jobage` is unsupported there; use it when compensation matters more than recency.
- **`czyjesteldorado-search`** - aggregator (Pracuj.pl, No Fluff Jobs, theprotocol.it, direct employers) with **salary normalized to monthly PLN**, which is the only way to compare hourly B2B against monthly employment offers. **Only the 10 newest per category** are reachable, so treat it as a frequent "what's new" feed, not an exhaustive search; `/scrape` dedupe across runs is what makes it accumulate.

**Market-agnostic:**

- **`linkedin-search`** - public `jobs-guest` endpoints, location as an explicit flag, so it works anywhere. Personal use only, per its own ToS note: keep volume low.
- **`freehire-search`** - returns each hit's full description.

Elsewhere in the world, run `/add-portal` with your local board's URL. The generated skill lands
under `.agents/skills/` and `/scrape` picks it up with no further wiring.

### Suggested CLI sweep

<!-- SETUP: replace the queries below with your own roles, categories and cities. The shapes are
     what matters; the Polish examples are there to be copied and edited. -->

```bash
# Breadth: keyword plus city, and a whole category remote
bun run .agents/skills/justjoinit-search/cli/src/cli.ts search -q "[ROLE]" -l [city] --jobage 14 --format table
bun run .agents/skills/justjoinit-search/cli/src/cli.ts search -c [category] -l remote --jobage 14 --format table

# Salary-first
bun run .agents/skills/nofluffjobs-search/cli/src/cli.ts search -q "[ROLE]" -l [city] --format table

# What's new across your target categories
bun run .agents/skills/czyjesteldorado-search/cli/src/cli.ts search -c [cat1],[cat2],[cat3] --jobage 3 --format table

# Level-restricted, where calibration says only one level converts
bun run .agents/skills/justjoinit-search/cli/src/cli.ts search -c [category] -l [city] --experience junior --format table
```

The `site:` query templates below are the **WebSearch fallback**: for portals without a CLI,
company career pages, or when a CLI fails.

## Search Sites

<!-- SETUP: /setup writes your market's boards here. The Polish list is the shipped example. -->

Primary:
- **justjoin.it** - largest Polish IT board, salary ranges published. **CLI installed** (`justjoinit-search`)
- **nofluffjobs.com** - IT-only, every offer publishes a salary range, strong on B2B contracts. **CLI installed** (`nofluffjobs-search`)
- **czyjesteldorado.pl** - aggregator with normalized monthly-PLN salary. **CLI installed** (`czyjesteldorado-search`)
- **theprotocol.it**, **pracuj.pl**, **rocketjobs.pl**, **bulldogjob.pl**, **solid.jobs** - no CLI; `site:` fallback
- **linkedin.com/jobs** - also covered by the `linkedin-search` CLI, which should be preferred

Secondary:
- Company career pages via `site:` searches
- Remote-first boards: weworkremotely.com, remoteok.com, justremote.co

## Query Categories

Order these by what actually converts, not by what sounds closest to the long-term goal. Once
`04-job-evaluation.md` has calibration data, it decides this order.

### Priority 1: [PRIMARY TARGET ROLE TYPE]

```
site:[board] "[Role Title]" [City]
site:[board] "[Role Title]" [key tool]
site:linkedin.com/jobs "[Role Title]" [Country] remote
```

Titles to match: [every title this role travels under, including local-language variants].

### Priority 2: [BRIDGE ROLES, if your search spans two role families]

Roles that read as your current job on the CV while growing the skills of the next one. Rank
these **above** Priority 3 even when the titles look further from the goal.

```
site:[board] "[Bridge Title]" [City]
```

### Priority 3: [THE ROLE FAMILY YOU ARE MOVING TOWARD, level-restricted]

<!-- SETUP: where calibration shows one level converting and another not, write the hard rule
     here, with the numbers behind it. -->

```
site:[board] "Junior [Title]" [City] OR remote
```

### Priority 4: Wider net

<!-- SETUP: queries that widen rather than target: a distinctive domain you have shipped in, an
     unusual product type, a tool combination few candidates have. If CLAUDE.md says domain is
     not a filter, these widen the net rather than narrowing it to a sector. -->

## Searchable Skill Terms

Use these as query keywords, distinctive and genuinely supported by the profile:
**[skill]**, **[skill]**, **[skill]**.

**Do not search on:** [the "Not yet" list from `01-candidate-profile.md`]. Where an employer has
already rejected an application on one of these gaps, name it here so no future sweep surfaces
the same mismatch.

## Location Filter

- **Ideal:** [remote scope, or the city]
- **Acceptable:** [hybrid radius]
- **Borderline:** [what to flag rather than drop]
- **Fail:** [relocation, onsite outside the radius, whatever `CLAUDE.md` lists as a deal-breaker]

## Compensation Filter

- **Target:** [range and contract type]
- **Acceptable:** [the lower band, and what has to be true to accept it]
- **Flag:** [the floor, and the plain sentence to say when a posting is under it]
- Boards that publish ranges let this filter run before any application effort is spent

## Date Filter

Only include jobs posted within the last 14 days, or with an application deadline that has not yet passed. If a posting date cannot be determined, include it but flag as "date unknown".

## Application-Channel Note

Rank a posting **higher** when it names a recruiter or hiring manager who can be contacted
directly, and **lower** when it is a one-click apply with no named contact.

<!-- SETUP: once outcomes accumulate, replace this with your own channel data from
     04-job-evaluation.md. The generic rule above holds until then. -->

## Adapting Queries

If the user specifies a focus area, select queries from the matching category and also generate 2-3 custom queries for that focus. For example:
- "/scrape [focus_area]" -> relevant category queries + custom focus-specific queries
