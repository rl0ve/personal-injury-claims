import { useRef, useState } from "react";
import { FileText, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { WidgetHeader } from "@/components/claims/WidgetHeader";
import { EvidenceList } from "@/components/claims/EvidenceList";
import { useRole } from "@/lib/role/useRole";
import { addCaseEvidence, markEvidenceHelpful } from "@/lib/claims/useCases";
import type { EvidenceDocument, InjuryClaim } from "@/lib/claims/types";

// Documents on an injury case ARE its evidence: the medical records bundle, the
// IME report, the treatment plan, the claimant's own paperwork. So this tab
// is the evidence list plus an upload, rather than a second parallel store.

const EXTENSION_KIND: Record<string, EvidenceDocument["kind"]> = {
  pdf: "pdf",
  log: "log",
  txt: "log",
  csv: "log",
  zip: "zip",
  jpg: "image",
  jpeg: "image",
  png: "image",
  heic: "image",
};

function fileToDocument(file: File, uploadedBy: string): EvidenceDocument {
  const dot = file.name.lastIndexOf(".");
  const extension = dot > 0 ? file.name.slice(dot + 1).toLowerCase() : "";
  const sizeKb = Math.max(1, Math.round(file.size / 1024));
  return {
    id: `up-${file.name}-${file.size}`,
    kind: EXTENSION_KIND[extension] ?? "pdf",
    title: file.name,
    verdict: `${extension.toUpperCase() || "FILE"} · ${sizeKb} KB`,
    addedAt: new Date().toISOString(),
    addedBy: uploadedBy,
    isNew: true,
    helpful: null,
  };
}

function UploadButton({ claim }: { claim: InjuryClaim }) {
  const { profile } = useRole();
  const inputRef = useRef<HTMLInputElement>(null);

  function onFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length > 0) {
      addCaseEvidence(claim, files.map((f) => fileToDocument(f, profile.name)));
    }
    // Reset so picking the same file again still fires onChange.
    e.target.value = "";
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => inputRef.current?.click()}>
        <Upload className="size-3.5" />
        Upload document
      </Button>
      <input ref={inputRef} type="file" multiple className="hidden" onChange={onFiles} />
    </>
  );
}

/** Overview widget: the latest few documents, with an "N more" link to the tab. */
export function CaseDocumentsWidget({
  claim,
  onOpen,
}: {
  claim: InjuryClaim;
  onOpen?: () => void;
}) {
  const [latest, more] = [claim.evidence.slice(0, 3), Math.max(0, claim.evidence.length - 3)];

  return (
    <Card className="gap-2 p-5">
      <WidgetHeader
        icon={<FileText className="size-4 text-muted-foreground" />}
        title="Documents"
        onOpen={onOpen}
      >
        <UploadButton claim={claim} />
      </WidgetHeader>

      {latest.length === 0 ? (
        <p className="py-2 text-sm text-muted-foreground">No documents yet.</p>
      ) : (
        <>
          <EvidenceList documents={latest} />
          {more > 0 && onOpen && (
            <button
              type="button"
              onClick={onOpen}
              className="w-fit pt-1 text-xs font-medium text-primary hover:underline"
            >
              {more} more
            </button>
          )}
        </>
      )}
    </Card>
  );
}

/**
 * The Documents tab. Rating stays available here as well as in the console,
 * evidence usefulness is a signal worth capturing whenever someone reads it,
 * not only at the moment of decision.
 */
export function CaseDocumentsTab({ claim }: { claim: InjuryClaim }) {
  const [showRatings, setShowRatings] = useState(true);

  return (
    <Card className="gap-3 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="flex items-center gap-2 text-base font-semibold">
          <FileText className="size-4 text-muted-foreground" />
          Documents · {claim.evidence.length}
        </span>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowRatings((v) => !v)}
            className="text-xs font-normal text-muted-foreground"
          >
            {showRatings ? "Hide ratings" : "Rate usefulness"}
          </Button>
          <UploadButton claim={claim} />
        </div>
      </div>

      <EvidenceList
        documents={claim.evidence}
        onHelpful={
          showRatings
            ? (evidenceId, helpful) => markEvidenceHelpful(claim, evidenceId, helpful)
            : undefined
        }
      />
    </Card>
  );
}
