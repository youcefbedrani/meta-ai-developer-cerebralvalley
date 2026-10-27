import type { Metadata } from "next";
import { LegalArticle, MarketingPage } from "@/components/landing/marketing-page";
import { BRAND } from "@/lib/brand";
import "../landing.css";

export const metadata: Metadata = { title: "Terms of Service" };

export default function TermsPage() {
  return (
    <MarketingPage>
      <LegalArticle title="Terms of Service" updated="[date]">
        <p>These terms govern your use of {BRAND.name} (the “Service”), operated by [Company legal name], [address] (“we”, “us”). By creating an account you agree to them.</p>
        <h2>1. The Service</h2>
        <p>{BRAND.name} helps founders discover, research, validate and plan software products. AI-generated content can be incomplete or wrong. Reports separate sourced facts from analysis and assumptions, but you are responsible for your own business decisions. Nothing in the Service is financial, legal or investment advice, and we do not predict business success.</p>
        <h2>2. Accounts</h2>
        <p>You must provide accurate information and keep your credentials secure. You are responsible for activity under your account. You must be at least 18 years old.</p>
        <h2>3. Acceptable use</h2>
        <ul>
          <li>Do not use the Service to break the law, infringe rights, send spam or collect personal data without a lawful basis.</li>
          <li>Landing pages you publish must not deceive visitors, impersonate others or include fake testimonials or claims.</li>
          <li>Do not attempt to access other users’ data, disrupt the Service or abuse rate limits.</li>
        </ul>
        <h2>4. Your content</h2>
        <p>You own the ideas, notes and other content you add. You grant us a limited licence to process it solely to provide the Service. We do not use your workspace content to train shared AI models.</p>
        <h2>5. Waitlists you collect</h2>
        <p>When you publish a waitlist, you are the controller of the email addresses collected and must use them only as described on your page and in line with applicable law.</p>
        <h2>6. Plans, credits and billing</h2>
        <p>Paid plans renew monthly until cancelled. AI credits are granted each calendar month, are not transferable and expire at month end. Payments are processed by Stripe. You can cancel anytime from Settings; access continues until the end of the paid period. [Refund policy].</p>
        <h2>7. Availability and changes</h2>
        <p>We aim for high availability but the Service is provided “as is” without warranties. We may change or discontinue features with reasonable notice.</p>
        <h2>8. Liability</h2>
        <p>To the extent permitted by law, our total liability is limited to the amount you paid us in the 12 months before the claim. [Jurisdiction-specific terms].</p>
        <h2>9. Termination</h2>
        <p>You can delete your account at any time. We may suspend accounts that violate these terms.</p>
        <h2>10. Contact</h2>
        <p>Questions: <a href={`mailto:${BRAND.supportEmail}`}>{BRAND.supportEmail}</a>. Governing law: [jurisdiction].</p>
      </LegalArticle>
    </MarketingPage>
  );
}
