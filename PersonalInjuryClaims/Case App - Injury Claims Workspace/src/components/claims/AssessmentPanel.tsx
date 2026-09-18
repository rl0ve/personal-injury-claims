import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowUp,
  PanelRightClose,
  PanelRightOpen,
  PanelRight,
} from "lucide-react";
import { AiMark } from "@/components/ui/ai-mark";
import { AgentMarkdown } from "@/components/claims/AgentMarkdown";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Label } from "@/components/claims/CoverageConsole";
import {
  EvidenceSection,
  PrecedentSection,
  type SignalVerdict,
} from "@/components/claims/AssessmentSignals";
import { splitFor } from "@/lib/claims/costSplit";
import { caseIdentifiers } from "@/services/uipath/assistantService";
import { REASONING_OPTIONS } from "@/lib/claims/demoData";
import { initialsOf, money, moneyExact, timeOnly } from "@/lib/claims/format";
import { useRole } from "@/lib/role/useRole";
import { askAgent, localAnswer } from "@/services/uipath/assistantService";
import { isAssistantConfigured } from "@/services/uipath/config";
import { useUiPath } from "@/services/uipath/UiPathProvider";
import type {
  CaseAction,
  SuggestedReply,
  InjuryClaim,
} from "@/lib/claims/types";

// The "Ask about this case" rail.
//
// The component keeps its Assessment name, as does the `rightPanel` state and
// the localStorage key behind it, which would strand everyone's saved panel
// choice if renamed. Only what a reader sees has changed.
//
// A conversation, not a widget: it opens with the agent's recommendation and the
// reasoning behind it, and the signer's verdict on that reasoning lands in the
// same thread as a reply. That is deliberate: the point of the screen is that
// the reasoning is discussable, and what the person says back is the record.
//
// It never decides. Decision controls live in the decision card only.

interface Message {
  id: string;
  from: "agent" | "user";
  text: string;
  time: string;
  /** Tints the bubble amber for the agent flagging a departure, not answering. */
  tone?: "warning";
}

const REPLY_KIND_LABEL: Record<SuggestedReply["kind"], string> = {
  disagree: "Disagree",
  "missing-context": "Missing context",
  "ask-back": "Ask back",
  agree: "Agree",
};

/**
 * What moving off the recommendation costs, in one clause.
 *
 * Derived from the split rather than authored per option, so it stays true if
 * the claim's lines change: a position that leaves nothing with us is described
 * as putting the whole claim on the claimant, and the reverse, and anything in
 * between reads as the two totals it actually produces.
 */
function departureClause(action: CaseAction, outcome: string): string {
  const option = action.options.find((o) => o.outcome === outcome);
  const split = splitFor(action, option);
  if (split.vendorTotal === 0) {
    return `puts the whole ${moneyExact(split.customerTotal)} on the claimant`;
  }
  if (split.customerTotal === 0) {
    return `puts the whole ${moneyExact(split.vendorTotal)} on us`;
  }
  return `moves us to ${moneyExact(split.vendorTotal)} and the claimant to ${moneyExact(
    split.customerTotal,
  )}`;
}

/** The recommendation, with a segmented confidence meter. */
function RecommendationCard({ action }: { action: CaseAction }) {
  const pct = action.confidencePercent ?? 0;
  const filled = Math.round(pct / 10);

  return (
    <div className="mb-2 rounded-lg border border-border bg-card px-2.5 py-2">
      <Label>Recommendation</Label>
      <p className="mt-0.5 text-[13px] font-semibold leading-snug">
        {action.recommendation.headline}
      </p>

      <div className="mt-2 flex items-center gap-2.5">
        <span className="flex shrink-0 items-start gap-px leading-none">
          <span className="text-[31px] font-bold tracking-tight text-primary tabular-nums">
            {pct}
          </span>
          <span className="mt-1 text-[13px] font-bold text-primary">%</span>
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex h-2.5 items-stretch gap-[2px]" aria-hidden>
            {Array.from({ length: 10 }, (_, i) => (
              <i
                key={i}
                className={cn(
                  "flex-1 rounded-[1.5px]",
                  i < filled ? "bg-primary" : "bg-muted",
                )}
              />
            ))}
          </span>
          <span className="mt-1 block text-[8.5px] font-semibold uppercase tracking-widest text-muted-foreground">
            Confidence
          </span>
        </span>
      </div>
    </div>
  );
}

function Bubble({
  message,
  children,
}: {
  message: Message;
  children?: React.ReactNode;
}) {
  const { profile } = useRole();
  const fromAgent = message.from === "agent";

  return (
    <div
      className={cn(
        "flex items-start gap-1.5",
        fromAgent ? "flex-row" : "flex-row-reverse",
      )}
    >
      <span
        className={cn(
          "mt-0.5 grid size-5 shrink-0 place-items-center rounded-full text-[9px] font-semibold",
          fromAgent
            ? "bg-primary/15 text-primary"
            : "bg-muted text-muted-foreground",
        )}
      >
        {fromAgent ? <AiMark className="size-3" /> : initialsOf(profile.name)}
      </span>
      <div
        className={cn(
          "flex min-w-0 max-w-[85%] flex-col gap-0.5",
          !fromAgent && "items-end",
        )}
      >
        <div
          className={cn(
            "min-w-0 rounded-xl px-2.5 py-1.5 text-[12.5px] leading-relaxed",
            fromAgent
              ? "rounded-tl-sm bg-muted text-foreground"
              : "rounded-tr-sm border border-border bg-card",
            message.tone === "warning" &&
              "border border-warning/40 bg-warning/10 text-foreground",
          )}
        >
          {children}
          {/* The agent answers in Markdown; the reader types plain text, and
              running their own words through a renderer would eat an asterisk
              or a hash they meant literally. */}
          {fromAgent ? (
            <AgentMarkdown>{message.text}</AgentMarkdown>
          ) : (
            <span className="whitespace-pre-line">{message.text}</span>
          )}
        </div>
        <span className="px-1 text-[10px] leading-none text-muted-foreground">
          {message.time}
        </span>
      </div>
    </div>
  );
}

export function AssessmentPanel({
  action,
  claim,
  onClose,
  onShowCase,
  position,
  defaultOpen = true,
}: {
  action: CaseAction;
  claim: InjuryClaim;
  /** When set, the host owns open/closed and the panel's own strip is dropped. */
  onClose?: () => void;
  /**
   * Start collapsed to the rail rather than open.
   *
   * Open is the right default on the console, where the rail is one of the two
   * things on the screen. On a page that reads as a single column it is the
   * second thing, and opening at 330px narrows the column before anybody asked a
   * question — so that page passes `false` and the reader opens it themselves.
   *
   * Ignored when `onClose` is set, since the host owns open/closed then.
   */
  defaultOpen?: boolean;
  /** Swap this panel for the case details. They share one column. */
  onShowCase?: () => void;
  /**
   * The coverage position currently selected in the decision card.
   *
   * The rail is a conversation about a specific call, so it has to know which
   * one is on the table: moving off the recommendation is the moment worth
   * saying something about, and what is worth saying differs by where you moved
   * to. Absent, the rail stays a plain assessment.
   */
  position?: string;
}) {
  const { sdk, isAuthenticated } = useUiPath();
  const canUseAgent =
    isAssistantConfigured() && isAuthenticated && Boolean(sdk);

  const hostControlled = Boolean(onClose);
  const [open, setOpen] = useState(defaultOpen);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);
  const [replies, setReplies] = useState<Message[]>([]);
  const [verdicts, setVerdicts] = useState<Record<string, SignalVerdict>>({});
  const [usedReplies, setUsedReplies] = useState<string[]>([]);
  /** Why the last question fell back to the local answer, if it did. */
  const [agentError, setAgentError] = useState<string | null>(null);

  const recommended = action.recommendation.recommendedOutcome;
  const departed = Boolean(position) && position !== recommended;

  /**
   * The agent's standing line about the position on the table.
   *
   * Not appended to the thread: it is the agent's current stance, so moving the
   * position again replaces it rather than stacking another paragraph. Anything
   * the reader actually said stays in the thread above it.
   */
  const stance = useMemo<Message | null>(() => {
    if (!position) return null;
    if (!departed) {
      return {
        id: "stance-agreed",
        from: "agent",
        text: "I've preselected it. Review and submit, or change the position.",
        time: "Now",
      };
    }
    // The option's label, not its outcome code: the rail is talking, and
    // "you've moved to denied" is not a sentence anyone says.
    const option = action.options.find((o) => o.outcome === position);
    const title = option?.label ?? option?.outcome ?? "another position";
    return {
      id: `stance-${position}`,
      from: "agent",
      tone: "warning",
      text: `You've moved to ${title.toLowerCase()}, which ${departureClause(
        action,
        position,
      )}. That's a different call from mine, and the reason matters more than the change does, and it's what I'd learn from. What did I get wrong?`,
      time: "Now",
    };
  }, [action, position, departed]);

  /**
   * Replies worth offering here. Filtered by position, since an objection to a denial
   * is not an objection to full coverage, and spent once used, so the rail does
   * not keep offering something already said.
   */
  const offered = useMemo(
    () =>
      (action.replies ?? []).filter(
        (r) =>
          !usedReplies.includes(r.id) &&
          (!r.forOptions ||
            (position ? r.forOptions.includes(position) : false)),
      ),
    [action.replies, usedReplies, position],
  );

  // The agent's answer to a moved position is the point of moving it, and it
  // lands at the bottom of a thread that is usually already taller than the
  // rail. Without this the reader changes the position and sees nothing happen.
  const threadRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = threadRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [replies.length, stance?.id]);

  function pickReply(reply: SuggestedReply) {
    setUsedReplies((used) => [...used, reply.id]);
    setReplies((r) => [
      ...r,
      { id: `q-${reply.id}`, from: "user", text: reply.body, time: "Just now" },
      { id: `a-${reply.id}`, from: "agent", text: reply.answer, time: "Now" },
    ]);
  }

  // The opening turn is the assessment itself, so the rail reads as the agent
  // having already said its piece before the person arrived.
  const opening = useMemo<Message>(
    () => ({
      id: "assessment",
      from: "agent",
      text: action.recommendation.detail,
      time: timeOnly(new Date(Date.now() - 40 * 60_000).toISOString()),
    }),
    [action.recommendation.detail],
  );

  // A recorded reasoning verdict joins the thread as the person's own reply,
  // followed by what recording it actually did.
  const verdictMessages = useMemo<Message[]>(() => {
    if (!action.completedReasoning) return [];
    const option = REASONING_OPTIONS.find(
      (o) => o.value === action.completedReasoning,
    );
    if (!option) return [];
    return [
      { id: "verdict", from: "user", text: option.label, time: "Just now" },
      { id: "verdict-effect", from: "agent", text: option.effect, time: "Now" },
    ];
  }, [action.completedReasoning]);

  async function send(text: string) {
    const question = text.trim();
    if (!question || pending) return;

    const asked: Message = {
      id: `q-${Date.now()}`,
      from: "user",
      text: question,
      time: "Just now",
    };
    setReplies((r) => [...r, asked]);
    setDraft("");
    setPending(true);

    // The reply lands as an empty bubble that fills as the agent streams into
    // it. Waiting for the whole answer would leave the rail blank for seconds on
    // a question the agent is already answering.
    const replyId = `a-${Date.now()}`;
    const stream = (soFar: string) =>
      setReplies((r) =>
        r.some((m) => m.id === replyId)
          ? r.map((m) => (m.id === replyId ? { ...m, text: soFar } : m))
          : [...r, { id: replyId, from: "agent", text: soFar, time: "Now" }],
      );

    setAgentError(null);
    try {
      const answer = canUseAgent
        ? await askAgent(sdk!, question, {
            threadKey: `${claim.id}:${action.actionType}`,
            identifiers: caseIdentifiers(claim),
            seedContext:
              `${claim.id}, ${claim.customer}, ${claim.site}. ` +
              `${claim.description}. In ${claim.currentStage}, ` +
              `${money(claim.claimValue)} claimed. The open decision is ` +
              `"${action.title}"; the agent recommends ` +
              `${action.recommendation.recommendedOutcome}.`,
            onChunk: stream,
          }).catch((err: unknown) => {
            // Surfaced, not swallowed. Every failure used to look identical from
            // the outside, all of it "it didn't work", with the reason only in a console
            // nobody has open during a demo.
            const why =
              err instanceof Error ? err.message : "the agent was unreachable";
            console.warn(
              "Conversational agent unavailable, answering locally:",
              err,
            );
            setAgentError(why);
            return localAnswer(question, claim);
          })
        : localAnswer(question, claim);

      // Settles the bubble on the final text, which also replaces whatever a
      // half-streamed answer left behind when the agent dropped mid-sentence.
      stream(answer);
    } finally {
      // In a finally so a throw anywhere above cannot leave the composer
      // disabled. A stuck `pending` presents as clicking doing nothing at all,
      // which is the least diagnosable failure this panel has.
      setPending(false);
    }
  }

  if (!hostControlled && !open) {
    return (
      <div className="shrink-0 border-l border-border">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Ask about this case"
          title="Ask about this case"
          className="flex h-full w-11 flex-col items-center py-4 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <PanelRightOpen className="size-4" />
        </button>
      </div>
    );
  }

  return (
    // Labelled as a region, so the controls inside it can say what they do
    // ("Hide") without repeating the panel's name to reach an accessible one.
    <aside
      aria-label="Ask about this case"
      className="flex min-h-0 w-full shrink-0 flex-col overflow-hidden border-l border-border bg-background sm:w-[330px]"
    >
      <div className="flex h-10 shrink-0 items-center gap-1 border-b border-border px-3">
        <span className="min-w-0 flex-1 truncate text-sm font-medium">
          Ask about this case
        </span>
        {/* The two panels share this column, so switching between them is one
            click rather than close-then-open. */}
        {onShowCase && (
          <button
            type="button"
            onClick={onShowCase}
            aria-label="Show case details"
            title="Show case details"
            className="grid size-7 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <PanelRight className="size-4" />
          </button>
        )}
        <button
          type="button"
          onClick={() => (onClose ? onClose() : setOpen(false))}
          aria-label="Hide"
          className="grid size-7 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <PanelRightClose className="size-4" />
        </button>
      </div>

      <div ref={threadRef} className="min-h-0 flex-1 overflow-y-auto p-2.5">
        <div className="flex flex-col gap-2">
          <Bubble message={opening}>
            <RecommendationCard action={action} />
          </Bubble>

          {/* The two rollups, opened. Each was a one-line count before, which
              told the reader a number existed without giving them anything they
              could take issue with. */}
          <div className="ml-6 flex flex-col">
            {action.signals?.length ? (
              <EvidenceSection
                signals={action.signals}
                verdicts={verdicts}
                onVerdict={(id, v) =>
                  setVerdicts((prev) =>
                    // Clicking the same thumb again clears it, because a verdict you
                    // cannot take back is one people stop giving honestly.
                    prev[id] === v
                      ? Object.fromEntries(
                          Object.entries(prev).filter(([k]) => k !== id),
                        )
                      : { ...prev, [id]: v },
                  )
                }
              />
            ) : null}
            {action.precedentBreakdown?.length ? (
              <PrecedentSection
                slices={action.precedentBreakdown}
                basis={action.precedentBasis}
                recommended={recommended}
              />
            ) : null}
          </div>

          {verdictMessages.map((message) => (
            <Bubble key={message.id} message={message} />
          ))}
          {replies.map((message) => (
            <Bubble key={message.id} message={message} />
          ))}
          {/* The agent's current stance sits last: it answers the position on
              the table now, so it is replaced when that moves, not stacked. */}
          {stance && <Bubble message={stance} />}
          {pending && (
            <div className="ml-6 text-[12.5px] text-muted-foreground">
              Thinking…
            </div>
          )}
        </div>
      </div>

      {offered.length > 0 && (
        <div className="shrink-0 border-t border-border px-2.5 pt-2">
          <div className="flex flex-wrap gap-1">
            {offered.map((reply) => (
              <button
                key={reply.id}
                type="button"
                onClick={() => pickReply(reply)}
                className="flex max-w-full items-baseline gap-1.5 rounded-md border border-border px-1.5 py-1 text-left text-[11px] transition-colors hover:bg-muted"
              >
                <span className="shrink-0 text-[8.5px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {REPLY_KIND_LABEL[reply.kind]}
                </span>
                <span className="min-w-0 truncate">{reply.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="shrink-0 border-t border-border p-2.5">
        {agentError && (
          <p className="mb-2 rounded-md bg-warning/10 px-2 py-1.5 text-[10px] leading-snug text-warning-foreground">
            <b className="font-semibold">Answered from case context.</b> The
            agent could not: {agentError}
          </p>
        )}
        {!canUseAgent && (
          <p className="mb-2 text-[10px] leading-snug text-muted-foreground">
            {/* Says which of the two reasons applies. It used to tell you to
                set env vars that may well already be set, which sends a reader
                to a file to fix something that is not broken. */}
            Answering from case context.{" "}
            {isAssistantConfigured()
              ? "sign in to UiPath to ask the conversational agent."
              : "no conversational agent is configured."}
          </p>
        )}
        <div className="relative">
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && void send(draft)}
            placeholder="Ask about this case…"
            className="h-10 rounded-lg pr-11 text-sm"
          />
          <button
            type="button"
            aria-label="Send"
            onClick={() => void send(draft)}
            className="absolute right-2 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-md text-white transition-opacity hover:opacity-90 [background-image:var(--ai-gradient)]"
          >
            <ArrowUp className="size-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
