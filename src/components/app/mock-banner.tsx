import { FlaskConical } from "lucide-react";
import { isMockProvider } from "@/lib/env";

/** Visible whenever AI or search providers return canned test data (never in production). */
export function MockModeBanner() {
  const ai = isMockProvider("ai");
  const search = isMockProvider("search");
  if (!ai && !search) return null;
  return (
    <div role="status" className="flex items-center justify-center gap-2 border-b border-warning/30 bg-warning/10 px-4 py-2 text-center text-xs text-warning">
      <FlaskConical className="size-3.5" />
      Mock mode: {ai && search ? "AI and web search return" : ai ? "AI returns" : "web search returns"} canned test data. Nothing generated here is real.
    </div>
  );
}
