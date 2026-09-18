import { useState } from "react";
import { ChevronDown, ThumbsDown, ThumbsUp } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AgentSignal, PrecedentSlice } from "@/lib/claims/types";

// The two rollups the assessment argues from, opened rather than summarised.
//
// Both were one-line counts before ("5 signals · 3 high", "60% agree") which
// told the reader a number was available without telling them anything they
// could disagree with. Opened, each signal names what it bought and takes a
// thumb, and the precedent shows the forty percent who did something else.

const IMPORTANCE_BARS: Record<AgentSignal["importance"], number> = {
  high: 3,
  medium: 2,
  low: 1,
};

/** Three ascending bars, filled to the signal's weight. */
function Weight({ importance }: { importance: AgentSignal["importance"] }) {
  const filled = IMPORTANCE_BARS[importance];
  return (
    <span
      aria-label={`${importance} importance`}
      className="flex h-3 shrink-0 items-end gap-[1.5px]"
    >
      {[3, 6, 9].map((h, i) => (
        <i
          key={h}
          style={{ height: `${h}px` }}
          className={cn("w-[2.5px] rounded-[1px]", i < filled ? "bg-primary" : "bg-muted")}
        />
      ))}
    </span>
  );
}

export type SignalVerdict = "up" | "down";

function SignalRow({
  signal,
  verdict,
  onVerdict,
}: {
  signal: AgentSignal;
  verdict?: SignalVerdict;
  onVerdict: (v: SignalVerdict) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <li className="border-b border-border/60 last:border-0">
      <div className="flex items-center gap-1.5 py-1.5">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
        >
          <Weight importance={signal.importance} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[11.5px] font-medium leading-snug">
              {signal.short}
            </span>
            <span className="block truncate text-[10.5px] leading-snug text-muted-foreground">
              → {signal.backs}
            </span>
          </span>
          <ChevronDown
            className={cn(
              "size-3 shrink-0 text-muted-foreground transition-transform",
              !open && "-rotate-90",
            )}
          />
        </button>

        {/* The thumb is on the signal, not the conclusion. Which input was
            misread is feedback an agent can act on; "I disagree" is not. */}
        <span className="flex shrink-0 items-center gap-0.5">
          {(["up", "down"] as const).map((v) => {
            const Icon = v === "up" ? ThumbsUp : ThumbsDown;
            const active = verdict === v;
            return (
              <button
                key={v}
                type="button"
                onClick={() => onVerdict(v)}
                aria-pressed={active}
                aria-label={v === "up" ? `${signal.short}: read correctly` : `${signal.short}: misread`}
                className={cn(
                  "grid size-5 place-items-center rounded transition-colors",
                  active && v === "up" && "bg-success/15 text-success",
                  active && v === "down" && "bg-destructive/15 text-destructive",
                  !active && "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <Icon className="size-3" />
              </button>
            );
          })}
        </span>
      </div>

      {open && (
        <div className="pb-2 pl-[22px] pr-1">
          <p className="text-[11.5px] leading-relaxed text-muted-foreground">{signal.detail}</p>
          <div className="mt-1 flex flex-wrap gap-1">
            {signal.sources.map((source) => (
              <span
                key={source}
                className="rounded border border-border px-1 py-px font-mono text-[9px] uppercase tracking-wider text-muted-foreground"
              >
                {source}
              </span>
            ))}
          </div>
        </div>
      )}
    </li>
  );
}

/** A collapsible section header carrying its own one-line rollup. */
function Section({
  label,
  summary,
  children,
  defaultOpen = false,
}: {
  label: string;
  summary: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-t border-border pt-1.5 first:border-0 first:pt-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-1.5 py-1 text-left"
      >
        <ChevronDown
          className={cn(
            "size-3 shrink-0 text-muted-foreground transition-transform",
            !open && "-rotate-90",
          )}
        />
        <span className="text-[11.5px] font-semibold">{label}</span>
        <span className="ml-auto shrink-0 text-[10.5px] tabular-nums text-muted-foreground">
          {summary}
        </span>
      </button>
      {open && <div className="pb-1">{children}</div>}
    </div>
  );
}

export function EvidenceSection({
  signals,
  verdicts,
  onVerdict,
}: {
  signals: AgentSignal[];
  verdicts: Record<string, SignalVerdict>;
  onVerdict: (id: string, v: SignalVerdict) => void;
}) {
  const high = signals.filter((s) => s.importance === "high").length;
  const marked = Object.keys(verdicts).length;

  return (
    <Section
      label="Evidence"
      summary={`${signals.length} signals · ${high} high${marked ? ` · ${marked} marked` : ""}`}
    >
      <ul className="flex flex-col">
        {signals.map((signal) => (
          <SignalRow
            key={signal.id}
            signal={signal}
            verdict={verdicts[signal.id]}
            onVerdict={(v) => onVerdict(signal.id, v)}
          />
        ))}
      </ul>
    </Section>
  );
}

const SLICE_TONE = ["bg-primary", "bg-primary/45", "bg-muted-foreground/35"];

export function PrecedentSection({
  slices,
  basis,
  recommended,
}: {
  slices: PrecedentSlice[];
  basis?: string;
  /** The recommended outcome, emphasised in the list. */
  recommended?: string;
}) {
  const total = slices.reduce((sum, s) => sum + s.cases, 0);
  if (!total) return null;
  const pct = (n: number) => Math.round((n / total) * 100);
  const agree = slices.find((s) => s.outcome === recommended);

  return (
    <Section
      label="Precedent"
      summary={agree ? `${pct(agree.cases)}% agree` : `${total} cases`}
    >
      <div
        role="img"
        aria-label={slices.map((s) => `${pct(s.cases)} percent ${s.label}`).join(", ")}
        className="flex h-1.5 gap-[2px]"
      >
        {slices.map((s, i) => (
          <span
            key={s.outcome}
            style={{ flexGrow: s.cases }}
            className={cn("min-w-0 basis-0 rounded-[1.5px]", SLICE_TONE[i] ?? "bg-muted")}
          />
        ))}
      </div>

      <ul className="mt-2 flex flex-col gap-1">
        {slices.map((s, i) => {
          const isRecommended = s.outcome === recommended;
          return (
            <li key={s.outcome} className="flex items-center gap-1.5">
              <span
                aria-hidden
                className={cn("size-2 shrink-0 rounded-[1.5px]", SLICE_TONE[i] ?? "bg-muted")}
              />
              <span
                className={cn(
                  "w-7 shrink-0 text-[11px] tabular-nums",
                  isRecommended ? "font-semibold text-primary" : "text-muted-foreground",
                )}
              >
                {pct(s.cases)}%
              </span>
              <span
                className={cn(
                  "min-w-0 flex-1 truncate text-[11.5px]",
                  isRecommended ? "font-medium text-foreground" : "text-muted-foreground",
                )}
              >
                {s.label}
              </span>
              <span className="shrink-0 text-[10.5px] tabular-nums text-muted-foreground">
                {s.cases}
              </span>
            </li>
          );
        })}
      </ul>

      {basis && (
        <p className="mt-2 text-[9.5px] leading-snug text-muted-foreground">
          {total} cases · {basis}
        </p>
      )}
    </Section>
  );
}
