import { useState } from "react";
import { ArrowUp, X } from "lucide-react";
import { AiMark } from "@/components/ui/ai-mark";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { AgentMarkdown } from "@/components/claims/AgentMarkdown";
import {
  askAgent,
  caseIdentifiers,
  localAnswer,
  SUGGESTED_QUESTIONS,
  type AssistantMessage,
} from "@/services/uipath/assistantService";
import { isAssistantConfigured } from "@/services/uipath/config";
import { useUiPath } from "@/services/uipath/UiPathProvider";
import type { InjuryClaim } from "@/lib/claims/types";

/**
 * The case-scoped assistant. Streams from a UiPath Conversational Agent when one
 * is configured; otherwise answers from the case in front of the user and says
 * so. A failed agent call falls back the same way rather than showing an error:
 * mid-demo, a degraded answer beats a broken panel.
 */
export function AskAiPanel({
  claim,
  onClose,
}: {
  claim: InjuryClaim;
  onClose: () => void;
}) {
  const { sdk, isAuthenticated } = useUiPath();
  const canUseAgent = isAssistantConfigured() && isAuthenticated && Boolean(sdk);

  const [messages, setMessages] = useState<AssistantMessage[]>([
    {
      role: "assistant",
      text: `I can explain why ${claim.id} reached a person, summarise the evidence, or tell you what's blocking it.`,
      local: !canUseAgent,
    },
  ]);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);
  /** Why the last question fell back to the local answer, if it did. */
  const [agentError, setAgentError] = useState<string | null>(null);

  async function send(text: string) {
    const question = text.trim();
    if (!question || pending) return;

    setAgentError(null);
    setMessages((m) => [...m, { role: "user", text: question }]);
    setDraft("");
    setPending(true);

    if (!canUseAgent) {
      setMessages((m) => [
        ...m,
        { role: "assistant", text: localAnswer(question, claim), local: true },
      ]);
      setPending(false);
      return;
    }

    try {
      const answer = await askAgent(sdk!, question, {
        threadKey: claim.id,
        identifiers: caseIdentifiers(claim),
        seedContext:
          `${claim.id}, ${claim.customer}, ${claim.site}. ` +
          `${claim.description}. In ${claim.currentStage}, owned by ` +
          `${claim.owner}.`,
      });
      setMessages((m) => [...m, { role: "assistant", text: answer }]);
    } catch (err) {
      const why = err instanceof Error ? err.message : "the agent was unreachable";
      console.warn("Conversational agent call failed, answering locally:", err);
      setAgentError(why);
      setMessages((m) => [
        ...m,
        { role: "assistant", text: localAnswer(question, claim), local: true },
      ]);
    } finally {
      setPending(false);
    }
  }

  return (
    <aside className="flex h-full w-full shrink-0 flex-col border-l border-border bg-background sm:w-[380px]">
      <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
        <span className="flex items-center gap-2 text-sm font-semibold">
          <span className="grid size-5 place-items-center rounded-full text-white [background-image:var(--ai-gradient)]">
            <AiMark className="size-3" />
          </span>
          Ask about this case
        </span>
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          className="grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-muted"
        >
          <X className="size-4" />
        </button>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {messages.map((message, i) => (
          <div
            key={i}
            className={cn(
              "min-w-0 max-w-[85%] rounded-lg px-3 py-2 text-sm",
              message.role === "assistant"
                ? "bg-muted text-foreground"
                : "ml-auto bg-primary text-primary-foreground",
            )}
          >
            {message.role === "assistant" ? (
              <AgentMarkdown>{message.text}</AgentMarkdown>
            ) : (
              <span className="whitespace-pre-line">{message.text}</span>
            )}
          </div>
        ))}
        {pending && (
          <div className="max-w-[85%] rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
            Thinking…
          </div>
        )}
      </div>

      <div className="flex flex-col gap-3 border-t border-border p-4">
        {agentError && (
          <p className="rounded-md bg-warning/10 px-2 py-1.5 text-[11px] leading-snug text-warning-foreground">
            <b className="font-semibold">Answered from case context.</b> The agent could not:{" "}
            {agentError}
          </p>
        )}
        {!canUseAgent && (
          <span className="text-[11px] leading-snug text-muted-foreground">
            {/* Says which of the two reasons applies. It used to tell you to
                set env vars that may well already be set, which sends a reader
                to a file to fix something that is not broken. */}
            Answering from case context.{" "}
            {isAssistantConfigured()
              ? "sign in to UiPath to ask the conversational agent."
              : "no conversational agent is configured."}
          </span>
        )}
        <div className="flex flex-wrap gap-2">
          {SUGGESTED_QUESTIONS.map((question) => (
            <button
              key={question}
              type="button"
              onClick={() => void send(question)}
              className="rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted"
            >
              {question}
            </button>
          ))}
        </div>
        <div className="relative">
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && void send(draft)}
            placeholder="Ask about this case…"
            className="h-11 rounded-lg pr-12 text-sm"
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
