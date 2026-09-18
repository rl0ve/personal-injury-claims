import { Suspense, lazy, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "@tanstack/react-router";
import { ChevronLeft, CircleAlert, Clock } from "lucide-react";
import { AiMark } from "@/components/ui/ai-mark";
import { Card } from "@/components/ui/card";
import { PageContainer } from "@/components/PageContainer";
import { AssessmentPanel } from "@/components/claims/AssessmentPanel";
import {
  CaseBanner,
  ConsoleHeader,
  DetailFolds,
  FindingCauses,
} from "@/components/claims/CoverageConsole";
import { DecisionConsoleSkeleton } from "@/components/claims/CaseSkeletons";
import { CoverageDecisionCard } from "@/components/claims/CoverageDecisionCard";
import { DecisionForm } from "@/components/claims/DecisionForm";
import { EvidenceList, HelpfulToggle } from "@/components/claims/EvidenceList";
import { PriorityBadge, SlaBadge } from "@/components/claims/badges";
import { money, timeOnly } from "@/lib/claims/format";
import { formatElapsed, formatSlaBudget, slaStatusFor } from "@/lib/claims/sla";
import {
  markEvidenceHelpful,
  reopenDecision,
  useAction,
  useCase,
} from "@/lib/claims/useCases";
import type { CaseAction, InjuryClaim } from "@/lib/claims/types";
import { useFlags } from "@/lib/flags";
import { coverageFixtureFor } from "@/lib/coverage/fixture";

/**
 * THE CI BUILD OF THIS SCREEN, behind `ciCoverageDecision`.
 *
 * LAZY, and the reason is weight rather than taste: the rebuilt screen pulls in
 * its own component tree, its reducer and its fixture — some eight thousand lines
 * that nothing else in the app imports. Split out, none of it is fetched until
 * somebody opens the one URL it serves.
 */
const CoverageDecisionCiPage = lazy(() =>
  import("@/pages/cases/CoverageDecisionCiPage").then((m) => ({
    default: m.CoverageDecisionCiPage,
  })),
);

// The decision console.
//
// Two shapes, chosen by the action itself. An action carrying `causes`, meaning a
// combined-cause coverage decision, gets the full console: the finding open, the
// supporting record folded, the money split by cause, and the signer's limit.
// Everything else gets the plain layout: why it reached you, the evidence, and
// the decision form.
//
// The constraint that holds in both: the Assessment rail never decides. Decision
// controls appear in the decision card and nowhere else.

// ── The plain layout, for actions with no combined-cause finding ────────────

function HeaderFact({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <span className="text-xs font-light text-muted-foreground">{label}</span>
      {/* Wraps rather than truncates: the policy number and the cover term are the
          facts the decision turns on, so an ellipsis would hide the argument. */}
      <span className="text-sm font-medium break-words">{value}</span>
    </div>
  );
}

function SignalCaptureRail({
  action,
  claim,
  note,
  onNote,
}: {
  action: CaseAction;
  claim: InjuryClaim;
  note: string;
  onNote: (value: string) => void;
}) {
  return (
    <aside className="flex w-full shrink-0 flex-col gap-4 xl:w-[340px]">
      <Card className="gap-3 border-transparent p-5 ring-1 ring-inset ring-insight-400/40">
        <div className="flex items-center gap-2">
          <span className="grid size-5 place-items-center rounded-full text-white [background-image:var(--ai-gradient)]">
            <AiMark className="size-3" />
          </span>
          <span className="text-sm font-semibold">Signal capture</span>
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium">Was this evidence useful?</span>
          <ul className="flex flex-col gap-1.5">
            {claim.evidence.map((document) => (
              <li
                key={document.id}
                className="flex items-center gap-2 rounded-lg border border-border p-2.5"
              >
                <span className="min-w-0 flex-1 text-sm">{document.title}</span>
                <HelpfulToggle
                  value={document.helpful}
                  onChange={(next) => markEvidenceHelpful(claim, document.id, next)}
                />
              </li>
            ))}
          </ul>
        </div>

        {action.peerContext && (
          <p className="rounded-lg bg-muted/60 p-3 text-xs leading-relaxed text-muted-foreground">
            {action.peerContext}
          </p>
        )}

        <div className="flex flex-col gap-1.5">
          <label htmlFor="signal-note" className="text-sm font-medium">
            Anything the buttons missed?
          </label>
          <textarea
            id="signal-note"
            value={note}
            onChange={(e) => onNote(e.target.value)}
            rows={3}
            placeholder="Optional, free text, holds nothing up."
            className="w-full resize-y rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30"
          />
        </div>

        <div className="border-t border-border pt-3">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Captured automatically
          </span>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            Which evidence was opened and for how long, whether the recommendation was changed, and
            time to decide.
          </p>
          <p className="mt-2 text-[11px] uppercase tracking-wide text-muted-foreground/80">
            Non-blocking · written to the decision ledger
          </p>
        </div>
      </Card>
    </aside>
  );
}

function PlainConsole({
  action,
  claim,
  onCompleted,
}: {
  action: CaseAction;
  claim: InjuryClaim;
  onCompleted: () => void;
}) {
  const [note, setNote] = useState("");
  const slaStatus = slaStatusFor(action.elapsedMinutes, action.slaMinutes);

  return (
    <div className="flex flex-col gap-6">
      <Card className="gap-4 p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-semibold">{claim.id}</h1>
              {action.blocking && (
                <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">
                  <CircleAlert className="size-3" />
                  Blocking
                </span>
              )}
              <PriorityBadge priority={action.priority} />
              <span className="text-xs text-muted-foreground">Due {timeOnly(action.dueAt)}</span>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{action.stage}</p>
          </div>

          <div className="flex items-center gap-3">
            <SlaBadge status={slaStatus} />
            <span className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-muted-foreground tabular-nums">
              <Clock className="size-3.5" />
              {formatSlaBudget(action.slaMinutes)} · {formatElapsed(action.elapsedMinutes)}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-x-8 gap-y-4 border-t border-border pt-4 sm:grid-cols-3 2xl:grid-cols-6">
          <HeaderFact label="Claimant" value={claim.customer} />
          <HeaderFact label="Incident location" value={claim.site} />
          <HeaderFact
            label="Policy"
            value={`${claim.asset.model} · No. ${claim.asset.serial}`}
          />
          <HeaderFact label="Claim value" value={money(claim.claimValue)} />
        </div>
      </Card>

      <div className="flex flex-col gap-6 xl:flex-row">
        <div className="flex min-w-0 flex-1 flex-col gap-6">
          <Card className="gap-2 p-5">
            <span className="text-base font-semibold">Why this reached you</span>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {action.whyThisReachedYou}
            </p>
          </Card>

          <div className="flex flex-col gap-2">
            <span className="text-base font-semibold">Evidence</span>
            <EvidenceList documents={claim.evidence} defaultOpenFirst />
          </div>

          <DecisionForm
            action={action}
            claim={claim}
            extraData={{ note }}
            onCompleted={onCompleted}
          />
        </div>

        <SignalCaptureRail
          action={action}
          claim={claim}
          note={note}
          onNote={setNote}
        />
      </div>
    </div>
  );
}

// ── The page ────────────────────────────────────────────────────────────────

export function DecisionConsolePage() {
  const { caseId, taskId } = useParams({ strict: false }) as { caseId: string; taskId: string };
  const { action, isLoading: actionLoading } = useAction(taskId);
  const { claim, isLoading: caseLoading } = useCase(caseId);
  const navigate = useNavigate();
  const flags = useFlags();

  // Only the departure is state; the recommendation is the resting value. Held
  // here because the assessment rail answers the position as well as the
  // decision card setting it. See CoverageDecisionCard's `position` prop.
  const [chosen, setChosen] = useState<string | null>(null);
  useEffect(() => setChosen(null), [taskId]);

  // Same distinction as the case page: still arriving, versus not there.
  if ((actionLoading || caseLoading) && (!action || !claim)) {
    return <DecisionConsoleSkeleton />;
  }

  if (!action || !claim) {
    return (
      <PageContainer>
        <div className="flex flex-col gap-3">
          <Link
            to="/cases"
            className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft className="size-4" /> Work queue
          </Link>
          <p className="text-sm text-muted-foreground">
            No open decision {taskId} on case {caseId}.
          </p>
        </div>
      </PageContainer>
    );
  }

  /**
   * THE FLAG, AND THE CASE, AND BOTH HAVE TO HOLD.
   *
   * Below the loading and not-found guards, so the two screens share them and
   * arrive with a case and an action already in hand.
   *
   * `coverageFixtureFor` authors CLAIM-5182 and returns null for every other
   * case, so a flag-ON app still shows the console below on the rest of the queue
   * rather than a page apologising for having no evidence set. Off the flag,
   * nothing changes at all.
   */
  if (flags.ciCoverageDecision && coverageFixtureFor(caseId)) {
    return (
      <Suspense fallback={<DecisionConsoleSkeleton />}>
        <CoverageDecisionCiPage action={action} claim={claim} />
      </Suspense>
    );
  }

  const position = chosen ?? action.recommendation.recommendedOutcome;
  const setPosition = setChosen;

  const back = () => void navigate({ to: "/cases/$caseId", params: { caseId: claim.id } });
  const rich = Boolean(action.causes?.length);

  const breadcrumb = (
    <Link
      to="/cases/$caseId"
      params={{ caseId }}
      className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
    >
      <ChevronLeft className="size-4" /> {caseId}
    </Link>
  );

  if (!rich) {
    return (
      <PageContainer>
        <div className="flex flex-col gap-6">
          {breadcrumb}
          <PlainConsole action={action} claim={claim} onCompleted={back} />
        </div>
      </PageContainer>
    );
  }

  return (
    <div className="flex h-full min-h-0">
      <div className="min-w-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex max-w-[1460px] flex-col gap-4 px-5 py-5">
          {breadcrumb}
          <ConsoleHeader action={action} claim={claim} />

          {/* The reading column and the deciding column. The decision card is
              sticky so the position, the split and the limit stay in view while
              the record beside it is read. */}
          <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
            <div className="flex min-w-0 flex-col gap-3 pb-10">
              <CaseBanner action={action} claim={claim} />
              <FindingCauses action={action} />
              <DetailFolds action={action} claim={claim} />

              {/* The documents the finding rests on. The folds above summarise
                  what they say; this is where you open one and check. */}
              {claim.evidence.length > 0 && (
                <div className="flex flex-col gap-2 pt-1">
                  <div className="flex items-baseline gap-2">
                    <span className="text-sm font-semibold">
                      Evidence · {claim.evidence.length}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      Open a document to see the page and what was read off it
                    </span>
                  </div>
                  <EvidenceList
                    documents={claim.evidence}
                    onHelpful={(evidenceId, helpful) =>
                      markEvidenceHelpful(claim, evidenceId, helpful)
                    }
                  />
                </div>
              )}
            </div>

            <div className="xl:sticky xl:top-4">
              <CoverageDecisionCard
                action={action}
                claim={claim}
                onCompleted={back}
                onReopen={() => reopenDecision(action.id)}
                position={position}
                onPositionChange={setPosition}
              />
            </div>
          </div>
        </div>
      </div>

      <AssessmentPanel action={action} claim={claim} position={position} />
    </div>
  );
}
