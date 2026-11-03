import type { Metadata } from "next";
import { Bricolage_Grotesque, Inter, JetBrains_Mono } from "next/font/google";
import localFont from "next/font/local";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { BRAND } from "@/lib/brand";
import "./globals.css";

const sans = Inter({ variable: "--font-sans", subsets: ["latin"] });
const mono = JetBrains_Mono({ variable: "--font-mono", subsets: ["latin"] });
/** The Startum wordmark font (src/components/brand/logo.tsx). */
const logo = Bricolage_Grotesque({ variable: "--font-logo", subsets: ["latin"], weight: ["700", "800"] });
/** Arabic text in the app (Inter has no Arabic glyphs); only downloaded when Arabic characters are on the page. */
// Self-hosted (Noto Sans Arabic, SIL OFL, Arabic subset, variable 400–700): Google's CSS for it broke next/font/google builds.
const arabic = localFont({
  src: "./fonts/NotoSansArabic-arabic.woff2",
  variable: "--font-arabic",
  weight: "400 700",
  display: "swap",
  preload: false,
  declarations: [{ prop: "unicode-range", value: "U+0600-06FF, U+0750-077F, U+0870-0891, U+0897-08E1, U+08E3-08FF, U+200C-200E, U+2010-2011, U+204F, U+2E41, U+FB50-FDFF, U+FE70-FE74, U+FE76-FEFC" }],
});

export const metadata: Metadata = {
  title: { default: `${BRAND.name} — ${BRAND.tagline}`, template: `%s · ${BRAND.name}` },
  description: BRAND.description,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable} ${logo.variable} ${arabic.variable} h-full antialiased`} suppressHydrationWarning>
      <body className="min-h-full bg-background text-foreground" suppressHydrationWarning>
        <TooltipProvider>{children}</TooltipProvider>
        <Toaster position="bottom-right" />
      </body>
    </html>
  );
}
