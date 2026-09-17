# Personal Injury Claims — plan to completion

## Context

Pivoting the working Property Insurance Claims Maestro solution into a Personal Injury
Claims demo for an investor webinar. Mounish records 2–3 PM PST; dry run with Raghu 3 PM PST.

Ground truth, in precedence order:
1. `maestro-case-demo-script.md` — Mounish's ~9 min presenter script; the only artifact that
   says what is actually on camera.
2. `process-skills` KB (motor-claims-third-party + workers-comp) — domain content.
3. `BRIEF.md` / `HANDOFF.md` — build mechanics and traps.
4. James Dickson's SKO solution — secondary reference only.

Standing decisions from this thread:
- Do **not** modify the Property Insurance Claims solution.
- **UiPath agents for everything.** No live external agents; a placeholder label only.
- The upload event fans out across **3 different stages** (Mounish).
- **Rename everything before the dry run**, mock data and agents included.
- Never say "coded app", "TypeScript SDK", or frame anything as BPMN edges/gateways/router.

## Already done

New solution `PersonalInjuryClaims` (`96a88950-5501-413f-894c-8f9373ab79cb`), local-only,
15 projects renamed and registered. Entity `InjuryClaimCaseEvent`
(`2da1619c-b0b2-f111-a6a7-7c1e520b3a1e`). Global event wired into
`caseManagerData.data.globalEvents` + two Data Fabric bindings. Case plan display layer
converted (16 stages, ~40 tasks, all descriptions). Validates on `--strict`.

BRIEF.md corrected twice: `resourceKey` is the Data Fabric **connection** id, not the entity
GUID; `eventMode` resolves to `webhooks`.

## Phase 0 — Verify inherited state before building on it

Verified already: entity `InjuryClaimCaseEvent` exists with exactly CaseId / EventType /
Comment / DocumentName / File; Property Insurance Claims has zero files modified since the
copy was taken and its case plan still carries 27 property references, so it is intact.

Re-check rather than assume, since these came from earlier in the session:
- The 16 stage names and ~40 task names now in `caseplan.json` — read them and judge the
  domain mapping directly; they came from a KB synthesis that was not independently checked.
- That the global event's `CaseId` filter actually binds to `metadata.InstanceId`, by running
  it, not by reading it.
- That all 15 registered projects still pack, before trusting the manifest.

## Phase 1 — Finish the rename (blocks the dry run)

Only the case plan is converted. One coordinated pass, then validate once at the end.

**1a. Variable rename**, applied to the case plan and every dependent file together:

| Current | New | | Current | New |
|---|---|---|---|---|
| `perilCode` | `injuryTypeCode` | | `sumInsuredContents` | `policyLimitCosts` |
| `causeOfLossCode` | `liabilityBasisCode` | | `vacancyDays` | `notificationDelayDays` |
| `averageAppliedFlag` | `contributoryNegligenceFlag` | | `habitableFlag` | `independentLivingFlag` |
| `reserveBuildings` | `reserveGeneralDamages` | | `floodCoverInForce` | `liabilityCoverInForce` |
| `reserveContents` | `reserveSpecialDamages` | | `catEventCode` | `litigationEventCode` |
| `reserveAccommodation` | `reserveCareAndRehab` | | `insuredName` | `claimantName` |
| `sumInsuredBuildings` | `policyLimitIndemnity` | | `riskAddress` | `incidentLocation` |
| `supplementalScopeOutcome` | `supplementalTreatmentOutcome` | | `coverageOutcome` | `liabilityOutcome` |

Keep `vulnerableCustomerFlag` (KB calls out vulnerable-claimant handling),
`subrogationPotentialFlag`, `settlementBasis/Path/Outcome`, `fraudScore`, `authorityLimit`.

These names are contract-coupled — they appear as JSON **keys**, not just values, in
`API - Injury Claims Gateway/Workflow.json`, `API - Injury Policy Gateway`, `API - Injury Rules`,
`API - Injury Provider Network Gateway`, all agent schemas (plus `.agent-builder/` mirrors),
`Case App - Injury Claims Console/action-schema.json`, and the BPMN models.

**1b. Agent prompts** — all four agents: `agent.json`, `entry-points.json`,
`evals/evaluators/evaluator-default.json`, the `.agent-builder/` mirrors, and the Case Agent's
`evals/eval-sets/evaluation-set-default.json`. Language sits in system/user prompts and schema
field descriptions. Example to rewrite (Triage): *"You classify a property insurance claim into
a handling track. Track assignment weighs peril, severity, habitability and value together."*

**1c. API workflow mock data** — display-facing deterministic stand-ins. Heaviest is the
`SCENARIOS` map in `API - Injury Claims Gateway/Workflow.json`
(`perilCode: 'ESCAPE_OF_WATER'`, `reserveBuildings: 65000`, UK risk addresses). Replace with
injury scenarios: injury type, liability position, general/special damages reserves.

**1d. BPMN** — all three models carry property task labels ("Cost contents schedule",
"Dispose of salvage", "Project accommodation cost") and data-object names
(`accommodationCost`, `contentsCost`, `salvageValue`, `restorerName`). The `.bpmn` **filenames**
are also still property-named inside the renamed directories, e.g.
`BPMN-Early-Intervention-Dispatch/BPMN-Emergency-Mitigation-Dispatch.bpmn`.

**1e. Also in scope**: `PersonalInjuryClaims/case-plan.json`, `caseplan.json.bpmn`,
`resources/solution_folder/app/codedAction/property-claims-console.json`, and the package name
`@property-claims/decision-form`.

Close with: `uip maestro case format` → `uip maestro case bindings sync` →
`uip maestro case validate --strict`.

## Phase 2 — The 5:00 moment (highest value)

**2a. Get Event Data tool** on `Agent - Injury Claims Case Agent`, copying
`/Users/robert.love/Unsynced/CUSTOMER/build/Loan Origination - Connect with Experts/Agent - Case Manager/resources/Get Event Data/resource.json`
— reads the row by `{{eventId}}`. Point at `InjuryClaimCaseEvent`, connection
`080f3ca9-b976-46d2-a5ed-454a628e6214`. The agent already has an `eventId` input wired.
Verify first whether the Case Agent currently declares tools (it calls API - Case Plan and
API - Rules per HANDOFF, but scoping suggested the other three agents have none).

**2b. Prompt scenarios** so a document-upload event fans out across three stages:

| Stage | Task fired | Why it follows |
|---|---|---|
| Medical Evidence & Treatment | Review new medical evidence / instruct IME | the stage the claim was waiting in |
| Condition Deterioration & Re-assessment | Re-assess following deterioration | interrupting lane — the script's "condition worsens" beat |
| Quantum Assessment & Settlement Negotiation | Revise reserve on new evidence | downstream; KB makes medical evidence a hard gate on settlement |

## Phase 3 — The app (2:15 moment)

Real scope is 9 files in Workspace + 5 in Console, not the 62 a raw grep suggests.

**3a. Mock data.** Master fixture `Case App - Injury Claims Workspace/src/lib/claims/demoData.ts`
(1598 lines): 3 hero cases + 38 background = **41, already matching the script**, with the 3
hero cases surfaced as the "needs judgement" queue. No count changes needed — only content.
Rename hero case to claimant **Joseph Thompson** / **CLAIM-5182** and the officer persona to
**Dana** (`src/lib/role/RoleProvider.tsx` currently a loss-adjuster persona). Name/address pools
at `demoData.ts:1071–1135`. Decision-console narrative in `src/lib/coverage/` (`fixture.ts`,
`coverage-decision.ts`, `decision-signals.ts`, `case-sections.ts`, `case-documents.ts`).
Stage names in `src/lib/claims/casePlan.ts` (heaviest, 18 hits). Also
`src/lib/claims/types.ts` (`PropertyClaim` interface), `caseSlas.ts`, `costSplit.ts`,
`CaseDetailsTab.tsx`, `HomepageSplash.tsx`, `caseOverlay.ts`.

**3b. HITL swap.** Replace the four-outcome coverage decision with **upload + comment + submit**
in `packages/decision-form` (`src/taskSpec.ts` lines 19–304 carry peril/flood/vacancy/sum-insured
rule logic; `src/DecisionForm.tsx:156` defaults to `'Escape of water'`). Note: the package is a
sibling source package, **not** a wired npm workspace dependency — confirm how each app consumes
it before editing. Update `action-schema.json` to match (9 of its 20 inputs are property-specific).

**3c. Write the row** to `InjuryClaimCaseEvent` on submit, carrying `CaseId` = running instance
id, modelled on the Loan Origination dashboard's "New loan application" modal. Bind `CaseId` from
the loaded case context — never accept it as client-supplied free text.

## Phase 4 — Threshold Injury Assessment (6:45 moment)

New BPMN mirroring James's `ReviewInjury`, all UiPath agents: Start → Get Entity Record →
Normalize Referral Id → Process Injury Report Packet (IXP) → parallel [Analyze medical report /
Analyze accident details] → join → Injury Assessment Agent → Set Injury Id → Update Entity Record
→ Complete. **Cut this first if time runs short**; the case-level story survives without it.

## Phase 5 — Identity, deploy, verify

HANDOFF's #1 lesson: wire identity **before** the first app deploy.

- New OAuth external app + redirect URI. `Case App - Injury Claims Workspace/.env` still carries
  the **property** client id `ce33064e-…` and **old** deploy keys
  (`VITE_CASE_PROCESS_KEY=4dac771c…`, `VITE_CASE_FOLDER_KEY=4b98b85d…`).
- `VITE_UIPATH_SCOPES` omits the DataFabric scopes `uipath.json` already declares
  (`DataFabric.Data.Read/Write`). **The upload write fails without them.**
- `uip maestro case pack` → `uip solution pack` → `publish` → `deploy run`. Coded apps deploy
  separately via `uip codedapp`. Folder/process keys are deploy outputs, so `.env` is filled last.

## Verification

Execution is ground truth — three defects passed every validator on the property build.

1. `validate --strict` clean; `bindings sync` leaves no drift.
2. Start an instance; confirm it reaches Medical Evidence & Treatment.
3. In the deployed app as Dana, open CLAIM-5182, upload a document, add a comment, submit.
4. Confirm the row lands in `InjuryClaimCaseEvent` with `CaseId` = that instance id
   (`uip df records list`).
5. Confirm the event appears in the execution trail and the Case Manager Agent fired tasks in
   **three distinct stages**.
6. Read the incidents — watch for the `170002` runtime timeout that killed the property build on
   a slower model. Agent is on `anthropic.claude-sonnet-5` / 10 turns.
7. Screen-check every visible surface for stray property language before recording.

## Risks

- **Time.** Phases 1–3 are the demo; Phase 4 is the stretch.
- **Trigger fires for every instance** if the `CaseId` filter is wrong. It must come from a
  structured filter tree — a bare expression string is silently dropped by Studio Web, and a null
  `groupOperator` silently widens the trigger to match every event.
- **Deploy keys rotate** after every operation, including failed ones.
- `uip` is shadowed (`~/.npm-global/bin` vs `/usr/local/bin`); mixed versions silently drop Api
  and Agent projects from a pack.
