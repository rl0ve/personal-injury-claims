# PersonalInjuryClaims solution — handoff

Covers the thread from "I don't think you updated the action app within the solution, did you?"
through to the point Robert noticed he was in the wrong thread. Written 17 Sep 2026.

Read this before touching the solution. Cloud and local have diverged and neither is a superset of
the other, so a naive pack or upload loses work in one direction or the other.

## 1. Where everything lives

| Asset | Path / URL |
|---|---|
| Solution root (local) | `/Users/robert.love/Unsynced/PersonalInjuryClaims/PersonalInjuryClaims` |
| Solution id | `dbf7785c-845a-40a9-006f-08df14ddbfdf` |
| Cloud download (working base) | `out/dbf7785c-845a-40a9-006f-08df14ddbfdf/` — disposable, re-downloadable |
| Local case plan | `PersonalInjuryClaims/caseplan.json` + `caseplan.json.bpmn` (both 17 Sep 21:03) |
| Cloud case plan | `out/…/PersonalInjuryClaims/caseplan.case` + `caseplan.case.bpmn` |
| Action app (coded action app) | `Case App - Injury Claims Console/` — standalone, not a solution project |
| Coded case app | `Case App - Injury Claims Workspace/` — standalone, not a solution project |
| Action app resource in solution | `out/…/resources/solution_folder/app/codedAction/injury-claims-console.json` |
| Action app package resource | `out/…/resources/solution_folder/package/injury-claims-console.json` |
| Action Center lineage task | https://cloud.uipath.com/businessorchestration/DefaultTenant/actions_/tasks/12857418 |
| Backups of the three edited gateways | `<scratchpad>/wfbak/` |
| Backup of the 16-project `.uipx` | `<scratchpad>/PersonalInjuryClaims.uipx.bak` |
| CLI reference for this solution | `CLAUDE.md` / `AGENTS.md` at the solution root |

Scratchpad for this session was
`/private/tmp/claude-502/-Users-robert-love-Unsynced-FUSION-2026/a4322031-656f-4c34-bbd9-7f7a2a923447/scratchpad`.
Re-create the backups from the cloud download if that has been cleared.

## 2. Standing verdicts and precedence rules

**Do not overwrite Tyler Toth's case plan or case manager agent work.** Robert, 17 Sep: *"I don't
want to overwrite what he did with the case plan or the case manager agent"*. Later the same day he
cleared it: *"Tyler closed out the file I think...so you can make edits on top of his"*. The
protection has lapsed but the caution has not — the case plan is shared.

**Cloud is ground truth for the case plan.** The Case ID prefix and the sticky note were made in
Studio Web and exist only there. `metadata.caseIdentifier` is `INJ`, `caseIdentifierType` is
`constant`, and there is a `case-management:StickyNote` node `StickyNote_bYX1ty` with content
`**EXCEPTION STAGES**`, 2640x400, parented to root.

**Local is ground truth for the three API gateway waits and for the Flow project.** Neither exists
in the cloud copy.

**The Flow replaces the BPMN, not the other way round.** Robert, 17 Sep: *"rewire the case plan to
use the Flow...confirm the Flow works independently first before you'll publish an update to the
case plan"*. Studio Web had converted `Flow-Threshold-Injury-Assessment` (type `Flow`) into
`BPMN-Threshold-Injury-Assessment` (type `ProcessOrchestration`) and moved the call from Liability
Assessment to Medical Evidence & Quantum Decision, where it now runs as a `process` task. The cloud
plan has zero `flow-process` tasks.

**Publishing and deploying need an explicit per-release go.** Robert authorised exactly one cloud
write in this thread: *"no...you do it"* for the action app publish. Nothing else was pushed.

**Visible labels must read as real steps.** Robert, 17 Sep: *"I just don't want a lot of stuff to
say 'Wait' that's visible to the user if it's not really logical"*.

## 3. Decisions applied

### Case ID prefix — 17 Sep, Robert in Studio Web

Prefix was `PC` (a leftover from the property claims scenario; `PC-` appears nowhere in the
solution). Recommended `CLAIM` to match the apps, which display `CLAIM-5182`, `CLAIM-5170`,
`CLAIM-5164`, and the case plan `runId` default of `5182`. Robert: *"I have other things that are
claim...should I be more specific...or too long? like INJURY CLAIM?"* Settled on `INJ` —
`INJURY CLAIM` was rejected for the space and for a prefix longer than the number it qualifies.
Applied by Robert in Studio Web; present in the cloud plan only.

### Three stage waits — 17 Sep, applied by Claude

Robert: *"the issue is in Instance Management I couldn't see these 3 operating at the same time
because they executed too fast"*, and *"add the waits"*, at 15 seconds (10 judged too tight once UI
refresh is added).

A front-end delay in the action app was ruled out: the stages fire *after* the task completes, so
the delay has to be server-side in what Instance Management actually spends time in. Hand-editing
the case plan was also ruled out — one `wait-for-timer` task expands to 46 generated elements in
`caseplan.json.bpmn` (task subprocess, cancel boundary event, three global-update service tasks,
nine sequence flows, plus diagram geometry) and wires into two inclusive gateways. That is compiler
output.

Delay went into the API workflow each stage's task calls instead. Every call site passes a unique
`requestSource`, so the two shared gateways are gated rather than slowed wholesale.

| Stage | Workflow | Call sites | Gate | Visible label |
|---|---|---|---|---|
| Liability Assessment & Admission | API - Injury Severity Data Gateway | 1 | none needed | Await severity data provider response |
| Rehabilitation & Return-to-Work | API - Injury Provider Network Gateway | 5 | `requestSource === 'AuthoriseTreatmentPlan'` | Await provider network confirmation |
| Condition Deterioration & Re-assessment | API - Injury Claims Gateway | 12 | `requestSource === 'UpdateSupplementalReserve'` | Await reserve posting confirmation |

`If` branch labels are "Treatment plan authorisation route" and "Supplemental reserve route" — they
read as routing, not padding. First labels written were "Demo pacing wait" and "Pace this call for
the demo"; both were replaced after Robert's note in section 2.

Applied in **both** trees. All three validate `Success` via `uip api-workflow validate`. The three
gate values were confirmed present in the *cloud* case plan, so the waits fire on the right stages
there too.

Shape used, per `.agents/skills/uipath-api-workflow/references/task-types.md`:
`{"wait": {"minutes": 0, "seconds": 15, "milliseconds": 0}}` with
`metadata.activityType: "Wait"`, inserted immediately before `Javascript_1` in `Sequence_1`.

Caveat recorded at the time: Condition Deterioration's *first* task is a human `action`, and the
gated API call is its second. That stage becomes visible when the action appears, not when the wait
runs. If it still flashes past, the cause is the action auto-completing in that scenario.

### Action app published — 17 Sep, authorised by Robert

`injury-claims-console` was **absent from Orchestrator entirely** — all 50 packages listed, no match
at any version — while both case plans bind the action task to `Shared.injury-claims-console`. The
solution resource pinned `1.0.3`, a version that exists neither in Orchestrator nor in the local
`pkg/` (which holds 1.0.4 through 1.0.8).

Built fresh (`npm run build`, confirmed zero occurrences of `Rule Results`, `Notable`,
`Risk Factors` in the output), then:

```
uip codedapp pack dist -n injury-claims-console -v 1.0.9 --output-dir pkg
uip codedapp publish -n injury-claims-console -v 1.0.9 -t Action --uipath-dir pkg
```

Result: published and registered as an Action app, **System Name `IDdd29f4a17efb46729db4ec3985883882`,
Deploy Version 2**. This is a **new registration**, not a new version of the existing
`ID902897f7337e4602aab81a724f58a759`. See section 4 — this is the main open decision.

### Reversal — Case Apps added to the solution, then removed

Robert: *"I thought you can action apps"*. Correct: `AppV2` is a valid solution project type. Both
Case App folders were given a `project.uiproj` and registered, taking the manifest to 18 projects.
`uip solution pack --dry-run` then failed on both with
*"WebApp manifest not found: webAppManifest.json"*.

Reverted, and the reason is structural rather than a missing file. Per
`.agents/skills/uipath-coded-apps/SKILL.md`, an in-solution coded app nests build artefacts under
`source/dist/` and deploys through the solution, and you must **not** run
`uip codedapp pack/publish/deploy` on it afterwards. Both apps are standalone today, built to
`dist/`, published through exactly that flow, with version histories in `pkg/` to prove it.
Converting means restructuring both and abandoning their deploy path.

Manifest restored to 16 projects from backup; both `project.uiproj` files deleted;
`uip solution pack --dry-run` back to `Success` with zero failures.

### Reversal — `resources edit --source remote --force`

Run against the app resource key `fe3ee4d9-be5d-4223-a0cb-684a97ef100f` to pick up 1.0.9. It
reported five differing properties (`actionSchema`, `appSystemName`, `name`, `package`, `version`),
and `--force` **renamed the resource file to `property-claims-console.json`** and applied a property
insurance action schema (`riskAddress`, `perilCode`, `floodCoverInForce`, `vacancyDays`,
`averageAppliedFlag`, reinstatement/indemnity settlement basis), still at version 1.0.3.

That tree was discarded and re-downloaded. **Do not re-run this command on that resource.**

**Correction on the record.** On that evidence Claude claimed the injury app was a renamed clone of
the property claims app. Robert pushed back — *"I don't think this statement is correct...because my
coded action app follows this lineage"* (the task URL in section 1) — and he was right. The
solution's own resource carries a genuine injury schema: `claimantName`, `incidentLocation`,
`injuryTypeCode`, `liabilityBasisCode`, `contributoryNegligenceFlag`, `notificationDelayDays`,
schema version 4, last modified 16 Sep. The property schema came from the remote lookup resolving to
the wrong app, almost certainly matching on `externalClientId ce33064e-0fdf-4e81-8269-09e0374941fa`,
which both apps share from the original scaffold clone. The lineage is sound; only the lookup was
wrong.

### Flow added to the solution — 17 Sep

Robert: *"the Flow should be part of the solution"*. `Flow-Threshold-Injury-Assessment` copied from
local into the cloud tree and registered with `uip solution projects add`. Manifest now 18 projects
and it packs `Success` as type `Flow`.

Not yet done: removing `BPMN-Threshold-Injury-Assessment`, and rewiring the case plan's `process`
task back to a `flow-process` task. Both were gated on confirming the Flow independently.

## 4. Deferred / partially actioned

**Repointing the action app resource at 1.0.9.** The blocker is that the publish created a new
registration. Two routes, and Robert had not chosen:

- Repoint the resource at `IDdd29f4a1…` 1.0.9. Simple, but moves the case plan to a different app
  registration and orphans the Action Center lineage from task 12857418.
- Publish into the existing `ID902897…` registration and bump the resource to that version.
  Preserves lineage; needs the right publish invocation to target an existing app rather than
  register a new one.

Either way, `resources edit --patch` rather than `--source remote`, and both the
`app/codedAction/` and `package/` resource files move together — the app resource's
`spec.package.key` must match the package resource's `key`.

**Confirming the Flow works independently.** `uip maestro flow check` and
`uip maestro case decompile` both fail with *"@uipath/maestro-builder-sdk is not installed in this
workspace"*. `PersonalInjuryClaims.Flow.Flow-Threshold-Injury-Assessment` **is** already published
in Orchestrator, so it exists as a runnable package, and it packs clean. A live run was not done.

**Rewiring the case plan to the Flow.** Gated on the above. Note the case plan is authored in Studio
Web and `caseplan.case.bpmn` is the runtime artifact — `entry-points.json` points at
`/content/caseplan.case.bpmn#trigger_Start1`, not at the JSON. Editing the JSON alone changes the
designer model and not what executes.

**The Workspace coded case app.** Left standalone. Robert distinguished them: *"the coded case app is
different from the action app"*. Only the action app was in scope.

## 5. Open questions

| Question | Owner | Where it gets settled |
|---|---|---|
| Repoint the resource at the new 1.0.9 registration, or publish into `ID902897…` to keep the Action Center lineage? | Robert | Directly; blocks the action app fix |
| Does the Flow need a live run before the case plan is rewired, or is "packs clean and already published" enough? | Robert | Directly |
| Is the cloud case plan's `nodes[0].type` a Studio Web forward-version issue, or does it need fixing? | Robert / Tyler | See section 7 — blocks any pack of the cloud tree |
| Should `BPMN-Threshold-Injury-Assessment` be removed once the Flow is wired in, or kept alongside? | Robert | Directly |

## 6. Work queue

1. ~~Identify the correct action app version~~ **DONE** — 1.0.4 is the only build containing
   `Rule Results`, `Notable`, `Risk Factors`; 1.0.5 onward are clean. Robert's own test:
   *"the correct action app should no longer has 'Rule Results' and 'Notable' or 'Risk Factors'"*.
2. ~~Add the three stage waits~~ **DONE** in both trees, all validating.
3. ~~Rename demo-ish labels~~ **DONE**.
4. ~~Publish the action app~~ **DONE** as 1.0.9, but see item 5.
5. **BLOCKED on section 5 question 1** — repoint the solution's app resource at a 1.0.9 that
   preserves the Action Center lineage.
6. ~~Add the Flow to the solution~~ **DONE** in the cloud tree; packs `Success`.
7. **TODO** — fix the case plan pack failure (section 7). Nothing can be packed from the cloud tree
   until this clears.
8. **TODO** — rewire the case plan's Threshold Injury Assessment task from `process` back to
   `flow-process`, and decide the fate of the BPMN project.
9. **TODO** — reconcile local and cloud into one tree, then pack, publish, deploy.

## 7. Operational notes

**The cloud case plan does not pack.** `uip solution pack . --dry-run` on the downloaded tree fails
the `CaseManagement` project:

```
Failed to compile 'caseplan.case' into 'caseplan.case.bpmn':
Error migrating Case JSON from V20 to V21: invalid_union at nodes[0].type —
Expected 'case-management:Trigger' | 'case-management:Stage' |
'case-management:ExceptionStage' | 'case-management:StickyNote'
```

`nodes[0]` is the trigger. Pre-existing and unrelated to anything changed here — the Flow was added
in the same run and reported `Success`. Everything else in the solution packs.

**Cloud and local have diverged.** Neither is a superset.

| | Local | Cloud |
|---|---|---|
| Case plan file | `caseplan.json` | `caseplan.case` (+ a `.bak` of the old json) |
| Threshold Injury Assessment | `Flow` | `ProcessOrchestration` (BPMN) |
| `API - Fetch File` | absent | present |
| Projects | 16 | 17 (18 after the Flow was added) |
| Case ID `INJ`, sticky note | no | yes |
| The three gateway waits | yes | applied by hand after download |

**`uip solution download` is the pull.** There is no sync verb; `upload` pushes and overwrites.

```
uip solution download dbf7785c-845a-40a9-006f-08df14ddbfdf -d ./out --extract
```

**Broken tooling.**

- `@uipath/maestro-builder-sdk` is not installed, so `uip maestro flow check`,
  `uip maestro case check`, `uip maestro case decompile` and `uip maestro case compile` all fail.
  Install routes `@uipath` to `https://npm.pkg.github.com/` via `.npmrc`.
- `uip maestro case tasks` is read-only — `describe`, `enrich`, `get`. No add.
- `uip solution validate` does not exist. Use `uip solution pack . --dry-run`.
- `uip codedapp publish` takes no positional argument; use `-n`, `-v`, `--uipath-dir`.
- `uip maestro flow pack` has no `-o`.
- `uip solution resources edit --source remote` on the app resource resolves to the wrong app and
  `--force` renames the resource file. Avoid; use `--patch`.
- The Automation Solutions metadata service timed out during that call. Intermittent.

**The Case Apps are not solution members and the case plan does not carry them.** The action app is
reached through bindings `bAPP00001` (name) and `bAPP00002` (folderPath), both keyed
`Shared.injury-claims-console` with no version pin, so the deployed version is whatever the resource
points at. The Flow's own `bindings_v2.json` points at folder
`Shared/Personal Injury Claims Demo`, which is *not* the `Shared` folder the app binding uses.

**Member package ids come from folder names.** `<solution>.<short-type>.<member-folder>`, spaces and
dots collapsing to a single dot, must be unique and under 100 characters. Relevant if any Case App
is ever folded in — those folder names are long.

**Stage node ids**, for reference: `Stage_Invs03` (Liability Assessment & Admission),
`Stage_Mitg05` (Rehabilitation & Return-to-Work), `Stage_Hidn12` (Condition Deterioration &
Re-assessment). An existing `wait-for-timer` lives at `tMT050002` in `Stage_Mitg05` at `PT2M` — the
shape to copy if a case-plan-level timer is ever wanted.

---

## 8. Reconciled — 18 Sep, from the deploying thread

The two threads were editing the same local tree. This one packs, publishes and deploys from
`/Users/robert.love/Unsynced/PersonalInjuryClaims/PersonalInjuryClaims` to deployment **PI Claims**
(folder `fe049ea4-01a6-49e8-814d-8f5f5ec4ebf7`, case process key
`7ee94568-fa50-49cd-bd8d-e483a1f0709e`). Live version is **1.4.1**.

**Ported from the cloud tree into local, now deployed:**

- `metadata.caseIdentifier` `PC` → `INJ`, type `constant`. `PC` no longer appears in the compiled
  artifact.
- `StickyNote_bYX1ty` `**EXCEPTION STAGES**`, 2640x400, parented to root.

**Deliberately not ported: `API - Fetch File`.** Neither case plan references it; it exists only as
a Case Agent tool ("Fetch File From Data Fabric"). The `Get Event Data` tool was removed from the
Case Agent earlier in this thread after it faulted runs repeatedly with
`170002 Failed to execute tool`, and the event payload already carries `Comment` and
`DocumentName`. Adding another Data Fabric tool re-opens that failure mode for no demo benefit.

**Resolved: section 5 question 1.** Keep the existing app registration. The case plan resolves the
action app by name (`Shared.injury-claims-console`) and this thread has been deploying into that
registration, now at **1.0.8**. The `IDdd29f4a1…` registration created by the 1.0.9 publish is an
orphan; nothing points at it. Two duplicate apps, `injury-claims-console_1` and `_2`, also exist in
the folder and are unreferenced.

**Resolved: section 6 items 7, 8, 9 and section 5 question 4.** The local tree already has the Flow
wired as a `flow-process` task, `BPMN-Threshold-Injury-Assessment` deleted, and the case plan
validating `--strict` and packing clean. The cloud tree's `nodes[0].type` V20→V21 pack failure does
not block anything, because nothing packs from the download.

**Resolved: section 5 question 2.** The Flow has had a live run. Instance
`15f0ba49-f674-48de-aecb-18d6b83cfca2` on 1.3.3 reached `Completed` with zero incidents, and the
case plan started it on its own. The earlier faults were the three agent nodes receiving empty
string inputs: the runtime strips empty strings, so required fields arrived missing
(`scenario`, `injuryTypeCode`). All three nodes now carry real values.

**The three 15-second stage waits shipped.** They were already in the local gateways and went out
with every version from 1.3.5 onward. They pair with the agent's stage fan-out rather than
replacing it: the agent enters the stages, the waits keep them on screen long enough to see.

**Do not sync in either direction.** `solution upload` from local would destroy the INJ prefix's
Studio Web origin, the sticky note as authored, and `API - Fetch File`. `solution download` over
local would destroy the Flow wiring and land on a tree that does not pack. Port individual fields
by hand, as was done here.

### Still open, and it is the one that matters

**The Data Fabric global event does not reach the case.** Root cause is not the case plan: there are
**zero Integration Service connections in `Shared/PI Claims`**. The solution provisions its own
connection resource scoped to `solution_folder` with `authenticationType:
AuthenticateAfterDeployment`, and it was never authenticated, so nothing exists in that folder to
listen with. The only authenticated copy, `080f3ca9-b976-46d2-a5ed-454a628e6214`
`Data Fabric - Robert Love`, sits in `Shared` one level up, where the case cannot reach it.

The fix needs one manual step: authenticate the UiPath Data Fabric connection in `Shared/PI Claims`
via Integration Service. `deploy upgrade` takes no `--config-file`, and `solution pack` regenerates
the connection resource from server state, so neither the local resource file nor an in-place
upgrade can redirect it. The alternative is `deploy config link` onto the Shared connection, which
forces a `deploy run` into a fresh folder.

Three case-plan gaps were found and fixed along the way while chasing this. All were real, none was
the cause:

- `activityPropertyConfiguration.filterVariables` was missing, so the filter's `{var_0}` had nothing
  binding it and compiled to `CaseId==''`. The working reference binds
  `{"var_0": "=js:(metadata.InstanceId)"}`.
- `data.inputs` was missing entirely, along with `outputs`, `bindings`, `id`, `elementId` and
  `activityConfigurationVersion: "v2"`. The global event now matches the working warranty shape.
- An earlier note in BRIEF.md that "eventMode resolves to webhooks" was backwards in one place and
  right in another: `activityPropertyConfiguration.eventMode` is `webhooks`, and the nested
  `instanceParameters.eventMode` follows from it. Editing the nested `configuration` string directly
  does nothing, because the packer regenerates it from the outer fields.

**Duplicate task starts are fixed.** `shouldRunOnlyOnce` compiles to a guard that tests only
`tasksCompleted`, never `tasksRunning`, so two Case Manager evaluations seconds apart both emitted
the same task and the engine dispatched both. The fix was an `enum` on the Case Manager Agent's
`tasksToRun.taskName`, restricting it to the eight event-response tasks so the other 26 activate
only from their own rules. A clean run counted 79 element executions, 79 distinct, zero duplicates.

### Studio Web upload broke the canvas, then was reverted — 18 Sep

`uip solution upload` from local replaced the cloud case plan and the Studio Web canvas then
failed to render with `TypeError: Cannot read properties of undefined (reading 'x')` at `setNodes`.

**Cause: case-plan schema version.** Studio Web authors at `version: 32.0.1`; the CLI reads and
writes `27.0.0`. The `version` field alone routes the migrator — Tyler's 32.0.1 plan relabelled to
`27.0.0` validates `Success`, and the local 27.0.0 plan relabelled to `32.0.1` fails. The node
content is compatible; only the label decides which migration chain runs. Upgrading the CLI from
`1.203.0-dev.8729` to `8733` does not change this.

**Reverted.** The cloud was restored by uploading the pre-overwrite archive
`out-fresh/dbf7785c-845a-40a9-006f-08df14ddbfdf.uis`, verified back at `version 32.0.1` with
`INJ`, the 360-day SLA, the sticky note and all three agent tools intact. Nothing authored in
Studio Web was lost.

**Consequence: the two surfaces are deliberately divergent again.**

- **Cloud** is Tyler's state, at 32.0.1, and Studio Web renders it. Do not upload over it.
- **Local** carries the merge and is what packs, publishes and deploys. Runtime is 1.5.0.

**Do not run `uip solution upload` from local against this solution** until the case plan is
reconciled. The route, when there is time: take the 32.0.1 cloud plan as the base, relabel it
`27.0.0` so the CLI can pack it, re-apply the local edits onto it (the `flow-process` task, the
`tasksToRun` enum, the global-event `filterVariables` and `data.inputs`, `shouldRunOnlyOnce`), and
bump the label back to `32.0.1` only in the copy that goes to Studio Web.

**Ported from cloud into local in this pass:** the overall SLA `180d` → `360d`, which clears the
"Overall SLA is lower than total SLA of all stages" validate warning.

## 9. Case-plan schema version, resolved — 18 Sep

Section 8 said "the `version` field alone routes the migrator". That is half right and it cost a
day. The migrator does not read the label to pick a chain. It `safeParse`s the document against
every schema in turn and uses the first that matches, and each schema pins `version` to an exact
literal. So a label naming a schema that does not exist matches nothing, and detection falls
through to this branch in `@uipath/case-schema`:

```js
if (jsonObject.version && jsonObject.metadata && !jsonObject.root) {
  return { detected: { version: 20, versionString: "20.0.0" } };
}
```

**There is no `32.0.1`.** The newest schema in the table is `32.0.0`. A plan labelled `32.0.1`
therefore reads as 20.0.0, the 20 to 21 migration runs, and V21 validates nodes against
`CaseManagementJsonNodeSchemaV14`, whose trigger type is the pre-V24 `case-management:Trigger`.
Our trigger is `uipath.case.trigger`, which is correct from V24 on. Hence the Maestro error:

```
Error migrating Case JSON from 20.0.0 to 21.0.0: Invalid discriminator value.
Expected 'case-management:Trigger' | ... at nodes[0].type
```

Studio Web accepted `32.0.1` because its bundle carries a newer schema table than the Maestro
viewer does. Fixing one surface broke the other.

### What the migration actually changes

Measured by running the real `migrateCaseInMemoryJsonToLatest` over the plan, not by reading the
schema source. 56 differences, in three groups:

| Change | Count | Verdict |
|---|---|---|
| `selectedStageId` becomes `selectedStageIds`, an array | 16 pairs | Benign, the V29 shape |
| `current-stage-entered` rewritten to `runs-sequentially` | 5 | Already what the packer emits |
| Entry-condition ids and display names regenerated | 15 | Ids are noise, names were restored by hand |

The third group matters only for legibility, so the five readable names
("Policy workstream opens", "Loss detail workstream opens", "Screening workstream opens",
"Emergency lane opens", "Care support needed") were copied back onto the migrated plan.

### Why the rewrite is safe

`current-stage-entered` is gone in V32 and three of its five uses are the Fnol01 tasks that open
together on stage entry, so on paper this threatens the parallel fan-out. It does not, because the
packer already applies the same rewrite when it compiles. The deployed `caseplan.json.bpmn` that
ran the verified six-stage fan-out carries 30 `runs-sequentially` and no live
`current-stage-entered`. The runtime has been on V32 semantics all along.

Proved by packing both plans and comparing the compiled output:

- Packing the 27.0.0 plan and the migrated 32.0.0 plan gives BPMN of identical length whose only
  differences are 95 characters of regenerated ids.
- Packing the *same* plan twice gives 94 such characters, so that is the noise floor.
- Normalising ids and display names away, the two compiled documents are identical apart from the
  `ruleName` strings deliberately restored above. The guard expressions
  (`vars.caseState.tasksCompleted.some(...)`) match byte for byte.

Worth knowing: the packer reads the plan through an older lineage that tops out at 20 and reports
`Current migration version: 20, Latest available: 20` whatever the label says. The label is
inert at pack time. It only decides what the Maestro and Studio Web viewers do.

### State now

Local `PersonalInjuryClaims/caseplan.json` is a genuine `32.0.0` document: content unchanged,
readable rule names kept, formatted with `uip maestro case format`. It round-trips through the
migrator with no further migration, and it compiles to the BPMN we verified end to end.

**Cloud is still on the broken `32.0.1` label** and has not been touched. Uploading the local plan
over it is now the reconciliation section 8 deferred, and it no longer needs a relabelling dance.
