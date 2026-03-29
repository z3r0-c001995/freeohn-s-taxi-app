import { useCallback, useEffect, useState } from "react";
import { useRouter } from "expo-router";

import {
  adminLogout,
  getAdminAuthMe,
  setAdminPortalRuntimeSession,
  type AdminAuthUser,
} from "@/lib/admin-portal-api";
import {
  clearAdminPortalSession,
  getAdminPortalSession,
  type AdminPortalSession,
} from "@/lib/admin-portal-auth";

export function useAdminPortalGuard() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [adminUser, setAdminUser] = useState<AdminAuthUser | null>(null);
  const [session, setSession] = useState<AdminPortalSession | null>(null);
  const [error, setError] = useState<string | null>(null);

  const resolveSession = useCallback(async () => {
    setReady(false);
    setError(null);

    const storedSession = await getAdminPortalSession();
    if (!storedSession) {
      setAdminPortalRuntimeSession(null);
      router.replace("/admin/login");
      return;
    }

    setSession(storedSession);
    setAdminPortalRuntimeSession(storedSession);

    try {
      const me = await getAdminAuthMe();
      setAdminUser(me.user);
      setReady(true);
    } catch (authError) {
      const message = authError instanceof Error ? authError.message : "Unauthorized";
      setError(message);
      setAdminPortalRuntimeSession(null);
      await clearAdminPortalSession();
      router.replace("/admin/login");
    }
  }, [router]);

  useEffect(() => {
    void resolveSession();
  }, [resolveSession]);

  const logout = useCallback(async () => {
    try {
      await adminLogout();
    } catch {
      // Ignore server logout failures; local session clear is authoritative.
    }
    await clearAdminPortalSession();
    setAdminPortalRuntimeSession(null);
    setAdminUser(null);
    setSession(null);
    setReady(false);
    router.replace("/admin/login");
  }, [router]);

  return {
    ready,
    adminUser,
    session,
    error,
    refreshAuth: resolveSession,
    logout,
  };
}
