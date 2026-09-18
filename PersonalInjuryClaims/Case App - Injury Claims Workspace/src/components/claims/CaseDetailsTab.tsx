import { useState } from "react";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { CustomerStandingCard } from "@/components/claims/CustomerStandingCard";
import { PriorityBadge, SlaBadge } from "@/components/claims/badges";
import { dateTime, money } from "@/lib/claims/format";
import { ROLE_PROFILES } from "@/lib/role/RoleProvider";
import type { Priority, InjuryClaim } from "@/lib/claims/types";

// The Details tab: the case record, grouped the way a claims officer
// thinks about it: who and where, what happened, what it's worth, and the case
// variables Maestro carries.
//
// Almost everything is read-only, because the connected systems are the record:
// the Injury Severity Data Gateway owns the injury record, the Injury Policy
// Gateway owns entitlement, the Injury Claims Gateway owns cost. Only
// fields the case itself owns are editable, and only for the case owner.
// Editing one writes to session state, not to Maestro.

type FieldType = "text" | "tel" | "email" | "number" | "select";

interface FieldDef {
  key: string;
  label: string;
  type?: FieldType;
  options?: readonly string[];
  /** Editable inline. Everything else is a system of record. */
  editable?: boolean;
  /** Read the value off the case rather than a flat key. */
  value: (c: InjuryClaim) => React.ReactNode;
  /** The raw value an editor starts from. */
  raw?: (c: InjuryClaim) => string;
  /** Applied on save. */
  patch?: (v: string) => Partial<InjuryClaim>;
}

const PRIORITIES: readonly Priority[] = ["P1", "P2", "P3", "P4"];
const OWNERS = Object.values(ROLE_PROFILES).map((p) => p.name);

const CARDS: { id: string; title: string; fields: FieldDef[] }[] = [
  {
    id: "customer",
    title: "Claimant and incident location",
    fields: [
      { key: "customer", label: "Claimant", value: (c) => c.customer },
      { key: "site", label: "Incident location", value: (c) => c.site },
      {
        key: "lineStatus",
        label: "Work status",
        value: (c) =>
          c.lineStatus ? (
            <span className="text-destructive">
              {c.lineStatus}
              {c.lineDownHours ? ` · ${c.lineDownHours} hr` : ""}
            </span>
          ) : (
            "Fit for work"
          ),
      },
      {
        key: "owner",
        label: "Case owner",
        type: "select",
        options: OWNERS,
        editable: true,
        value: (c) => `${c.owner}${c.ownerRole ? ` · ${c.ownerRole}` : ""}`,
        raw: (c) => c.owner,
        patch: (v) => ({
          owner: v,
          ownerRole: Object.values(ROLE_PROFILES).find((p) => p.name === v)?.title ?? "",
        }),
      },
    ],
  },
  {
    id: "asset",
    title: "Injury and policy",
    fields: [
      { key: "assetModel", label: "Policy type", value: (c) => c.asset.model || "Not recorded" },
      { key: "assetSerial", label: "Policy number", value: (c) => c.asset.serial || "Not recorded" },
      { key: "assetDescription", label: "Injury", value: (c) => c.asset.description || "Not recorded" },
      {
        key: "inService",
        label: "Time on risk",
        value: (c) => (c.asset.inServiceMonths ? `${c.asset.inServiceMonths} months` : "Not recorded"),
      },
      { key: "coverageStatus", label: "Policy status", value: (c) => c.asset.coverageStatus },
      {
        key: "coveragePosition",
        label: "Liability position",
        value: (c) => String(c.variables["Coverage.Position"] ?? "Not yet set"),
      },
    ],
  },
  {
    id: "failure",
    title: "Injury and impact",
    fields: [
      { key: "description", label: "Reported injury", value: (c) => c.description },
      {
        key: "priority",
        label: "Priority",
        type: "select",
        options: PRIORITIES,
        editable: true,
        value: (c) => <PriorityBadge priority={c.priority} />,
        raw: (c) => c.priority,
        // The P1 override in SDD §1 keys off this, so changing it changes the
        // case clock, which is exactly why it is worth being editable.
        patch: (v) => ({ priority: v as Priority }),
      },
      {
        key: "queueReason",
        label: "Why it needs a person",
        value: (c) => c.queueReason ?? "Nothing outstanding",
      },
      { key: "openedAt", label: "Opened", value: (c) => dateTime(c.openedAt) },
      { key: "lastUpdatedAt", label: "Last update", value: (c) => dateTime(c.lastUpdatedAt) },
    ],
  },
  {
    id: "commercial",
    title: "Commercial and status",
    fields: [
      {
        key: "claimValue",
        label: "Claim value",
        type: "number",
        editable: true,
        value: (c) => money(c.claimValue),
        raw: (c) => String(c.claimValue),
        patch: (v) => ({ claimValue: Number(v) || 0 }),
      },
      { key: "currentStage", label: "Current stage", value: (c) => c.currentStage },
      {
        key: "activeLanes",
        label: "Open lanes",
        value: (c) => (c.activeLanes.length ? c.activeLanes.join(", ") : "None"),
      },
      { key: "status", label: "Status", value: (c) => c.status },
      { key: "slaStatus", label: "Stage SLA", value: (c) => <SlaBadge status={c.slaStatus} /> },
      { key: "closureReason", label: "Closure reason", value: (c) => c.closureReason ?? "Not closed" },
    ],
  },
];

function inputType(type?: FieldType): React.HTMLInputTypeAttribute {
  if (type === "number") return "number";
  if (type === "email") return "email";
  if (type === "tel") return "tel";
  return "text";
}

export function CaseDetailsTab({
  claim,
  editable = false,
  onSave,
  rail = false,
}: {
  claim: InjuryClaim;
  /** Case owner only. Enables the pencils. */
  editable?: boolean;
  onSave?: (patch: Partial<InjuryClaim>) => void;
  rail?: boolean;
}) {
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  function startEdit(field: FieldDef) {
    setDraft(field.raw?.(claim) ?? "");
    setEditingKey(field.key);
  }

  function cancel() {
    setEditingKey(null);
    setDraft("");
  }

  function save(field: FieldDef) {
    const value = draft.trim();
    if (!value || !field.patch) return cancel();
    onSave?.(field.patch(value));
    cancel();
  }

  return (
    <div
      className={
        rail ? "flex flex-col gap-4" : "grid gap-4 @min-[720px]:grid-cols-[repeat(2,minmax(0,1fr))]"
      }
    >
      {/* Its own card rather than fields on "Claimant and incident location": these are
          read from the Injury Policy Gateway and weighed, not case fields
          to be maintained, and the block only makes its point read together. */}
      <CustomerStandingCard claim={claim} />

      {CARDS.map((card) => (
        <Card key={card.id} className="gap-4 p-5">
          <span className="text-base font-semibold">{card.title}</span>
          <div className="flex flex-col gap-4">
            {card.fields.map((field) => {
              const isEditing = editingKey === field.key;
              const canEdit = editable && field.editable && !rail;
              return (
                <div key={field.key} className="flex flex-col gap-1">
                  <span className="text-xs text-muted-foreground">{field.label}</span>
                  {isEditing ? (
                    <div className="flex flex-col gap-2">
                      {field.type === "select" ? (
                        <Select value={draft} onValueChange={setDraft}>
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {field.options?.map((o) => (
                              <SelectItem key={o} value={o}>
                                {o}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Input
                          autoFocus
                          type={inputType(field.type)}
                          value={draft}
                          onChange={(e) => setDraft(e.target.value)}
                          className={cn(field.type === "number" && "tabular-nums")}
                        />
                      )}
                      <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" onClick={cancel}>
                          Cancel
                        </Button>
                        <Button size="sm" disabled={!draft.trim()} onClick={() => save(field)}>
                          Save
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{field.value(claim)}</span>
                      {canEdit && (
                        <button
                          type="button"
                          aria-label={`Edit ${field.label}`}
                          onClick={() => startEdit(field)}
                          className="grid size-6 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                        >
                          <Pencil className="size-3.5" />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      ))}

      {/* Case variables get their own card: they are Maestro's, not the app's,
          and the instance view shows the same list. */}
      <Card className="gap-4 p-5">
        <span className="text-base font-semibold">Case variables</span>
        <div className="flex flex-col gap-4">
          {Object.entries(claim.variables).map(([name, value]) => (
            <div key={name} className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">{name}</span>
              <span className="text-sm font-medium">{String(value)}</span>
            </div>
          ))}
          {claim.instanceId && (
            <div className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">Instance ID</span>
              <span className="text-sm font-medium tabular-nums">{claim.instanceId}</span>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
