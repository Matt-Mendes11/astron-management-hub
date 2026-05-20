const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");

function ensureDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function copyWithReplacements(src, dest, replacements) {
  let text = fs.readFileSync(src, "utf8");
  for (const [from, to] of replacements) {
    text = text.split(from).join(to);
  }
  ensureDir(dest);
  fs.writeFileSync(dest, text, "utf8");
}

const moves = [
  {
    src: "src/app/staff-management/page.js",
    dest: "src/app/[store]/the-team/page.js",
    replacements: [
      ['import { useSearchParams } from "next/navigation";', 'import { useParams, useSearchParams } from "next/navigation";'],
      ['import { labelToSlug } from "../../lib/stores";', 'import { storeLabelFromRoute, storeSlugFromRoute, backHrefFromReturn } from "../../../lib/storeRoute";'],
      ["export default function StaffManagementPage() {\n  const searchParams = useSearchParams();\n  const storeParam = searchParams.get(\"store\");\n  const selectedStore = STORES.includes(storeParam) ? storeParam : \"Hillcrest\";\n\n  const backHref = useMemo(() => {\n    const r = searchParams.get(\"return\");\n    if (r) {\n      try {\n        return decodeURIComponent(r);\n      } catch {\n        return r;\n      }\n    }\n    return `/${labelToSlug(selectedStore)}`;\n  }, [searchParams, selectedStore]);", "export default function StaffManagementPage() {\n  const params = useParams();\n  const searchParams = useSearchParams();\n  const storeSlug = storeSlugFromRoute(params?.store, searchParams);\n  const selectedStore = storeLabelFromRoute(params?.store, searchParams);\n\n  const backHref = useMemo(\n    () => backHrefFromReturn(searchParams, `/${storeSlug}/the-team`),\n    [searchParams, storeSlug]\n  );"],
      ['href={`/staff-management/${row.id}?${queryStore}${', 'href={`/${storeSlug}/the-team/${row.id}?${queryStore}${'],
    ],
  },
  {
    src: "src/app/staff-management/[id]/page.js",
    dest: "src/app/[store]/the-team/[id]/page.js",
    replacements: [
      ['import { labelToSlug } from "../../lib/stores";', 'import { storeLabelFromRoute, storeSlugFromRoute, backHrefFromReturn } from "../../../../lib/storeRoute";'],
      ["  const storeParam = searchParams.get(\"store\");\n  const selectedStore = STORES.includes(storeParam) ? storeParam : \"Hillcrest\";", "  const storeSlug = storeSlugFromRoute(params?.store, searchParams);\n  const selectedStore = storeLabelFromRoute(params?.store, searchParams);"],
      ['    return `/staff-management?${queryStore}`;\n  }, [searchParams, queryStore]);', "    return backHrefFromReturn(searchParams, `/${storeSlug}/the-team`);\n  }, [searchParams, storeSlug]);"],
    ],
  },
  {
    src: "src/app/payments/page.js",
    dest: "src/app/[store]/admin-controls-sheet/payments/page.js",
    replacements: [
      ['import { useSearchParams } from "next/navigation";', 'import { useParams, useSearchParams } from "next/navigation";'],
      ['import { labelToSlug } from "../../lib/stores";', 'import { storeLabelFromRoute, storeSlugFromRoute, backHrefFromReturn } from "../../../lib/storeRoute";'],
      ["export default function PaymentsPage() {\n  const searchParams = useSearchParams();\n  const selectedStore = searchParams.get(\"store\") || \"Hillcrest\";", "export default function PaymentsPage() {\n  const params = useParams();\n  const searchParams = useSearchParams();\n  const storeSlug = storeSlugFromRoute(params?.store, searchParams);\n  const selectedStore = storeLabelFromRoute(params?.store, searchParams);"],
      ['  const backHref = useMemo(() => {\n    const r = searchParams.get(\"return\");\n    if (r) {\n      try {\n        return decodeURIComponent(r);\n      } catch {\n        return r;\n      }\n    }\n    return `/${labelToSlug(selectedStore)}/admin-controls-sheet`;\n  }, [searchParams, selectedStore]);', "  const backHref = useMemo(\n    () => backHrefFromReturn(searchParams, `/${storeSlug}/admin-controls-sheet`),\n    [searchParams, storeSlug]\n  );"],
    ],
  },
  {
    src: "src/app/fuel-planner/page.js",
    dest: "src/app/[store]/fuel-management/fuel-plan/page.js",
    replacements: [
      ['import { useRouter, useSearchParams } from "next/navigation";', 'import { useParams, useSearchParams } from "next/navigation";'],
      ['import { labelToSlug } from "../../lib/stores";', 'import { storeLabelFromRoute, storeSlugFromRoute, backHrefFromReturn } from "../../../lib/storeRoute";'],
      ["function FuelPlannerPageInner() {\n  const router = useRouter();\n  const searchParams = useSearchParams();\n  const returnUrl = searchParams.get(\"return\");\n  const selectedStoreParam = searchParams.get(\"store\");\n  const selectedStore = STORE_OPTIONS.includes(selectedStoreParam ?? \"\")\n    ? selectedStoreParam\n    : \"Hillcrest\";\n\n  useEffect(() => {\n    if (returnUrl) return;\n    const slug = labelToSlug(selectedStore);\n    router.replace(`/${slug}/fuel-management`);\n  }, [returnUrl, router, selectedStore]);", "function FuelPlannerPageInner() {\n  const params = useParams();\n  const searchParams = useSearchParams();\n  const storeSlug = storeSlugFromRoute(params?.store, searchParams);\n  const selectedStore = storeLabelFromRoute(params?.store, searchParams);"],
      ['  const backHref = useMemo(() => {\n    if (returnUrl) {\n      try {\n        return decodeURIComponent(returnUrl);\n      } catch {\n        return returnUrl;\n      }\n    }\n    return `/${labelToSlug(selectedStore)}/fuel-management`;\n  }, [returnUrl, selectedStore]);\n\n  if (!returnUrl) {\n    return (\n      <div className=\"grid min-h-[40vh] place-items-center p-8 text-center text-sm text-slate-600\">\n        Redirecting to Fuel Management…\n      </div>\n    );\n  }', "  const backHref = useMemo(\n    () => backHrefFromReturn(searchParams, `/${storeSlug}/fuel-management`),\n    [searchParams, storeSlug]\n  );"],
    ],
  },
  {
    src: "src/app/site-assessments/page.js",
    dest: "src/app/[store]/routines-and-audits/site-assessments/page.js",
    replacements: [
      ['import { useSearchParams } from "next/navigation";', 'import { useParams, useSearchParams } from "next/navigation";'],
      ['import { labelToSlug } from "../../lib/stores";', 'import { storeLabelFromRoute, storeSlugFromRoute, backHrefFromReturn } from "../../../lib/storeRoute";'],
      ["export default function SiteAssessmentsPage() {\n  const searchParams = useSearchParams();\n  const selectedStore = STORES.includes(searchParams.get(\"store\")) ? searchParams.get(\"store\") : \"Hillcrest\";\n\n  const backHref = useMemo(() => {\n    const r = searchParams.get(\"return\");\n    if (r) {\n      try {\n        return decodeURIComponent(r);\n      } catch {\n        return r;\n      }\n    }\n    return `/${labelToSlug(selectedStore)}/routines-and-audits`;\n  }, [searchParams, selectedStore]);", "export default function SiteAssessmentsPage() {\n  const params = useParams();\n  const searchParams = useSearchParams();\n  const storeSlug = storeSlugFromRoute(params?.store, searchParams);\n  const selectedStore = storeLabelFromRoute(params?.store, searchParams);\n\n  const backHref = useMemo(\n    () => backHrefFromReturn(searchParams, `/${storeSlug}/routines-and-audits`),\n    [searchParams, storeSlug]\n  );"],
    ],
  },
  {
    src: "src/app/repairs-maintenance/page.js",
    dest: "src/app/[store]/repairs-maintenance/log/page.js",
    replacements: [
      ['import { useSearchParams } from "next/navigation";', 'import { useParams, useSearchParams } from "next/navigation";'],
      ['import { labelToSlug } from "../../lib/stores";', 'import { storeLabelFromRoute, storeSlugFromRoute, backHrefFromReturn } from "../../../lib/storeRoute";'],
      ["export default function RepairsMaintenancePage() {\n  const searchParams = useSearchParams();\n  const selectedStore = STORES.includes(searchParams.get(\"store\"))\n    ? searchParams.get(\"store\")\n    : \"Hillcrest\";\n\n  const backHref = useMemo(() => {\n    const r = searchParams.get(\"return\");\n    if (r) {\n      try {\n        return decodeURIComponent(r);\n      } catch {\n        return r;\n      }\n    }\n    return `/${labelToSlug(selectedStore)}/repairs-maintenance`;\n  }, [searchParams, selectedStore]);", "export default function RepairsMaintenancePage() {\n  const params = useParams();\n  const searchParams = useSearchParams();\n  const storeSlug = storeSlugFromRoute(params?.store, searchParams);\n  const selectedStore = storeLabelFromRoute(params?.store, searchParams);\n\n  const backHref = useMemo(\n    () => backHrefFromReturn(searchParams, `/${storeSlug}/repairs-maintenance`),\n    [searchParams, storeSlug]\n  );"],
    ],
  },
];

for (const move of moves) {
  copyWithReplacements(
    path.join(root, move.src),
    path.join(root, move.dest),
    move.replacements
  );
  console.log(`Migrated ${move.src} -> ${move.dest}`);
}
