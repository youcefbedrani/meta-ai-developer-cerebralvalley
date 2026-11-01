/*
 * App languages. The shell (sidebar, top bar) is translated here by hand so it's instant; page text is translated
 * on the fly by Muse Spark and cached (components/app/page-translator.tsx), and AI results are written in the
 * user's language (server/ai/run.ts).
 */

export const LOCALES = ["en", "fr", "es", "ar"] as const;
export type Locale = (typeof LOCALES)[number];

export const LOCALE_INFO: Record<Locale, { label: string; english: string; dir: "ltr" | "rtl" }> = {
  en: { label: "English", english: "English", dir: "ltr" },
  fr: { label: "Français", english: "French", dir: "ltr" },
  es: { label: "Español", english: "Spanish", dir: "ltr" },
  ar: { label: "العربية", english: "Arabic", dir: "rtl" },
};

export const isLocale = (v: unknown): v is Locale => typeof v === "string" && (LOCALES as readonly string[]).includes(v);
export const toLocale = (v: unknown): Locale => (isLocale(v) ? v : "en");

export const THEME_COOKIE = "startum_theme";
export type Theme = "light" | "dark";

/** English → [fr, es, ar]. Keys are the English text as written in the shell. */
const SHELL: Record<string, [string, string, string]> = {
  // Sidebar
  Dashboard: ["Tableau de bord", "Panel", "لوحة التحكم"],
  "Start here": ["Commencer ici", "Empieza aquí", "ابدأ هنا"],
  "AI Copilot": ["Copilote IA", "Copiloto IA", "المساعد الذكي"],
  "1 · Discover": ["1 · Découvrir", "1 · Descubrir", "1 · اكتشف"],
  "2 · Validate": ["2 · Valider", "2 · Validar", "2 · تحقّق"],
  "3 · Build & grow": ["3 · Construire et grandir", "3 · Construir y crecer", "3 · ابنِ وانمُ"],
  Account: ["Compte", "Cuenta", "الحساب"],
  Statistics: ["Statistiques", "Estadísticas", "الإحصائيات"],
  Control: ["Contrôle", "Control", "التحكم"],
  "Discover Ideas": ["Découvrir des idées", "Descubrir ideas", "اكتشف الأفكار"],
  "Gold Mine": ["Mine d'or", "Mina de oro", "منجم الذهب"],
  "Traditional → Innovative": ["Traditionnel → Innovant", "Tradicional → Innovador", "من التقليدي ← إلى المبتكر"],
  Marketplace: ["Marketplace", "Marketplace", "السوق"],
  "My Projects": ["Mes projets", "Mis proyectos", "مشاريعي"],
  "Research & Validate": ["Rechercher et valider", "Investigar y validar", "البحث والتحقق"],
  "Validation Lab": ["Labo de validation", "Laboratorio de validación", "مختبر التحقق"],
  "Marketing Studio": ["Studio marketing", "Estudio de marketing", "استوديو التسويق"],
  Resources: ["Ressources", "Recursos", "الموارد"],
  "My profile": ["Mon profil", "Mi perfil", "ملفي الشخصي"],
  Settings: ["Paramètres", "Ajustes", "الإعدادات"],
  Overview: ["Vue d'ensemble", "Resumen", "نظرة عامة"],
  Projects: ["Projets", "Proyectos", "المشاريع"],
  "Jobs & AI": ["Tâches et IA", "Tareas e IA", "المهام والذكاء الاصطناعي"],
  "Billing & credits": ["Facturation et crédits", "Facturación y créditos", "الفوترة والرصيد"],
  Users: ["Utilisateurs", "Usuarios", "المستخدمون"],
  "Sign-ups": ["Inscriptions", "Registros", "التسجيلات"],
  "Audit log": ["Journal d'audit", "Registro de auditoría", "سجل التدقيق"],
  Soon: ["Bientôt", "Pronto", "قريبًا"],
  // Top bar
  "Search…": ["Rechercher…", "Buscar…", "ابحث…"],
  "Search pages, projects, ideas…": ["Rechercher des pages, projets, idées…", "Buscar páginas, proyectos, ideas…", "ابحث في الصفحات والمشاريع والأفكار…"],
  Pages: ["Pages", "Páginas", "الصفحات"],
  Ideas: ["Idées", "Ideas", "الأفكار"],
  Scans: ["Analyses", "Análisis", "التحليلات"],
  "No results": ["Aucun résultat", "Sin resultados", "لا توجد نتائج"],
  "Searching…": ["Recherche…", "Buscando…", "جارٍ البحث…"],
  Notifications: ["Notifications", "Notificaciones", "الإشعارات"],
  "No notifications yet": ["Aucune notification pour l'instant", "Aún no hay notificaciones", "لا توجد إشعارات بعد"],
  "When research, designs, videos or scans finish, they show up here.": [
    "Quand une recherche, un design, une vidéo ou une analyse se termine, elle apparaît ici.",
    "Cuando terminen investigaciones, diseños, vídeos o análisis, aparecerán aquí.",
    "عند انتهاء الأبحاث أو التصاميم أو الفيديوهات أو التحليلات ستظهر هنا.",
  ],
  Language: ["Langue", "Idioma", "اللغة"],
  "Light mode": ["Mode clair", "Modo claro", "الوضع الفاتح"],
  "Dark mode": ["Mode sombre", "Modo oscuro", "الوضع الداكن"],
  "Open navigation": ["Ouvrir la navigation", "Abrir navegación", "فتح القائمة"],
  "Translating this page with Muse Spark…": ["Traduction de la page avec Muse Spark…", "Traduciendo la página con Muse Spark…", "جارٍ ترجمة الصفحة باستخدام Muse Spark…"],
  // Notification texts
  "Research finished": ["Recherche terminée", "Investigación terminada", "اكتمل البحث"],
  "Competitor scan finished": ["Analyse des concurrents terminée", "Análisis de competidores terminado", "اكتمل تحليل المنافسين"],
  "Market voices collected": ["Voix du marché collectées", "Voces del mercado recopiladas", "تم جمع آراء السوق"],
  "MVP design ready": ["Design du MVP prêt", "Diseño del MVP listo", "تصميم المنتج جاهز"],
  "Code generated": ["Code généré", "Código generado", "تم توليد الكود"],
  "Code updated": ["Code mis à jour", "Código actualizado", "تم تحديث الكود"],
  "Launch video ready": ["Vidéo de lancement prête", "Vídeo de lanzamiento listo", "فيديو الإطلاق جاهز"],
  "Posted to social": ["Publié sur les réseaux", "Publicado en redes", "تم النشر على الشبكات"],
  "Scan finished": ["Analyse terminée", "Análisis terminado", "اكتمل التحليل"],
  "Something failed": ["Un échec est survenu", "Algo falló", "حدث خطأ"],
  "Credits refunded": ["Crédits remboursés", "Créditos reembolsados", "تمت إعادة الرصيد"],
  "Running low on credits": ["Crédits presque épuisés", "Te quedan pocos créditos", "رصيدك منخفض"],
};

const COL: Record<Exclude<Locale, "en">, 0 | 1 | 2> = { fr: 0, es: 1, ar: 2 };

/** Translates a shell string; unknown strings come back unchanged (the page translator can still pick them up). */
export function t(locale: Locale, text: string): string {
  if (locale === "en") return text;
  return SHELL[text]?.[COL[locale]] ?? text;
}
