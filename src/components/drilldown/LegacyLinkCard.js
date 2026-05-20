"use client";

import Link from "next/link";

const BTN =
  "mt-3 inline-block w-full rounded-md bg-[#f97316] px-4 py-2.5 text-center text-sm font-semibold text-white shadow-sm transition hover:bg-[#ea580c]";

/** Legacy link-card: white surface, grey copy, orange CTA. */
export default function LegacyLinkCard({ title, description, buttonLabel, href, external, disabled }) {
  const body = (
    <>
      <h2 className="text-[0.9rem] font-semibold text-slate-900">{title}</h2>
      {description ? (
        <p className="flex-1 text-[0.8rem] leading-snug text-slate-600">{description}</p>
      ) : null}
      {href && !disabled ? (
        external ? (
          <a href={href} target="_blank" rel="noopener noreferrer" className={BTN}>
            {buttonLabel}
          </a>
        ) : (
          <Link href={href} className={BTN}>
            {buttonLabel}
          </Link>
        )
      ) : (
        <button type="button" disabled className={`${BTN} cursor-not-allowed opacity-60`}>
          {buttonLabel}
        </button>
      )}
    </>
  );

  return (
    <div className="flex min-h-[200px] flex-col rounded-[10px] border border-slate-200 bg-white p-6 shadow-sm transition hover:border-[#f97316]/40 hover:shadow-md">
      {body}
    </div>
  );
}
