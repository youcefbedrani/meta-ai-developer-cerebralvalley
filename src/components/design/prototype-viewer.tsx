"use client";

import { ArrowLeft, Check, ChevronLeft, ChevronRight, Laptop, Loader2, MousePointerClick, RotateCcw, Smartphone } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { startCodebaseAction } from "@/app/(app)/app/(founder)/projects/[id]/design/actions";
import { Button } from "@/components/ui/button";
import { screenSlug } from "@/lib/prototype";
import { cn } from "@/lib/utils";

type ProtoScreen = { id: string; name: string; device: "MOBILE" | "DESKTOP"; links: number };

const DESKTOP_WIDTH = 1280;
const DESKTOP_HEIGHT = 820;

/**
 * Figma-style prototype mode: one screen at a time in a device frame. Clicking a hotspot inside the design
 * (data-goto) switches screens; clicking anywhere else flashes the hotspots. The screen runs in an
 * opaque-origin sandbox, so it can only talk to us through postMessage, and we only accept messages from it.
 */
export function PrototypeViewer({ projectId, screens, startId, cost, balance, hasCode }: { projectId: string; screens: ProtoScreen[]; startId: string; cost: number; balance: number; hasCode: boolean }) {
  const router = useRouter();
  const [currentId, setCurrentId] = useState(startId);
  const [history, setHistory] = useState<string[]>([]);
  const [visited, setVisited] = useState<Set<string>>(() => new Set([startId]));
  const [pending, start] = useTransition();
  const frame = useRef<HTMLIFrameElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  // Desktop screens render at their design width (1280px) and are scaled down to fit, like Figma's canvas.
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const el = stage.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setScale(Math.min(1, (entry.contentRect.width - 2) / DESKTOP_WIDTH)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const index = Math.max(0, screens.findIndex((s) => s.id === currentId));
  const current = screens[index];
  const mobile = current?.device === "MOBILE";

  const go = useCallback(
    (id: string) => {
      if (id === currentId) return;
      setHistory((h) => [...h, currentId]);
      setCurrentId(id);
      setVisited((v) => new Set(v).add(id));
    },
    [currentId],
  );
  const step = useCallback((d: 1 | -1) => go(screens[(index + d + screens.length) % screens.length].id), [go, index, screens]);

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (!frame.current || e.source !== frame.current.contentWindow) return;
      const data = e.data as { type?: string; target?: unknown; key?: unknown };
      if (data?.type === "startum-goto" && typeof data.target === "string") {
        const target = screens.find((s) => screenSlug(s.name) === data.target);
        if (target) go(target.id);
        else toast.message("That screen isn't designed yet", { description: `Add a "${data.target.replace(/-/g, " ")}" screen in the Design tab.` });
      } else if (data?.type === "startum-key") step(data.key === "ArrowLeft" ? -1 : 1);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "ArrowRight") step(1);
      if (e.key === "ArrowLeft") step(-1);
    };
    window.addEventListener("message", onMessage);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("message", onMessage);
      window.removeEventListener("keydown", onKey);
    };
  }, [go, screens, step]);

  if (!current) return null;
  const back = () => {
    const prev = history.at(-1);
    if (!prev) return;
    setHistory((h) => h.slice(0, -1));
    setCurrentId(prev);
  };
  const approve = () =>
    start(async () => {
      const r = await startCodebaseAction(projectId);
      if (!r.ok) return void toast.error(r.error);
      toast.success("Approved. Muse Spark is writing your code");
      router.push(`/app/projects/${projectId}/design#code`);
    });

  return (
    <div className="space-y-3">
      <div className="surface flex flex-wrap items-center gap-2 p-3">
        <Link href={`/app/projects/${projectId}/design`} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"><ArrowLeft className="size-4" /> Design</Link>
        <span className="mx-1 h-5 w-px bg-border" />
        <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary"><MousePointerClick className="size-3.5" /> Prototype</span>
        <span className="text-sm font-medium">{current.name}</span>
        <span className="text-xs text-muted-foreground">{index + 1} / {screens.length} · visited {visited.size}</span>
        <div className="ml-auto flex items-center gap-1">
          <button type="button" onClick={back} disabled={!history.length} className="inline-flex size-8 items-center justify-center rounded-lg hover:bg-muted disabled:opacity-40" aria-label="Back to the previous screen"><RotateCcw className="size-4" /></button>
          <button type="button" onClick={() => step(-1)} className="inline-flex size-8 items-center justify-center rounded-lg hover:bg-muted" aria-label="Previous screen"><ChevronLeft className="size-4" /></button>
          <button type="button" onClick={() => step(1)} className="inline-flex size-8 items-center justify-center rounded-lg hover:bg-muted" aria-label="Next screen"><ChevronRight className="size-4" /></button>
          <span className="mx-1 h-5 w-px bg-border" />
          {hasCode ? (
            <Link href={`/app/projects/${projectId}/design/code`} className="inline-flex h-9 items-center gap-1.5 rounded-[10px] border border-border px-3 text-sm hover:bg-muted">View the code</Link>
          ) : null}
          <Button variant="gradient" className="h-9 px-4" disabled={pending || balance < cost} onClick={approve}>{pending ? <Loader2 className="animate-spin" /> : <Check />} {hasCode ? "Approve & regenerate code" : "Approve & generate code"}</Button>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-[220px_minmax(0,1fr)]">
        <nav aria-label="Screens" className="surface max-h-[78vh] overflow-auto p-2">
          <p className="px-2 pb-2 pt-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Screens</p>
          <ul className="space-y-1">
            {screens.map((s, i) => (
              <li key={s.id}>
                <button type="button" onClick={() => go(s.id)} className={cn("flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm", s.id === currentId ? "bg-primary/10 font-medium text-primary" : "hover:bg-muted")}>
                  <span className="grid size-5 shrink-0 place-items-center rounded bg-muted text-[10px] text-muted-foreground">{i + 1}</span>
                  <span className="min-w-0 flex-1 truncate">{s.name}</span>
                  {s.device === "MOBILE" ? <Smartphone className="size-3.5 text-muted-foreground" /> : <Laptop className="size-3.5 text-muted-foreground" />}
                  {visited.has(s.id) ? <span className="size-1.5 rounded-full bg-success" aria-label="visited" /> : null}
                </button>
                {s.links ? null : <p className="px-9 text-[10px] text-muted-foreground">no links to other screens</p>}
              </li>
            ))}
          </ul>
          <p className="mt-3 border-t border-border px-2 pt-2 text-[11px] leading-relaxed text-muted-foreground">Click buttons and links in the design to move between screens. Click anywhere else to see what&apos;s clickable. ← → also work.</p>
        </nav>

        <div className="surface min-w-0 overflow-auto bg-[radial-gradient(circle_at_1px_1px,var(--border)_1px,transparent_0)] bg-[length:18px_18px] p-4">
          <div ref={stage} className="grid w-full place-items-center">
            <div key={current.id} className={cn("overflow-hidden bg-white shadow-2xl", mobile ? "rounded-[36px] border-[10px] border-neutral-900" : "rounded-xl border border-border")} style={mobile ? undefined : { width: DESKTOP_WIDTH * scale + 2 }}>
              {mobile ? null : (
                <div className="flex items-center gap-1.5 border-b border-border bg-muted/60 px-3 py-2">
                  <i className="size-2.5 rounded-full bg-red-400" /><i className="size-2.5 rounded-full bg-amber-400" /><i className="size-2.5 rounded-full bg-green-400" />
                  <span className="ml-3 truncate rounded-md bg-background px-2 py-0.5 text-[11px] text-muted-foreground">{screenSlug(current.name)}</span>
                </div>
              )}
              <div style={mobile ? undefined : { width: DESKTOP_WIDTH * scale, height: DESKTOP_HEIGHT * scale, overflow: "hidden" }}>
                <iframe
                  ref={frame}
                  title={`${current.name} prototype`}
                  src={`/app/projects/${projectId}/design/${current.id}/html?proto=1`}
                  sandbox="allow-scripts"
                  className="block origin-top-left border-0"
                  style={mobile ? { width: 390, height: 780 } : { width: DESKTOP_WIDTH, height: DESKTOP_HEIGHT, transform: `scale(${scale})` }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
