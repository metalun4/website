import Image from "next/image";
import ppImage from "@/assets/baris.jpg";
import {FileText, Github, Linkedin, Mail, MapPin, Twitter} from "lucide-react";
import Link from "next/link";

export default function Home() {
  const currentYear = new Date().getFullYear();

  const skills = ["Web Development", "Frontend Development", "Backend Development", "JavaScript", "TypeScript",
    "React", "NextJS", "React Native", "NestJS", "SQL","TensorFlow", "Machine Learning", "Computer Vision", "Cloud Development"];

  const socials = [
    {url: "https://github.com/metalun4/?utm_source=aydemir.website", icon: Github},
    {url: "https://twitter.com/metalun4/?utm_source=aydemir.website", icon: Twitter},
    {url: "https://linkedin.com/in/barisaydemir/?utm_source=aydemir.website", icon: Linkedin},
    {url: "/BarisAydemirResumeWS.pdf", icon: FileText},
  ]

  return (
    <div className="container flex flex-col min-h-screen mx-auto justify-between">
      <main className="flex flex-col md:flex-row justify-center my-auto font-semibold p-3">
        <div className="flex flex-col md:pr-24 py-12 justify-center items-center md:items-start md:text-start">
          <Image className={"border border-black rounded-md mb-2 dark:border-0"} src={ppImage} alt={"Glorious picture"} placeholder={"blur"} height={164} width={164}/>
          <div className="border-b pb-2 mb-2 text-nowrap">
            <h1 className="text-4xl">Barış Aydemir</h1>
            <p>Software Developer</p>
          </div>
          <div className="flex flex-col gap-2">
            <div className="flex"><MapPin /><p className="ml-2 font-light">Izmir, Türkiye</p></div>
            <div className="flex"><Mail /><p className="ml-2 font-light">baris@aydemir.website</p></div>
            <div className="flex gap-2 mt-2">
              {socials.map((social, index) => (
                <Link key={index} href={social.url} target={"_blank"} className="hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black p-1 rounded-md"><social.icon size={36}/></Link>
              ))}
            </div>
          </div>
        </div>
        <div className="flex flex-col md:border-s-4 md:pl-16 gap-8 py-12 justify-center md:items-start md:text-start">
          <div className="flex flex-col">
            <h1 className="text-2xl border-b p-2">Summary</h1>
            <p className="max-w-[78ch] px-6 py-2">An experienced Software Developer with a passion for building innovative solutions across web, mobile, and industrial automation. My expertise spans full-stack development using React, React Native, Node.js, and C#, complemented by strong DevOps skills with Docker and AWS. Certified in TensorFlow and experienced with PyTorch, I specialize in integrating machine learning into practical applications that optimize workflows and enhance decision-making.</p>
          </div>
          <div className="flex flex-col">
            <h1 className="text-2xl border-b p-2">Skills</h1>
            <div className="flex flex-wrap max-w-[78ch] justify-center gap-2 p-6 py-4">
              {skills.map((skill, index) => (
                <span key={index} className="p-1 rounded-md font-bold bg-black text-white dark:bg-white dark:text-black">{skill}</span>
              ))}
            </div>
          </div>
        </div>
      </main>
      <footer className="flex items-end justify-center pb-6">
        <p className="text-gray-500 dark:text-gray-400">&copy; {currentYear} Baris Aydemir - Find the code on <a target="_blank" href="https://github.com/metalun4/website" className="border-b text-black dark:text-white">GitHub</a></p>
      </footer>
    </div>
  );
}
