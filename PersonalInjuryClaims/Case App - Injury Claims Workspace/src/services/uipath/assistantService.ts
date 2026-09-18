// The backend for "Ask about this case".
//
// With a Conversational Agent configured (VITE_ASSISTANT_AGENT_ID +
// VITE_ASSISTANT_FOLDER_ID), questions stream from it over a WebSocket. Without
// one, or when it is unreachable, silent, or errors, `localAnswer` answers
// from the case in front of the reader. That fallback is deliberate: a demo
// should never show a dead panel, and the local answers say they are local.

import type { UiPath } from "@uipath/uipath-typescript/core";
import {
  ConversationalAgent,
  MessageRole,
  type SessionStream,
} from "@uipath/uipath-typescript/conversational-agent";
import { money } from "@/lib/claims/format";
import { formatRemaining } from "@/lib/claims/sla";
import type { InjuryClaim } from "@/lib/claims/types";
import { caseConfig, integrationConfig, isAssistantConfigured } from "./config";

export interface AssistantMessage {
  role: "assistant" | "user";
  text: string;
  /** True when the answer came from local case context rather than the agent. */
  local?: boolean;
}

export const SUGGESTED_QUESTIONS = [
  "Why did this case reach a person?",
  "What medical evidence is outstanding?",
  "Is liability admitted or disputed?",
  "How does quantum sit against the reserve?",
];

/**
 * One live conversation per thread, so context carries between questions.
 *
 * Asking "what about the wage loss?" after "why is liability disputed?" only
 * works if the agent still has the first turn. A fresh conversation per
 * question would make every follow-up a non-sequitur. Keyed by case (or case +
 * action), so two cases never share a thread.
 */
const threads = new Map<string, Promise<Thread>>();

/** A question in flight, keyed by the exchange carrying its answer. */
interface Pending {
  text: string;
  onChunk?: (soFar: string) => void;
  settle: (err?: Error) => void;
}

interface Thread {
  conversationId: string;
  session: SessionStream;
  /** Exchange id → the question waiting on it. */
  pending: Map<string, Pending>;
  /** True once the prose summary has gone out. */
  seeded: boolean;
  /**
   * The case this thread is about.
   *
   * Held here rather than taken from each call's options, because a question
   * asked on this thread is by definition about this case, and depending on
   * every caller to pass the same GUIDs on every click is how they went out
   * inconsistently. A caller can still refine them (the live instance id
   * arrives after the first read on an overlaid row); it cannot drop them.
   */
  identifiers: CaseIdentifiers;
}

/** Non-empty values win, so a later read can fill a blank but never clear one. */
export function mergeIdentifiers(base: CaseIdentifiers, next?: CaseIdentifiers): CaseIdentifiers {
  return {
    caseInstanceId: next?.caseInstanceId || base.caseInstanceId,
    folderKey: next?.folderKey || base.folderKey,
  };
}

/**
 * How long to wait for the server to acknowledge a new session.
 *
 * Then proceed regardless. The acknowledgement matters, because sending an exchange
 * before it lands is rejected with EXCHANGE_START_PROCESSING_FAILED. But a
 * server that never acknowledges is not a reason to refuse to try.
 */
const SESSION_ACK_MS = 4_000;

/**
 * How long a question may go *silent* before the local answer takes over.
 *
 * A deadline on silence, not on the whole answer. A question that needs several
 * tool calls ("is liability admitted or disputed?" walks stages, tasks and clocks)
 * can easily run past any sensible total, and killing it at a fixed 30 seconds
 * threw away an answer that was arriving. Every chunk pushes this out again.
 */
const ANSWER_SILENCE_MS = 45_000;

async function openThread(sdk: UiPath, identifiers: CaseIdentifiers): Promise<Thread> {
  const agentId = Number(integrationConfig.assistantAgentId);
  const folderId = Number(integrationConfig.assistantFolderId);
  const client = new ConversationalAgent(sdk);

  // Resolve the agent rather than trusting the two numbers in .env. A wrong id
  // otherwise opens a session that simply never answers, which looks like a
  // hung panel; this way it says which agents the folder actually holds.
  const inFolder = await client.getAll(folderId);
  const agent = inFolder.find((a) => a.id === agentId);
  if (!agent) {
    const seen = inFolder.map((a) => `${a.id} (${a.name})`).join(", ") || "none";
    throw new Error(`Agent ${agentId} is not in folder ${folderId}. That folder has: ${seen}.`);
  }

  // The agent-bound shorthand, so agentId and folderId cannot drift from the
  // agent just resolved.
  const conversation = await agent.conversations.create({ autogenerateLabel: true });
  const session = await conversation.startSession({ echo: true });

  await new Promise<void>((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      resolve();
    };
    session.onSessionStarted(finish);
    window.setTimeout(finish, SESSION_ACK_MS);
  });

  const thread: Thread = {
    conversationId: conversation.id,
    session,
    pending: new Map(),
    seeded: false,
    identifiers,
  };

  // Wired once per session, not once per question. The answer arrives on the
  // session's own exchange stream, so each exchange is matched back to the
  // question waiting on it by id.
  session.onExchangeStart((exchange) => {
    const waiting = thread.pending.get(exchange.exchangeId);
    if (!waiting) return;

    exchange.onMessageStart((message) => {
      // With echo on, the reader's own turn comes back here too.
      if (!message.isAssistant) return;
      message.onContentPartStart((part) => {
        part.onChunk((chunk) => {
          if (!chunk.data) return;
          waiting.text += chunk.data;
          waiting.onChunk?.(waiting.text);
        });
      });
    });

    exchange.onExchangeEnd(() => waiting.settle());
    exchange.onErrorStart((err) =>
      waiting.settle(new Error(err.message || "The conversational agent errored")),
    );
  });

  return thread;
}

function threadFor(
  sdk: UiPath,
  key: string,
  identifiers: CaseIdentifiers,
): Promise<Thread> {
  const existing = threads.get(key);
  if (existing) {
    // Fold in anything newly known. An overlaid row has no instance id until
    // the live read lands, and the thread should pick it up rather than spend
    // the rest of the conversation without it.
    return existing.then((thread) => {
      thread.identifiers = mergeIdentifiers(thread.identifiers, identifiers);
      return thread;
    });
  }
  // Cached as the promise, not the result, so two questions asked in quick
  // succession share one conversation instead of racing to open two.
  const opening = openThread(sdk, identifiers).catch((err) => {
    threads.delete(key);
    throw err;
  });
  threads.set(key, opening);
  return opening;
}

/** Drops a thread, so the next question starts a new conversation. */
export function endThread(key: string): void {
  const handle = threads.get(key);
  threads.delete(key);
  void handle?.then(({ session }) => session.sendSessionEnd()).catch(() => {});
}

export interface CaseIdentifiers {
  /** The Maestro case instance GUID. */
  caseInstanceId?: string;
  /** The folder GUID the instance lives in. */
  folderKey?: string;
}

/**
 * The GUIDs off a case, for the agent's tools.
 *
 * `instanceId` is empty on a demo row, and on the overlay it is the live
 * instance the row is painted over, which is exactly the one the agent should
 * open. The folder falls back to the configured case folder, since a case read
 * from that folder lives in it whether or not the row says so.
 *
 * Empty strings are dropped rather than sent: `folderKey: ` with nothing after
 * it is worse than an absent line, because a tool will try to use it.
 */
export function caseIdentifiers(claim: {
  instanceId?: string;
  folderKey?: string;
}): CaseIdentifiers {
  return {
    caseInstanceId: claim.instanceId || undefined,
    folderKey: claim.folderKey || caseConfig.folderKey || undefined,
  };
}

export interface AskOptions {
  /** Groups questions into one conversation. Usually the case id. */
  threadKey: string;
  /**
   * The GUIDs the agent's case-lookup tools need.
   *
   * Not optional in practice: without them the agent has a question about a
   * case it cannot open, and its tools fail on the missing arguments. They go
   * out as their own labelled lines rather than inside the prose or a JSON
   * blob, so a tool can lift them without parsing English.
   */
  identifiers?: CaseIdentifiers;
  /** A short description of the case, for the agent's first turn. */
  seedContext?: string;
  /** Called with the answer so far, as it streams. */
  onChunk?: (soFar: string) => void;
}

/**
 * The identifier lines, as the agent's tools expect to find them.
 *
 * Sent with **every** turn, not just the first. They were first-turn-only, on
 * the assumption the agent would carry them forward, and it does not: a tool
 * call on the second question had no case to open, which is why a suggested
 * question like "How long is left on the clock?" failed while the opening one
 * worked. Repeating three short lines is a trivial cost next to a whole class
 * of failure that only shows up on the second question.
 *
 * Empty values are omitted rather than sent blank: a tool will try to use
 * `folderKey:` with nothing after it.
 */
export function identifierLines(identifiers?: CaseIdentifiers): string {
  const lines: string[] = [];
  if (identifiers?.caseInstanceId) lines.push(`caseInstanceId: ${identifiers.caseInstanceId}`);
  if (identifiers?.folderKey) lines.push(`folderKey: ${identifiers.folderKey}`);
  if (!lines.length) return "";
  return `Case identifiers (use these for tool calls):\n${lines.join("\n")}`;
}

/**
 * What goes in front of one question.
 *
 * Identifiers every time; the prose summary only on the first turn of a thread,
 * because it is bulky and the agent genuinely does keep the conversation.
 * Exported because this is the contract with the agent's tools, the labelled lines
 * they lift the GUIDs from, and a format that drifts silently is how the panel
 * ends up asking about a case the agent cannot open.
 */
export function seedBlock(options: AskOptions, withSummary = true): string {
  return [
    identifierLines(options.identifiers),
    withSummary && options.seedContext ? `Case summary: ${options.seedContext}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");
}

/**
 * One turn as the agent receives it: the preamble, then the question.
 *
 * Exported so the every-turn identifier rule is under test rather than under
 * assumption. It was first-turn-only, and the failure that caused only appears
 * on the *second* question, which is exactly the kind of bug a demo finds live.
 */
export function turnPayload(
  question: string,
  options: AskOptions,
  withSummary: boolean,
): string {
  const seed = seedBlock(options, withSummary);
  return seed ? `Context:\n${seed}\n\n${question}` : question;
}

/**
 * Asks the configured Conversational Agent, streaming the reply.
 *
 * The transport is a WebSocket and the shape is nested: a session carries
 * exchanges, an exchange carries messages, a message carries content parts, and
 * text arrives as chunks on those parts.
 *
 * The message is sent through the explicit lifecycle of `startMessage`,
 * `sendContentPart` and `sendMessageEnd`, rather than the one-shot
 * `sendMessageWithContentPart`, which the service accepts without ever
 * answering. The exchange id is a upper-cased UUID for the same reason: the
 * service rejects other shapes with EXCHANGE_START_PROCESSING_FAILED.
 *
 * Rejects rather than returning something vague when the agent is unreachable,
 * silent, or errors: the caller falls back to `localAnswer`, and a demo that
 * quietly shows a worse answer as though it came from the agent is worse than
 * one that says where the answer came from.
 */
export async function askAgent(
  sdk: UiPath,
  question: string,
  options: AskOptions,
): Promise<string> {
  if (!isAssistantConfigured()) {
    throw new Error("No conversational agent configured");
  }

  if (import.meta.env.DEV) {
    // Logged before the connection, not after. The identifiers are the whole
    // contract with the agent's tools, and a log that only appears once the
    // socket is up is missing in exactly the case worth diagnosing.
    console.debug("[assistant] question carrying:", {
      thread: options.threadKey,
      ...(options.identifiers ?? {}),
    });
  }

  const thread = await threadFor(sdk, options.threadKey, options.identifiers ?? {});

  // Resolved from the thread, not from this call's options: the identifiers
  // belong to the case, and a click that happens to render without them must
  // not send a question the agent cannot ground.
  const identifiers = thread.identifiers;
  if (!identifiers.caseInstanceId) {
    console.warn(
      "[assistant] asking without a case instance id. The agent's case tools " +
        "will have nothing to open. Thread:",
      options.threadKey,
    );
  }

  // Match the SDK's own id shape. It uses crypto.randomUUID().toUpperCase(),
  // and the service rejects anything else.
  const exchangeId = crypto.randomUUID().toUpperCase();

  // The summary is a first-turn nicety; the identifiers are not, and are sent
  // every time. `seeded` only flips once a summary has actually gone out, so a
  // thread that opened without one is not marked as having sent it.
  const summaryThisTurn = !thread.seeded && Boolean(options.seedContext);
  if (summaryThisTurn) thread.seeded = true;
  const payload = turnPayload(question, { ...options, identifiers }, summaryThisTurn);


  return new Promise<string>((resolve, reject) => {
    let settled = false;
    let timer = 0;

    function settle(err?: Error) {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      const answer = thread.pending.get(exchangeId)?.text ?? "";
      thread.pending.delete(exchangeId);

      // Partial text beats no text. A stream that stalls after saying something
      // useful has still said it, and discarding it to show the local answer
      // instead loses work the agent already did.
      if (answer.trim() && (!err || err.name === "SilenceTimeout")) {
        resolve(answer);
        return;
      }
      reject(err ?? new Error("The conversational agent returned an empty answer"));
    }

    function keepAlive() {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        const err = new Error(
          thread.pending.get(exchangeId)?.text
            ? "The conversational agent stopped mid-answer"
            : "The conversational agent did not answer",
        );
        err.name = "SilenceTimeout";
        settle(err);
      }, ANSWER_SILENCE_MS);
    }

    keepAlive();

    thread.pending.set(exchangeId, {
      text: "",
      // Each chunk is proof it is still working, so the clock starts over.
      onChunk: (soFar) => {
        keepAlive();
        options.onChunk?.(soFar);
      },
      settle,
    });

    try {
      const exchange = thread.session.startExchange({ exchangeId });
      const message = exchange.startMessage({ role: MessageRole.User });
      void message
        .sendContentPart({ data: payload })
        .then(() => message.sendMessageEnd())
        .catch((err: unknown) =>
          settle(err instanceof Error ? err : new Error("Could not send the question")),
        );
    } catch (err) {
      settle(err instanceof Error ? err : new Error("Could not start the exchange"));
    }
  });
}

/**
 * Answers from the case in hand. Keyword-matched on purpose: it is a fallback,
 * not a model, and pretending otherwise in a demo would be worse than useless.
 */
export function localAnswer(question: string, claim: InjuryClaim): string {
  const q = question.toLowerCase();

  if (q.includes("why") && (q.includes("person") || q.includes("here") || q.includes("reach"))) {
    return claim.queueReason
      ? `${claim.queueReason}. The case is in ${claim.currentStage}, owned by ${claim.owner} (${claim.ownerRole}).`
      : `Nothing is waiting on a person. ${claim.id} is in ${claim.currentStage} and progressing on its own.`;
  }

  if (q.includes("evidence") || q.includes("medical") || q.includes("record")) {
    if (claim.evidence.length === 0) {
      return "No medical or supporting evidence is attached to this case yet.";
    }
    const lines = claim.evidence.map(
      (e) => `• ${e.title}${e.verdict ? `: ${e.verdict}` : ""}`,
    );
    return `${claim.evidence.length} evidence items are attached, medical records among them:\n${lines.join("\n")}`;
  }

  if (q.includes("liab") || q.includes("negligen") || q.includes("fault")) {
    const position = String(claim.variables["Coverage.Position"] ?? "not yet set");
    return `The liability position on ${claim.id} is ${position}. The case sits in ${claim.currentStage}, owned by ${claim.owner}${claim.ownerRole ? ` (${claim.ownerRole})` : ""}. Any admission or denial is recorded against that position before quantum is agreed.`;
  }

  if (q.includes("quantum") || q.includes("reserve") || q.includes("damages") || q.includes("settle")) {
    return `Quantum on ${claim.id} is carried at ${money(claim.claimValue)} against the reserve, covering general and special damages plus care and rehabilitation costs. It is not agreed until the medical evidence is complete and liability is settled.`;
  }

  if (q.includes("block") || q.includes("clos")) {
    if (claim.activeLanes.length > 0) {
      return `Closure is gated by ${claim.activeLanes.join(" and ")}. Until that lane completes, ${claim.currentStage} cannot complete.`;
    }
    return `Nothing is gating closure beyond the normal path. The case is in ${claim.currentStage}.`;
  }

  if (q.includes("clock") || q.includes("sla") || q.includes("long") || q.includes("due")) {
    return `${claim.currentStage} carries a ${Math.round(claim.slaMinutes / 60)}-hour clock. ${formatRemaining(claim.elapsedMinutes, claim.slaMinutes)}, currently ${claim.slaStatus.toLowerCase()}.`;
  }

  if (q.includes("cost") || q.includes("value") || q.includes("claim")) {
    return `The claim value on ${claim.id} is ${money(claim.claimValue)}.`;
  }

  if (q.includes("who") || q.includes("owner") || q.includes("assign")) {
    return `${claim.owner}, ${claim.ownerRole}, owns ${claim.id} in ${claim.currentStage}.`;
  }

  return `${claim.id} · ${claim.customer} · ${claim.site}. Currently in ${claim.currentStage}, ${claim.slaStatus.toLowerCase()} against its clock, owned by ${claim.owner}. Ask about the medical evidence, the liability position, or quantum.`;
}
