---
name: devlog
description: Crafts a natural, human-sounding devlog article from repository work data and example articles. Expects 1-4 example articles for voice matching, plus repo-work-report or worklog output as source material. Applies the strictest not-ai-writer directives. Use when the user wants a blog post, devlog entry, or article about their development work.
---

# Devlog Article Skill

## Quick start

User provides:
1. **1-4 example articles** — real articles matching their desired voice
2. **Work report data** — output from repo-work-report, git log, or worklog

Output: one article matching voice, length, and style of examples, built from work data.

## Article Crafting Workflow

### Phase 1: Analyze Example Articles

Extract voice markers from every example:
- Sentence length and rhythm (short punchy? long flowing? mixed?)
- Paragraph structure (1-liners? blocks? dialogue?)
- Pronoun use (first person? we? second person?)
- Humor style (dry? sarcastic? self-deprecating? absent?)
- Technical depth (code snippets? abstract? tutorial-style?)
- Opinion strength (hedged? direct? controversial?)
- Formatting patterns (headers? bullets? asides? footnotes?)
- Opening and closing patterns

Build a voice profile. Quantify: average sentence length, paragraph sentence count, sentences per section.

### Phase 2: Map Work Data to Article

- Identify the narrative arc: what problem, what was tried, what failed, what worked, what was learned
- Select 3-7 key moments or commits worth discussing
- Find the human story behind the commits (frustration, surprise, "duh" moments)
- Rank moments by story value, not by commit order

### Phase 3: Draft

Match the voice profile exactly. Structure:
1. **Hook opening** — matches example opening pattern, never a meta-intro
2. **Context section** — sets up the problem in 1-3 paragraphs
3. **Narrative body** — key moments told as story, not changelog
4. **Technical details woven in** — code with personal commentary, not documentation
5. **Reflection** — what changed in thinking, what surprised
6. **Closing** — matches example closing pattern

Target length = average of examples. If examples vary widely, match the closest one to the work data scope.

### Phase 4: not-ai-writer Hardening

Run the full checklist from [REFERENCES.md](REFERENCES.md):
- Vocabulary sweep against all 3 banned tiers
- Burstiness verification (sentence length variation)
- Voice audit against profile from Phase 1
- Opening line pattern check (no forbidden openings)
- Read-aloud test: does every paragraph sound like the example author?

## Writing Directives (STRICTEST)

All rules from repo-work-report apply. These are ADDITIONAL and NON-NEGOTIABLE:

- **Match voice profile** — every paragraph must contain at least one voice element from the profile
- **Zero tolerance for AI vocabulary** — every word on the banned list triggers rewrite
- **No consecutive same-structure sections** — if one section is prose, next is list or dialogue or code+commentary
- **Opening must NOT start with** "This week" / "In this post" / "Recently I" / "I've been working on" / "I wanted to share"
- **Code examples are contextualized** — never drop code without personal commentary around it
- **Every technical claim has a human reaction** — frustration, surprise, relief, confusion
- **No hedging in opinions** — if the author has an opinion, state it directly, don't soften it
- **Paragraph length must vary** — no two consecutive paragraphs within 2 sentences of each other
- **At least 1 fragment per paragraph** — a deliberate sentence fragment that mirrors natural speech

## Output format

Article structure follows this order:

1. **Hook** — opening that matches example pattern, never meta-intro
2. **Context** — 1–3 paragraphs setting up the problem
3. **Narrative body** — key moments told as story, not changelog
4. **Technical details** — code with personal commentary woven in
5. **Reflection** — what changed in thinking, what surprised
6. **Closing** — matches example closing pattern

Target length = average of provided examples. Voice must match the profile extracted in Phase 1.

## Reference

See [REFERENCES.md](REFERENCES.md) for the complete banned vocabulary (200+ words across 3 tiers), burstiness structure rules, voice matching checklist, and opening line patterns.
