import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import { GLASS_CLASSES } from "@/components/ui/card";
import { PageContainer } from "@/components/PageContainer";
import { CaseFacts } from "@/components/coverage/CaseFacts";
import { CustomerSection, DocumentsSection, HistorySection } from "@/components/coverage/RecordSections";
import { DecisionSection } from "@/components/coverage/decision/DecisionSection";
import { Pill, TYPE } from "@/components/coverage/primitives";
import { AssessmentPanel } from "@/components/claims/AssessmentPanel";
import { coverageFixtureFor, type CoverageFixture } from "@/lib/coverage/fixture";
import { ciActionOverlay, ciCaseOverlay } from "@/lib/coverage/caseOverlay";
import { useCoverageDecision } from "@/lib/coverage/store";
import { useRole } from "@/lib/role/useRole";
import { recordDecision, reopenDecision } from "@/lib/claims/useCases";
import type { CaseAction, InjuryClaim } from "@/lib/claims/types";
import { cn } from "@/lib/utils";
// The selection-driven capture bar, lifted out of the host that the fork of this
// screen was embedded in. Its own notes explain the gesture.
import { AddEvidenceBar } from "@/components/coverage/evidence-capture/add-evidence-bar";
import {
  fromCaptureUi,
  useScreenSelection,
} from "@/components/coverage/evidence-capture/use-screen-selection";
import { templateFor } from "@/components/coverage/evidence-capture/evidence-templates";

/**
 * THE COVERAGE DECISION, CI BUILD — behind `ciCoverageDecision`.
 *
 * One reading column, read straight down, in two open sections and three folded
 * ones: **the case** — who and what, the claim, why it reached a person, and the
 * finding established about it — then **the decision**, with the evidence it rests
 * on underneath it; then history, this claimant and the documents, folded.
 *
 * The decision used to be the fourth of seven blocks, below the evidence. It leads
 * its own section now, and the evidence sits under it — which is what puts the
 * agent's reassessment in view while the rows causing it are being edited
 * (../../components/coverage/decision/DecisionSection.tsx has the argument).
 *
 * ./DecisionConsolePage.tsx renders the previous screen, decides which of the two
 * runs, and is where the case and the action are read — so this page takes both as
 * props rather than loading them again. Off the flag, that page is unchanged and
 * nothing here is reachable.
 */
export function CoverageDecisionCiPage({
  action,
  claim,
}: {
  action: CaseAction;
  claim: InjuryClaim;
}) {
  /**
   * THE FORK'S FIGURES, and this is the only place they are applied.
   *
   * ../../lib/coverage/caseOverlay.ts says why: the screen prints the claim, the
   * ceiling and the agreement off the case and the action, and the copy it came
   * from re-authored all three. Overlaying here keeps this app's demo set — and
   * therefore every other screen — untouched.
   */
  const overlaid = useMemo(() => ciActionOverlay(action), [action]);
  const overlaidCase = useMemo(() => ciCaseOverlay(claim), [claim]);

  /**
   * Belt and braces. The host only routes here when this returns a fixture, so
   * this branch is unreachable today — but the flag is a presenter switch and the
   * URL is typeable, and a case with no evidence set should say so rather than
   * render an argument built on nothing.
   */
  const fixture = coverageFixtureFor(claim.id);
  if (!fixture) {
    return (
      <PageContainer>
        <div className="flex flex-col gap-3">
          <BackLink caseId={claim.id} />
          <p className="text-sm text-muted-foreground">
            The rebuilt decision page is authored for CLAIM-5182 only; {claim.id} has no
            evidence set yet.
          </p>
        </div>
      </PageContainer>
    );
  }

  return <Decision action={overlaid} claim={overlaidCase} fixture={fixture} />;
}

function Decision({
  action,
  claim,
  fixture,
}: {
  action: CaseAction;
  claim: InjuryClaim;
  fixture: CoverageFixture;
}) {
  const { profile } = useRole();
  const { state, dispatch, limit, claim: claimTotal, recommended, opening } = useCoverageDecision(action, fixture);
  const [notice, setNotice] = useState<string | null>(null);

  /**
   * THE RECORD IS SELECTABLE, AND A SELECTION OFFERS TO BECOME EVIDENCE.
   *
   * `record` is the scroller below, and the only region of this screen a drag
   * counts in: the dock is chrome, and half a gesture that ended in it is not
   * something to file.
   */
  const record = useRef<HTMLDivElement>(null);
const { selection, readSelection, offer, clear: clearSelection } =
    useScreenSelection(record);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 3200);
    return () => clearTimeout(t);
  }, [notice]);

  // Records and STAYS: the decision is a section of the record now, so the record
  // shows it decided rather than sending the reviewer back to the case.
  const submit = (outcome: string, reason: string) => {
    recordDecision(action, outcome, profile.name, reason);
  };

  return (
    /**
     * THE RECORD AND THE RAIL, and the rail starts collapsed.
     *
     * The screen this came from had no right-hand panel: the fork's host put its
     * assessment widget elsewhere. Here the rail is the app's own
     * (../../components/claims/AssessmentPanel.tsx), the same one the console
     * beside this page shows, and it stays available rather than being dropped on
     * the way in.
     *
     * `defaultOpen={false}` because on this screen it is the second thing, not the
     * first. The record reads straight down in one column and the decision is in
     * it; opening at 330px would push that column narrow before anybody asked a
     * question. Collapsed, it is the 44px strip the panel already draws for
     * itself, one click from the conversation.
     */
    <div className="flex h-full min-h-0">
      <div className="relative flex min-w-0 flex-1 flex-col">
        <div
          ref={record}
          /**
           * `select-text`, AND HERE IT IS BELT RATHER THAN BRACES.
           *
           * The host this came from sets `select-none` on the body — the desktop
           * convention, so dragging across the shell does not blue-wash a sidebar
           * — and there this opt-in was the whole reason a selection could happen
           * at all: without it, no selection, so no bar, and the widget would be
           * correct and permanently invisible. This app sets no such rule, so the
           * class is currently a no-op. It stays, because the day the app does
           * adopt `select-none` the gesture would otherwise die silently.
           *
           * Scoped to the scroller rather than the page, so the dock below stays
           * unselectable — its buttons and totals are not evidence.
           */
          className="min-h-0 flex-1 select-text overflow-y-auto"
          // Mouseup, not `selectionchange`: the latter fires throughout a drag, so
          // the bar would appear mid-gesture and jump with the cursor. This is the
          // moment the drag has a result.
          onMouseUp={(e) => {
            if (fromCaptureUi(e)) return;
            readSelection();
          }}
          onMouseDown={(e) => {
            // The bar lives inside this element, so its own controls must not read
            // as a click away — mousedown lands before their click does.
            if (fromCaptureUi(e)) return;
            clearSelection();
          }}
        >
          <div className="mx-auto flex max-w-[1180px] flex-col gap-6 p-6 pb-14">
            {/* THE CASE PAGE'S OWN CHROME — a back-link, then a hero card. A
                reviewer arriving here from ./CaseDetailPage.tsx lands on the
                header they have just left: the same link row and the same glass
                hero. The title is 20px where that page's is 24 — see `TYPE.page`
                in ../../components/coverage/primitives.tsx; that page's h1 is a
                claimant name and this one is a sentence.

                IT GOES BACK ONE STEP, NOT ALL THE WAY OUT. The copy this came
                from sent this link to `/cases`, which skipped the page the
                reviewer actually arrived from — the case — and made the only
                route back to it the id in the title. Now it is the same
                breadcrumb the console beside this screen draws
                (./DecisionConsolePage.tsx): the chevron and the case id, back to
                the record this decision belongs to. */}
            <Link
              to="/cases/$caseId"
              params={{ caseId: claim.id }}
              className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
            >
              <ChevronLeft className="size-4" /> {claim.id}
            </Link>

            <header className={cn(...GLASS_CLASSES, "flex flex-wrap items-center gap-x-10 gap-y-4 p-6")}>
              {/* THE CASE ID IS IN THE TITLE, AND IT IS STILL THE LINK.
                  It was printed twice — as the row's right-hand link above, and
                  again in a 12px line under the title next to the claimant name —
                  and the claimant name was a third copy, since `CaseFacts` states
                  it as the first fact of the card directly below. So the sub-line
                  went whole, and the id moved up into the name of the thing it
                  identifies.

                  It stays an anchor rather than becoming text: that link is the
                  one-click route back to the case record, and dropping the row's
                  copy would otherwise have removed it. Mono and
                  `text-muted-foreground` so it reads as a reference beside the
                  title rather than as part of the sentence, and no underline —
                  colour-on-hover is how every other link in this app is drawn.

                  12px, down from 15: against a 20px title a 15px id was close
                  enough in size to read as a second half of the headline, and 15
                  is a rung nothing else on the page has. At 12 it matches the meta
                  line in the card below and reads as what it is. */}
              <h1 className={cn(TYPE.page, "mr-auto min-w-0")}>
                {action.title}
                <span className="text-muted-foreground"> · </span>
                <Link
                  to="/cases/$caseId"
                  params={{ caseId: claim.id }}
                  title={`Open case ${claim.id}`}
                  className="font-mono text-xs font-medium text-muted-foreground hover:text-foreground"
                >
                  {claim.id}
                </Link>
              </h1>

              {/* THE THREE READINGS ON ONE LINE, WITH NO CAPTIONS.
                  They were label-over-value `Meta` columns — "Status" over a pill
                  reading "Action required", "Stage" over one reading "Resolution
                  decision", "SLA" over the time left. Every one of those captions
                  names what its own value already says, and between them they cost
                  the header a whole line.

                  The hairline sits before the SLA and nowhere else, because that is
                  the one seam that matters here: the two pills are states the case
                  is IN, and the time left is a reading that is still moving. */}
              <div className="flex flex-wrap items-center gap-2.5 text-sm font-medium">
                <Pill tone={action.status === "Completed" ? "ok" : "warn"}>
                  {action.status === "Completed" ? "Decided" : "Action required"}
                </Pill>
                <Pill tone="info">{action.stage}</Pill>
                <span aria-hidden className="h-4 w-px shrink-0 bg-border" />
                <SlaChip slaMinutes={action.slaMinutes} elapsedMinutes={action.elapsedMinutes} />
              </div>
            </header>

            {/* TWO SECTIONS, NOT THREE — and the seam moved rather than closed.
                `CaseFacts` carries the finding (the case, and what was established
                about it); `DecisionSection` carries the evidence under the decision
                it feeds. `CaseInfo`, which used to band the finding and the
                evidence together between them, is gone — each of those two halves
                is now inside the card whose subject it belongs to, and each still
                owns its own band, rows, state and dispatch. */}
            <CaseFacts action={action} claim={claim} />
            <DecisionSection
              action={action}
              state={state}
              dispatch={dispatch}
              limit={limit}
              claim={claimTotal}
              recommended={recommended}
              opening={opening}
              deciderName={profile.name}
              onSubmit={submit}
              onReopen={() => reopenDecision(action.id)}
              onMoreAction={(id) => setNotice(`${id.replace(/-/g, " ")} — not wired in this build yet.`)}
            />
            {/* THE SECOND WAY IN. `offer` hands the hook a selection nobody dragged —
                the row's own text and rect — so the bar, the reading lookup and the
                commit below are the same code path a drag takes. Only this section
                gets it: `customer` is the only source with a reading. */}
            <CustomerSection
              claim={claim}
              history={fixture.history}
              onCapture={offer}
            />
            {/* UNDER THE CLAIMANT, NOT OVER IT. Both answer "what else should weigh
                on this", and they are not the same rank: this case's own account is
                the nearer fact, and other people's cases qualify it. Reading the
                precedent first made the claimant's record land as a footnote to
                cases that are not theirs. */}
            <HistorySection caseId={claim.id} />
            <DocumentsSection caseId={claim.id} />
          </div>
        </div>

        {/* INERT ON PURPOSE, for now. The bar is real, the gesture is real, and the
            commit is a no-op until the evidence list is ready to receive one — the
            v3 store already has an `evidence.add` action, and connecting this is
            giving that action a payload and dispatching it here. A placeholder row
            appearing in the list would claim something was recorded. */}
        {selection && (
          <AddEvidenceBar
            // Keyed on the text, so a new drag is a new bar and its half-typed
            // title cannot follow the reader to a different passage. The
            // component's own note explains why this is a key and not an effect.
            key={selection.text}
            selection={selection}
            /**
             * RIGHT-ANCHORED FOR A ROW, CENTRED FOR A DRAG — and the test is which
             * one produced the subject.
             *
             * A drag's rect is the run of words themselves, and the bar belongs over
             * the middle of them. A row's rect is the whole row, so centring puts the
             * panel in the middle of the card when the button that opened it was at
             * the right edge — which reads as some other control answering.
             */
            align={selection.via === "row" ? "right" : "center"}
            // And a row press is already the request, so the bar opens on the field
            // rather than on the question a drag still has to be asked.
            openComposed={selection.via === "row"}
            /**
             * COMMIT — the title is the reader's, the reading is the section's.
             *
             * `templateFor` answers whether the part of the record they dragged
             * across produces evidence at all
             * (../../../../../_components/evidence-capture/evidence-templates.ts).
             * The claimant section does; nothing else does yet, and a selection there
             * says so rather than failing silently — a demo where a control
             * occasionally does nothing invisibly is worse than one where it says it
             * did nothing.
             *
             * `addedByReviewer` is what makes the row the reviewer's: it earns the
             * chip and the row's own edit and remove actions, which the agent's three
             * items deliberately do not have.
             *
             * Nothing here persists. The store is a `useReducer` with no storage
             * behind it, so a refresh puts the list back to the fixture's three — by
             * design, and the reason this is safe to demo repeatedly.
             */
            onAdd={(_text, title) => {
              const template = templateFor(selection.source);
              if (!template) {
                setNotice("Only This claimant can be filed as evidence.");
                return;
              }
              dispatch({
                type: "evidence.create",
                item: {
                  // The typed line, verbatim. It is the one judgement in the gesture.
                  name: title,
                  note: template.note,
                  // Neither part of the composer was filled in, and an added item is
                  // not required to argue for a line of the claim.
                  backs: null,
                  sources: [],
                  importance: template.importance,
                  call: template.call,
                  addedByReviewer: true,
                },
              });
            }}
            onDismiss={clearSelection}
          />
        )}

        {notice && (
          <div
            role="status"
            className="absolute right-4 bottom-4 z-30 rounded-lg border border-border bg-card px-3 py-2 text-xs text-muted-foreground shadow-md first-letter:uppercase"
          >
            {notice}
          </div>
        )}
      </div>

      <AssessmentPanel
        action={action}
        claim={claim}
        // The rail is a conversation about a specific call, so it has to know
        // which one is on the table. On the console that is the decision card's
        // selection; here the position lives in the coverage store.
        position={state.resolution}
        defaultOpen={false}
      />
    </div>
  );
}

/**
 * Label over value, copied from ../cases/CaseDetailPage.tsx.
 *
 * A copy rather than an import: it is six lines, it is private there, and lifting
 * it into a shared module would be a change to a file this page has no other
 * reason to touch. If a third caller appears it should move.
 */
function BackLink({ caseId }: { caseId: string }) {
  return (
    <Link
      to="/cases/$caseId"
      params={{ caseId }}
      className="inline-flex h-7 items-center gap-1 rounded-md px-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
    >
      <ChevronLeft className="size-3.5" /> Back
    </Link>
  );
}

/**
 * Time left on the SLA, with a ring that fills as it is spent.
 *
 * "2h 13m left" is what a reviewer needs; "SLA 4 hr" is what the system knows, and
 * it stays on the `title`. The ring is a conic gradient off the theme's primary, so
 * it needs no extra token; past the budget it turns destructive and the label says
 * how far over.
 *
 * **It is a bare value on the header's reading line, not a chip.** It used to carry
 * its own border, card background, height and inline "SLA" caption — a bordered
 * widget in a header that has no other bordered widget in it — and then a `Meta`
 * caption above it. Both are gone; the ring and the reading, which are the two
 * things it actually says, are unchanged.
 *
 * **The word "SLA" now appears only on the `title`**, which is the one thing the
 * caption was carrying that the value does not: "2h 13m left" says what is left,
 * and hovering says what it is left OF.
 */
function SlaChip({ slaMinutes, elapsedMinutes }: { slaMinutes: number; elapsedMinutes: number }) {
  const left = slaMinutes - elapsedMinutes;
  const over = left < 0;
  const pct = Math.min(100, Math.max(0, (elapsedMinutes / slaMinutes) * 100));
  const abs = Math.abs(left);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  const text = `${h > 0 ? `${h}h ` : ""}${m}m ${over ? "over" : "left"}`;
  return (
    <span
      className="inline-flex items-center gap-2"
      title={`SLA ${Math.round(slaMinutes / 60)} hr`}
    >
      <span
        aria-hidden
        className="relative size-4 shrink-0 rounded-full"
        style={{
          background: `conic-gradient(var(${over ? "--destructive" : "--primary"}) ${pct}%, var(--muted) ${pct}% 100%)`,
        }}
      >
        <span className="absolute inset-[3px] rounded-full bg-card" />
      </span>
      <span className={cn("tabular-nums", over && "text-destructive")}>{text}</span>
    </span>
  );
}
