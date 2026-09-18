# Personal Injury Claims — investor webinar demo

Working notes and shareable artifacts for the Personal Injury Claims Maestro
Case Management demo, pivoted from the Property Insurance Claims build for the
2026-09-17 investor webinar.

The solution source is in this repo under `PersonalInjuryClaims/`, and is
deployed to the `businessorchestration` organisation, `DefaultTenant`.

## What is here

| Path | What it is |
|---|---|
| `docs/BUILD-NOTES.md` | Traps hit during the build and how each was resolved |
| `demo-assets/updated-medical-records.pdf` | The document uploaded on camera at the ~5:00 mark |
| `docs/video-narration.md` | Per-frame narration for the screenshot video, demo beats only |
| `PersonalInjuryClaims/` | The solution source: case plan, agents, case apps, APIs, flow and BPMN projects |

The presenter script, the scope brief and the completion plan are kept out of
this repo: they name people and schedule internal meetings. Ask Robert for them
directly.

## The demo in one paragraph

A claims officer opens a running personal injury claim, uploads updated medical
records from the treating provider and adds a note. That write lands as a row in
a Data Fabric entity, which fires a global event on the case. The Case Manager
Agent reads the event, reads the document detail, and decides on its own which
work now has to happen — activating tasks across three different stages rather
than following a fixed path.

## Deployed coordinates

| Thing | Where |
|---|---|
| Case app | https://businessorchestration.uipath.host/personal-injury-claims |
| Solution folder | `Shared/PersonalInjuryClaims` |
| Data Fabric entity | `InjuryClaimCaseEvent` |
| Event trigger | `CREATED`, filtered on `CaseId == metadata.InstanceId`, webhook mode |

Resource GUIDs rotate on every redeploy, so they are deliberately not recorded
here. Read them from `uip or folders list` and `uip or processes list`.

## The solution source

| Path under `PersonalInjuryClaims/` | What it is |
|---|---|
| `PersonalInjuryClaims/caseplan.json` | The case plan the demo runs on. `caseplan.json.bpmn` beside it is the compiled runtime artifact |
| `Agent - Injury Claims Case Agent/` | The Case Manager Agent, which decides which stages and tasks a business event should open |
| `Agent - Injury Claims Triage`, `Agent - Liability Assessment`, `Agent - Subrogation Assessment` | Task-level agents |
| `Flow-Threshold-Injury-Assessment/` | The threshold injury assessment, the task opened on camera |
| `BPMN-*/` | The three long-running sub-processes |
| `API - */` | The gateway and rules projects the tasks call |
| `Case App - Injury Claims Workspace/` | Dana's caseload and case pages |
| `Case App - Injury Claims Console/` | The task surface where the records are uploaded |
| `packages/decision-form/` | The decision form shared by both apps |

### Running the case app locally

```bash
cd "PersonalInjuryClaims/Case App - Injury Claims Workspace"
cp .env.example .env    # then fill in the tenant block
npm install
npm run dev
```

With no `.env` the app runs entirely on its bundled demo dataset. `.env` is not
committed: every value in it is a tenant coordinate or a public PKCE client id
rather than a secret, but it is local wiring and belongs to whoever is running
the demo.
