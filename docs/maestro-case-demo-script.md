# Maestro Case demo — agentic claims for a top ANZ insurer (~9 min)

---

## 0:00 — Raghu hands off → you take the demo (≈45s)

**[Raghu closes the momentum & impact section (slide 27) and hands over]**
*Suggested handoff line (Raghu):* "…and to show you what that actually looks like on a real claim, let me hand over to Mounish."

**You (Mounish):**
> "Thanks, Raghu, and hi everyone. You've just seen the momentum behind **Maestro**, and the results customers are getting from it — let me make one of those real."

> "**One of the top insurance providers in ANZ** is using **Maestro** to completely reimagine their claims process for the agentic era. The best way to show you is through a single **personal-injury claim.**"

**[ON SCREEN — slide: 'The reality of a single claim']**

---

## 0:45 — The reality of one claim (≈1:30)

**[ON SCREEN — the single-claim journey graphic]**

> "It starts with an auto accident — the injured person is admitted to hospital, their initial claim is filed, and they're discharged, kicking off an **injury assessment.**"

Walk the journey out loud:
> "All is well… until a couple of days later, **their condition worsens and they're readmitted** — and now new medical information has to be factored into an assessment that's already midway through."

> "And that's just the medical thread. **In parallel**, third parties are disputing liability; then the **diagnosis changes again.** And it all has to converge into a legal review, an action plan, and settlement to close the claim."

**The point (say it plainly):**
> "This is a **dynamic, fragmented process** that doesn't follow a predefined sequence. It's highly situational — it *evolves* as new information emerges at different points in time. That's the complexity every insurer lives with — and it's exactly what **Maestro** was built to untangle."

---

## 2:15 — Dana's world: the claims officer (≈1:45)

**[ON SCREEN — claims app → My Claims Queue]**

> "Let's start where the work is felt — with **Dana, a claims officer**."

> "Here's her whole caseload — **41 open claims** running right now. But look at the shift: **most of them are progressing on their own.** The orchestration is moving them forward — gathering records, triaging, drafting decisions — with no one touching them."

> "What Dana actually has to work on today is **three.** Just the handful that genuinely need **human judgement**. Her job went from chasing forty-one claims to deciding on three."

**[Open CLAIM-5182 — Joseph Thompson]**

> "Let's open one. Here, Dana gets a **360° view of the claim** — all the data, where it is in the process, and what's pending on her. And if she wants more, she just asks the **conversational agent.**"

> "This claim is waiting on new medical information — and Dana happens to have it: the provider sent the records to her email this morning, outside the normal channels. So she clicks into the task, uploads them, adds a quick note, and **submits.**"

> "This one click just set something in motion. Let me show you what's happening *underneath*."

---

## 4:00 — Under the hood: Maestro Case (≈1:00)

**[ON SCREEN — switch to Maestro Case → this claim]**

> "This is the same claim in **Maestro Case**. It takes that chaotic, situational process and turns it into one orchestrated, *observable* system — spanning **multiple stages**, and within each stage the **agents, automations and people** doing the work — from first filing all the way to settlement."

> "And it's the **single source of truth** for the claim: what's happened so far, what we're waiting on now, and what should happen next."

> "The claim moves through stages — but notice, there's **no fixed sequence between them**; nothing is wired in a set order. So what decides where the case goes next?"

---

## 5:00 — The Case Manager Agent (≈1:45) — the heart of the demo

**[Point to the Case Manager Agent sitting over the case]**

> "This — sitting over the whole case — is the **Case Manager Agent.** It's what decides what happens next in the claim, and it's **always listening for business events.** When Dana submitted those records a moment ago, **that was the event.**"

**[Point to the execution trail]**
> "You can see it land — **the event shows up right here in the execution trail.** And watch what the **Case Manager Agent** did with it: it read *all* the history and context around this claim, and **decided which stages and tasks need to happen *right now*** — given everything that's already occurred."

> "You can see the **decision it made** in the trail — and the result on the case: **several tasks just fired off in parallel**, because the Case Manager Agent decided those need to happen next. This is **context-driven activation** — the right task, at the right time. Nobody re-planned the claim; the agent re-coordinated the work off the new information."

> "So that's **AI at the *process* level** — a specialized agent, the **Case Manager Agent**, running the whole case and deciding what happens next as things change. But it doesn't stop there."

---

## 6:45 — …and all the way down to the task (≈1:00)

**[Open a task — Threshold Injury Assessment]**

> "Let's look at one of the tasks in the case — the threshold injury assessment. There's a whole **team of AI agents and automations** getting the work done: **UiPath IXP** reading the medical documents, a **UiPath agent** analysing the medical report, an **automation** pulling details from the source system, a **LangChain agent** on the accident details, and a hand-off to an external **Vertex agent** on Google's agent engine to finish the assessment against policy thresholds."

> "So the intelligence runs **top to bottom** — the **Case Manager Agent deciding the work that needs to happen in the case**, and **agents and automations doing the work** — and **Maestro governs every one of them.**"

---

## 7:45 — Governed and in control (≈1:00)

**[Scroll the execution trail; then the live-instance controls — pause / resume / retry / migrate]**

> "And it does that in a few ways. Everything runs **inside the business's own rules** — the allowed transitions, the SLAs, when a human has to sign off — so nothing steps outside the boundaries the business sets."

> "And it's all **provable.** Scroll the **execution trail** and there's the complete record of the case — **every rule applied, every decision, every agent and automation execution, and every human action** — timestamped, in one place."

> "You also stay in **control of the live case** — **pause it, resume it, retry a step, even migrate a running case onto a new version of the process** — without losing where it is."

> "That's what a regulated insurer needs: agents moving fast, a provable record of everything that happened, and the controls to step in whenever they want."

---

## 8:35 — Close (≈40s)

**[Stay in Maestro Case — or cut to the Maestro end card]**

> "So — in a single claim, you saw it all come together: a messy, unpredictable case, run end to end by the **Case Manager Agent**, with agents and automations doing the work, all inside the business's rules and every step on the record."

> "That's how one of the largest insurers in ANZ is reimagining claims for the agentic era on **Maestro.** And they're not alone — **customers across industries are transforming their processes by orchestrating them on Maestro.**"

*Optional hand-back (you → Raghu):* "Back to you, Raghu."

---

## Presenter cheat-sheet

**Say:** Maestro Case · the case · **Case Manager Agent** (reads the context, decides what runs next) · **context-driven activation** ("the right task at the right time") · AI at the process level *and* the task level · stages · agents/automations/people/external parties · events / "always listening" · inside the business's rules · execution trail / auditable / on the record · live-instance controls (pause / resume / retry / migrate).

**Don't say:** coded app / how the app is built · TypeScript SDK · "no lines connecting" / edges / arrows / gateways.
*(Note: there's **no separate "router"** — the Case Manager Agent itself reads the context and decides what runs next. And avoid the BPMN edges/arrows/gateways framing.)*

**The three beats to land, in order:**
1. **Complexity** — one claim is many actors, long-running, non-linear, evolves as new info arrives.
2. **Agent-led orchestration** — the **Case Manager Agent** listens for events and decides what runs next (context-driven), with **agents and automations doing the work in each task**. Intelligence runs process → task.
3. **Governed + human** — the case runs **inside the business's rules**, Dana only handles what needs **judgement** (**41 → 3**), and everything's on the record in the execution trail.

**If asked "is this real?":** live agents (LangChain, Google Vertex, UiPath) and real human/external tasks running on Maestro Case; the claim data is demo data.

**Strongest moment:** the **Case Manager Agent activating** when Dana submits the records (§5:00) — slow down there. If short on time, compress §2.
