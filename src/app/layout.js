import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import StoreSelector from "../components/StoreSelector";
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