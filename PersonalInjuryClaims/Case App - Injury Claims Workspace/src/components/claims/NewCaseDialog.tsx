import { useEffect, useState } from "react";
import { ExternalLink, Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/claims/CoverageConsole";
import { cn } from "@/lib/utils";
import { startNewCase } from "@/services/uipath/caseService";
import {
  caseConfig,
  isNewCaseConfigured,
  portalUrl,
  uipathConfig,
} from "@/services/uipath/config";
import { useUiPath } from "@/services/uipath/UiPathProvider";

// Starts a case by starting the configured Orchestrator process with the demo
// arguments. Not a Maestro API call: the case is created by the job the process
// runs, which is why the arguments are a demo contract (`demoScenario`,
// `demoRunId`, `ownerEmail`) rather than the case's own intake payload.

const SCENARIOS = ["Standard", "MissingEvidence", "Rejected", "Critical"] as const;

const SCENARIO_HINT: Record<(typeof SCENARIOS)[number], string> = {
  Standard: "The happy path: liability admitted, treatment complete, settled.",
  MissingEvidence: "Medical evidence incomplete, so the case waits on the claimant.",
  Rejected: "Liability denied, exiting through the denial lane.",
  Critical: "P1 serious injury, on the 24-hour case clock.",
};

/**
 * A fresh run id per case.
 *
 * Seeded from the clock rather than a counter: two people demoing against the
 * same tenant would otherwise both mint WR-RUN-0001 and collide.
 */
function freshRunId(): string {
  const n = Math.floor(Date.now() / 1000) % 10000;
  return `WR-RUN-${String(n).padStart(4, "0")}`;
}

export function NewCaseDialog({ onStarted }: { onStarted?: () => void }) {
  const { sdk, isAuthenticated, user } = useUiPath();

  const [open, setOpen] = useState(false);
  const [scenario, setScenario] = useState<(typeof SCENARIOS)[number]>("Standard");
  const [runId, setRunId] = useState(freshRunId);
  const [ownerEmail, setOwnerEmail] = useState("");
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [started, setStarted] = useState<{ jobId?: number; runId: string } | null>(null);

  // A new dialog means a new run: minting the id once at mount would reuse it
  // for every case started in the session.
  useEffect(() => {
    if (!open) return;
    setRunId(freshRunId());
    setOwnerEmail(user?.email ?? "");
    setError(null);
    setStarted(null);
  }, [open, user?.email]);

  const configured = isNewCaseConfigured();
  const canStart = configured && isAuthenticated && Boolean(sdk);

  async function start() {
    if (!sdk) return;
    setStarting(true);
    setError(null);
    try {
      const { jobId } = await startNewCase(sdk, {
        demoScenario: scenario,
        demoRunId: runId,
        ownerEmail,
      });
      setStarted({ jobId, runId });
      // The case appears once the job creates the instance, which is not
      // instant, so refresh anyway and a fast one shows up without a manual click.
      onStarted?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start the process.");
    } finally {
      setStarting(false);
    }
  }

  // Portal host, not the API host. This is a link for a person to click.
  const jobsUrl = `${portalUrl()}/${uipathConfig.orgName}/${uipathConfig.tenantName}/orchestrator_/jobs`;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="size-4" />
          New case
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Start a new case</DialogTitle>
          <DialogDescription>
            Starts the injury claims process in Orchestrator. The case instance appears in the queue
            once the job creates it.
          </DialogDescription>
        </DialogHeader>

        {started ? (
          <div className="flex flex-col gap-3">
            <div className="rounded-lg border border-success/35 bg-success/10 p-3 text-sm">
              <b className="block font-semibold text-success">Job started</b>
              <span className="text-muted-foreground">
                {started.runId}
                {started.jobId ? ` · job ${started.jobId}` : ""} · scenario {scenario}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              The queue refreshes on its own, but the instance only appears once the process has
              created it. Refresh again in a moment if it is not there yet.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label>Scenario</Label>
              <Select
                value={scenario}
                onValueChange={(v) => setScenario(v as (typeof SCENARIOS)[number])}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SCENARIOS.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span className="text-xs text-muted-foreground">{SCENARIO_HINT[scenario]}</span>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>Run id</Label>
              <div className="flex items-center gap-2">
                <Input
                  value={runId}
                  onChange={(e) => setRunId(e.target.value)}
                  className="font-mono text-sm"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setRunId(freshRunId())}
                  title="Generate a new run id"
                >
                  New
                </Button>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>Owner email</Label>
              <Input
                value={ownerEmail}
                onChange={(e) => setOwnerEmail(e.target.value)}
                placeholder="name@company.com"
                type="email"
                className="text-sm"
              />
              <span className="text-xs text-muted-foreground">
                {user?.email
                  ? "Defaults to the signed-in user."
                  : "Sign in and this defaults to you."}
              </span>
            </div>

            {!configured && (
              <p className="rounded-md bg-warning/10 p-3 text-xs text-warning-foreground">
                No process configured. Set{" "}
                <code className="font-mono">VITE_NEW_CASE_PROCESS_KEY</code> (or{" "}
                <code className="font-mono">VITE_CASE_PROCESS_KEY</code>) and a folder key.
              </p>
            )}
            {configured && !isAuthenticated && (
              <p className="rounded-md bg-warning/10 p-3 text-xs text-warning-foreground">
                Sign in to start a job.
              </p>
            )}
            {error && (
              <p className="rounded-md bg-destructive/10 p-3 text-xs text-destructive">{error}</p>
            )}

            <p className="text-[11px] text-muted-foreground">
              Process{" "}
              <code className="font-mono">{caseConfig.newCaseProcessKey.slice(0, 8) || "none"}…</code>{" "}
              in folder{" "}
              <code className="font-mono">
                {caseConfig.newCaseFolderKey.slice(0, 8) || "none"}…
              </code>
            </p>
          </div>
        )}

        <DialogFooter className="sm:justify-between">
          {started ? (
            <>
              <Button variant="outline" size="sm" asChild>
                <a href={jobsUrl} target="_blank" rel="noreferrer">
                  <ExternalLink className="size-4" />
                  Jobs in Orchestrator
                </a>
              </Button>
              <Button onClick={() => setOpen(false)}>Done</Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => void start()}
                disabled={!canStart || starting || !runId.trim()}
              >
                {starting && <Loader2 className={cn("size-4 animate-spin")} />}
                {starting ? "Starting…" : "Start case"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
