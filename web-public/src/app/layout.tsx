import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";
import { SiteHeader } from "@/components/site-header";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist-sans" });

export const metadata: Metadata = {
  title: {
    default: "Centro COP — Odontología y Psicología",
    template: "%s | Centro COP",
  },
  description:
    "Centro odontológico y psicológico en Colombia. Agenda citas online, atención integral y seguimiento clínico.",
  openGraph: {
    title: "Centro COP",
    description: "Salud dental y mental con tecnología clínica avanzada.",
    type: "website",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body className={`${geist.variable} min-h-screen antialiased`}>
        <Providers>
          <SiteHeader />
          <main>{children}</main>
        </Providers>
      </body>
    </html>
  );
}
