# Two-week NFL demonstration checkpoint

Author: Angelis Pseftis

## Scope and authoritative records

October 10–23, 2026, America/New_York. The frozen scope is `data/nfl_demo_window_scope.json`: 29 games, including two in London. The requirement and evidence register is `data/acceptance/nfl_window.json`. This checkpoint is updated in place.

## Current implementation

`site/window-demo.html` is the scoped demonstration workspace. It combines selectable games, separate public-source report access, synthetic feed injection, editable exercise monitoring circles, synthetic video and camera failure states, evidence-bound simulated review, cross-game schedule/duplicate-template relationships, and exportable brief history. Public evidence is not inserted into the synthetic evidence stream.

`site/window_model_snapshots.json` contains 29 actual local Qwen3.5 9B inference results. The model ranks supplied fictional verification candidates. It does not generate threat findings. Packet hashes and exact input matching bind the recorded results to the completed replay. The browser makes no model request. Changes to replay evidence or freshness invalidate applicability. Spatial edits and human decisions are explicitly excluded from model inputs.

Regenerate changed model inputs locally with `node scripts/build_window_model_snapshots.mjs`; matching recorded inputs are reused. The local Ollama-compatible service must already be running on 127.0.0.1:11434. Failed calls are recorded without manufactured results. No inference service is exposed publicly.

## Latest evidence

The schedule builder now retains originally scoped games moved outside the window and surfaces publisher-status exceptions, missing frozen IDs, entrants and kickoff changes. Equivalent timestamp formatting does not create a false change. The latest source fetch matched the frozen scope and preserved applicability of all 29 recorded model runs.

- 215 targeted local tests passed: `node --test test/window*.test.mjs`. Mocked model error tests are separate from actual model execution evidence.
- All 29 actual model results completed, with no failures; packet hashes and current input bindings verified.
- Local browser smoke test: all 29 games reached 35/35 deliveries and enabled synthetic camera playback. This does not prove playback for every game.
- Representative browser checks covered actual advancing synthetic video, camera outage/recovery, area editing, review invalidation, model applicability, cross-game duplicate claims, and a downloaded three-snapshot history archive.
- Responsive check: observed 391-pixel content width, 383-pixel document width; populated game had no horizontal page overflow. Keyboard area editing and stale-model hiding passed.
- Earlier map and camera deployments succeeded. This checkpoint's model/relationship/history changes still need deployed verification after publication.

## Remaining acceptance work

- Verify the latest deployment and inspect every scoped game's complete workflow against the acceptance matrix, including exports, review transitions and failure states.
- Improve demo navigation and presentation; assess whether shared templates provide sufficient scenario diversity for the requested demonstration.
- Current schedule was refreshed and matches all 29 frozen games. Cancellation, postponement, missing-record and moved-outside-window handling now have six passing mutation tests. Verify the new status presentation after deployment; future publisher changes still require reconciliation.
- Finish per-game real-versus-synthetic source coverage and public participant-role coverage without conflating announcements with attendance.
- Demonstrate model behavior for changed or emerging inputs, with actual local execution or clearly labeled backend simulation. The current browser only presents matching recorded full-replay runs.
- Complete mobile and keyboard checks beyond the representative game, citation/provenance checks and final requirement-by-requirement audit.

Other uncommitted changes to the main application and local analysis backend predate this increment and have been preserved. Their presence is not evidence of verified or deployed functionality. The goal remains active and incomplete.
