import type { Metadata } from "next";
import { LegalArticle, MarketingPage } from "@/components/landing/marketing-page";
import { BRAND } from "@/lib/brand";
import "../landing.css";

export const metadata: Metadata = { title: "Privacy Policy" };

export default function PrivacyPage() {
  return (
    <MarketingPage>
      <LegalArticle title="Privacy Policy" updated="[date]">
        <p>This policy explains what personal data {BRAND.name} ([Company legal name], “we”) processes and why.</p>
        <h2>What we collect</h2>
        <ul>
          <li><strong>Account data:</strong> name, email and authentication identifiers (via Firebase Authentication).</li>
          <li><strong>Workspace content:</strong> your founder profile, projects, ideas, research reports, experiments, interview notes and plans.</li>
          <li><strong>Billing data:</strong> plan and subscription status. Card details are handled by Stripe and never reach our servers.</li>
          <li><strong>Usage data:</strong> AI usage logs (operation, model, token counts, cost estimates) and security logs.</li>
          <li><strong>Waitlist data:</strong> emails submitted on landing pages our users publish, stored on behalf of that user.</li>
        </ul>
        <h2>How we use it</h2>
        <p>To provide and secure the Service, run the AI features you request, process payments, prevent abuse and communicate with you about your account. We do not sell personal data and do not use your workspace content to train shared AI models.</p>
        <h2>Processors</h2>
        <p>We share data only as needed with: Google Firebase (authentication), our AI provider ([provider]) to process prompts you trigger, our web search provider ([provider]) for research queries, Stripe (payments), Resend (email), [hosting provider] and, if enabled, Sentry (error monitoring).</p>
        <h2>Cookies</h2>
        <p>We use a strictly necessary, httpOnly session cookie to keep you signed in. [List any analytics cookies if added.]</p>
        <h2>Retention</h2>
        <p>We keep your data while your account is active and delete it within [30] days after account deletion, except where the law requires longer retention (e.g. invoices). Backups are kept for [14] days.</p>
        <h2>Your rights</h2>
        <p>Depending on where you live, you can access, correct, export or delete your data and object to certain processing. Contact <a href={`mailto:${BRAND.supportEmail}`}>{BRAND.supportEmail}</a>.</p>
        <h2>Security</h2>
        <p>Data is encrypted in transit, access is restricted per account, and sessions use secure httpOnly cookies.</p>
        <h2>Changes</h2>
        <p>We will notify you of material changes. Contact: [address / DPO details].</p>
      </LegalArticle>
    </MarketingPage>
  );
}
