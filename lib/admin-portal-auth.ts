import AsyncStorage from "@react-native-async-storage/async-storage";

export type AdminPortalAuthMode = "token" | "dev-header";

export type AdminPortalSession = {
  authMode: AdminPortalAuthMode;
  accessToken: string | null;
  devUserId: string | null;
  openId: string;
  userName: string;
  loggedInAt: string;
};

const ADMIN_PORTAL_SESSION_KEY = "adminPortalSession";

function parseSession(raw: string | null): AdminPortalSession | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<AdminPortalSession>;
    if (!parsed || (parsed.authMode !== "token" && parsed.authMode !== "dev-header")) {
      return null;
    }
    if (!parsed.openId || !parsed.userName || !parsed.loggedInAt) {
      return null;
    }
    return {
      authMode: parsed.authMode,
      accessToken: parsed.accessToken ?? null,
      devUserId: parsed.devUserId ?? null,
      openId: parsed.openId,
      userName: parsed.userName,
      loggedInAt: parsed.loggedInAt,
    };
  } catch {
    return null;
  }
}

export async function getAdminPortalSession(): Promise<AdminPortalSession | null> {
  const raw = await AsyncStorage.getItem(ADMIN_PORTAL_SESSION_KEY);
  return parseSession(raw);
}

export async function saveAdminPortalSession(session: AdminPortalSession): Promise<void> {
  await AsyncStorage.setItem(ADMIN_PORTAL_SESSION_KEY, JSON.stringify(session));
}

export async function clearAdminPortalSession(): Promise<void> {
  await AsyncStorage.removeItem(ADMIN_PORTAL_SESSION_KEY);
}
