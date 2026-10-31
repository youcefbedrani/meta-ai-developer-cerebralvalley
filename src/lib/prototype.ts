/*
 * Clickable prototype helpers. Pure, so the browser viewer, the HTML route and the code generator agree on
 * slugs and routes. Screens link to each other with data-goto="<slug>" (written by the Muse Spark designer).
 */

export const screenSlug = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "screen";

const ENTRY = /landing|welcome|home page|homepage|marketing/i;

/** The route each screen becomes in the generated app: the entry screen is "/", the others "/<slug>". */
export function screenRoutes(names: string[]): Record<string, string> {
  const entry = names.find((n) => ENTRY.test(n)) ?? null;
  const routes: Record<string, string> = {};
  for (const n of names) routes[screenSlug(n)] = n === entry ? "/" : `/${screenSlug(n)}`;
  return routes;
}

/** The screen a prototype starts on: the landing / welcome screen if there is one, otherwise the first. */
export function startScreen<T extends { name: string }>(screens: T[]): T | undefined {
  return screens.find((s) => ENTRY.test(s.name)) ?? screens[0];
}

/**
 * Injected into a screen served in prototype mode. Clicks on [data-goto] ask the parent viewer to switch
 * screens (postMessage; the document runs in an opaque-origin sandbox). Clicks anywhere else flash the
 * hotspots, like Figma's prototype mode, so the founder sees what's clickable. Forms never submit.
 */
export const PROTOTYPE_SCRIPT = `<style>
@keyframes stHot{0%,100%{box-shadow:0 0 0 0 rgba(59,130,246,0)}35%{box-shadow:0 0 0 3px rgba(59,130,246,.85);background-color:rgba(59,130,246,.12)}}
html.st-hot [data-goto]{animation:stHot .9s ease}
[data-goto]{cursor:pointer}
</style>
<script>
(function(){
  function flash(){var r=document.documentElement;r.classList.remove('st-hot');void r.offsetWidth;r.classList.add('st-hot');}
  document.addEventListener('click',function(e){
    var el=e.target&&e.target.closest?e.target:null;if(!el)return;
    var t=el.closest('[data-goto]');
    if(t){e.preventDefault();e.stopPropagation();parent.postMessage({type:'startum-goto',target:t.getAttribute('data-goto')},'*');return;}
    if(el.closest('a,button'))e.preventDefault();
    flash();
  },true);
  document.addEventListener('submit',function(e){e.preventDefault();},true);
  document.addEventListener('keydown',function(e){if(e.key==='ArrowRight'||e.key==='ArrowLeft')parent.postMessage({type:'startum-key',key:e.key},'*');});
})();
</script>`;

/** The screen's HTML with the prototype script added before </body>. */
export function withPrototypeScript(html: string): string {
  const i = html.toLowerCase().lastIndexOf("</body>");
  return i < 0 ? `${html}\n${PROTOTYPE_SCRIPT}` : `${html.slice(0, i)}${PROTOTYPE_SCRIPT}\n${html.slice(i)}`;
}
