import { apiCall } from "@/lib/_core/api";
import type { AdminPortalSession } from "@/lib/admin-portal-auth";

type AdminCallOptions = RequestInit;

let runtimeSession: AdminPortalSession | null = null;

export function setAdminPortalRuntimeSession(session: AdminPortalSession | null) {
  runtimeSession = session;
}

function getAdminAuthHeaders(session: AdminPortalSession | null): Record<string, string> {
  if (!session) {
    return {};
  }

  if (session.authMode === "token" && session.accessToken) {
    return {
      Authorization: `Bearer ${session.accessToken}`,
    };
  }

  if (session.authMode === "dev-header" && session.devUserId) {
    return {
      "x-dev-user-id": session.devUserId,
      "x-dev-user-role": "admin",
    };
  }

  return {};
}

async function adminCall<T>(endpoint: string, options: AdminCallOptions = {}): Promise<T> {
  return apiCall<T>(endpoint, {
    ...options,
    headers: {
      ...((options.headers as Record<string, string> | undefined) ?? {}),
      ...getAdminAuthHeaders(runtimeSession),
    },
  });
}

export type AdminAuthUser = {
  id: number | null;
  openId: string;
  name: string;
  role: "admin";
};

export type AdminAuthLoginResponse = {
  authMode: "token" | "dev-header";
  accessToken: string | null;
  devUserId: string | null;
  expiresInSeconds: number;
  user: AdminAuthUser;
};

export type AdminAuthMeResponse = {
  user: AdminAuthUser;
};

export async function adminLogin(openId: string, password: string) {
  return apiCall<AdminAuthLoginResponse>("/api/admin/auth/login", {
    method: "POST",
    body: JSON.stringify({ openId, password }),
  });
}

export async function getAdminAuthMe() {
  return adminCall<AdminAuthMeResponse>("/api/admin/auth/me");
}

export async function adminLogout() {
  return adminCall<{ ok: boolean }>("/api/admin/auth/logout", {
    method: "POST",
  });
}

export type AdminOverviewResponse = {
  generatedAt: string;
  counts: {
    totalDrivers: number;
    onlineDrivers: number;
    verifiedDrivers: number;
    activeTrips: number;
    completedTrips: number;
    cancelledTrips: number;
    pendingDispatchOffers: number;
    openIncidents: number;
    ratingsSubmitted: number;
  };
  metrics: {
    counters: Record<string, number>;
    gauges: Record<string, number>;
    timestamp: string;
  };
};

export type AdminDriversResponse = {
  generatedAt: string;
  drivers: {
    driverId: string;
    userId: number;
    verified: boolean;
    rating: number;
    totalTrips: number;
    vehicle: {
      make: string;
      model: string;
      color: string;
      plateNumber: string;
    };
    personalInfo: {
      fullName: string;
      phoneNumber: string;
      nrcNumber: string;
      homeAddress: string;
      emergencyContactName: string | null;
      emergencyContactPhone: string | null;
      payoutMethod?: "MOBILE_MONEY" | "BANK" | null;
      payoutAccountNumber?: string | null;
    };
    compliance: {
      driversLicenseNumber: string;
      vehicleRegistrationNumber: string;
      hasDriversLicense: boolean;
      hasVehicleRegistrationDocument: boolean;
      insured: boolean;
      roadTaxCleared: boolean;
      fitnessTestPassed: boolean;
    };
    commercial: {
      ridesPurchased: number;
      ridesCompleted: number;
      ridesRemaining: number;
      notes: string | null;
    };
    documents: {
      driversLicenseDocumentRef: string;
      vehicleRegistrationDocumentRef: string;
      insuranceDocumentRef: string;
      roadTaxDocumentRef: string;
      fitnessCertificateDocumentRef: string;
    };
    audit: {
      createdAt: string;
      updatedAt: string;
      createdByAdminId: number | null;
      updatedByAdminId: number | null;
      verificationReviewedAt: string | null;
      compliance: {
        driversLicenseCheckedAt: string | null;
        vehicleRegistrationCheckedAt: string | null;
        insuranceCheckedAt: string | null;
        roadTaxCheckedAt: string | null;
        fitnessCheckedAt: string | null;
      };
    };
    account: {
      openId: string;
      isActive: boolean;
      passwordUpdatedAt: string;
      lastLoginAt: string | null;
    } | null;
    status: {
      isOnline: boolean;
      lat: number | null;
      lng: number | null;
      lastSeenAt: string | null;
      activeTripId: string | null;
    } | null;
  }[];
};

export type AdminActivityResponse = {
  generatedAt: string;
  trips: any[];
  tripEvents: any[];
  incidents: any[];
  dispatchOffers: any[];
};

export async function getAdminOverview() {
  return adminCall<AdminOverviewResponse>("/api/admin/overview");
}

export async function getAdminDrivers() {
  return adminCall<AdminDriversResponse>("/api/admin/drivers");
}

export async function getAdminActivities(limit = 60) {
  return adminCall<AdminActivityResponse>(`/api/admin/activities?limit=${limit}`);
}

export async function registerDriver(payload: {
  userId: number;
  vehicleMake: string;
  vehicleModel: string;
  vehicleColor: string;
  plateNumber: string;
  personalInfo: {
    fullName: string;
    phoneNumber: string;
    nrcNumber: string;
    homeAddress: string;
    emergencyContactName?: string;
    emergencyContactPhone?: string;
  };
  compliance: {
    driversLicenseNumber: string;
    vehicleRegistrationNumber: string;
    hasDriversLicense: boolean;
    hasVehicleRegistrationDocument: boolean;
    insured: boolean;
    roadTaxCleared: boolean;
    fitnessTestPassed: boolean;
  };
  commercial: {
    ridesPurchased: number;
    notes?: string;
  };
  documents: {
    driversLicenseDocumentRef: string;
    vehicleRegistrationDocumentRef: string;
    insuranceDocumentRef: string;
    roadTaxDocumentRef: string;
    fitnessCertificateDocumentRef: string;
  };
  account?: {
    openId?: string;
    password?: string;
    isActive?: boolean;
  };
  verified?: boolean;
}) {
  return adminCall<any>("/api/admin/drivers/register", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function setDriverVerification(driverId: string, verified: boolean) {
  return adminCall<any>(`/api/admin/drivers/${driverId}/verify`, {
    method: "POST",
    body: JSON.stringify({ verified }),
  });
}

export async function addDriverRideCredits(driverId: string, ridesToAdd: number) {
  return adminCall<any>(`/api/admin/drivers/${driverId}/credits`, {
    method: "POST",
    body: JSON.stringify({ ridesToAdd }),
  });
}

export async function updateDriverCredentials(
  driverId: string,
  payload: { openId?: string; password?: string; isActive?: boolean },
) {
  return adminCall<any>(`/api/admin/drivers/${driverId}/credentials`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
