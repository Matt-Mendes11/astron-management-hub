import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";
import StoreSelector from "../components/StoreSelector";
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

const navItems = [
  {
    label: "Dashboard",
    href: "/",
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M3 13h8V3H3v10zM13 21h8v-6h-8v6zM13 11h8V3h-8v8zM3 21h8v-6H3v6z" />
      </svg>
    ),
  },
  {
    label: "Fuel Planner",
    href: "/fuel-planner",
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M7 3h8v18H7z" />
        <path d="M15 7h3l2 2v10a2 2 0 0 1-2 2h-3" />
      </svg>
    ),
  },
  {
    label: "Operations Team Hub",
    href: "/operations-team-hub",
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 3l7 4v5c0 5-3.5 8-7 9-3.5-1-7-4-7-9V7l7-4z" />
        <path d="M9 12l2 2 4-4" />
      </svg>
    ),
  },
  {
    label: "Payments",
    href: "/payments",
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="2" y="5" width="20" height="14" rx="2" />
        <path d="M2 10h20" />
      </svg>
    ),
  },
  {
    label: "Site Assessments",
    href: "/site-assessments",
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M3 10l9-7 9 7" />
        <path d="M5 9v12h14V9" />
        <path d="M9 21v-6h6v6" />
      </svg>
    ),
  },
];

export default function RootLayout({ children }) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-screen bg-slate-50 text-slate-900">
        <div className="flex min-h-screen">
          {/* Sidebar */}
          <aside className="w-64 shrink-0 bg-[#3c008b] text-white">
            <div className="border-b border-white/20 px-6 py-5">
              <div className="text-2xl font-extrabold tracking-wide">ASTRON</div>
              <div className="text-xs text-white/70">Regional Portal</div>
            </div>

            <nav className="px-3 py-4">
              <ul className="space-y-1">
                {navItems.map((item) => (
                  <li key={item.label}>
                    <Link
                      href={item.href}
                      className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-white/90 hover:bg-white/10 hover:text-white"
                    >
                      {item.icon}
                      <span>{item.label}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          </aside>

          {/* Main area */}
          <div className="flex min-w-0 flex-1 flex-col">
            {/* Top bar */}
            <header className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-6">
              <h1 className="text-lg font-semibold text-slate-800">Regional Terminal Portal</h1>

              <div className="flex items-center gap-4">
                <StoreSelector />
                <div className="h-9 w-9 rounded-full bg-[#FF6600] text-white grid place-items-center font-semibold">
                  M
                </div>
                <span className="text-sm font-medium text-slate-700">
                  M. Mendes - Regional Manager
                </span>
              </div>
            </header>

            {/* Page content slot */}
            <main className="flex-1 overflow-auto p-6">{children}</main>
          </div>
        </div>
      </body>
    </html>
  );
}