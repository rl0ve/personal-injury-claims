import { useState } from "react";
import { ChevronDown, Expand, FileText, Package, ScrollText, ThumbsDown, ThumbsUp } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { relativeTime } from "@/lib/claims/format";
import { DocumentViewer } from "@/components/claims/DocumentViewer";
import type { EvidenceDocument } from "@/lib/claims/types";

// Evidence, expandable in place. The console's point is that everything needed
// to decide is on one screen, so an evidence item opens where it sits rather
// than in a viewer that covers the decision.

const KIND_ICON = {
  pdf: FileText,
  log: ScrollText,
  zip: Package,
  image: FileText,
} as const;

function EvidenceBody({
  document,
  onOpenDocument,
}: {
  document: EvidenceDocument;
  onOpenDocument?: () => void;
}) {
  return (
    <div className="flex flex-col gap-3 border-t border-border px-4 py-3">
      {document.body && (
        <p className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
          {document.body}
        </p>
      )}
      {document.table && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[28rem] text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                {document.table.columns.map((column) => (
                  <th key={column} className="py-1.5 pr-4 font-medium text-muted-foreground">
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {document.table.rows.map((row) => {
                // A row carrying an out-of-envelope delta is the finding, not a
                // detail, so mark it and the eye lands there first.
                const flagged = row.some((cell) => /out of envelope/i.test(cell));
                return (
                  <tr key={row.join("|")} className="border-b border-border/50 last:border-0">
                    {row.map((cell, i) => (
                      <td
                        key={i}
                        className={cn(
                          "py-1.5 pr-4",
                          i === 0 && "font-medium",
                          flagged && i === row.length - 1 && "font-medium text-destructive",
                        )}
                      >
                        {cell}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted-foreground">
          Added {relativeTime(document.addedAt)} · {document.issuer ?? document.addedBy}
          {document.pages ? ` · ${document.pages} pages` : ""}
        </span>
        {onOpenDocument && (
          <button
            type="button"
            onClick={onOpenDocument}
            className="ml-auto flex items-center gap-1 text-xs font-medium text-primary hover:underline"
          >
            <Expand className="size-3" />
            Open document
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * Was this evidence useful? Non-blocking, written to the decision ledger, and the
 * raw material continuous improvement reads later.
 *
 * Exported so the console's signal-capture rail can rate evidence without
 * re-rendering the expandable list beside it.
 */
export function HelpfulToggle({
  value,
  onChange,
}: {
  value: boolean | null | undefined;
  onChange: (next: boolean | null) => void;
}) {
  const base =
    "grid size-7 place-items-center rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50";
  return (
    <span className="flex shrink-0 items-center gap-1">
      <button
        type="button"
        aria-label="Mark useful"
        aria-pressed={value === true}
        onClick={(e) => {
          e.stopPropagation();
          onChange(value === true ? null : true);
        }}
        className={cn(
          base,
          value === true
            ? "bg-success/15 text-success"
            : "text-muted-foreground hover:bg-muted hover:text-foreground",
        )}
      >
        <ThumbsUp className="size-3.5" />
      </button>
      <button
        type="button"
        aria-label="Mark not useful"
        aria-pressed={value === false}
        onClick={(e) => {
          e.stopPropagation();
          onChange(value === false ? null : false);
        }}
        className={cn(
          base,
          value === false
            ? "bg-destructive/15 text-destructive"
            : "text-muted-foreground hover:bg-muted hover:text-foreground",
        )}
      >
        <ThumbsDown className="size-3.5" />
      </button>
    </span>
  );
}

export function EvidenceList({
  documents,
  onHelpful,
  defaultOpenFirst = false,
}: {
  documents: EvidenceDocument[];
  /** Omit to hide the useful/not-useful controls (e.g. on a read-only tab). */
  onHelpful?: (evidenceId: string, helpful: boolean | null) => void;
  defaultOpenFirst?: boolean;
}) {
  const [open, setOpen] = useState<Record<string, boolean>>(() =>
    defaultOpenFirst && documents[0] ? { [documents[0].id]: true } : {},
  );
  // The document currently open in the full-window viewer, by id. Held by id
  // rather than by object so a rating made inside the viewer flows back in.
  const [viewing, setViewing] = useState<string | null>(null);
  const viewed = documents.find((d) => d.id === viewing) ?? null;

  if (documents.length === 0) {
    return (
      <Card className="p-5">
        <span className="text-sm text-muted-foreground">
          No evidence is attached to this case yet.
        </span>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {documents.map((document) => {
        const Icon = KIND_ICON[document.kind];
        const isOpen = open[document.id] ?? false;
        return (
          <Card key={document.id} className="gap-0 overflow-hidden p-0">
            <div className="flex items-center gap-3 px-4 py-3">
              <button
                type="button"
                onClick={() => setOpen((o) => ({ ...o, [document.id]: !isOpen }))}
                aria-expanded={isOpen}
                className="flex min-w-0 flex-1 items-center gap-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
              >
                <ChevronDown
                  className={cn(
                    "size-4 shrink-0 text-muted-foreground transition-transform",
                    isOpen && "rotate-0",
                    !isOpen && "-rotate-90",
                  )}
                />
                <Icon className="size-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                    <span className="truncate text-sm font-medium">{document.title}</span>
                    {document.isNew && (
                      <span className="rounded-full bg-info/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-info">
                        New
                      </span>
                    )}
                  </span>
                  {document.verdict && (
                    <span className="block truncate text-xs text-muted-foreground">
                      {document.verdict}
                    </span>
                  )}
                </span>
              </button>
              {/* The real document, full window. Only offered where there is a
                  file behind the summary. */}
              {document.fileUrl && (
                <button
                  type="button"
                  aria-label={`Open ${document.title}`}
                  title="Open document"
                  onClick={(e) => {
                    e.stopPropagation();
                    setViewing(document.id);
                  }}
                  className="grid size-7 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <Expand className="size-3.5" />
                </button>
              )}
              {onHelpful && (
                <HelpfulToggle
                  value={document.helpful}
                  onChange={(next) => onHelpful(document.id, next)}
                />
              )}
            </div>
            {isOpen && (
              <EvidenceBody
                document={document}
                onOpenDocument={document.fileUrl ? () => setViewing(document.id) : undefined}
              />
            )}
          </Card>
        );
      })}

      {viewed && (
        <DocumentViewer
          document={viewed}
          onClose={() => setViewing(null)}
          onHelpful={onHelpful ? (next) => onHelpful(viewed.id, next) : undefined}
        />
      )}
    </div>
  );
}
