import { TriangleAlert } from "lucide-react";

/**
 * Shown wherever a feature needs configuration that is missing.
 * We never fake a working integration.
 */
export function ConfigErrorNotice({
  title,
  missing,
  hint,
}: {
  title: string;
  missing: readonly string[];
  hint?: string;
}) {
  return (
    <div role="alert" className="rounded-2xl border border-warning/30 bg-warning/5 p-5 text-sm">
      <div className="flex items-center gap-2 font-medium text-warning">
        <TriangleAlert className="size-4" />
        {title}
      </div>
      <p className="mt-2 text-muted-foreground">
        Add these variables to <code className="font-mono text-foreground">.env</code> and restart the server:
      </p>
      <ul className="mt-2 space-y-1 font-mono text-xs text-foreground">
        {missing.map((m) => (
          <li key={m}>• {m}</li>
        ))}
      </ul>
      {hint ? <p className="mt-3 text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
