# Two-week NFL demonstration checkpoint

Author: Angelis Pseftis

## Scope and authoritative records

October 10–23, 2026, America/New_York. The frozen scope is `data/nfl_demo_window_scope.json`: 29 games, including two in London. The requirement and evidence register is `data/acceptance/nfl_window.json`. This checkpoint is updated in place.

## Current implementation

`site/window-demo.html` is the scoped demonstration workspace. It combines selectable games, separate public-source report access, synthetic feed injection, editable exercise monitoring circles, synthetic video and camera failure states, evidence-bound simulated review, cross-game schedule/duplicate-template relationships, and exportable brief history. Public evidence is not inserted into the synthetic evidence stream.

`site/window_model_snapshots.json` contains 29 actual local Qwen3.5 9B inference results. The model ranks supplied fictional verification candidates. It does not generate threat findings. Packet hashes and exact input matching bind the recorded results to the completed replay. The browser makes no model request. Changes to replay evidence or freshness invalidate applicability. Spatial edits and human decisions are explicitly excluded from model inputs.

Regenerate changed model inputs locally with `node scripts/build_window_model_snapshots.mjs`; matching recorded inputs are reused. The local Ollama-compatible service must already be running on 127.0.0.1:11434. Failed calls are recorded without manufactured results. No inference service is exposed publicly.

## Latest evidence

Guided scenario stages now expose baseline, emerging observations, duplicate/contrary evidence, corrections, camera outage, recovery and staleness. A labeled simulated analysis service updates verification work with source references and is exported independently of the recorded-model result. No live inference claim is made.

The schedule builder now retains originally scoped games moved outside the window and surfaces publisher-status exceptions, missing frozen IDs, entrants and kickoff changes. Equivalent timestamp formatting does not create a false change. The latest source fetch matched the frozen scope and preserved applicability of all 29 recorded model runs.

- 277 targeted local tests passed: `node --test test/window*.test.mjs`. Mocked model error tests are separate from actual model execution evidence.
- All 29 actual model results completed, with no failures; packet hashes and current input bindings verified.
- Local browser smoke test: all 29 games reached 35/35 deliveries and enabled synthetic camera playback. This does not prove playback for every game.
- Representative browser checks covered actual advancing synthetic video, camera outage/recovery, area editing, review invalidation, model applicability, cross-game duplicate claims, and a downloaded three-snapshot history archive.
- Responsive check: observed 391-pixel content width, 383-pixel document width; populated game had no horizontal page overflow. Keyboard area editing and stale-model hiding passed.
- Deployed application revision `39bc3d5ff217253831e93fe87bc293cdfdde9031` passed GitHub Actions run `38075710165`. All 17 scoped application assets returned HTTP 200 and exactly matched committed bytes. The refreshed schedule matched all 29 frozen games.

## Final acceptance

Demonstration acceptance passed on October 10, 2026. The per-game, per-dataset and 11-requirement matrix is `data/acceptance/nfl_window.json`; deployed byte hashes, browser boundaries and downloaded-file hashes are in `data/acceptance/nfl_deployment_evidence.json`.

- All 29 deployed game workflows passed review invalidation, camera outage/recovery, recorded-model applicability and stale-source checks on revision `85f6431`. Those workflow modules are unchanged in the final release.
- All 29 games passed the final release's infrastructure checks: absent before injection, five layers after injection, all five intersecting the expanded exercise area, with the correct recorded model result.
- A deployed synthetic video advanced at 800 by 450 pixels and stopped on injected outage. This verifies the procedural demonstration, not real stadium CCTV.
- All 29 local downloaded briefs passed citation, label, model and edited-area checks. The final deployed brief and history downloads also passed, including all five infrastructure geometries and their evidence references.
- All 203 local game/stage combinations, all 29 mobile and keyboard checks, and all 29 public-role panels passed. These are local browser evidence; matching deployed assets are recorded separately.
- Public-role coverage includes 31 snapshot announcements across nine games. Missing coverage, international source limits, public-camera availability and directory-only sources remain explicit. Announcements do not establish attendance.
- Push-triggered and hourly GitHub Actions refresh/deployment are configured. Future upstream changes and source outages remain possible; freshness, unavailable states and schedule reconciliation expose them.

The demo is available at https://redxking.github.io/event-atlas-nfl-demo/window-demo.html. Browser cache bypass was required to inspect the newly published module during rollout; final verification matched the release.

## Completion boundary

The fixed-window demonstration is complete. Restricted feeds, investigative people, sensitive infrastructure and venue-camera examples are fictional. Monitoring circles are editable exercise areas based on unreviewed venue coordinate candidates. Recorded Qwen runs are actual local inference; changing-input analysis is explicitly simulated. GitHub Pages does not provide online inference, authenticated analyst accounts or an operational audit backend. Session history must be exported before leaving the page. Demonstration acceptance does not establish operational law-enforcement readiness.

Other uncommitted changes to the main application and local analysis backend predate this increment and have been preserved. They are excluded from this acceptance claim. This final checkpoint and evidence-only commit do not change the verified application release.
