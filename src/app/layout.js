import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import AuthLayoutShell from "../components/AuthLayoutShell";
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
        <AuthLayoutShell>{children}</AuthLayoutShell>
      </body>
    </html>
  );
}