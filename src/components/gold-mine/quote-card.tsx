import { ExternalLink, MessageSquare } from "lucide-react";
import { CopyButton } from "./copy-button";

const fmt = new Intl.DateTimeFormat("en", { dateStyle: "medium" });

export type QuoteView = {
  id: string;
  quote: string;
  url: string;
  platform: string;
  community: string | null;
  postedAt: Date | null;
  retrievedAt: Date;
  engagement?: number | null;
  isBest?: boolean;
};

/** A verbatim customer quote, always shown with its source. */
export function QuoteCard({ q, copy = false }: { q: QuoteView; copy?: boolean }) {
  return (
    <figure className="rounded-xl border border-border bg-white p-3.5 text-sm">
      <blockquote className="leading-relaxed">“{q.quote}”</blockquote>
      <figcaption className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
        <a href={q.url} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-1 hover:text-foreground">
          {q.platform}
          {q.community ? ` · ${q.community}` : ""} <ExternalLink className="size-3" />
        </a>
        <span>· {q.postedAt ? `posted ${fmt.format(q.postedAt)}` : `retrieved ${fmt.format(q.retrievedAt)}`}</span>
        {q.engagement != null ? (
          <span className="inline-flex items-center gap-1">
            · <MessageSquare className="size-3" /> {q.engagement}
          </span>
        ) : null}
        {q.isBest ? <span className="rounded bg-violet-50 px-1.5 font-medium text-violet-700">best</span> : null}
        {copy ? <CopyButton text={q.quote} className="ml-auto" /> : null}
      </figcaption>
    </figure>
  );
}
