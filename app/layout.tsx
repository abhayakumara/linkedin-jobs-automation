import type { Metadata } from "next";
import "./globals.css";
import Sidebar from "@/components/Sidebar";
import { prisma } from "@/lib/db";
import { capabilities } from "@/lib/settings";

export const metadata: Metadata = {
  title: "JobPilot — AI Job Application Autopilot",
  description: "Discover, tailor, apply, and reach out — automatically.",
};

export const dynamic = "force-dynamic";

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const profiles = await prisma.profile.findMany({
    select: { id: true, name: true, headline: true, isActive: true },
    orderBy: { updatedAt: "desc" },
  });
  const caps = capabilities();

  return (
    <html lang="en">
      <body className="text-slate-100 antialiased">
        <div className="flex min-h-screen">
          <Sidebar profiles={profiles} caps={caps} />
          <main className="flex-1 overflow-x-hidden px-6 py-8 md:px-10">
            <div className="mx-auto max-w-6xl animate-fade-in">{children}</div>
          </main>
        </div>
      </body>
    </html>
  );
}
