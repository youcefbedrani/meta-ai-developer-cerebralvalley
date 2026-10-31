"use client";

import { ArrowLeft, Check, CircleAlert, Copy, Download, File, FilePlus2, FolderOpen, History, Loader2, MousePointerClick, Save, Sparkles, Trash2, Undo2, Wand2, Zap } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { changeCodeAction, fixCodeAction, restoreCodeAction, saveCodeAction } from "@/app/(app)/app/(founder)/projects/[id]/design/actions";
import { MetaMark } from "@/components/brand/hackathon-lockup";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Issue = { file: string; line: number; message: string };
type Check = { ok: boolean; issues: Issue[]; checkedAt: string } | null;
type Version = { id: string; version: number | null; note: string | null; ok: boolean | null; createdAt: string };

const EDITABLE = /^(src\/[\w\-./[\]()@]+\.(tsx?|css|json)|public\/[\w\-./]+|package\.json|README\.md)$/;

/**
 * The generated codebase as an editor: change any file yourself, or ask Muse Spark for a change. Every saved
 * change becomes a new version and is type-checked in the background; Muse Spark fixes what the check finds.
 */
export function CodeViewer(props: {
  projectId: string;
  versionId: string;
  version: number;
  note: string;
  summary: string | null;
  name: string;
  files: Record<string, string>;
  order: string[];
  generatedAt: string;
  check: Check;
  job: { stage: string | null; mode: string } | null;
  lastError: string | null;
  versions: Version[];
  costs: { change: number; fix: number };
  balance: number;
}) {
  const { projectId, versionId, name, files, check, job, costs, balance } = props;
  const router = useRouter();
  const [path, setPath] = useState(props.order.find((p) => p.endsWith("page.tsx")) ?? props.order[0]);
  const [edits, setEdits] = useState<Record<string, string | null>>({});
  const [newPath, setNewPath] = useState("");
  const [request, setRequest] = useState("");
  const [showVersions, setShowVersions] = useState(false);
  const [pending, start] = useTransition();
  const editor = useRef<HTMLTextAreaElement>(null);
  const busy = !!job;
  const checking = busy && job?.mode === "check";

  // While a job runs (Muse Spark changing / fixing, or the check), refresh until it's done.
  useEffect(() => {
    if (!busy) return;
    const id = setInterval(() => router.refresh(), 3000);
    return () => clearInterval(id);
  }, [busy, router]);

  const current = useMemo(() => {
    const out: Record<string, string> = { ...files };
    for (const [p, c] of Object.entries(edits)) {
      if (c === null) delete out[p];
      else out[p] = c;
    }
    return out;
  }, [files, edits]);
  const paths = useMemo(() => {
    const added = Object.keys(current).filter((p) => !props.order.includes(p)).sort();
    return [...props.order.filter((p) => p in current), ...added];
  }, [current, props.order]);
  const groups = useMemo(() => {
    const out: Record<string, string[]> = {};
    for (const p of paths) {
      const dir = p.includes("/") ? p.slice(0, p.lastIndexOf("/")) : "";
      (out[dir] ??= []).push(p);
    }
    return Object.entries(out);
  }, [paths]);
  const dirty = Object.keys(edits).length;
  const code = current[path] ?? "";
  const editable = EDITABLE.test(path) && !busy;
  const fileIssues = (p: string) => (check?.issues ?? []).filter((i) => i.file === p).length;
  const base = `/app/projects/${projectId}/design`;

  const edit = (p: string, value: string | null) => setEdits((e) => {
    const next = { ...e };
    if (value !== null && files[p] === value) delete next[p];
    else next[p] = value;
    return next;
  });
  const run = (fn: () => Promise<{ ok: true } | { ok: false; error: string }>, success: string, after?: () => void) =>
    start(async () => {
      const r = await fn();
      if (!r.ok) return void toast.error(r.error);
      toast.success(success);
      after?.();
      router.refresh();
    });
  const goTo = (file: string, line: number) => {
    setPath(file);
    requestAnimationFrame(() => {
      const el = editor.current;
      if (!el) return;
      const offset = (current[file] ?? "").split("\n").slice(0, line - 1).join("\n").length + (line > 1 ? 1 : 0);
      el.focus();
      el.setSelectionRange(offset, offset);
      el.scrollTop = Math.max(0, (line - 4) * 20);
    });
  };

  return (
    <div className="space-y-3">
      {/* Top bar */}
      <div className="surface flex flex-wrap items-center gap-2 p-3">
        <Link href={base} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"><ArrowLeft className="size-4" /> Design</Link>
        <span className="mx-1 h-5 w-px bg-border" />
        <div className="min-w-0">
          <p className="text-sm font-medium">{name}: MVP code <span className="ml-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-normal text-muted-foreground">v{props.version}</span></p>
          <p className="truncate text-xs text-muted-foreground">{props.note} · Next.js + Tailwind · {paths.length} files · {new Date(props.generatedAt).toLocaleString()}</p>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <div className="relative">
            <button type="button" onClick={() => setShowVersions((v) => !v)} className="inline-flex h-9 items-center gap-1.5 rounded-[10px] border border-border px-3 text-sm hover:bg-muted"><History className="size-4" /> Versions</button>
            {showVersions ? (
              <div className="absolute right-0 z-20 mt-1 w-80 rounded-xl border border-border bg-card p-1 shadow-xl">
                {props.versions.map((v) => (
                  <div key={v.id} className={cn("flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs", v.id === versionId && "bg-primary/10")}>
                    <span className="font-medium">v{v.version ?? "?"}</span>
                    {v.ok === true ? <Check className="size-3.5 text-success" /> : v.ok === false ? <CircleAlert className="size-3.5 text-amber-600" /> : null}
                    <span className="min-w-0 flex-1 truncate text-muted-foreground" title={v.note ?? ""}>{v.note ?? "Update"}</span>
                    {v.id === versionId ? <span className="text-[10px] text-primary">current</span> : (
                      <button type="button" disabled={pending || busy} onClick={() => run(() => restoreCodeAction(projectId, v.id), `Restored v${v.version}`, () => setShowVersions(false))} className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 hover:bg-muted disabled:opacity-50"><Undo2 className="size-3" /> Restore</button>
                    )}
                  </div>
                ))}
              </div>
            ) : null}
          </div>
          <Link href={`${base}/prototype`} className="inline-flex h-9 items-center gap-1.5 rounded-[10px] border border-border px-3 text-sm hover:bg-muted"><MousePointerClick className="size-4" /> Prototype</Link>
          <a href={`${base}/code/download`} className="inline-flex h-9 items-center gap-1.5 rounded-[10px] border border-border px-3 text-sm hover:bg-muted"><Download className="size-4" /> .zip</a>
          {/* StackBlitz's POST API: the files go to StackBlitz only when the founder clicks. */}
          <form action="https://stackblitz.com/run?file=README.md" method="post" target="_blank">
            <input type="hidden" name="project[title]" value={name} />
            <input type="hidden" name="project[description]" value={`${name}: MVP generated with Startum`} />
            <input type="hidden" name="project[template]" value="node" />
            {Object.keys(files).map((p) => <input key={p} type="hidden" name={`project[files][${p}]`} value={files[p]} />)}
            <Button type="submit" variant="gradient" className="h-9 px-4" disabled={dirty > 0} title={dirty ? "Save your changes first" : undefined}><Zap /> Run on StackBlitz</Button>
          </form>
        </div>
      </div>

      {/* Status + Ask Muse Spark */}
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <div className="surface p-4">
          {busy ? (
            <div className="flex items-center gap-3" aria-live="polite">
              <Loader2 className="size-5 animate-spin text-primary" />
              <div>
                <p className="text-sm font-medium">{checking ? "Checking that it runs…" : "Muse Spark is working on your code…"}</p>
                <p className="text-xs text-muted-foreground">{job?.stage ?? "Starting"}</p>
              </div>
            </div>
          ) : check?.ok ? (
            <div className="flex items-start gap-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-success/15 text-success"><Check className="size-5" /></span>
              <div>
                <p className="text-sm font-medium">Compiles: 0 problems</p>
                <p className="text-xs text-muted-foreground">Every file type-checked, plus the React rules that break apps at runtime. Checked {new Date(check.checkedAt).toLocaleTimeString()}.</p>
              </div>
            </div>
          ) : check ? (
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="flex items-center gap-2 text-sm font-medium text-amber-700"><CircleAlert className="size-4" /> {check.issues.length} problem{check.issues.length === 1 ? "" : "s"} to fix before it runs</p>
                <Button size="sm" variant="gradient" disabled={pending || balance < costs.fix} onClick={() => run(() => fixCodeAction(projectId), "Muse Spark is fixing the problems")}><Wand2 /> Fix with Muse Spark · {costs.fix} credits</Button>
              </div>
              <ul className="mt-2 max-h-36 space-y-1 overflow-auto text-xs">
                {check.issues.map((i, n) => (
                  <li key={n}>
                    <button type="button" onClick={() => goTo(i.file, i.line)} className="w-full rounded-md px-2 py-1 text-left hover:bg-muted"><code className="font-medium">{i.file}:{i.line}</code> <span className="text-muted-foreground">{i.message}</span></button>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Not checked yet.</p>
          )}
          {props.lastError && !busy ? <p className="mt-2 text-xs text-destructive">{props.lastError}</p> : null}
          {props.summary && !busy ? <p className="mt-3 border-t border-border pt-2 text-xs text-muted-foreground"><b className="text-foreground">Last change:</b> {props.summary}</p> : null}
        </div>

        <form
          className="surface ambient-glow flex flex-col gap-2 p-4"
          onSubmit={(e) => {
            e.preventDefault();
            run(() => changeCodeAction(projectId, request), "Muse Spark is changing your code", () => setRequest(""));
          }}
        >
          <label htmlFor="code-request" className="flex items-center gap-2 text-sm font-medium"><Sparkles className="size-4 text-primary" /> Ask Muse Spark to change the code <span className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-[10px] font-normal text-muted-foreground"><MetaMark /> Meta AI</span></label>
          <textarea id="code-request" value={request} onChange={(e) => setRequest(e.target.value)} rows={2} disabled={busy} placeholder='e.g. "Add a pricing page with 3 plans and link it from the nav" or "Show overdue items in red on the dashboard"' className="w-full rounded-lg border border-border bg-background p-2 text-sm disabled:opacity-60" />
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-muted-foreground">It edits the files, then checks the code compiles and fixes what doesn&apos;t.</span>
            <Button type="submit" size="sm" variant="gradient" disabled={pending || busy || dirty > 0 || request.trim().length < 4 || balance < costs.change} title={dirty ? "Save or discard your own edits first" : undefined}>{pending ? <Loader2 className="animate-spin" /> : <Wand2 />} Apply · {costs.change} credits</Button>
          </div>
        </form>
      </div>

      {/* Files + editor */}
      <div className="grid gap-3 lg:grid-cols-[260px_minmax(0,1fr)]">
        <nav aria-label="Files" className="surface max-h-[72vh] overflow-auto p-2 text-sm">
          <form
            className="mb-2 flex gap-1"
            onSubmit={(e) => {
              e.preventDefault();
              const p = newPath.trim().replace(/^\/+/, "");
              if (!EDITABLE.test(p)) return void toast.error("New files go in src/ (e.g. src/components/Pricing.tsx) or public/.");
              if (p in current) return void toast.error("That file already exists.");
              edit(p, p.endsWith(".tsx") ? `export default function Component() {\n  return <div></div>;\n}\n` : "");
              setPath(p);
              setNewPath("");
            }}
          >
            <input aria-label="New file path" value={newPath} onChange={(e) => setNewPath(e.target.value)} disabled={busy} placeholder="src/components/New.tsx" className="h-8 min-w-0 flex-1 rounded-md border border-border bg-background px-2 text-xs" />
            <button type="submit" disabled={busy} className="inline-flex size-8 items-center justify-center rounded-md border border-border hover:bg-muted disabled:opacity-50" aria-label="Add file"><FilePlus2 className="size-4" /></button>
          </form>
          {groups.map(([dir, ps]) => (
            <div key={dir || "root"} className="mb-2">
              {dir ? <p className="flex items-center gap-1.5 px-2 py-1 text-xs text-muted-foreground"><FolderOpen className="size-3.5" /> {dir}</p> : null}
              <ul>
                {ps.map((p) => (
                  <li key={p}>
                    <button type="button" onClick={() => setPath(p)} className={cn("flex w-full items-center gap-1.5 rounded-md py-1 pr-2 text-left", dir ? "pl-6" : "pl-2", p === path ? "bg-primary/10 font-medium text-primary" : "hover:bg-muted")}>
                      <File className="size-3.5 shrink-0 opacity-60" /> <span className="min-w-0 flex-1 truncate">{p.slice(dir ? dir.length + 1 : 0)}</span>
                      {fileIssues(p) ? <span className="rounded-full bg-amber-100 px-1.5 text-[10px] text-amber-800">{fileIssues(p)}</span> : null}
                      {p in edits ? <span className="size-1.5 rounded-full bg-primary" aria-label="unsaved" /> : null}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        <div className="surface flex min-w-0 flex-col overflow-hidden">
          <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2 text-xs">
            <code className="truncate font-medium">{path}</code>
            <span className="text-muted-foreground">{code.split("\n").length} lines{editable ? "" : " · read-only"}</span>
            <div className="ml-auto flex items-center gap-1">
              <button type="button" className="inline-flex items-center gap-1 rounded-md px-2 py-1 hover:bg-muted" onClick={() => navigator.clipboard.writeText(code).then(() => toast.success("Copied"), () => toast.error("Couldn't copy"))}><Copy className="size-3.5" /> Copy</button>
              {editable && path !== "package.json" ? <button type="button" className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-destructive hover:bg-destructive/10" onClick={() => { edit(path, null); setPath(paths.find((p) => p !== path) ?? "README.md"); }}><Trash2 className="size-3.5" /> Delete</button> : null}
            </div>
          </div>
          <textarea
            ref={editor}
            aria-label={`Contents of ${path}`}
            value={code}
            readOnly={!editable}
            spellCheck={false}
            onChange={(e) => edit(path, e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== "Tab" || !editable) return;
              e.preventDefault();
              const el = e.currentTarget;
              const { selectionStart: a, selectionEnd: b } = el;
              edit(path, `${code.slice(0, a)}  ${code.slice(b)}`);
              requestAnimationFrame(() => el.setSelectionRange(a + 2, a + 2));
            }}
            className="min-h-[62vh] w-full resize-y bg-neutral-950 p-4 font-mono text-[12.5px] leading-5 text-neutral-100 outline-none"
          />
          {dirty ? (
            <div className="flex flex-wrap items-center gap-2 border-t border-border bg-primary/5 px-3 py-2 text-sm">
              <span className="text-muted-foreground">{dirty} unsaved file{dirty === 1 ? "" : "s"}: {Object.keys(edits).join(", ")}</span>
              <div className="ml-auto flex gap-2">
                <Button size="sm" variant="outline" disabled={pending} onClick={() => setEdits({})}>Discard</Button>
                <Button size="sm" variant="gradient" disabled={pending || busy} onClick={() => run(() => saveCodeAction(projectId, versionId, edits), "Saved. Checking that it runs…", () => setEdits({}))}>{pending ? <Loader2 className="animate-spin" /> : <Save />} Save & check</Button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
