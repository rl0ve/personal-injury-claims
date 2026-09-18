import { ChevronLeft } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PageContainer } from "@/components/PageContainer";

// Placeholders for the two screens you can land on cold.
//
// Both are reachable by URL, so a refresh starts with no cases in memory and
// spends a beat restoring the token and reading the instance. These stand in for
// that beat. They trace the real layout (hero, meta row, tabs) so the page
// does not jump when the data replaces them.

function Line({ className }: { className?: string }) {
  return <Skeleton className={className ?? "h-4 w-40"} />;
}

/** A dimmed, inert copy of the back link, so the header does not pop in. */
function BackLink() {
  return (
    <span className="flex w-fit items-center gap-1 text-sm text-muted-foreground/60">
      <ChevronLeft className="size-4" /> Work queue
    </span>
  );
}

export function CaseDetailSkeleton() {
  return (
    <div className="h-full overflow-y-auto p-6" aria-busy="true" aria-label="Loading case">
      <div className="flex flex-col gap-6">
        <BackLink />

        <Card className="gap-0 p-0">
          <div className="flex flex-wrap items-start gap-x-10 gap-y-4 p-6">
            <div className="mr-auto flex min-w-0 flex-col gap-2">
              <Line className="h-7 w-64" />
              <Line className="h-3 w-44" />
              <Line className="h-4 w-[28rem] max-w-full" />
              <Line className="h-3 w-80 max-w-full" />
            </div>

            {/* The four meta columns: label over value. */}
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="flex flex-col gap-1.5">
                <Line className="h-3 w-16" />
                <Line className="h-5 w-24" />
              </div>
            ))}

            <div className="flex w-full flex-wrap items-center gap-2">
              <Line className="h-9 w-52" />
              <Line className="h-9 w-40" />
            </div>
          </div>
        </Card>

        {/* Tab strip, then the overview's two columns. */}
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: 6 }, (_, i) => (
              <Line key={i} className="h-8 w-24" />
            ))}
          </div>
          <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
            <Card className="p-6">
              <div className="flex flex-col gap-3">
                {Array.from({ length: 5 }, (_, i) => (
                  <Line key={i} className={i === 0 ? "h-5 w-48" : "h-4 w-full"} />
                ))}
              </div>
            </Card>
            <Card className="p-6">
              <div className="flex flex-col gap-3">
                {Array.from({ length: 4 }, (_, i) => (
                  <Line key={i} className={i === 0 ? "h-5 w-32" : "h-4 w-full"} />
                ))}
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

export function DecisionConsoleSkeleton() {
  return (
    <PageContainer>
      <div className="flex flex-col gap-6" aria-busy="true" aria-label="Loading decision">
        <BackLink />
        <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
          <Card className="p-6">
            <div className="flex flex-col gap-4">
              <Line className="h-6 w-72" />
              <Line className="h-4 w-full" />
              <Line className="h-4 w-5/6" />
              <div className="mt-2 flex flex-col gap-2">
                {Array.from({ length: 4 }, (_, i) => (
                  <Line key={i} className="h-11 w-full" />
                ))}
              </div>
              <Line className="h-9 w-40" />
            </div>
          </Card>
          <Card className="p-6">
            <div className="flex flex-col gap-3">
              {Array.from({ length: 6 }, (_, i) => (
                <Line key={i} className={i === 0 ? "h-5 w-36" : "h-4 w-full"} />
              ))}
            </div>
          </Card>
        </div>
      </div>
    </PageContainer>
  );
}

/**
 * The Actions pane, before it has anything in it.
 *
 * Traces the real three-part layout (queue, decision column, decision card)
 * so the page does not jump when the content replaces it. The queue's fixed
 * width matches the pane's default so the seam does not move either.
 */
export function ActionsSkeleton() {
  return (
    <div className="flex h-full" aria-busy="true" aria-label="Loading actions">
      {/* Queue */}
      <div className="flex w-[385px] shrink-0 flex-col gap-3 border-r border-border p-4">
        <div className="flex items-center justify-between">
          <Line className="h-5 w-28" />
          <Line className="h-8 w-20" />
        </div>
        <Line className="h-9 w-full" />
        <Line className="h-3 w-24" />
        {Array.from({ length: 3 }, (_, i) => (
          <Card key={i} className="gap-2 p-4">
            <Line className="h-4 w-48" />
            <Line className="h-3 w-40" />
            <Line className="h-3 w-28" />
            <Line className="h-5 w-20" />
          </Card>
        ))}
      </div>

      {/* Decision pane */}
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex flex-col gap-3 border-b border-border p-5">
          <Line className="h-6 w-[26rem] max-w-full" />
          <Line className="h-3 w-40" />
          <div className="flex flex-wrap gap-6">
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="flex flex-col gap-1.5">
                <Line className="h-3 w-14" />
                <Line className="h-4 w-24" />
              </div>
            ))}
          </div>
        </div>

        <div className="grid flex-1 items-start gap-4 p-5 xl:grid-cols-[minmax(0,1fr)_400px]">
          <div className="flex flex-col gap-4">
            <Card className="flex flex-col gap-2 p-4">
              <Line className="h-4 w-56" />
              <Line className="h-3 w-72 max-w-full" />
              <Line className="h-3 w-full" />
              <Line className="h-3 w-4/5" />
            </Card>
            <Card className="flex flex-col gap-3 p-4">
              <Line className="h-3 w-40" />
              <Line className="h-10 w-full" />
              <Line className="h-10 w-full" />
              <Line className="h-4 w-64 max-w-full" />
            </Card>
          </div>
          <Card className="flex flex-col gap-3 p-4">
            <Line className="h-5 w-32" />
            {Array.from({ length: 3 }, (_, i) => (
              <Line key={i} className="h-12 w-full" />
            ))}
            <Line className="h-24 w-full" />
          </Card>
        </div>
      </div>
    </div>
  );
}
