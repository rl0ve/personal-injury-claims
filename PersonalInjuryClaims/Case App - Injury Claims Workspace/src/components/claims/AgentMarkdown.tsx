import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

// The agent answers in Markdown (headings, bold, bullets, GFM tables) and the
// panels were rendering it as literal text, so a reply arrived full of `##` and
// `|---|---|`.
//
// Everything is scaled for a ~330px rail rather than a document column, and the
// element set is deliberately small: what the agent actually emits. A table is
// the one thing that cannot be made to fit, so it scrolls inside its own box
// rather than widening the bubble and pushing the panel over the case.

export function AgentMarkdown({ children, className }: { children: string; className?: string }) {
  return (
    <div className={cn("min-w-0 [&>*:first-child]:mt-0 [&>*:last-child]:mb-0", className)}>
      <Markdown
        remarkPlugins={[remarkGfm]}
        components={{
          // Heading levels collapse to two weights. An agent that opens with
          // `##` is not implying a document outline, and honouring six sizes in
          // a chat bubble reads as a mistake.
          h1: ({ children }) => (
            <p className="mb-1 mt-3 text-[13px] font-semibold leading-snug">{children}</p>
          ),
          h2: ({ children }) => (
            <p className="mb-1 mt-3 text-[13px] font-semibold leading-snug">{children}</p>
          ),
          h3: ({ children }) => (
            <p className="mb-1 mt-2.5 text-[12.5px] font-semibold leading-snug">{children}</p>
          ),
          h4: ({ children }) => (
            <p className="mb-1 mt-2.5 text-[12.5px] font-semibold leading-snug">{children}</p>
          ),
          p: ({ children }) => <p className="my-1.5 leading-relaxed">{children}</p>,
          strong: ({ children }) => <b className="font-semibold">{children}</b>,
          em: ({ children }) => <i className="italic">{children}</i>,
          ul: ({ children }) => (
            <ul className="my-1.5 flex list-disc flex-col gap-0.5 pl-4">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="my-1.5 flex list-decimal flex-col gap-0.5 pl-4">{children}</ol>
          ),
          li: ({ children }) => <li className="leading-relaxed">{children}</li>,
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noreferrer"
              className="text-primary underline underline-offset-2"
            >
              {children}
            </a>
          ),
          code: ({ children }) => (
            <code className="rounded bg-muted px-1 py-px font-mono text-[11px]">{children}</code>
          ),
          pre: ({ children }) => (
            <pre className="my-1.5 overflow-x-auto rounded-md bg-muted p-2 font-mono text-[11px]">
              {children}
            </pre>
          ),
          blockquote: ({ children }) => (
            <blockquote className="my-1.5 border-l-2 border-border pl-2 text-muted-foreground">
              {children}
            </blockquote>
          ),
          hr: () => <hr className="my-2.5 border-border" />,
          // A table is wider than any rail. Scrolling it inside its own box is
          // the only option that does not either clip a column or widen the
          // panel, and the header stays put while you scroll.
          table: ({ children }) => (
            <div className="my-2 max-w-full overflow-x-auto rounded-md border border-border">
              <table className="w-max min-w-full border-collapse text-[11.5px]">{children}</table>
            </div>
          ),
          thead: ({ children }) => <thead className="bg-muted/60">{children}</thead>,
          th: ({ children }) => (
            <th className="border-b border-border px-2 py-1 text-left font-semibold">{children}</th>
          ),
          td: ({ children }) => (
            <td className="border-b border-border/60 px-2 py-1 align-top">{children}</td>
          ),
        }}
      >
        {children}
      </Markdown>
    </div>
  );
}
