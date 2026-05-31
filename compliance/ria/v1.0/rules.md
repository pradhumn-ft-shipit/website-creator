# RIA Compliance Ruleset — v1.0 (DRAFT)

**Status:** draft · **Industry:** RIA (SEC- and state-registered investment advisers) · **Not yet approved.**

> ⚠️ PLACEHOLDER. This ruleset must be authored from PRD §5 (compliance framework) and the active
> RIA regulatory sources, with citations, then pass two-person review (PRD §5.7) before it is used
> in generation. The machine-readable counterpart is `rules.json`.

## How this ruleset is used (three-layer engine)

1. **Layer 1 — prevention:** the active ruleset is injected into Gemini's system prompt so generation
   operates within constraints.
2. **Layer 2 — validation:** a separate Gemini Flash pass scans output for prohibited terms and
   required disclosures (`prohibited_terms` + `required_disclosures` in `rules.json`).
3. **Layer 3 — manual gate:** WRI team review for the first 50 sites and any Layer-2-flagged site.

Every generated piece records the ruleset version it was built against.

## Prohibited terms

_(to be authored — each with citation)_

## Required disclosures

_(to be authored — each with citation and placement: footer / page / form)_

## Conditional rules

_(to be authored — context-dependent rules, e.g. SEC vs. state registration)_

## Citations

_(source list — regulatory references for every rule above)_
