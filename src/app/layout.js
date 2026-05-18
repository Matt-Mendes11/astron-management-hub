import { Suspense } from "react";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import AppHeader from "../components/AppHeader";
import Sidebar from "../components/Sidebar";
export const dynamic = 'force-dynamic';
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "Astron Portal",
  description: "Regional Terminal Portal",
};

export default function RootLayout({ children }) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-screen bg-slate-50 text-slate-900">
        <div className="flex min-h-screen">
          <Sidebar />

          {/* Main area */}
          <div className="flex min-w-0 flex-1 flex-col">
            <Suspense fallback={<div className="h-[4.25rem] shrink-0 border-b border-slate-200 bg-white" aria-hidden />}>
              <AppHeader />
            </Suspense>

            {/* Page content slot */}
            <main className="flex-1 overflow-auto p-6">{children}</main>
          </div>
        </div>
      </body>
    </html>
  );
}