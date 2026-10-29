import type {Metadata, Viewport} from "next";
import {Geist} from "next/font/google";
import {siteDescription, siteTitle, siteUrl} from "@/lib/site";
import "./globals.css";

const geist = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin", "latin-ext"],
  display: "swap",
});

export const viewport: Viewport = {
  themeColor: [
    {media: "(prefers-color-scheme: light)", color: "#f3f2ef"},
    {media: "(prefers-color-scheme: dark)", color: "#1c1c1c"},
  ],
};

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: siteTitle,
  description: siteDescription,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geist.variable} bg-background font-sans text-foreground antialiased selection:bg-foreground/15 selection:text-foreground`}>
        {children}
      </body>
    </html>
  );
}
