---
name: submission-check
description: Audit the project against LILA's submission checklist before sending the GitHub link. It covers the live deployment, every core feature, ARCHITECTURE.md, INSIGHTS.md and the README. Use when the user asks whether the project is ready to submit, or near the deadline.
disable-model-invocation: true
---

# Submission check

Check each item for real. Open things and run things. Report a table: item, status (PASS/FAIL/PARTIAL), and evidence.

## 1. Deployment
- [ ] The deployed Netlify URL loads in a fresh browser tab (use Chrome tools). There are no console errors.
- [ ] It works without local setup and without any explanation from us. The default view shows something useful.

## 2. Core features (test each in the live app)
- [ ] Player paths render on the **correct** minimap and are aligned (compare with `/verify-coords` output).
- [ ] Humans and bots are visually distinct, and there is a legend.
- [ ] Kill, death, loot and storm-death markers are distinct and explained in the legend.
- [ ] Filtering by map, date and match works, including empty states.
- [ ] Timeline playback has play/pause/scrub and shows the match progressing.
- [ ] Heatmaps exist for kill zones, death zones and traffic, and can be toggled.

## 3. Repo deliverables
- [ ] `README.md` covers the tech stack, setup steps, env vars (or "none"), the deployed URL and how to rerun the pipeline.
- [ ] `ARCHITECTURE.md` is **one page**. It covers the stack and why, the data flow from parquet to screen, a step-by-step **coordinate mapping** walkthrough, the assumptions, and a tradeoffs table.
- [ ] `INSIGHTS.md` has **3** insights. Each one has what caught the eye, concrete evidence (a stat or pattern), actionable items with the affected metrics, and why a Level Designer should care.
- [ ] Insights were found **using the tool**. Screenshots help.
- [ ] Clean git history. No secrets and no raw zip committed. `git status` is clean.
- [ ] Code quality: typecheck, lint and build pass (`pnpm -C web build`). No dead code or debug logs.

## 4. Spec re-read
Re-read `docs/ASSIGNMENT.md` end to end and flag anything still missed.
