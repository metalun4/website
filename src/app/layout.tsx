import type {Metadata} from "next";
import {Open_Sans} from "next/font/google";
import "./globals.css";

const openSans = Open_Sans({
  variable: "--font-open-sans",
  style: "normal"
});

const metaInfo = {
  author: "Baris Aydemir",
  description: "An experienced Software Developer with a passion for building innovative solutions.",
  title: "Software Developer",
  url: "https://baris.aydemir.website",
}

export const metadata: Metadata = {
  title: `${metaInfo.author} | ${metaInfo.title}`,
  description: metaInfo.description,
  authors: [{name: metaInfo.author, url: metaInfo.url}],
  keywords: ["Software", "Developer", "Frontend", "Development", "Freelancer", "Freelance"],
  openGraph: {
    title: `${metaInfo.author} | ${metaInfo.title}`,
    description: metaInfo.description,
    url: metaInfo.url,
    siteName: `${metaInfo.author} Portfolio`,
    type: "website",
    locale: "en_US",
    images: [
      {
        url: `${metaInfo.url}/baris.jpg`,
        width: 160,
        height: 160,
      }
    ]
  }
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${openSans.variable} text-center antialiased`}>
        {children}
      </body>
    </html>
  );
}
