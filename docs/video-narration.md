# Personal Injury Claims — narration for the screenshot video

Demo beats only: 2:15 through 9:05 of `maestro-case-demo-script.md`. Fifteen frames, one
narration block each. Spoken register: these lines are read aloud over a still, so they carry
the connective tissue a written sentence would cut.

Frame files live in `video-frames/`. Each block's filename is the still it plays over.

---

## 01 — `01-queue.png` — Dana's caseload

Let's start where the work is actually felt, with Dana, a claims officer.

This is her whole caseload, forty-one open claims, all running right now. But look at what has
changed: most of them are moving forward on their own, because the orchestration is gathering
the records, triaging, drafting decisions, and nobody is touching them.

What Dana has to work on today is three. Just the handful that genuinely need a person's
judgement. Her job went from chasing forty-one claims to deciding on three.

## 02 — `02-case-overview.png` — CLAIM-5182

So let's open one. This is Joseph Thompson, claim five one eight two.

Dana gets the whole claim on one screen: the data, where it has got to in the process, and
what is pending on her. If she wants more than that, she asks the conversational agent.

And this claim is waiting on new medical information.

## 03 — `03-task-page.png` — The task, still inside the claim

This is what the claim is waiting for. And notice she has not left the claim to open it: the claim
number, the claimant and the stage are all still in front of her, with one way back.

Dana happens to have the medical information. The provider sent the records to her email this
morning, outside the normal channels.

## 04 — `04-action-app-pre-submit.png` — Upload and note

So she does the obvious thing. She attaches the records the provider sent her, writes a short
note for the case, and she is ready to submit.

Everything above the note is what the case agent has already established on this claim, so she
is not reading it cold.

## 05 — `05-action-app-submitted.png` — Submitted

And that is the submit. One click.

The task is closed, the form is locked, and it names the document she attached. Nobody has to
guess what went in.

What that one click just set in motion is the part worth slowing down for.

## 06 — `06-case-after-submit.png` — Back on the claim

Back on the claim, and the submission is on the record. Who submitted it, what they submitted,
and when.

Nothing else on this claim is waiting on a person. Dana is done here.

## 07 — `07-vs-code-caseplan.png` — Where the case comes from

Now, before we watch this claim run, let me show you where it comes from.

This is the case plan for a personal-injury claim. It is the design of the whole thing: the
stages a claim moves through, and inside each stage the tasks, the rules, and who or what does
each piece of work. An agent, an automation, a person, or an outside party.

A business analyst designs the claim here, and Maestro runs it. And the app Dana was just
working in is built on this same case plan, so when she submitted those records she was
writing straight into the case we are about to open.

## 08 — `08-maestro-case.png` — The same claim, running

And here is that same claim, running, in Maestro Case.

This is what takes a chaotic, situational process and turns it into one orchestrated,
observable system, from first filing all the way to settlement. It is the single source of
truth for the claim: what has happened, what we are waiting on, and what should happen next.

The claim moves through stages, but there is no fixed sequence between them. Nothing is wired
in a set order. So what decides where the case goes next?

## 09 — `09-case-manager-agent.png` — The Case Manager Agent

This, sitting over the whole case, is the Case Manager Agent.

The Case Manager Agent is what decides what happens next in the claim, and it is always
listening for business events. When Dana submitted those records a moment ago, that was the
event.

## 10 — `10-event-in-trail.png` — The event lands

And you can watch it land. The event shows up right here in the execution trail.

Then look at what the Case Manager Agent did with it. It read all the history and context
around this claim, and it decided which stages and tasks need to happen right now, given
everything that had already happened.

## 11 — `11-fanout.png` — Several tasks, at once

Here is the result on the case. Several tasks just fired off in parallel, because the Case
Manager Agent decided those are what need to happen next.

This is context-driven activation: the right task, at the right time. Nobody re-planned the
claim. The agent re-coordinated the work off the new information.

So that is AI at the process level. But it does not stop there.

## 12 — `12-threshold-assessment.png` — All the way down to the task

Let's look at one of those tasks, the threshold injury assessment.

There is a whole team of agents and automations getting this done. UiPath IXP reads the
medical documents. A UiPath agent analyses the medical report. An automation pulls the details
from the source system. A LangChain agent works the accident details. And then it hands off to
a Vertex agent to finish the assessment against the policy thresholds.

So the intelligence runs top to bottom. The Case Manager Agent decides the work that needs to
happen in the case, agents and automations do the work, and Maestro governs every one of them.

## 13 — `13-trail-audit.png` — Provable

And it is all provable. Scroll the execution trail and there is the complete record of the
case. Every rule applied, every decision, every agent and automation execution, and every
human action, timestamped, in one place.

Everything also runs inside the business's own rules: the allowed transitions, the SLAs, when
a human has to sign off. Nothing steps outside the boundaries the business sets.

## 14 — `14-controls.png` — In control of a live case

You also stay in control of the live case. Pause it, resume it, retry a step, even migrate a
running case onto a new version of the process, without losing where it is.

That is what a regulated insurer needs: agents moving fast, a provable record of everything
that happened, and the controls to step in whenever they want.

## 15 — `15-close.png` — Close

So in a single claim you saw it all come together. A messy, unpredictable case, run end to end
by the Case Manager Agent, with agents and automations doing the work, all inside the
business's rules, and every step on the record.

That is how one of the largest insurers in ANZ is reimagining claims for the agentic era on
Maestro. And they are not alone. Customers across industries are transforming their processes
by orchestrating them on Maestro.
