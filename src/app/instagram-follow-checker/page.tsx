import type { Metadata } from "next";
import Link from "next/link";
import { ArrowDown, ArrowLeft } from "lucide-react";
import { ToolsMenu } from "@/components/tools-menu";
import { instagramFollowCheckerPath, siteName, siteUrl } from "@/lib/site";
import { FollowChecker } from "./follow-checker";
import { FollowCheckerGuide } from "./follow-checker-guide";
import "./instagram-checker.css";

const name = "Instagram Follow Checker";
const title = `${name} | Who Doesn’t Follow Back`;
const description = "Compare Instagram followers and following JSON files to see who doesn’t follow you back. Free, private, and processed in your browser. No login required.";
const canonicalUrl = `${siteUrl}${instagramFollowCheckerPath}`;

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: canonicalUrl },
  openGraph: { title, description, url: canonicalUrl, siteName, locale: "en_US", type: "website" },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    images: [{ url: `${canonicalUrl}/opengraph-image`, alt: name }],
  },
};

const checkerJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name,
  url: canonicalUrl,
  description,
  inLanguage: "en",
  applicationCategory: "UtilitiesApplication",
  browserRequirements: "Requires JavaScript and the File API.",
  isAccessibleForFree: true,
};

export default function InstagramFollowCheckerPage() {
  return (
    <div className="instagram-checker portfolio mx-auto max-w-4xl px-5 sm:px-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(checkerJsonLd).replace(/</g, "\\u003c") }} />
      <a className="skip-link" href="#main-content">Skip to content</a>
      <nav aria-label="Site navigation" className="relative z-20 flex items-center justify-between gap-3 border-b border-border py-2 text-sm sm:py-3">
        <Link href="/" prefetch={false} className="portfolio-nav">
          <ArrowLeft size={16} aria-hidden="true" /> Home
        </Link>
        <ToolsMenu currentPath={instagramFollowCheckerPath} />
      </nav>

      <main id="main-content" tabIndex={-1}>
        <header className="pt-8 pb-5 sm:pt-11 sm:pb-7">
          <h1 className="text-[2rem] leading-[1.12] font-semibold tracking-tight sm:text-5xl">{name}</h1>
          <p className="mt-3 max-w-[60ch] text-base leading-7 text-muted">
            Compare your Instagram followers and following JSON files to see who doesn’t follow you back.
          </p>
          <a href="#download-instagram-data" className="portfolio-text-link mt-1 inline-flex min-h-11 items-center gap-2 text-sm font-medium text-accent underline">
            How to download your JSON files <ArrowDown size={15} aria-hidden="true" />
          </a>
        </header>

        <FollowChecker />
        <FollowCheckerGuide />
      </main>
    </div>
  );
}
