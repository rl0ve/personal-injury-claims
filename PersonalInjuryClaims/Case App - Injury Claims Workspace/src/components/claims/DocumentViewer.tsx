import { useEffect, useState } from "react";
import { Download, ExternalLink, FileText, Loader2, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label, Mono } from "@/components/claims/CoverageConsole";
import { HelpfulToggle } from "@/components/claims/EvidenceList";
import { assetUrl } from "@/lib/app-base";
import { cn } from "@/lib/utils";
import { relativeTime } from "@/lib/claims/format";
import type { EvidenceDocument, ExtractedField } from "@/lib/claims/types";

// The document, in the app.
//
// The page itself on the left, what IXP pulled out of it on the right. Two
// panes rather than one because the question a reviewer is answering is not
// "what does this say" but "is what the model read off it right", which needs
// both, side by side.
//
// PDFs render in the browser's own viewer via an <object>. That is deliberate:
// bundling a PDF renderer to show seven demo documents would cost more than the
// rest of the app, and the native viewer already does search, zoom and print.

/**
 * A `blob:` URL for the document, re-typed as a PDF.
 *
 * The static host behind a deployed coded app serves every bundled file as
 * `application/octet-stream`, and `uip codedapp publish` exposes no per-file
 * content-type knob. A browser handed a PDF under that type downloads it
 * instead of rendering it, so opening a document fired a download and left an
 * empty pane behind. Fetching the bytes and re-wrapping them in a Blob typed
 * `application/pdf` puts back the type the host dropped: the native viewer
 * takes over, "New tab" opens inline, and Download still names the file.
 *
 * Locally this is a no-op beyond one extra fetch, since Vite already serves the
 * right type, and a correctly-typed body is reused as-is.
 */
function usePdfUrl(href: string | undefined) {
  const [url, setUrl] = useState<string>();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setUrl(undefined);
    setFailed(false);
    if (!href) return;

    let objectUrl: string | undefined;
    let cancelled = false;

    fetch(href)
      .then((res) => {
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
        return res.blob();
      })
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(
          blob.type === "application/pdf" ? blob : new Blob([blob], { type: "application/pdf" }),
        );
        setUrl(objectUrl);
      })
      .catch(() => {
        // Fall back to the raw URL. No worse than not trying, and correct the
        // day the host starts sending a real content type.
        if (!cancelled) setFailed(true);
      });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [href]);

  return { url, failed };
}

function FieldRow({ field }: { field: ExtractedField }) {
  const missing = field.value === "";

  return (
    <div className="flex flex-col gap-0.5 border-b border-border/60 py-2 last:border-0">
      <div className="flex items-baseline gap-2">
        <Label className="min-w-0 flex-1">{field.label}</Label>
        {field.inferred && (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-insight-100 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-insight-600 dark:bg-insight-800 dark:text-white">
            <Sparkles className="size-2.5" />
            Inferred
          </span>
        )}
        {field.confidence != null && (
          <Mono className="shrink-0 text-[9.5px] tabular-nums">{field.confidence}%</Mono>
        )}
      </div>

      <span
        className={cn(
          "text-[12.5px] leading-snug",
          missing ? "italic text-muted-foreground" : "font-medium text-foreground",
        )}
      >
        {missing ? "Not established. The model returned nothing" : field.value}
      </span>

      {field.source && (
        <span className="text-[10.5px] leading-snug text-muted-foreground">{field.source}</span>
      )}
    </div>
  );
}

export function DocumentViewer({
  document: doc,
  onClose,
  onHelpful,
}: {
  document: EvidenceDocument;
  onClose: () => void;
  onHelpful?: (helpful: boolean | null) => void;
}) {
  const [tab, setTab] = useState<"extracted" | "summary">("extracted");
  const inferredCount = doc.extracted?.filter((f) => f.inferred).length ?? 0;
  // Resolved against the app mount point: a bare relative path would resolve
  // against the current route and 404 on anything deeper than the root.
  const href = doc.fileUrl ? assetUrl(doc.fileUrl) : undefined;
  const { url: pdfUrl, failed } = usePdfUrl(href);
  // Everything the browser touches goes through the re-typed blob; the raw URL
  // is only a fallback for a fetch that never landed.
  const viewUrl = pdfUrl ?? (failed ? href : undefined);
  const filename = doc.fileUrl?.split("/").pop();

  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      {/* 80% of the viewport: big enough to read a page at width, small enough
          that the case behind it is still visible and the dialog reads as a
          preview rather than a navigation. The default max-w-lg is overridden
          wholesale. A document is not a form. */}
      <DialogContent
        showCloseButton={false}
        className="flex h-[80vh] w-[80vw] max-w-none flex-col gap-0 overflow-hidden p-0 sm:max-w-none"
      >
        <DialogTitle className="sr-only">{doc.title}</DialogTitle>
        <DialogDescription className="sr-only">
          {doc.issuer ? `${doc.issuer}. ` : ""}Document preview with extracted fields.
        </DialogDescription>
      <header className="flex shrink-0 flex-wrap items-center gap-3 border-b border-border px-4 py-3">
        <FileText className="size-4 shrink-0 text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-2">
            <span className="truncate text-sm font-semibold">{doc.title}</span>
            {doc.reference && <Mono className="text-[10.5px]">{doc.reference}</Mono>}
          </div>
          <span className="block truncate text-xs text-muted-foreground">
            {doc.issuer ?? doc.addedBy}
            {doc.pages ? ` · ${doc.pages} pages` : ""}
            {` · added ${relativeTime(doc.addedAt)}`}
          </span>
        </div>

        {onHelpful && (
          <span className="flex shrink-0 items-center gap-2">
            <span className="hidden text-xs text-muted-foreground sm:inline">Useful?</span>
            <HelpfulToggle value={doc.helpful} onChange={onHelpful} />
          </span>
        )}

        {href && (
          <>
            {/* Held back until the blob exists: pointed at the raw URL this
                button downloads the file rather than opening it. */}
            <Button variant="outline" size="sm" asChild={!!viewUrl} disabled={!viewUrl}>
              {viewUrl ? (
                <a href={viewUrl} target="_blank" rel="noreferrer">
                  <ExternalLink className="size-4" />
                  New tab
                </a>
              ) : (
                <>
                  <ExternalLink className="size-4" />
                  New tab
                </>
              )}
            </Button>
            <Button variant="outline" size="sm" asChild>
              <a href={viewUrl ?? href} download={filename}>
                <Download className="size-4" />
                Download
              </a>
            </Button>
          </>
        )}

        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          className="grid size-8 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <X className="size-4" />
        </button>
      </header>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        {/* The page */}
        <div className="min-h-0 flex-1 bg-muted/40 p-3">
          {href ? (
            viewUrl ? (
              <object
                data={viewUrl}
                type="application/pdf"
                className="size-full rounded-lg border border-border bg-card"
                aria-label={doc.title}
              >
                {/* Shown when the browser has no inline PDF viewer. */}
                <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
                  <FileText className="size-8 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    This browser can&rsquo;t display the PDF inline.
                  </p>
                  <Button asChild>
                    <a href={viewUrl} target="_blank" rel="noreferrer">
                      Open {doc.title}
                    </a>
                  </Button>
                </div>
              </object>
            ) : (
              /* Fetching the bytes. A frame rather than a spinner alone, so the
                 pane keeps its shape and the page doesn't jump when it lands. */
              <div className="flex h-full items-center justify-center rounded-lg border border-border bg-card">
                <span className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" />
                  Loading document&hellip;
                </span>
              </div>
            )
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border p-8 text-center">
              <FileText className="size-6 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                No file attached. This evidence is a summary only.
              </p>
            </div>
          )}
        </div>

        {/* What was read off it */}
        <aside className="flex min-h-0 w-full shrink-0 flex-col border-t border-border lg:w-[360px] lg:border-l lg:border-t-0">
          <div className="flex shrink-0 gap-4 border-b border-border px-4 pt-3">
            {(
              [
                ["extracted", `Extracted${doc.extracted?.length ? ` · ${doc.extracted.length}` : ""}`],
                ["summary", "Summary"],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setTab(key)}
                className={cn(
                  "border-b-2 pb-2 text-sm font-medium transition-colors",
                  tab === key
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            {tab === "extracted" ? (
              doc.extracted?.length ? (
                <>
                  {inferredCount > 0 && (
                    <p className="mb-3 rounded-lg bg-insight-100/40 p-2.5 text-[11.5px] leading-relaxed text-muted-foreground dark:bg-insight-800/20">
                      {inferredCount} of these {doc.extracted.length} values are{" "}
                      <span className="font-medium text-foreground">inferred</span>, meaning stated
                      nowhere in the document, derived by reading it against another. Those are the
                      ones worth checking.
                    </p>
                  )}
                  <div className="flex flex-col">
                    {doc.extracted.map((field) => (
                      <FieldRow key={field.label} field={field} />
                    ))}
                  </div>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Nothing has been extracted from this document.
                </p>
              )
            ) : (
              <div className="flex flex-col gap-3">
                {doc.verdict && (
                  <div>
                    <Label className="mb-1">Verdict</Label>
                    <p className="text-[13px] font-medium">{doc.verdict}</p>
                  </div>
                )}
                {doc.body && (
                  <p className="whitespace-pre-line text-[12.5px] leading-relaxed text-muted-foreground">
                    {doc.body}
                  </p>
                )}
                {doc.table && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-[12px]">
                      <thead>
                        <tr className="border-b border-border text-left">
                          {doc.table.columns.map((c) => (
                            <th key={c} className="py-1.5 pr-3 font-medium text-muted-foreground">
                              {c}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {doc.table.rows.map((row) => (
                          <tr key={row.join("|")} className="border-b border-border/50 last:border-0">
                            {row.map((cell, i) => (
                              <td key={i} className={cn("py-1.5 pr-3", i === 0 && "font-medium")}>
                                {cell}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {!doc.verdict && !doc.body && !doc.table && (
                  <p className="text-sm text-muted-foreground">No summary recorded.</p>
                )}
              </div>
            )}
          </div>
        </aside>
      </div>
      </DialogContent>
    </Dialog>
  );
}
