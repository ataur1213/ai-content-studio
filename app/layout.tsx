import type { Metadata } from "next";
import "./globals.css";

import Header from "@/components/Header";
import Sidebar from "@/components/Sidebar";

export const metadata: Metadata = {
  title: "AI Content Studio",
  description: "One Click AI Automation Platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="bg-slate-100">
        <div className="flex min-h-screen">
          <Sidebar />

          <div className="flex-1 ml-72">
            <Header />

            <main className="p-6">
              {children}
            </main>
          </div>
        </div>
      </body>
    </html>
  );
}