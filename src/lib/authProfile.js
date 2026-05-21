"use client";

import { useEffect, useState } from "react";
import { supabase } from "./supabaseBrowser";

const DEFAULT_PROFILE = {
  id: "",
  email: "",
  fullName: "Signed in user",
  role: "staff",
  storeName: "Hillcrest",
};

export function isManagerProfile(profile) {
  return String(profile?.role || "").toLowerCase() === "manager";
}

export function useAuthProfile() {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const loadProfile = async () => {
      setLoading(true);
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!active) return;
      if (!user) {
        setProfile(null);
        setLoading(false);
        return;
      }

      const { data } = await supabase
        .from("profiles")
        .select("id, full_name, role, store_name, assigned_store")
        .eq("id", user.id)
        .maybeSingle();

      if (!active) return;
      setProfile({
        ...DEFAULT_PROFILE,
        id: user.id,
        email: user.email || "",
        fullName: data?.full_name || user.email || DEFAULT_PROFILE.fullName,
        role: data?.role || DEFAULT_PROFILE.role,
        storeName: data?.assigned_store || data?.store_name || DEFAULT_PROFILE.storeName,
      });
      setLoading(false);
    };

    loadProfile();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      loadProfile();
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  return { profile, loading, isManager: isManagerProfile(profile) };
}

export async function signOut() {
  await supabase.auth.signOut();
  window.location.href = "/login";
}
