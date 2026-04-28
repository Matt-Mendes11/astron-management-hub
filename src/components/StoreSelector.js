"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

const STORES = ["Hillcrest", "Hammersdale", "Gillitts", "Cato Ridge"];

export default function StoreSelector() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [selectedStore, setSelectedStore] = useState("Hillcrest");
  const [pendingStore, setPendingStore] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    const storeFromQuery = searchParams.get("store");
    if (storeFromQuery && STORES.includes(storeFromQuery)) {
      setSelectedStore(storeFromQuery);
    }
  }, [searchParams]);

  const handleStoreChange = (event) => {
    const nextStore = event.target.value;
    if (!nextStore || nextStore === selectedStore) return;
    setPendingStore(nextStore);
    setIsModalOpen(true);
  };

  const confirmStoreChange = () => {
    if (!pendingStore) return;
    const params = new URLSearchParams(searchParams.toString());
    params.set("store", pendingStore);
    setSelectedStore(pendingStore);
    setIsModalOpen(false);
    setPendingStore(null);
    router.push(`${pathname}?${params.toString()}`);
  };

  const cancelStoreChange = () => {
    setIsModalOpen(false);
    setPendingStore(null);
  };

  return (
    <>
      <div className="flex items-center gap-2">
        <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Store</label>
        <select
          value={selectedStore}
          onChange={handleStoreChange}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 outline-none focus:border-[#ff6e00]"
        >
          {STORES.map((store) => (
            <option key={store} value={store}>
              {store}
            </option>
          ))}
        </select>
      </div>

      {isModalOpen && pendingStore && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/40 p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
            <h3 className="text-base font-semibold text-slate-900">CONFIRM LOCATION</h3>
            <p className="mt-2 text-sm text-slate-700">
              Are you sure you want to enter the {pendingStore} dashboard?
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={cancelStoreChange}
                className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmStoreChange}
                className="rounded-xl bg-[#ff6e00] px-4 py-2 text-sm font-semibold text-white transition hover:brightness-95"
              >
                Yes, Enter
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
