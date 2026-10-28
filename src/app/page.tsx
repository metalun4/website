import Image from "next/image";
import { ArrowDown, ArrowUpRight, BrainCircuit, Code2, FileText, Mail, MapPin, Server } from "lucide-react";
import ppImage from "@/assets/baris.jpg";
import { Github, Linkedin } from "@/components/social-icons";

const expertise = [
  {
    title: "Web & mobile",
    description: "Thoughtful interfaces for the browser and beyond.",
    icon: Code2,
    skills: ["JavaScript", "TypeScript", "React", "Next.js", "React Native"],
  },
  {
    title: "Backend & cloud",
    description: "The systems and infrastructure behind the experience.",
    icon: Server,
    skills: ["Node.js", "NestJS", "C#", "SQL", "Docker", "AWS"],
  },
  {
    title: "Applied machine learning",
    description: "Turning data into practical, intelligent applications.",
    icon: BrainCircuit,
    skills: ["TensorFlow", "PyTorch", "Machine Learning", "Computer Vision"],
  },
];

const profiles = [
  { label: "GitHub", url: "https://github.com/metalun4/?utm_source=aydemir.website", icon: Github },
  { label: "LinkedIn", url: "https://linkedin.com/in/barisaydemir/?utm_source=aydemir.website", icon: Linkedin },
];

export default function Home() {
  const currentYear = new Date().getFullYear();

  return (
    <div className="portfolio mx-auto max-w-6xl px-5 sm:px-8 lg:px-12">
      <a href="#main-content" className="skip-link">Skip to content</a>

      <header className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-b border-border py-5 sm:py-6">
        <a href="#main-content" aria-label="Barış Aydemir, home" className="portfolio-wordmark inline-flex min-h-11 items-center text-xl font-semibold tracking-tight" translate="no">
          ba<span className="text-accent">.</span>
        </a>
        <nav aria-label="Main navigation" className="flex flex-wrap gap-4 text-sm sm:gap-7">
          <a href="#about" className="portfolio-nav">About</a>
          <a href="#expertise" className="portfolio-nav">Expertise</a>
          <a href="#contact" className="portfolio-nav">Contact <ArrowUpRight size={14} aria-hidden="true" /></a>
        </nav>
      </header>

      <main id="main-content" tabIndex={-1}>
        <section aria-labelledby="intro-heading" className="grid items-center gap-10 py-12 sm:py-16 md:grid-cols-[minmax(0,1fr)_260px] md:gap-14 lg:gap-24 lg:py-20">
          <div className="min-w-0">
            <p className="portfolio-eyebrow">Software developer</p>
            <h1 id="intro-heading" className="mt-4 text-[clamp(2.5rem,5.4vw,4.25rem)] leading-[1.08] font-semibold tracking-[-0.055em]" translate="no">Barış Aydemir<span className="text-accent">.</span></h1>
            <p className="mt-6 max-w-lg text-[clamp(1.25rem,2.3vw,1.65rem)] leading-snug tracking-tight text-foreground">Useful software.<br />From interface to infrastructure.</p>
            <p className="mt-4 max-w-[49ch] text-base leading-7 text-muted">I turn complex problems into practical tools across web, mobile, and industrial automation.</p>
            <div className="mt-8 grid gap-3 min-[420px]:flex min-[420px]:flex-wrap">
              <a href="mailto:baris@aydemir.website" className="portfolio-button portfolio-button-primary"><Mail size={18} aria-hidden="true" /> Get in touch <ArrowUpRight size={16} aria-hidden="true" /></a>
              <a href="/BarisAydemirResumeWS.pdf" target="_blank" rel="noopener noreferrer" className="portfolio-button portfolio-button-secondary"><FileText size={18} aria-hidden="true" /> View résumé <span className="text-xs text-muted">PDF</span><span className="sr-only"> (opens in a new tab)</span></a>
            </div>
            <a href="#about" className="portfolio-text-link mt-8 hidden min-h-11 items-center gap-2 text-sm text-muted sm:inline-flex">A little more about me <ArrowDown size={15} aria-hidden="true" /></a>
          </div>

          <div className="grid min-w-0 grid-cols-[96px_minmax(0,1fr)] items-center gap-x-5 gap-y-1 md:flex md:flex-col md:items-stretch md:gap-4">
            <Image src={ppImage} alt="Barış Aydemir by the waterfront" width={260} height={260} sizes="(min-width: 768px) 260px, 96px" loading="eager" fetchPriority="high" placeholder="blur" className="row-span-2 aspect-square w-full rounded-2xl border border-border object-cover" />
            <p className="flex items-center gap-2 text-sm text-muted"><MapPin size={16} className="text-accent" aria-hidden="true" /> İzmir, Türkiye</p>
            <ul aria-label="Social profiles" className="flex flex-wrap gap-x-5 md:gap-y-4">
              {profiles.map(({ label, url, icon: Icon }) => (
                <li key={label}><a href={url} target="_blank" rel="noopener noreferrer" className="portfolio-text-link inline-flex min-h-11 items-center gap-2 text-sm"><Icon size={17} aria-hidden="true" />{label}<ArrowUpRight size={13} className="text-subtle" aria-hidden="true" /><span className="sr-only"> (opens in a new tab)</span></a></li>
              ))}
            </ul>
          </div>
        </section>

        <section id="about" aria-labelledby="about-heading" className="portfolio-section grid gap-5 border-t border-border py-10 md:grid-cols-[200px_minmax(0,1fr)] md:gap-10 sm:py-12">
          <h2 id="about-heading" className="portfolio-eyebrow">About me</h2>
          <div className="max-w-[65ch] space-y-4 text-base leading-8 text-muted">
            <p className="text-xl leading-8 font-medium tracking-tight text-foreground">Full-stack development. A practical mindset.</p>
            <p>I build across the stack with React, React Native, Node.js, and C#, supported by Docker and AWS. My work brings together web, mobile, and industrial automation to improve everyday workflows.</p>
            <p>TensorFlow certified and experienced with PyTorch, I also bring machine learning and computer vision into applications that help people make better decisions.</p>
          </div>
        </section>

        <section id="expertise" aria-labelledby="expertise-heading" className="portfolio-section border-t border-border py-10 sm:py-12">
          <div className="mb-7 flex flex-wrap items-end justify-between gap-3">
            <div><p className="portfolio-eyebrow">Expertise</p><h2 id="expertise-heading" className="mt-3 text-2xl font-medium tracking-tight sm:text-3xl">A toolkit for the whole picture.</h2></div>
            <a href="https://github.com/metalun4/?utm_source=aydemir.website" target="_blank" rel="noopener noreferrer" className="portfolio-text-link inline-flex min-h-11 items-center gap-2 text-sm text-muted">Explore my GitHub <ArrowUpRight size={15} aria-hidden="true" /><span className="sr-only"> (opens in a new tab)</span></a>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {expertise.map(({ title, description, icon: Icon, skills }) => (
              <article key={title} className="min-w-0 rounded-xl border border-border bg-surface p-5 lg:p-6">
                <span className="mb-5 inline-flex size-10 items-center justify-center rounded-lg bg-accent-soft text-accent"><Icon size={21} aria-hidden="true" /></span>
                <h3 className="text-lg leading-6 font-medium tracking-tight">{title}</h3>
                <p className="mt-3 text-sm leading-6 text-muted">{description}</p>
                <ul aria-label={`${title} technologies`} className="mt-5 flex flex-wrap gap-2">
                  {skills.map(skill => <li key={skill} className="rounded-md bg-surface-muted px-2.5 py-1.5 text-xs leading-5 text-muted" translate="no">{skill}</li>)}
                </ul>
              </article>
            ))}
          </div>
        </section>

        <section id="contact" aria-labelledby="contact-heading" className="portfolio-section mb-10 flex flex-col items-start justify-between gap-6 rounded-2xl border border-border bg-surface px-6 py-8 sm:px-8 md:flex-row md:items-center">
          <div className="min-w-0"><p className="portfolio-eyebrow">Say hello</p><h2 id="contact-heading" className="mt-3 text-2xl font-medium tracking-tight sm:text-3xl">Have something in mind?</h2><p className="mt-3 text-sm leading-6 text-muted">Let’s talk about your next project.</p></div>
          <a href="mailto:baris@aydemir.website" className="portfolio-text-link inline-flex min-h-11 max-w-full items-center gap-3 text-sm font-medium sm:text-base"><span className="min-w-0 break-words">baris@aydemir.website</span><ArrowUpRight size={19} className="shrink-0 text-accent" aria-hidden="true" /></a>
        </section>
      </main>

      <footer className="flex flex-wrap items-center justify-between gap-x-6 gap-y-1 border-t border-border py-5 text-xs leading-6 text-subtle">
        <p>© {currentYear} Barış Aydemir</p>
        <a target="_blank" rel="noopener noreferrer" href="https://github.com/metalun4/website" className="portfolio-text-link inline-flex min-h-11 items-center gap-1.5">Built with Next.js · View source <ArrowUpRight size={13} aria-hidden="true" /><span className="sr-only"> (opens in a new tab)</span></a>
      </footer>
    </div>
  );
}
