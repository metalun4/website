import Image from "next/image";
import ppImage from "@/assets/baris.jpg";
import {FileText, Mail, MapPin} from "lucide-react";
import {Github, Linkedin} from "@/components/social-icons";
import Link from "next/link";

export default function Home() {
  const currentYear = new Date().getFullYear();

  const skills = ["Web Development", "Frontend Development", "Backend Development", "JavaScript", "TypeScript",
    "React", "NextJS", "React Native", "NestJS", "SQL","TensorFlow", "Machine Learning", "Computer Vision", "Cloud Development"];

  const socials = [
    {url: "https://github.com/metalun4/?utm_source=aydemir.website", icon: Github},
    {url: "https://linkedin.com/in/barisaydemir/?utm_source=aydemir.website", icon: Linkedin},
    {url: "/BarisAydemirResumeWS.pdf", icon: FileText},
  ]

  return (
    <div className="mx-auto flex min-h-screen max-w-7xl flex-col justify-between px-5 text-center sm:px-8">
      <main className="my-auto flex flex-col justify-center py-10 md:flex-row md:py-20">
        <div className="flex flex-col items-center justify-center py-8 md:items-start md:pr-16 md:text-start lg:pr-24">
          <Image className="mb-6 rounded-xl border border-border" src={ppImage} alt="Barış Aydemir" placeholder="blur" height={164} width={164}/>
          <div className="mb-5 border-b border-border pb-5">
            <h1 className="text-[clamp(28px,3vw,36px)] font-semibold tracking-tight whitespace-nowrap">Barış Aydemir</h1>
            <p className="mt-2 text-muted">Software Developer</p>
          </div>
          <div className="flex flex-col gap-3 text-sm text-muted">
            <div className="flex items-center gap-3"><MapPin size={18} aria-hidden="true" /><p>Izmir, Türkiye</p></div>
            <div className="flex items-center gap-3"><Mail size={18} aria-hidden="true" /><p>baris@aydemir.website</p></div>
            <div className="mt-3 flex gap-2">
              {socials.map((social, index) => (
                <Link key={index} href={social.url} target="_blank" rel="noopener noreferrer" aria-label={["GitHub", "LinkedIn", "Resume"][index]} className="rounded-lg border border-border bg-surface p-2.5 text-muted transition-colors hover:bg-surface-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-foreground"><social.icon size={22}/></Link>
              ))}
            </div>
          </div>
        </div>
        <div className="flex min-w-0 flex-col justify-center gap-10 py-8 md:items-start md:border-s md:border-border md:pl-12 md:text-start lg:pl-16">
          <div className="flex flex-col">
            <h2 className="border-b border-border pb-3 text-xl font-medium tracking-tight">Summary</h2>
            <p className="mt-5 max-w-[65ch] text-base leading-8 text-muted">An experienced Software Developer with a passion for building innovative solutions across web, mobile, and industrial automation. My expertise spans full-stack development using React, React Native, Node.js, and C#, complemented by strong DevOps skills with Docker and AWS. Certified in TensorFlow and experienced with PyTorch, I specialize in integrating machine learning into practical applications that optimize workflows and enhance decision-making.</p>
          </div>
          <div className="flex flex-col">
            <h2 className="border-b border-border pb-3 text-xl font-medium tracking-tight">Skills</h2>
            <div className="mt-5 flex max-w-[65ch] flex-wrap justify-center gap-2 md:justify-start">
              {skills.map((skill, index) => (
                <span key={index} className="rounded-md border border-border bg-surface px-3 py-1.5 text-sm font-medium text-muted">{skill}</span>
              ))}
            </div>
          </div>
        </div>
      </main>
      <footer className="flex justify-center pt-8 pb-6 text-xs leading-6 text-subtle">
        <p>&copy; {currentYear} Baris Aydemir · Find the code on <a target="_blank" rel="noopener noreferrer" href="https://github.com/metalun4/website" className="rounded-sm underline decoration-border underline-offset-4 transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-foreground">GitHub</a></p>
      </footer>
    </div>
  );
}
