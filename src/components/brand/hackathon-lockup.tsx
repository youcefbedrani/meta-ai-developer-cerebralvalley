import { Wordmark } from "@/components/brand/logo";
import { cn } from "@/lib/utils";

/*
 * Hackathon co-brand lockup: "Startum. × Meta × event". The Meta symbol is Meta's official mark (Wikimedia
 * Commons, Meta_Platforms_Inc._logo.svg), used only to say Startum was built for Meta's hackathon. The event
 * mark is the hackathon's own logo. Both scale with font-size (1em high) and work on light and dark backgrounds.
 */

export const HACKATHON = {
  name: "Meta Global AI Developer Hackathon",
  models: "Muse Spark, Muse Spark Open, Muse Image, SAM 3.1 and Muse Voice",
  writeUp: "https://github.com/youcefbedrani/meta-ai-developer-cerebralvalley/blob/main/HACKATHON.md",
};

export function MetaMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 287 191" className={cn("h-[1em] w-auto shrink-0", className)} role="img" aria-label="Meta">
      <defs>
        <linearGradient id="meta-g1" x1="61" y1="117" x2="259" y2="127" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#0064e1" />
          <stop offset="0.4" stopColor="#0064e1" />
          <stop offset="0.83" stopColor="#0073ee" />
          <stop offset="1" stopColor="#0082fb" />
        </linearGradient>
        <linearGradient id="meta-g2" x1="45" y1="139" x2="45" y2="66" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#0082fb" />
          <stop offset="1" stopColor="#0064e0" />
        </linearGradient>
      </defs>
      <path fill="#0081fb" d="m31.06,125.96c0,10.98 2.41,19.41 5.56,24.51 4.13,6.68 10.29,9.51 16.57,9.51 8.1,0 15.51-2.01 29.79-21.76 11.44-15.83 24.92-38.05 33.99-51.98l15.36-23.6c10.67-16.39 23.02-34.61 37.18-46.96 11.56-10.08 24.03-15.68 36.58-15.68 21.07,0 41.14,12.21 56.5,35.11 16.81,25.08 24.97,56.67 24.97,89.27 0,19.38-3.82,33.62-10.32,44.87-6.28,10.88-18.52,21.75-39.11,21.75l0-31.02c17.63,0 22.03-16.2 22.03-34.74 0-26.42-6.16-55.74-19.73-76.69-9.63-14.86-22.11-23.94-35.84-23.94-14.85,0-26.8,11.2-40.23,31.17-7.14,10.61-14.47,23.54-22.7,38.13l-9.06,16.05c-18.2,32.27-22.81,39.62-31.91,51.75-15.95,21.24-29.57,29.29-47.5,29.29-21.27,0-34.72-9.21-43.05-23.09-6.8-11.31-10.14-26.15-10.14-43.06z" />
      <path fill="url(#meta-g1)" d="m24.49,37.3c14.24-21.95 34.79-37.3 58.36-37.3 13.65,0 27.22,4.04 41.39,15.61 15.5,12.65 32.02,33.48 52.63,67.81l7.39,12.32c17.84,29.72 27.99,45.01 33.93,52.22 7.64,9.26 12.99,12.02 19.94,12.02 17.63,0 22.03-16.2 22.03-34.74l27.4-.86c0,19.38-3.82,33.62-10.32,44.87-6.28,10.88-18.52,21.75-39.11,21.75-12.8,0-24.14-2.78-36.68-14.61-9.64-9.08-20.91-25.21-29.58-39.71l-25.79-43.08c-12.94-21.62-24.81-37.74-31.68-45.04-7.39-7.85-16.89-17.33-32.05-17.33-12.27,0-22.69,8.61-31.41,21.78z" />
      <path fill="url(#meta-g2)" d="m82.35,31.23c-12.27,0-22.69,8.61-31.41,21.78-12.33,18.61-19.88,46.33-19.88,72.95 0,10.98 2.41,19.41 5.56,24.51l-26.48,17.44c-6.8-11.31-10.14-26.15-10.14-43.06 0-30.75 8.44-62.8 24.49-87.55 14.24-21.95 34.79-37.3 58.36-37.3z" />
    </svg>
  );
}

export function EventMark({ className }: { className?: string }) {
  return (
    <svg viewBox="2 2.5 22.2 20" className={cn("h-[1.05em] w-auto shrink-0", className)} role="img" aria-label={HACKATHON.name}>
      <path fill="currentColor" d="M9.84 3.25C9.91 3.22 9.98 3.22 10.05 3.25C10.08 3.26 10.12 3.3 10.16 3.36C10.2 3.43 10.252 3.53 10.32 3.65L16.74 16.04C16.77 16.09 16.79 16.14 16.81 16.17C16.83 16.2 16.85 16.23 16.88 16.24C16.92 16.26 16.97 16.26 17.02 16.24C17.046 16.23 17.07 16.203 17.09 16.17C17.1 16.16 17.11 16.14 17.12 16.12L17.16 16.05L20.96 9.14C21 9.06 21.014 9.03 21.04 9.01C21.06 8.99 21.08 8.97 21.11 8.96C21.14 8.95 21.18 8.95 21.26 8.95L22.55 8.89H23.3C23.43 8.89 23.52 8.89 23.59 8.9C23.659 8.91 23.7 8.92 23.73 8.94C23.79 8.98 23.822 9.04 23.83 9.11C23.84 9.14 23.83 9.18 23.8 9.25C23.77 9.31 23.73 9.39 23.67 9.5L17.37 21.51C17.31 21.63 17.26 21.72 17.21 21.79C17.172 21.86 17.14 21.89 17.1 21.91C17.04 21.94 16.96 21.94 16.9 21.91C16.863 21.89 16.83 21.86 16.79 21.79C16.745 21.72 16.697 21.63 16.63 21.5L10.21 9.06C10.18 9 10.16 8.95 10.14 8.92C10.12 8.89 10.09 8.86 10.06 8.85C10.02 8.83 9.97 8.83 9.92 8.85C9.89 8.86 9.87 8.89 9.85 8.92C9.83 8.96 9.81 9 9.78 9.06L6.48 15.71C6.46 15.756 6.44 15.79 6.42 15.82C6.41 15.86 6.4 15.89 6.41 15.91C6.42 15.96 6.44 16 6.48 16.025C6.5 16.04 6.53 16.05 6.57 16.05C6.6 16.06 6.64 16.06 6.69 16.06H11.63C11.72 16.06 11.76 16.06 11.794 16.066C11.82 16.08 11.85 16.09 11.874 16.11C11.9 16.14 11.92 16.17 11.958 16.25L12.94 18.151L12.98 18.23C13.02 18.3 13.05 18.36 13.07 18.41C13.09 18.47 13.1 18.51 13.1 18.55C13.09 18.61 13.05 18.68 12.99 18.71C12.97 18.73 12.92 18.75 12.86 18.75C12.79 18.76 12.7 18.76 12.57 18.76H2.69C2.56 18.76 2.48 18.76 2.41 18.75C2.34 18.75 2.3 18.74 2.27 18.72C2.21 18.68 2.18 18.62 2.17 18.55C2.16 18.52 2.17 18.47 2.19 18.41C2.22 18.35 2.26 18.27 2.31 18.16L9.58 3.66C9.64 3.53 9.69 3.44 9.73 3.37C9.77 3.3 9.81 3.26 9.84 3.25Z" />
    </svg>
  );
}

function Times() {
  return <span aria-hidden="true" className="px-[0.35em] text-[0.7em] font-normal opacity-50">×</span>;
}

/** "Startum. × Meta × event". `compact` hides the partner marks on small screens. */
export function HackathonLockup({ className, wordmarkClassName, compact = false }: { className?: string; wordmarkClassName?: string; compact?: boolean }) {
  return (
    <span className={cn("inline-flex items-center leading-none", className)}>
      <Wordmark className={wordmarkClassName} />
      <span className={cn("inline-flex items-center", compact && "max-sm:hidden")}>
        <Times />
        <MetaMark />
        <Times />
        <EventMark />
      </span>
    </span>
  );
}
