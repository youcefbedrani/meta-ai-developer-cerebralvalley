"use client";

import { useEffect } from "react";

/**
 * Interactions and animations for the marketing landing page, ported from the
 * static HTML design. Works on the server-rendered markup inside #landing and
 * cleans up every observer, timer and listener on unmount.
 */
export function LandingEffects() {
  useEffect(() => {
    const root = document.getElementById("landing");
    if (!root) return;
    const $ = (sel: string) => root.querySelector<HTMLElement>(sel);
    const $$ = (sel: string) => [...root.querySelectorAll<HTMLElement>(sel)];
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const cleanups: (() => void)[] = [];
    const on = <K extends keyof HTMLElementEventMap>(el: HTMLElement | Window | null, type: K | string, fn: EventListener, opts?: AddEventListenerOptions) => {
      if (!el) return;
      el.addEventListener(type, fn, opts);
      cleanups.push(() => el.removeEventListener(type, fn, opts));
    };
    const every = (fn: () => void, ms: number) => {
      const id = window.setInterval(fn, ms);
      cleanups.push(() => window.clearInterval(id));
    };
    const later = (fn: () => void, ms: number) => {
      const id = window.setTimeout(fn, ms);
      cleanups.push(() => window.clearTimeout(id));
    };

    /* Hero words blur in */
    const raf = requestAnimationFrame(() => requestAnimationFrame(() => root.classList.add("loaded")));
    cleanups.push(() => cancelAnimationFrame(raf));

    /* Scroll reveal */
    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("in");
            io.unobserve(e.target);
          }
        }),
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" },
    );
    $$(".rv,.rv-scale").forEach((el) => io.observe(el));
    cleanups.push(() => io.disconnect());

    const onView = (el: Element | null, fn: () => void, threshold = 0.35) => {
      if (!el) return;
      const o = new IntersectionObserver(
        ([e]) => {
          if (e.isIntersecting) {
            fn();
            o.disconnect();
          }
        },
        { threshold },
      );
      o.observe(el);
      cleanups.push(() => o.disconnect());
    };

    /* Nav shrink + mobile menu */
    const nav = $("#nav");
    const onScroll = () => nav?.classList.toggle("scrolled", window.scrollY > 40);
    on(window, "scroll", onScroll, { passive: true });
    onScroll();
    const menu = $("#mobileMenu");
    on($("#burger"), "click", () => menu?.classList.toggle("open"));
    $$("#mobileMenu a").forEach((a) => on(a, "click", () => menu?.classList.remove("open")));

    /* Hero scene pointer parallax */
    const scene = $("#scene");
    const tilt = $("#tilt");
    if (!reduce && window.matchMedia("(pointer:fine)").matches && scene && tilt) {
      on(scene, "pointermove", ((e: PointerEvent) => {
        const r = scene.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width - 0.5;
        const y = (e.clientY - r.top) / r.height - 0.5;
        tilt.style.transform = `rotateX(${-y * 8}deg) rotateY(${x * 10}deg)`;
      }) as EventListener);
      on(scene, "pointerleave", () => (tilt.style.transform = ""));
    }

    /* Citation stack rotation */
    const stack = $$("#citeStack .cite");
    const order = stack.map((_, i) => i);
    const layout = () =>
      order.forEach((idx, pos) => {
        const c = stack[idx];
        c.style.zIndex = String(10 - pos);
        c.style.transform = `translateY(${pos * 14}px) scale(${1 - pos * 0.05})`;
        c.style.opacity = String(pos > 2 ? 0 : 1 - pos * 0.25);
        c.style.filter = pos ? `blur(${pos * 0.6}px)` : "none";
      });
    layout();
    if (!reduce && stack.length) {
      every(() => {
        const first = stack[order[0]];
        first.style.transform = "translateY(-30px) scale(1.02)";
        first.style.opacity = "0";
        later(() => {
          order.push(order.shift()!);
          layout();
        }, 450);
      }, 2800);
    }

    /* How it works: auto-advancing tabs */
    const steps = $$("#steps .step");
    const screens = $$(".stage .screen");
    const DUR = 5200;
    let cur = 0;
    let t0 = performance.now();
    let frame = 0;
    const go = (i: number) => {
      cur = i;
      t0 = performance.now();
      steps.forEach((s, k) => {
        s.classList.toggle("on", k === i);
        const prog = s.querySelector<HTMLElement>(".prog");
        if (prog) prog.style.width = "0";
      });
      screens.forEach((s, k) => s.classList.toggle("on", k === i));
    };
    steps.forEach((s, i) => on(s, "click", () => go(i)));
    const tick = (now: number) => {
      const p = Math.min((now - t0) / DUR, 1);
      const prog = steps[cur]?.querySelector<HTMLElement>(".prog");
      if (prog) prog.style.width = `${p * 100}%`;
      if (p >= 1) go((cur + 1) % steps.length);
      frame = requestAnimationFrame(tick);
    };
    onView($("#steps"), () => {
      if (!reduce && steps.length) {
        go(0);
        frame = requestAnimationFrame(tick);
      }
    }, 0.2);
    cleanups.push(() => cancelAnimationFrame(frame));

    /* Bars inside cards fill when visible */
    $$(".feat .hbar i").forEach((bar) => {
      const target = getComputedStyle(bar).getPropertyValue("--w");
      bar.style.width = "0";
      onView(bar, () => (bar.style.width = target));
    });

    /* Example dossier: tick off todos; scope limiter strikes items */
    onView($("#todos"), () =>
      $$("#todos .todo").forEach((t, i) => i < 2 && later(() => t.classList.add("done"), 500 + i * 700)),
    );
    onView($("#scope"), () => later(() => $("#scope")?.classList.add("go"), 500));

    /* ⌘K typing loop */
    const queries = ["RevOps ideas", "sources: pricing", "competitors"];
    const typed = $("#typed");
    const results = $$("#cmdRes div");
    let cancelled = false;
    cleanups.push(() => (cancelled = true));
    const sleep = (ms: number) => new Promise((r) => later(() => r(undefined), ms));
    const typeLoop = async () => {
      let qi = 0;
      while (!cancelled && typed) {
        const q = queries[qi];
        for (let i = 1; i <= q.length && !cancelled; i++) {
          typed.textContent = q.slice(0, i);
          await sleep(60);
        }
        results.forEach((r, k) => r.classList.toggle("hl", k === qi));
        await sleep(1700);
        for (let i = q.length; i >= 0 && !cancelled; i--) {
          typed.textContent = q.slice(0, i);
          await sleep(24);
        }
        await sleep(300);
        qi = (qi + 1) % queries.length;
      }
    };
    onView(typed, () => {
      if (reduce && typed) typed.textContent = queries[0];
      else void typeLoop();
    });

    /* Private-by-default cipher scramble */
    if (!reduce) {
      const glyphs = "ABCDEF0123456789#$%&*@";
      const scr = $$("[data-scramble]");
      let enc = false;
      every(() => {
        enc = !enc;
        scr.forEach((el) => {
          const plain = el.dataset.scramble ?? "";
          let f = 0;
          const id = window.setInterval(() => {
            f++;
            el.textContent = [...plain]
              .map((ch, i) => {
                if (ch === " ") return " ";
                const settled = i < f * 1.5;
                if (enc) return settled ? glyphs[(i * 7 + plain.length) % glyphs.length] : ch;
                return settled ? ch : glyphs[Math.floor(Math.random() * glyphs.length)];
              })
              .join("");
            if (f * 1.5 > plain.length) window.clearInterval(id);
          }, 40);
          cleanups.push(() => window.clearInterval(id));
        });
      }, 2600);
    }

    /* FAQ accordion */
    const qs = $$("#faqList .q");
    qs.forEach((q) => {
      const btn = q.querySelector<HTMLButtonElement>("button");
      on(btn, "click", () => {
        const open = q.classList.contains("open");
        qs.forEach((x) => {
          x.classList.remove("open");
          x.querySelector("button")?.setAttribute("aria-expanded", "false");
        });
        if (!open) {
          q.classList.add("open");
          btn?.setAttribute("aria-expanded", "true");
        }
      });
    });

    return () => cleanups.forEach((fn) => fn());
  }, []);

  return null;
}
