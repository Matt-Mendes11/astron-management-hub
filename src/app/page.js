
"use client";

import CommandCenter from "../components/CommandCenter";
import NoticeBoard from "../components/NoticeBoard";

export const dynamic = 'force-dynamic';

export default function HomeDashboardPage() {
  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <CommandCenter />
      <div className="w-full min-w-0">
        <NoticeBoard />
      </div>
    </div>
  );
}
