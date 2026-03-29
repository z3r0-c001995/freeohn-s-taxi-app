export type DriverFormState = {
  userId: string;
  fullName: string;
  phoneNumber: string;
  nrcNumber: string;
  homeAddress: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  vehicleMake: string;
  vehicleModel: string;
  vehicleColor: string;
  plateNumber: string;
  driversLicenseNumber: string;
  vehicleRegistrationNumber: string;
  driversLicenseDocumentRef: string;
  vehicleRegistrationDocumentRef: string;
  insuranceDocumentRef: string;
  roadTaxDocumentRef: string;
  fitnessCertificateDocumentRef: string;
  hasDriversLicense: boolean;
  hasVehicleRegistrationDocument: boolean;
  insured: boolean;
  roadTaxCleared: boolean;
  fitnessTestPassed: boolean;
  ridesPurchased: string;
  adminNotes: string;
  loginOpenId: string;
  loginPassword: string;
  loginActive: boolean;
  verified: boolean;
};

export const DEFAULT_DRIVER_FORM: DriverFormState = {
  userId: "",
  fullName: "",
  phoneNumber: "",
  nrcNumber: "",
  homeAddress: "",
  emergencyContactName: "",
  emergencyContactPhone: "",
  vehicleMake: "",
  vehicleModel: "",
  vehicleColor: "",
  plateNumber: "",
  driversLicenseNumber: "",
  vehicleRegistrationNumber: "",
  driversLicenseDocumentRef: "",
  vehicleRegistrationDocumentRef: "",
  insuranceDocumentRef: "",
  roadTaxDocumentRef: "",
  fitnessCertificateDocumentRef: "",
  hasDriversLicense: false,
  hasVehicleRegistrationDocument: false,
  insured: false,
  roadTaxCleared: false,
  fitnessTestPassed: false,
  ridesPurchased: "50",
  adminNotes: "",
  loginOpenId: "",
  loginPassword: "123456",
  loginActive: true,
  verified: false,
};

export function formatAuditTime(value?: string | null) {
  if (!value) return "Pending";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Pending";
  return parsed.toLocaleString();
}
