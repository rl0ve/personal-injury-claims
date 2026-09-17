# Personal Injury Claims — investor webinar demo

Working notes and shareable artifacts for the Personal Injury Claims Maestro
Case Management demo, pivoted from the Property Insurance Claims build for the
2026-09-17 investor webinar.

The solution source itself is not in this repo. It lives locally under
`PersonalInjuryClaims/` and is deployed to the `businessorchestration`
organisation, `DefaultTenant`.

## What is here

| Path | What it is |
|---|---|
| `docs/BRIEF.md` | Scope brief derived from the 2026-09-17 investor demo call, with two corrections verified against the CLI |
| `docs/maestro-case-demo-script.md` | The presenter script. Narrative ground truth, including the "don't say" list |
| `docs/completion-plan.md` | The plan followed to get from the property build to this one |
| `docs/BUILD-NOTES.md` | Traps hit during the build and how each was resolved |
| `demo-assets/updated-medical-records.pdf` | The document uploaded on camera at the ~5:00 mark |

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
