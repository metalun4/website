import type { Metadata } from "next";
import Image from "next/image";
import { ArrowDown, ArrowUpRight, BrainCircuit, Code2, FileText, Mail, MapPin, Server, Smartphone } from "lucide-react";
import ppImage from "@/assets/baris.jpg";
import { Github, Linkedin } from "@/components/social-icons";
import { CopyEmailButton } from "@/components/copy-email-button";
import { siteDescription, siteName, siteTitle, siteUrl } from "@/lib/site";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
  authors: [{ name: siteName, url: siteUrl }],
  openGraph: {
    title: siteTitle,
    description: siteDescription,
    url: "/",
    siteName,
    type: "website",
    locale: "en_US",
    images: [
      {
        url: "/baris.jpg",
        width: 1080,
        height: 1080,
        alt: "Barış Aydemir by the waterfront",
      },
    ],
  },
  twitter: {
    card: "summary",
    title: siteTitle,
    description: siteDescription,
    images: ["/baris.jpg"],
  },
};

const profileJsonLd = {
  "@context": "https://schema.org",
  "@type": "ProfilePage",
  url: siteUrl,
  mainEntity: {
    "@type": "Person",
    name: siteName,
    alternateName: "Baris Aydemir",
    url: siteUrl,
    image: `${siteUrl}/baris.jpg`,
    jobTitle: "Software Developer",
    description: siteDescription,
    email: "mailto:baris@aydemir.website",
    address: {
      "@type": "PostalAddress",
      addressLocality: "İzmir",
      addressCountry: "TR",
    },
    sameAs: [
      "https://github.com/metalun4",
      "https://www.linkedin.com/in/barisaydemir",
    ],
  },
};

const expertise = [
  { title: "Web & mobile", description: "Interfaces that make complex tasks feel straightforward.", icon: Code2, skills: ["JavaScript", "TypeScript", "React", "Next.js", "React Native"] },
  { title: "Backend & cloud", description: "APIs, data, and infrastructure that connect the pieces.", icon: Server, skills: ["Node.js", "NestJS", "C#", "SQL", "Docker", "AWS"] },
  { title: "Applied machine learning", description: "Computer vision and models with a practical purpose.", icon: BrainCircuit, skills: ["TensorFlow", "PyTorch", "Machine Learning", "Computer Vision"] },
];

// Public repositories; descriptions reflect their source, without inferred outcomes.
const projects = [
  { title: "OpsFlow Mobile", category: "Mobile application", description: "Create and edit orders and production plans, track their status, and browse recipes linked to customers.", icon: Smartphone, skills: ["React Native", "Expo", "TypeScript"], url: "https://github.com/metalun4/OpsFlow-Production-App" },
  { title: "OpsFlow API", category: "Backend development", description: "A NestJS API connecting customers, recipes, orders, and production plans, with checks against batch progress when plans change.", icon: Server, skills: ["NestJS", "TypeORM", "SQL Server"], url: "https://github.com/metalun4/OpsFlow-Production-API" },
  { title: "Lemon Quality", category: "Computer vision experiment", description: "A PyTorch convolutional model trained to classify images as good-quality lemons, bad-quality lemons, or empty backgrounds.", icon: BrainCircuit, skills: ["Python", "PyTorch", "Computer Vision"], url: "https://github.com/metalun4/lemon_quality" },
];

const profiles = [
  { label: "GitHub", url: "https://github.com/metalun4/?utm_source=aydemir.website", icon: Github },
  { label: "LinkedIn", url: "https://linkedin.com/in/barisaydemir/?utm_source=aydemir.website", icon: Linkedin },
];

export default function Home() {
  const currentYear = new Date().getFullYear();

  return (
    <div className="portfolio mx-auto max-w-6xl px-5 sm:px-8 lg:px-12">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(profileJsonLd).replace(/</g, "\\u003c") }} />
      <a href="#main-content" className="skip-link">Skip to content</a>
      <header className="portfolio-header">
        <a href="#main-content" aria-label="Barış Aydemir, home" className="portfolio-wordmark" translate="no">
          <span className="portfolio-monogram" aria-hidden="true">ba.</span>
          <span className="hidden sm:inline">Barış Aydemir</span>
        </a>
        <nav aria-label="Main navigation" className="portfolio-navigation">
          <a href="#work" className="portfolio-nav">Work</a>
          <a href="#expertise" className="portfolio-nav">Expertise</a>
          <a href="#about" className="portfolio-nav">About</a>
          <a href="#contact" className="portfolio-nav">Contact</a>
        </nav>
      </header>

      <main id="main-content" tabIndex={-1}>
        <section aria-labelledby="intro-heading" className="portfolio-hero">
          <div className="min-w-0">
            <p className="portfolio-eyebrow">Software developer</p>
            <h1 id="intro-heading" className="portfolio-headline" translate="no">Barış Aydemir</h1>
            <p className="portfolio-slogan">From an idea to<br className="hidden sm:block" /> <span className="text-accent">working software.</span></p>
            <p className="portfolio-intro">I build web and mobile applications, connect the systems behind them, and bring machine learning into practical use.</p>
            <div className="portfolio-hero-actions">
              <a href="mailto:baris@aydemir.website" className="portfolio-button portfolio-button-primary"><Mail size={17} aria-hidden="true" /> Get in touch <ArrowUpRight size={16} aria-hidden="true" /></a>
              <a href="#work" className="portfolio-button portfolio-button-secondary">Explore my work <ArrowDown size={16} aria-hidden="true" /></a>
            </div>
            <a href="/BarisAydemirResumeWS.pdf" target="_blank" rel="noopener noreferrer" className="portfolio-text-link mt-3 inline-flex min-h-11 items-center gap-2 text-sm text-muted"><FileText size={16} aria-hidden="true" /> View résumé <span className="text-xs text-subtle">PDF</span><ArrowUpRight size={14} aria-hidden="true" /><span className="sr-only"> (opens in a new tab)</span></a>
          </div>

          <div className="portfolio-profile">
            <div className="portfolio-portrait"><Image src={ppImage} alt="Barış Aydemir by the waterfront" width={288} height={288} sizes="(min-width: 1024px) 270px, (min-width: 768px) 222px, 62px" loading="eager" fetchPriority="high" placeholder="blur" className="aspect-square w-full rounded-xl object-cover" /></div>
            <p className="flex items-center gap-2 text-sm text-muted"><MapPin size={16} className="shrink-0 text-accent" aria-hidden="true" /> İzmir, Türkiye</p>
            <ul aria-label="Social profiles" className="flex flex-wrap gap-x-4">
              {profiles.map(({ label, url, icon: Icon }) => <li key={label}><a href={url} target="_blank" rel="noopener noreferrer" className="portfolio-text-link inline-flex min-h-11 items-center gap-2 text-sm"><Icon size={16} aria-hidden="true" />{label}<ArrowUpRight size={12} className="text-subtle" aria-hidden="true" /><span className="sr-only"> (opens in a new tab)</span></a></li>)}
            </ul>
          </div>
        </section>

        <section id="work" aria-labelledby="work-heading" className="portfolio-section border-t border-border py-10 sm:py-12">
          <div className="portfolio-section-heading">
            <div><p className="portfolio-eyebrow">01 / Selected work</p><h2 id="work-heading" className="portfolio-section-title">Ideas, put into practice.</h2><p className="mt-3 max-w-xl text-sm leading-6 text-muted">A selection of public projects across mobile, backend, and machine learning.</p></div>
            <a href="https://github.com/metalun4/?utm_source=aydemir.website" target="_blank" rel="noopener noreferrer" className="portfolio-text-link inline-flex min-h-11 items-center gap-2 text-sm text-muted">All repositories <ArrowUpRight size={15} aria-hidden="true" /><span className="sr-only"> (opens in a new tab)</span></a>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {projects.map(({ title, category, description, icon: Icon, skills, url }) => <article key={title} className="min-w-0">
              <a href={url} target="_blank" rel="noopener noreferrer" className="portfolio-project-card" aria-label={`${title} — view source on GitHub (opens in a new tab)`}>
                <div className="flex items-center justify-between"><span className="portfolio-project-icon"><Icon size={21} aria-hidden="true" /></span><ArrowUpRight size={19} className="portfolio-project-arrow" aria-hidden="true" /></div>
                <p className="mt-6 text-xs text-muted">{category}</p>
                <h3 className="mt-2 text-xl font-medium tracking-tight" translate="no">{title}</h3>
                <p className="mt-3 text-sm leading-6 text-muted">{description}</p>
                <ul aria-label={`${title} technologies`} className="portfolio-tags mt-6">{skills.map(skill => <li key={skill} translate="no">{skill}</li>)}</ul>
                <span className="mt-6 inline-flex items-center gap-2 text-xs font-medium text-accent"><Github size={14} aria-hidden="true" /> View source</span>
              </a>
            </article>)}
          </div>
        </section>

        <section id="expertise" aria-labelledby="expertise-heading" className="portfolio-section border-t border-border py-10 sm:py-12">
          <div className="portfolio-section-heading"><div><p className="portfolio-eyebrow">02 / Expertise</p><h2 id="expertise-heading" className="portfolio-section-title">From the interface to the infrastructure.</h2></div></div>
          <div className="portfolio-expertise-grid">
            {expertise.map(({ title, description, icon: Icon, skills }) => <article key={title} className="min-w-0">
              <Icon size={21} className="mb-4 text-accent" aria-hidden="true" />
              <h3 className="text-lg leading-6 font-medium tracking-tight">{title}</h3>
              <p className="mt-3 text-sm leading-6 text-muted">{description}</p>
              <ul aria-label={`${title} technologies`} className="portfolio-tags mt-5">{skills.map(skill => <li key={skill} translate="no">{skill}</li>)}</ul>
            </article>)}
          </div>
        </section>

        <section id="about" aria-labelledby="about-heading" className="portfolio-section grid gap-5 border-t border-border py-10 md:grid-cols-[220px_minmax(0,1fr)] md:gap-12 sm:py-12">
          <div><p className="portfolio-eyebrow">03 / About</p><h2 id="about-heading" className="portfolio-section-title">A practical mindset.</h2></div>
          <div className="max-w-[62ch] space-y-4 text-base leading-8 text-muted">
            <p>I’m Barış, a software developer based in İzmir, Türkiye. My work spans web, mobile, and industrial automation, with a focus on tools that make everyday workflows easier.</p>
            <p>I’m TensorFlow certified and work with PyTorch, bringing computer vision and machine learning into the same hands-on approach I take to full-stack development.</p>
          </div>
        </section>

        <section id="contact" aria-labelledby="contact-heading" className="portfolio-section portfolio-contact">
          <div><p className="portfolio-eyebrow">04 / Contact</p><h2 id="contact-heading" className="portfolio-section-title">Let’s build something useful.</h2><p className="mt-3 max-w-md text-sm leading-6 text-muted">Have a project or a question? Send me a note.</p></div>
          <div className="min-w-0">
            <a href="mailto:baris@aydemir.website" className="portfolio-email portfolio-text-link"><span className="min-w-0 break-words">baris@aydemir.website</span><ArrowUpRight size={21} className="shrink-0" aria-hidden="true" /></a>
            <CopyEmailButton />
          </div>
        </section>
      </main>

      <footer className="flex flex-wrap items-center justify-between gap-x-6 gap-y-1 border-t border-border py-5 text-xs leading-6 text-subtle">
        <p>© {currentYear} Barış Aydemir</p>
        <a target="_blank" rel="noopener noreferrer" href="https://github.com/metalun4/website" className="portfolio-text-link inline-flex min-h-11 items-center gap-1.5">View this site’s source <ArrowUpRight size={13} aria-hidden="true" /><span className="sr-only"> (opens in a new tab)</span></a>
      </footer>
    </div>
  );
}
