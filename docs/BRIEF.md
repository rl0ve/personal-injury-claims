# Personal Injury Claims — starting brief

Written 2026-09-17. **Ground truth is the Zoom call notes** ("Investor demo
2026-09-17 11:01 GMT-4"), read via the Zoom Hub doc. An earlier version of this
file guessed from the SKO doc and got the scope wrong; corrections are in §7.

Read with `/Users/robert.love/Unsynced/Property Insurance Claims/HANDOFF.md`
(build mechanics) and `/Users/robert.love/Unsynced/uipath-maestro-use-case-builder/`
(the skill).

---

## 1. What this actually is

An **Investor Webinar** demo. Dry run with Raghu **today at 3 PM PST**. Mounish
records the demo video **2–3 PM PST** to play during it.

This is **not** a new build on staging. It is a **pivot of the existing property
claims solution**: rename it, change the coded app logic, and add one new
capability — a working event-driven trigger.

> "The primary goal is to pivot the current 'property claims' workflow to
> 'personal injury claims' and implement a functional event-driven trigger using
> **Data Fabric** to demonstrate the case manager's adaptive nature."

## 2. Decisions from the call

- **Project pivot.** Project name and coded app logic change from "property
  insurance claims" to **personal injury claims**.
- **Demo workflow.** A claims officer **uploads documents and adds comments in
  the case app**; that triggers the **case manager** to execute a new set of
  tasks and stages.
- **Technical implementation.** A **global event** in Studio Web bound to a
  **Data Fabric entity**. When a record is updated (the document upload), it
  triggers the case manager agent via a prompt-based scenario.

## 3. Action items

| Owner | Item |
|---|---|
| **Robert** | Rename to "personal injury claims"; implement the Data Fabric event trigger |
| **Tyler** | Implement the event trigger on **warranty resolution first**; if it works, share the logic for Robert to copy |
| **Mounish** | Record the demo video 2–3 PM PST. Slides already final after Vikram, Arun and Raghu |

Tyler getting there first is the cheapest path. Check with him before burning
time on the trigger independently.

## 4. The technical requirements, verbatim

- **HITL**: the user **uploads medical plan documents from a provider and
  submits them** — *without approving or rejecting*. This replaces the current
  four-outcome Confirm Coverage Position decision.
- **Case Manager logic**: the agent needs **specific scenarios added to its
  prompt** so it knows which tasks to trigger when the document-upload event
  arrives.
- **Reference**: the **loan origination dashboard** project, for the TypeScript
  SDK implementation of Data Fabric connections.
  Local: `/Users/robert.love/Unsynced/CUSTOMER/build/Loan Origination - Connect with Experts/`
  (its `Agent - Case Manager` carries a `Get Event Data` resource).

## 5. The global event shape, already solved in Warranty

`[Fusion] Warranty Resolution` has a working one. Read it before writing a line:

`/Users/robert.love/Unsynced/Fusion Warranty Resolution/IndustrialWarrantyResolution/caseplan.case`
→ `metadata.caseManagerData.data.globalEvents[0]`

```jsonc
{
  "entryPointId": "<uuid>",
  "task": {
    "type": "wait-for-connector",
    "data": {
      "serviceType": "Intsvc.WaitForEvent",
      "context": [
        { "name": "connectorKey", "value": "uipath-uipath-dataservice" },
        { "name": "connection",   "value": "=bindings.bEjoEpXB8" },
        { "name": "resourceKey",  "value": "<Data Fabric CONNECTION id — see correction below>" },
        { "name": "folderKey",    "value": "=bindings.bNGSjk2cN" },
        { "name": "objectName",   "value": "WarrantyCaseCommentOrDocument" },
        { "name": "operation",    "value": "CREATED" },
        { "name": "metadata", "body": { "activityPropertyConfiguration": {
            "objectName": "WarrantyCaseCommentOrDocument",
            "eventType": "CREATED",
            "eventMode": "webhooks",
            "filterExpression": "=js:(`((CaseId=='{var_0}'))`)"
        }}}
      ]
    }
  }
}
```

The filter binds the entity row to the instance: `CaseId == metadata.InstanceId`.
So the entity needs a `CaseId` column, and whatever writes a row must populate it
with the running instance id.

**Correction (2026-09-17, verified against the CLI and Warranty's own bindings):**
`resourceKey` is the **Data Fabric connection id**, not the entity GUID. Warranty's
`921c0302-506b-42fd-ab74-28bbc5e4a63c` appears in its bindings as
`{"resource":"Connection","propertyAttribute":"ConnectionId"}` — a connection, not an
entity. `uip maestro case spec` independently emits `resourceKey` = the connection id
passed to `--connection-id`. The entity is identified only by `objectName`. Putting the
entity GUID here would have failed at runtime.

**Three traps in that block:**

1. **The entity is not in the package.** Warranty references
   `WarrantyCaseCommentOrDocument` by name and GUID only; the definition lives
   elsewhere in that tenant. An equivalent entity must be **created in
   DefaultTenant** before the event can fire. Expect the same for the injury one.
2. **`eventMode` disagrees with itself** — `"webhooks"` at the top of
   `activityPropertyConfiguration`, `"polling"` inside the nested
   `instanceParameters`. **Resolved 2026-09-17: `webhooks` governs.**
   `uip maestro case spec` reports `Operation.EventMode: "webhooks"` for CREATED and
   emits `webhooks` in both places; Warranty's nested `polling` is vestigial designer
   state. The injury build writes `webhooks` consistently.
3. **The Data Fabric connection is tenant-bound** and in Warranty is named after
   a colleague's account. Create a fresh one; do not copy the GUID.

## 6. Shortest path to the dry run

Ordered by risk, highest first. The trigger is the only genuinely new thing.

1. **Ask Tyler** whether the warranty trigger works yet. If it does, copy it.
2. **Create the Data Fabric entity** in DefaultTenant with a `CaseId` column,
   plus a Data Fabric connection. Nothing downstream works without these.
3. **Add the global event** to `caseplan.json` on the Warranty shape above.
4. **Add the scenarios to the Case Agent prompt** so the upload event maps to a
   named set of tasks and stages. This is what makes the demo *look* adaptive —
   the event firing is only half of it.
5. **Change the HITL** from the four-outcome coverage decision to an
   upload-and-submit action. The shared `packages/decision-form` component means
   this changes in one place for both hosts.
6. **Rename** property → personal injury: solution, case project, stages, the
   coded app's copy and fixtures.
7. **Write the row from the case app** on upload, carrying `CaseId`, using the
   TypeScript SDK pattern from the loan origination dashboard.

Rename last of the functional items. It touches the most files and none of the
risk, and a half-renamed build still demos.

## 7. Corrections to my earlier brief

I inferred the scope from the SKO doc before reading the call notes. Wrong on
three counts:

| I said | Actually |
|---|---|
| The target is the SKO demo on `staging.uipath.com/uipathlabs/Playground` | The target is **this** solution on `cloud.uipath.com/businessorchestration/DefaultTenant`, pivoted |
| Two Studio projects already exist; question is whether to extend them | Those are the **Suncorp SKO reference**, not the build surface |
| Three live instances held at three stages, Process App choreography | That is the SKO script. The investor demo is upload → event → case manager reacts |

The SKO doc stays useful as **narrative reference** for what a personal injury
claim contains — threshold injury assessment, provider questions, internal
review, return-to-work planning. It is not the build spec.

SKO links, kept for reference:

| What | URL |
|---|---|
| SKO doc | `…/Demo and Preso Assets/Agentic/GTM/SKOFY27/KeynoteDemo/AgenticCMInjuryClaim/Claims PI Case Management Demo.docx` |
| SKO case instance | https://staging.uipath.com/uipathlabs/Playground/maestro_/cases/3b73de73-32d9-458c-a2b5-833c6722c3fc/instances/4d09f413-716f-4329-8031-5cb11a56a7de?folderKey=17c3f2fb-9994-42bf-b49b-6c917c756dba |
| SKO Studio — ReviewInjury | https://staging.uipath.com/uipathlabs/studio_/designer/b41d8258-de5c-4124-a733-4edb9be6a1cc?solutionId=b805a76d-e2f0-4aae-8114-e911c9b85198 |
| SKO Studio — InjuryClaimsAgenticCaseManagement | https://staging.uipath.com/uipathlabs/studio_/designer/7647b858-8b8c-4434-8862-60191a74e8d0?solutionId=b805a76d-e2f0-4aae-8114-e911c9b85198 |

## 8. Current state of the build being pivoted

All tenant coordinates, traps and deferred items are in
`Property Insurance Claims/HANDOFF.md`. The short version:

- Solution `1.0.13` deployed to `Shared/PersonalPropertyClaims`
  (`4b98b85d-14a1-41bb-b97a-61b0b9d36cd0`), case processKey
  `4dac771c-cfaf-412d-9902-6645c7df2870`.
- Case app `1.0.6` live and signed in at
  https://businessorchestration.uipath.host/property-insurance-claims/cases —
  reads the real tenant, surfaces the real task, completes it in place.
- Case Agent on `anthropic.claude-sonnet-5`, 10 iterations.
- Instance `19dd1f70` has **completed**, but carries one `170002` incident whose
  text says "reached the time limit" while the recorded duration is 32 seconds.
  The message contradicts itself; do not trust it as a diagnosis.

## 9. Open questions

| Question | Owner |
|---|---|
| Does Tyler's warranty trigger work yet? | Tyler — ask before building it twice |
| Does a Data Fabric entity + connection already exist in DefaultTenant, or is that from scratch? | Robert |
| How deep does the rename go for a webinar — display names only, or package ids and URLs too? | Robert |
| Which new tasks and stages should the upload event trigger? | Robert. The agent prompt needs them named explicitly |
