import "server-only";

/*
 * "Will it run?" for a generated codebase, without installing anything: a real TypeScript type-check of every
 * .ts/.tsx file in memory, against small declarations of exactly what the scaffold allows (next/link,
 * next/navigation, next/cache, the store and the form actions), plus the JSX mistakes that compile but crash
 * React at runtime (style="…" strings, class=, for=). Runs in the worker (it loads the typescript package).
 * Packages listed in package.json are allowed as untyped modules.
 */

export type CheckIssue = { file: string; line: number; message: string };
export type CheckResult = { ok: boolean; issues: CheckIssue[]; checkedAt: string };

/** What the generated app may import, typed loosely enough for real code and strictly enough to catch mistakes. */
const AMBIENT = `
declare module "next/link" { const Link: (props: { href: string; children?: any; [attr: string]: any }) => any; export default Link; }
declare module "next/navigation" { export function redirect(path: string): never; export function notFound(): never; }
declare module "next/cache" { export function revalidatePath(path: string, type?: "layout" | "page"): void; }
declare module "next" { export type Metadata = { title?: string; description?: string; [key: string]: any }; }
declare module "*.css";
declare module "node:fs" { export const promises: { readFile(p: string, enc: string): Promise<string>; writeFile(p: string, data: string): Promise<void>; mkdir(p: string, o?: any): Promise<any> }; }
declare module "node:path" { const path: { join(...p: string[]): string; dirname(p: string): string }; export default path; }
declare const process: { cwd(): string; env: Record<string, string | undefined> };
declare function structuredClone<T>(v: T): T;
declare module "react" {
  export type ReactNode = any;
  export type CSSProperties = Record<string, string | number>;
  export type FormEvent<T = any> = any;
  export type ChangeEvent<T = any> = any;
  export type MouseEvent<T = any> = any;
  export function useState<T>(initial: T | (() => T)): [T, (next: T | ((prev: T) => T)) => void];
  export function useEffect(effect: () => any, deps?: any[]): void;
  export function useMemo<T>(factory: () => T, deps: any[]): T;
  export function useCallback<T extends (...args: any[]) => any>(fn: T, deps: any[]): T;
  export function useRef<T>(initial: T): { current: T };
  export function useTransition(): [boolean, (fn: () => void | Promise<void>) => void];
  export function useActionState<S>(action: (state: S, payload: FormData) => S | Promise<S>, initial: S): [S, (payload: FormData) => void, boolean];
  const React: any;
  export default React;
}
declare namespace React { type ReactNode = any; type CSSProperties = Record<string, string | number>; }
declare namespace JSX {
  type Element = any;
  interface ElementChildrenAttribute { children: {} }
  interface IntrinsicAttributes { key?: string | number }
  interface IntrinsicElements { [tag: string]: { style?: Record<string, string | number>; class?: never; for?: never; [attr: string]: any } }
}
`;

const FRIENDLY: [RegExp, string][] = [
  [/is not assignable to type 'never'/, "In JSX use className instead of class, and htmlFor instead of for."],
  [/Type 'string' is not assignable to type 'Record<string, string \| number>'/, 'style must be an object in JSX, e.g. style={{ width: "40%" }}, not a string.'],
];

export async function checkCodebase(files: Record<string, string>): Promise<CheckResult> {
  const ts = (await import("typescript")).default;
  const sources = Object.fromEntries(Object.entries(files).filter(([p]) => /^src\/.+\.(ts|tsx)$/.test(p)));
  const issues: CheckIssue[] = [];

  // package.json and seed data must at least parse.
  for (const p of ["package.json", "tsconfig.json", "src/data/seed.json"]) {
    if (files[p] === undefined) continue;
    try {
      JSON.parse(files[p]);
    } catch (err) {
      issues.push({ file: p, line: 1, message: `Invalid JSON: ${err instanceof Error ? err.message : "parse error"}` });
    }
  }
  if (!files["package.json"]) issues.push({ file: "package.json", line: 1, message: "package.json is missing." });

  // Every page must default-export a component.
  for (const [p, code] of Object.entries(sources)) {
    if (/\/page\.tsx$/.test(p) && !/export\s+default\s/.test(code)) issues.push({ file: p, line: 1, message: "A page must have a default export (export default function …)." });
  }

  // React rules the type-checker can't see: hooks need "use client"; client files can't read the file store.
  for (const [p, code] of Object.entries(sources)) {
    const client = /^\s*(\/\/[^\n]*\n|\/\*[\s\S]*?\*\/\s*)*["']use client["']/.test(code);
    const hook = code.match(/\buse(State|Effect|Memo|Callback|Ref|Transition|ActionState)\s*\(/);
    if (hook && !client) issues.push({ file: p, line: lineOf(code, hook.index ?? 0), message: `use${hook[1]} only works in a client component: add "use client"; as the first line, or move the interactive part into its own client component.` });
    if (client && /from\s+["']@\/lib\/store["']/.test(code)) issues.push({ file: p, line: lineOf(code, code.search(/@\/lib\/store/)), message: 'A "use client" file can\'t import @/lib/store (it reads files on the server). Read the data in a server page and pass it as props.' });
    if (client && /export\s+default\s+async\s+function/.test(code)) issues.push({ file: p, line: lineOf(code, code.search(/export\s+default\s+async/)), message: "A client component can't be async. Remove async, or remove \"use client\"." });
  }

  const ROOT = "/project/";
  // Packages the founder (or Muse Spark) added to package.json are allowed; their types aren't checked.
  let extra = "";
  try {
    const pkg = JSON.parse(files["package.json"] ?? "{}") as { dependencies?: Record<string, string> };
    const builtIn = new Set(["next", "react", "react-dom"]);
    extra = Object.keys(pkg.dependencies ?? {}).filter((d) => !builtIn.has(d) && /^[@a-z0-9][\w./@-]*$/i.test(d)).map((d) => `declare module "${d}";\ndeclare module "${d}/*";`).join("\n");
  } catch {
    // Reported above as invalid JSON.
  }
  const virtual: Record<string, string> = { [`${ROOT}ambient.d.ts`]: AMBIENT + extra };
  for (const [p, code] of Object.entries(sources)) virtual[ROOT + p] = code;
  if (files["src/data/seed.json"] !== undefined) virtual[`${ROOT}src/data/seed.json`] = files["src/data/seed.json"];

  const options: import("typescript").CompilerOptions = {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    jsx: ts.JsxEmit.Preserve,
    strict: false,
    noImplicitAny: false,
    noEmit: true,
    skipLibCheck: true,
    resolveJsonModule: true,
    esModuleInterop: true,
    allowSyntheticDefaultImports: true,
    lib: ["lib.es2022.d.ts", "lib.dom.d.ts", "lib.dom.iterable.d.ts"],
    baseUrl: ROOT,
    paths: { "@/*": ["src/*"] },
    types: [],
  };
  const host = ts.createCompilerHost(options, true);
  const readLib = host.getSourceFile.bind(host);
  host.getSourceFile = (name, lang, onError) => (virtual[name] !== undefined ? ts.createSourceFile(name, virtual[name], lang, true) : readLib(name, lang, onError));
  host.fileExists = (name) => virtual[name] !== undefined || (name.includes("/typescript/lib/") && ts.sys.fileExists(name));
  host.readFile = (name) => virtual[name] ?? (name.includes("/typescript/lib/") ? ts.sys.readFile(name) : undefined);
  host.directoryExists = (dir) => {
    const d = dir.endsWith("/") ? dir : `${dir}/`;
    return Object.keys(virtual).some((f) => f.startsWith(d)) || (dir.includes("/typescript/lib") && ts.sys.directoryExists(dir));
  };
  host.realpath = (p) => p;
  host.writeFile = () => {};
  host.getCurrentDirectory = () => ROOT;

  const program = ts.createProgram(Object.keys(virtual), options, host);
  for (const d of ts.getPreEmitDiagnostics(program)) {
    if (!d.file || !d.file.fileName.startsWith(ROOT) || d.file.fileName.endsWith("ambient.d.ts")) continue;
    const file = d.file.fileName.slice(ROOT.length);
    const line = d.start !== undefined ? d.file.getLineAndCharacterOfPosition(d.start).line + 1 : 1;
    let message = ts.flattenDiagnosticMessageText(d.messageText, " ");
    for (const [re, friendly] of FRIENDLY) if (re.test(message)) message = `${friendly} (${message.slice(0, 160)})`;
    issues.push({ file, line, message: message.slice(0, 400) });
  }
  return { ok: issues.length === 0, issues: issues.slice(0, 60), checkedAt: new Date().toISOString() };
}

const lineOf = (code: string, index: number) => code.slice(0, Math.max(0, index)).split("\n").length;

/** The issues of one file, as text for the fixer prompt. */
export const issuesText = (issues: CheckIssue[]) => issues.map((i) => `${i.file}:${i.line} ${i.message}`).join("\n");
