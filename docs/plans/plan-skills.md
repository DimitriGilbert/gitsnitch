# Plan: git-snitch Skills

## 1. Where Skills Live in the Repo

**Base path:** `/home/didi/workspace/Code/git-report/git-snitch/.opencode/skills/`

These are project-local skills shipped inside the repo. Opencode discovers project-local skills from `.opencode/skills/` within the working directory. Each skill is a directory containing at minimum a `SKILL.md`.

```
git-snitch/
└── .opencode/
    └── skills/
        ├── repo-work-report/
        │   └── SKILL.md
        ├── worklog/
        │   └── SKILL.md
        ├── changelog/
        │   └── SKILL.md
        └── devlog/
            └── SKILL.md
```

---

## 2. File Structure Per Skill

Following the write-a-skill guidance:
- `SKILL.md` is required, under 100 lines, with frontmatter description
- Reference files only if SKILL.md would exceed 100 lines
- Scripts only for deterministic operations
- Description max 1024 chars, third person, includes trigger words

### Skill 1: repo-work-report

```
.opencode/skills/repo-work-report/
└── SKILL.md
```

Single file. The not-ai-writer directives are embedded inline (vocabulary bans, structure rules) rather than split into a reference file since the combined content fits under 100 lines with tight editing.

### Skill 2: worklog

```
.opencode/skills/worklog/
└── SKILL.md
```

Single file. Aggregation logic is straightforward enough to keep in one file.

### Skill 3: changelog

```
.opencode/skills/changelog/
└── SKILL.md
```

Single file. Changelog format rules and not-ai-writer directives are concise.

### Skill 4: devlog

```
.opencode/skills/devlog/
├── SKILL.md
└── REFERENCES.md
```

Two files. SKILL.md stays under 100 lines. REFERENCES.md holds the expanded not-ai-writer vocabulary blacklist (200+ words), sentence structure rules, and the example article analysis framework. This is the strictest writing skill and needs the extra reference depth.

---

## 3. Content Outlines Per Skill

### 3.1 repo-work-report

**Description (frontmatter):**
```
Generates a structured work report from a single git repository for a given time period using git commands and file/diff reading. Use when the user asks for a work summary, activity report, or "what did I do" for a repo in a date range. Embeds not-ai-writer directives for natural output.
```

**SKILL.md outline:**

```
# repo-work-report

## Quick Start
- Single-paragraph example: user says "what did I work on last week in this repo?"
- Agent runs git log, gathers commits, classifies them, reads key diffs, produces work report

## Data Gathering Workflow
Phase 1: Collect raw commits
  - git log --since=<start> --until=<end> --numstat --pretty=format:...
  - Include: hash, short hash, author, date, subject, body, file stats
  - If user provides --all-branches, add --all flag
  - Default to current branch only

Phase 2: Classify and group
  - Group commits by classification: feature, bugfix, refactor, docs, test, chore, etc.
  - Within each group, order by date (most recent first)
  - Identify significant commits (large diffs, cross-cutting changes)

Phase 3: Read diffs for context
  - For each significant commit, run git show <hash> to get full diff
  - For file-level context, read changed files to understand what areas of codebase were touched
  - Use file paths to infer module/feature areas

Phase 4: Structure the report
  - Repository name and time range
  - Summary section (3-5 sentences, not-ai-writer compliant)
  - Sections by commit type:
    - Features shipped
    - Bugs fixed
    - Refactoring / improvements
    - Documentation
    - Tests
    - Other / maintenance
  - Each section: bullet list of what changed, with commit hashes
  - Contributors active in this period
  - Key files and modules touched
  - Stats: total commits, additions, deletions, files changed

## Writing Directives (not-ai-writer)
- Banned vocabulary: delve, tapestry, symphony, comprehensive, holistic, intricate, leverage, orchestrate, foster, unlock, realm, underscore, meticulous
- No formal transitions: moreover, furthermore, consequently, therefore
- Use specific commit messages and file paths, not vague summaries
- Short punchy sentences mixed with longer explanatory ones
- Contractions allowed and encouraged
- No "It's important to note" or "It's worth mentioning"
- Write like explaining to a colleague, not writing a press release

## Output Format
Markdown with:
  - H1: repo name + time range
  - H2: sections by type
  - Commit references as `abc1234: message`
  - File paths in backticks
  - Stats in a compact table at the bottom
```

---

### 3.2 worklog

**Description (frontmatter):**
```
Aggregates work reports across multiple repositories into a unified worklog. Use when the user asks for a cross-repo work summary, weekly/multi-repo report, or wants to combine repo-work-report outputs. Embeds not-ai-writer directives for natural output.
```

**SKILL.md outline:**

```
# worklog

## Quick Start
- User says "give me my work log across all repos for this sprint"
- Agent runs repo-work-report for each repo, then merges into unified worklog

## Multi-Repo Gathering Workflow
Phase 1: Identify repositories
  - If user provides explicit repo paths, use those
  - If user provides a parent directory, discover git repos using the same logic as git-snitch scan (find .git directories)
  - For each repo, run the repo-work-report data gathering phase

Phase 2: Collect per-repo reports
  - Run git log for each repo with the same time range
  - Classify commits per repo
  - Read diffs for significant commits in each repo

Phase 3: Merge and deduplicate
  - Combine all commits into a unified timeline
  - Identify cross-repo themes (e.g., "auth system changes" spanning 3 repos)
  - Group by theme/type rather than by repo (repo-based grouping is secondary)
  - Deduplicate merge commits and automated commits

Phase 4: Structure the worklog
  - Title: time range (e.g., "Work Log: May 12-18, 2026")
  - Executive summary (2-4 sentences, what-ai-writer compliant)
  - Themed sections:
    - Features shipped (across repos)
    - Bugs fixed
    - Infrastructure / DevOps
    - Refactoring
    - Documentation
  - Per-repo breakdown (compact subsections)
  - Cross-repo initiatives highlighted
  - Total stats across all repos

## Writing Directives (not-ai-writer)
- Same banned vocabulary as repo-work-report
- Prioritize themes over repo-by-repo lists
- Use natural language for cross-repo narratives
- E.g., "The auth overhaul touched three repos: the API got new middleware, the frontend got a login rewrite, and the shared lib got token refresh logic."
- Not: "In repo A, auth middleware was added. Furthermore, in repo B..."

## Output Format
Markdown with:
  - H1: time range
  - H2: themed sections
  - Repo names as bold inline markers
  - Commit references as `repo:abc1234`
  - Stats table at bottom: repo | commits | additions | deletions
```

---

### 3.3 changelog

**Description (frontmatter):**
```
Generates a changelog from git repository data using commit classification and conventional commit parsing. Use when the user asks for a changelog, release notes, version history, or "what changed" document. Embeds not-ai-writer directives for natural, scannable output.
```

**SKILL.md outline:**

```
# changelog

## Quick Start
- User says "generate a changelog for the last month" or "create release notes for v2.0"
- Agent gathers commits, classifies them, and structures a changelog

## Changelog Generation Workflow
Phase 1: Gather commits
  - git log --since=<start> --until=<end> with full metadata
  - Parse conventional commit prefixes (feat!, fix!, etc.)
  - If user provides a version tag range, use git log v1.0..v2.0
  - Include --all if user wants all branches

Phase 2: Classify and filter
  - Use git-snitch commit classification (feat/fix/docs/refactor/etc.)
  - Filter out: merge commits, chore commits (unless notable), style-only changes
  - Identify breaking changes (feat!, fix!, BREAKING CHANGE in body)
  - Group by semantic type

Phase 3: Structure the changelog
  - Version header (from tag or user-provided version)
  - Date of release or range
  - Breaking Changes section (if any) - always first
  - Features section
  - Bug Fixes section
  - Other sections as needed: Refactoring, Documentation, Performance, CI/Build
  - Each entry: one-line description with PR/commit reference
  - Internal entries grouped; user-facing entries prominent

Phase 4: Format output
  - Follow Keep a Changelog format (keepachangelog.com)
  - OR SemVer-based if user specifies a version
  - Commit references as short links

## Writing Directives (not-ai-writer)
- Changelogs are technical documents - some formality is acceptable
- Still ban: tapestry, symphony, comprehensive, holistic, realm, orchestrate
- Each entry should be a clear, specific description of the change
- Start entries with imperative verbs: "Add", "Fix", "Remove", "Change", "Update"
- No filler sentences between entries
- No "We are excited to announce" or "This release brings"

## Output Format
Markdown following Keep a Changelog:
  - H2: [version] - YYYY-MM-DD
  - H3: Added / Changed / Fixed / Removed / Deprecated / Security
  - Bullet entries, each starting with imperative verb
  - Commit hash references in parentheses
```

---

### 3.4 devlog

**Description (frontmatter):**
```
Crafts a natural, human-sounding devlog article from repository work data and example articles. Expects 1-4 example articles for voice matching, plus repo-work-report or worklog output as source material. Applies the strictest not-ai-writer directives. Use when the user wants a blog post, devlog entry, or article about their development work.
```

**SKILL.md outline:**

```
# devlog

## Quick Start
- User provides 1-4 example articles (their previous writing) + work report data
- Agent analyzes voice from examples, then crafts a devlog article

## Article Crafting Workflow

Phase 1: Analyze example articles
  - Read each example article completely
  - Extract voice markers:
    - Sentence length patterns and rhythm
    - Paragraph structure and length
    - Use of personal pronouns (I, we, you)
    - Humor style and frequency
    - Technical depth level
    - Opinion strength and directness
    - Formatting patterns (headers, code blocks, lists, images)
    - Opening and closing patterns
  - Build a voice profile: list of specific patterns to replicate

Phase 2: Map work data to article structure
  - Review the work report or worklog data
  - Identify the narrative arc:
    - What problem was being solved?
    - What was tried? What failed? What worked?
    - What was learned?
  - Select 3-7 key moments/commits to feature
  - Find the human story behind the commits

Phase 3: Draft the article
  - Match the voice profile from Phase 1 exactly
  - Structure:
    - Hook opening (specific, personal, NOT generic)
    - Context section (why this work happened)
    - Body: narrative walkthrough of key changes
    - Technical details woven into story (code snippets, file paths)
    - Reflection/learning section
    - Closing that matches example pattern
  - Length: match example articles (if examples average 800 words, target 700-1000)

Phase 4: not-ai-writer hardening
  - Run through the full not-ai-writer checklist (see REFERENCES.md)
  - Vocabulary sweep: replace ALL banned words
  - Structure check: burstiness verification
  - Voice audit: personality injection verification
  - Format review: break any AI-predictable patterns
  - Final pass: read aloud mentally - does it sound like the same person who wrote the examples?

## Writing Directives (STRICTEST not-ai-writer)
- ALL rules from repo-work-report apply, plus:
- Must match the voice profile extracted from example articles
- Zero tolerance for AI vocabulary markers
- Every paragraph must have at least one voice element (opinion, anecdote, specific detail)
- No section may follow the same structural pattern as the previous section
- Opening must NOT start with "This week" or "In this post"
- Code examples must be contextualized with personal commentary, not just dropped in
- See REFERENCES.md for complete vocabulary blacklist and structure rules
```

**REFERENCES.md outline:**

```
# Devlog Reference: not-ai-writer Strict Mode

## Complete Banned Vocabulary (200+ words)

### Tier 1 - Instant AI Detection
delve, tapestry, symphony, comprehensive, holistic, intricate, realm, underscore,
meticulous, impressively, moreover, furthermore, consequently, therefore,
leverage, orchestrate, foster, unlock, unleash, harness, elevate, bolster,
burgeon, captivate, catalyze, compel, demystify, elucidate, navigate, landscape,
empower, seamless, robust, cutting-edge, innovative, transformative, game-changer,
revolutionary, state-of-the-art, next-generation, groundbreaking

### Tier 2 - Strong AI Indicators
significant, important, effective, essential, valuable, crucial, noteworthy,
notably, remarkably, it's important to note, it's worth noting, in today's,
in the modern, at the end of the day, all in all, various, numerous, multiple,
facilitate, implement, utilize, optimize, streamline, enhance, ensure,
encompass, integral, vital, paramount, profound, substantial, extensive

### Tier 3 - Subtle AI Patterns
embark, journey, exploration, deep dive, wealth of, plethora, myriad,
invaluable, indispensable, cornerstone, linchpin, beacon, testament,
beacon, hallmark, quintessential, paradigm, archetype, epitome

## Structure Rules (Burstiness Enforcement)

### Sentence Length Targets
- Mix: 3-word, 8-word, 20-word, 5-word, 35-word sentences
- No more than 2 consecutive sentences within 2 words of each other's length
- At least 1 fragment per paragraph (like this one)

### Paragraph Rules
- No two consecutive paragraphs with same number of sentences
- Vary between 1-sentence punch paragraphs and 5-7 sentence narrative paragraphs
- Opening paragraphs: short (1-3 sentences)
- Technical paragraphs: can be longer but must have personal interjection

### Section Opening Patterns
Rotating list - never repeat the same pattern:
1. Question
2. Direct statement
3. Personal anecdote
4. Code snippet with commentary
5. Bold claim
6. Specific number or data point

## Voice Matching Checklist
- [ ] Pronoun usage matches examples (I vs we vs you)
- [ ] Humor style matches (dry, self-deprecating, enthusiastic, sarcastic)
- [ ] Technical detail level matches (code-heavy, conceptual, high-level)
- [ ] Opinion frequency matches (every paragraph, occasional, rare)
- [ ] Paragraph length distribution matches examples
- [ ] Sentence complexity matches examples
- [ ] Opening and closing patterns match examples
- [ ] Formatting conventions match (headers, lists, code blocks, links)

## Opening Line Patterns to AVOID
- "This week I..."
- "In this post..."
- "Recently I..."
- "I've been working on..."
- "It's been a while since..."
- Any variation of "I wanted to share..."

## Good Opening Line Patterns
- Specific technical observation: "The memory leak was hiding in the closure."
- Emotional reaction: "Three hours. Three hours to find a missing semicolon."
- Scene-setting: "Friday afternoon, the deploy button, and a test suite that suddenly went red."
- Direct claim: "Trie indexes cut our query time by 90%."
- Question: "Ever deployed on a Friday and immediately regretted it?"
```

---

## 4. Every File to Create with Full Paths

```
/home/didi/workspace/Code/git-report/git-snitch/.opencode/skills/repo-work-report/SKILL.md
/home/didi/workspace/Code/git-report/git-snitch/.opencode/skills/worklog/SKILL.md
/home/didi/workspace/Code/git-report/git-snitch/.opencode/skills/changelog/SKILL.md
/home/didi/workspace/Code/git-report/git-snitch/.opencode/skills/devlog/SKILL.md
/home/didi/workspace/Code/git-report/git-snitch/.opencode/skills/devlog/REFERENCES.md
```

**Total: 5 files across 4 skill directories.**

---

## 5. Implementation Phases

### Phase 1: Create directory structure
Create the `.opencode/skills/` directory and all four skill directories:
```
.opencode/skills/repo-work-report/
.opencode/skills/worklog/
.opencode/skills/changelog/
.opencode/skills/devlog/
```

### Phase 2: Implement repo-work-report skill
Write `repo-work-report/SKILL.md` with:
- Frontmatter description with trigger words
- Quick start section with concrete example
- Four-phase data gathering workflow (collect, classify, read diffs, structure)
- Git command reference (exact commands the agent should run)
- not-ai-writer directives (embedded vocabulary bans and structure rules)
- Output format specification (markdown structure)

This is the foundational skill. Both `worklog` and `devlog` depend on it for source data.

### Phase 3: Implement worklog skill
Write `worklog/SKILL.md` with:
- Frontmatter description with trigger words
- Quick start section
- Multi-repo gathering workflow (discover repos, collect per-repo, merge, structure)
- Theme-based aggregation rules
- Cross-repo narrative writing directives
- Output format with per-repo breakdown table

### Phase 4: Implement changelog skill
Write `changelog/SKILL.md` with:
- Frontmatter description with trigger words
- Quick start section
- Changelog generation workflow (gather, classify/filter, structure, format)
- Keep a Changelog format reference
- Commit classification mapping (conventional commit to changelog section)
- Imperative verb entry style
- Output format specification

### Phase 5: Implement devlog skill
Write both `devlog/SKILL.md` and `devlog/REFERENCES.md`:
- SKILL.md stays under 100 lines with:
  - Frontmatter with trigger words
  - Quick start
  - Four-phase article crafting workflow
  - Strictest not-ai-writer directives summary
  - Link to REFERENCES.md
- REFERENCES.md contains:
  - Complete 3-tier banned vocabulary list (200+ words)
  - Burstiness enforcement rules
  - Voice matching checklist
  - Opening line patterns to avoid and to use

### Phase 6: Validate
- Each SKILL.md must be under 100 lines (except REFERENCES.md which is a reference file)
- Each frontmatter description must be under 1024 chars
- Each description must include "Use when..." trigger phrase
- Verify no time-sensitive information
- Verify consistent terminology across all four skills
- Verify all file paths reference `@git-snitch/core` types correctly where mentioned

---

## Key Design Decisions

1. **Skills are project-local** at `.opencode/skills/` inside the git-snitch repo, not in global paths. They ship with the repo.

2. **No utility scripts** - these are instruction-only skills. The agent runs git commands directly, uses the `@git-snitch/core` package types for understanding data shapes, and produces markdown output. No deterministic operations need saved scripts.

3. **not-ai-writer directives are tiered**:
   - `repo-work-report` and `worklog` and `changelog`: embedded inline (lighter touch, these are technical documents)
   - `devlog`: strictest enforcement with full REFERENCES.md (this is creative writing for public consumption)

4. **Skills reference `@git-snitch/core` types** (CommitRecord, CommitClassification, ContributorSummary, etc.) for the agent to understand the data structures it's working with, but do NOT import or execute code. The agent runs git CLI commands and optionally the `git-snitch` CLI itself.

5. **devlog has a REFERENCES.md** because the combined not-ai-writer vocabulary blacklist (200+ words), structure rules, and voice matching framework would push SKILL.md well over 100 lines. All other skills fit in a single SKILL.md.
