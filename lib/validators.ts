import { z } from "zod";

export const customerSchema = z.object({
  companyName: z.string().min(2),
  contactPerson: z.string().optional(),
  mobile: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  billingAddress: z.string().optional(),
  gstNumber: z.string().optional(),
  remarks: z.string().optional(),
  status: z.enum(["ACTIVE", "INACTIVE"]).default("ACTIVE"),
});

export const siteSchema = z.object({
  customer: z.string().min(1, "Customer required"),
  siteName: z.string().min(2),
  siteAddress: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  pincode: z.string().optional(),
  gpsLatitude: z.coerce.number().optional(),
  gpsLongitude: z.coerce.number().optional(),
  contactPerson: z.string().optional(),
  mobile: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  assignedEngineer: z.string().optional().or(z.literal("")),
  remarks: z.string().optional(),
  status: z.enum(["ACTIVE", "INACTIVE"]).default("ACTIVE"),
});

export const equipmentSchema = z.object({
  customer: z.string().min(1),
  site: z.string().min(1),
  equipmentType: z.string().optional(),
  make: z.string().optional(),
  model: z.string().optional(),
  serialNumber: z.string().optional(),
  kvaCapacity: z.string().optional(),
  assetId: z.string().optional(),
  installationDate: z.string().optional(),
  batteryMake: z.string().optional(),
  batteryModel: z.string().optional(),
  batteryQuantity: z.coerce.number().optional(),
  batteryCapacity: z.string().optional(),
  batteryInstallationDate: z.string().optional(),
  warrantyStartDate: z.string().optional(),
  warrantyEndDate: z.string().optional(),
  amcStartDate: z.string().optional(),
  amcEndDate: z.string().optional(),
  currentCondition: z.enum(["GOOD", "FAIR", "POOR", "NOT_WORKING"]).optional(),
  equipmentStatus: z.enum(["ACTIVE", "UNDER_REPAIR", "DECOMMISSIONED", "TRANSFERRED", "REPLACED"]).default("ACTIVE"),
  remarks: z.string().optional(),
});

const amcBaseSchema = z.object({
  customer: z.string().min(1, "Customer required"),
  site: z.string().min(1, "Site required"),
  equipmentIds: z.array(z.string()).min(1, "Select at least one equipment").refine((arr) => new Set(arr).size === arr.length, "Duplicate equipment not allowed"),
  amcType: z.enum(["COMPREHENSIVE", "NON_COMPREHENSIVE", "PREVENTIVE_MAINTENANCE", "OTHER"]),
  startDate: z.string().min(1, "Start date required"),
  endDate: z.string().min(1, "End date required"),
  contractAmount: z.coerce.number().min(0, "Amount cannot be negative"),
  paymentStatus: z.enum(["NOT_BILLED", "INVOICED", "PARTIAL", "PAID", "OVERDUE"]).default("NOT_BILLED"),
  paidAmount: z.coerce.number().min(0, "Paid amount cannot be negative").default(0).optional(),
  assignedEngineer: z.string().optional().or(z.literal("")),
  terms: z.string().optional(),
  status: z.enum(["ACTIVE", "EXPIRED", "CANCELLED", "RENEWED"]).default("ACTIVE"),
});

export const amcSchema = amcBaseSchema
  .refine((data) => new Date(data.endDate) >= new Date(data.startDate), { message: "End date must not be before start date", path: ["endDate"] })
  .superRefine((data, ctx) => {
    const paid = Number(data.paidAmount ?? 0);
    const total = Number(data.contractAmount ?? 0);
    if (data.paymentStatus === "PARTIAL") {
      if (!paid || paid <= 0) ctx.addIssue({ code: "custom", message: "Paid amount required for PARTIAL status", path: ["paidAmount"] });
      else if (paid >= total) ctx.addIssue({ code: "custom", message: "Paid amount must be less than contract amount for PARTIAL", path: ["paidAmount"] });
    }
    if (paid > total) ctx.addIssue({ code: "custom", message: "Paid amount cannot exceed contract amount", path: ["paidAmount"] });
    if (data.paymentStatus === "PAID" && paid !== 0 && paid !== total) ctx.addIssue({ code: "custom", message: "For PAID status, paid amount should be 0 or equal to contract amount", path: ["paidAmount"] });
  });

// Partial version for PATCH/PUT edits - Zod .partial() cannot be used on schemas with .refine(), so derive from base
export const amcUpdateSchema = amcBaseSchema.partial()
  .refine(
    (data) => {
      if (data.startDate && data.endDate) return new Date(data.endDate) >= new Date(data.startDate);
      return true;
    },
    { message: "End date must not be before start date", path: ["endDate"] }
  )
  .superRefine((data, ctx) => {
    if (data.paidAmount !== undefined && data.contractAmount !== undefined) {
      const paid = Number(data.paidAmount ?? 0);
      const total = Number(data.contractAmount ?? 0);
      if (paid > total) ctx.addIssue({ code: "custom", message: "Paid amount cannot exceed contract amount", path: ["paidAmount"] });
    }
    if (data.paymentStatus === "PARTIAL" && data.paidAmount !== undefined) {
      const paid = Number(data.paidAmount ?? 0);
      if (!paid || paid <= 0) ctx.addIssue({ code: "custom", message: "Paid amount required for PARTIAL status", path: ["paidAmount"] });
    }
  });

export const amcRenewSchema = z.object({
  newStartDate: z.string().min(1),
  newEndDate: z.string().min(1),
  newAmcType: z.enum(["COMPREHENSIVE", "NON_COMPREHENSIVE", "PREVENTIVE_MAINTENANCE", "OTHER"]).optional(),
  contractAmount: z.coerce.number().min(0).optional(),
  paymentStatus: z.enum(["NOT_BILLED", "INVOICED", "PARTIAL", "PAID", "OVERDUE"]).optional(),
  assignedEngineer: z.string().optional().or(z.literal("")),
  terms: z.string().optional(),
  remarks: z.string().optional(),
}).refine((d) => new Date(d.newEndDate) >= new Date(d.newStartDate), { message: "End date must not be before start date", path: ["newEndDate"] });

export const serviceCallSchema = z.object({
  customer: z.string().min(1, "Customer required"),
  site: z.string().min(1, "Site required"),
  equipment: z.string().optional().or(z.literal("")),
  complaintDate: z.string().min(1, "Complaint date required"),
  complaintTime: z.string().optional(),
  complaintType: z.enum(["BREAKDOWN", "PREVENTIVE", "INSTALLATION", "OTHER"]).default("BREAKDOWN"),
  problemDescription: z.string().min(5, "Problem description required"),
  priority: z.enum(["CRITICAL", "HIGH", "MEDIUM", "LOW"]).default("MEDIUM"),
  assignedEngineer: z.string().optional().or(z.literal("")),
  targetVisitDate: z.string().optional().or(z.literal("")),
  targetResolutionDate: z.string().optional().or(z.literal("")),
});

export const statusUpdateSchema = z.object({
  status: z.enum(["NEW","ASSIGNED","VISIT_SCHEDULED","ENGINEER_VISITED","DIAGNOSIS","REPAIR_IN_PROGRESS","PARTS_REQUIRED","PARTS_RECEIVED","WORK_COMPLETED","CUSTOMER_CONFIRMATION","CLOSED","ON_HOLD","CANCELLED","REOPENED"]),
  remarks: z.string().optional(),
});

export const visitSchema = z.object({
  visitDate: z.string().min(1, "Visit date required"),
  visitTime: z.string().optional(),
  visitPurpose: z.enum(["INITIAL_INSPECTION", "DIAGNOSIS", "FOLLOW_UP_REPAIR", "PARTS_INSTALLATION", "TESTING", "FINAL_INSTALLATION", "SERVICE_CENTER_REPAIR", "RETURN_REINSTALLATION", "OTHER"]).optional(),
  engineer: z.string().optional(),
  gpsLatitude: z.coerce.number().min(-90).max(90).optional(),
  gpsLongitude: z.coerce.number().min(-180).max(180).optional(),
  gpsAccuracy: z.coerce.number().optional(),
  completionLatitude: z.coerce.number().min(-90).max(90).optional(),
  completionLongitude: z.coerce.number().min(-180).max(180).optional(),
  completionGpsAccuracy: z.coerce.number().optional(),
  problemFound: z.string().optional(),
  diagnosis: z.string().optional(),
  workDone: z.string().optional(),
  equipmentCondition: z.enum(["GOOD", "FAIR", "POOR", "NOT_WORKING"]).optional(),
  partsUsed: z.array(z.string()).optional(),
  partsRequired: z.array(z.string()).optional(),
  engineerRemarks: z.string().optional(),
  beforePhotos: z.array(z.object({ url: z.string().url(), publicId: z.string(), fileName: z.string().optional(), resourceType: z.string().optional() })).optional(),
  afterPhotos: z.array(z.object({ url: z.string().url(), publicId: z.string(), fileName: z.string().optional(), resourceType: z.string().optional() })).optional(),
  customerSignature: z.object({ url: z.string().url(), publicId: z.string() }).optional(),
  signatureReason: z.enum(["CUSTOMER_UNAVAILABLE", "CUSTOMER_REFUSED", "SITE_CLOSED", "OTHER"]).optional(),
});

export const visitStartSchema = z.object({
  gpsLatitude: z.coerce.number().min(-90).max(90),
  gpsLongitude: z.coerce.number().min(-180).max(180),
  gpsAccuracy: z.coerce.number().optional(),
  gpsTimestamp: z.string().optional(),
});

export const visitCompleteSchema = z.object({
  completionLatitude: z.coerce.number().min(-90).max(90).optional(),
  completionLongitude: z.coerce.number().min(-180).max(180).optional(),
  completionGpsAccuracy: z.coerce.number().optional(),
  completionTimestamp: z.string().optional(),
  diagnosis: z.string().optional(),
  workDone: z.string().optional(),
  problemFound: z.string().optional(),
  equipmentCondition: z.enum(["GOOD", "FAIR", "POOR", "NOT_WORKING"]).optional(),
  engineerRemarks: z.string().optional(),
  beforePhotos: z.array(z.object({ url: z.string().url(), publicId: z.string() })).optional(),
  afterPhotos: z.array(z.object({ url: z.string().url(), publicId: z.string() })).optional(),
  customerSignature: z.object({ url: z.string().url(), publicId: z.string() }).optional(),
  signatureReason: z.enum(["CUSTOMER_UNAVAILABLE", "CUSTOMER_REFUSED", "SITE_CLOSED", "OTHER"]).optional(),
}).refine((d) => d.customerSignature || d.signatureReason, { message: "Signature or reason required", path: ["signatureReason"] });

export const partSchema = z.object({
  partNumber: z.string().min(2, "SKU required").transform((v) => v.toUpperCase().trim()),
  name: z.string().min(2, "Name required"),
  description: z.string().optional(),
  category: z.string().optional(),
  brand: z.string().optional(),
  unit: z.string().optional(),
  minimumStockLevel: z.coerce.number().min(0).default(5),
  initialStock: z.coerce.number().min(0).default(0).optional(),
  active: z.boolean().default(true),
});

export const inventoryAdjustSchema = z.object({
  type: z.enum(["IN", "OUT", "ADJUSTMENT", "RETURN"]),
  quantity: z.coerce.number().min(1, "Quantity must be positive"),
  remarks: z.string().optional(),
  location: z.string().optional(),
});

export const partRequestSchema = z.object({
  part: z.string().min(1, "Part required"),
  quantity: z.coerce.number().min(1, "Quantity must be >=1"),
  serviceCall: z.string().min(1, "ServiceCall required"),
  serviceVisit: z.string().min(1, "ServiceVisit required"),
  equipment: z.string().optional().or(z.literal("")),
  remarks: z.string().optional(),
});

export const partRequestStatusSchema = z.object({
  status: z.enum(["REQUIRED", "REQUESTED", "APPROVED", "DISPATCHED", "RECEIVED", "USED", "REJECTED", "CANCELLED"]),
  remarks: z.string().optional(),
  rejectionReason: z.string().optional(),
});

export const invoiceSchema = z.object({
  customer: z.string().min(1, "Customer required"),
  amcContract: z.string().optional().or(z.literal("")),
  serviceCall: z.string().optional().or(z.literal("")),
  invoiceDate: z.string().min(1),
  dueDate: z.string().optional().or(z.literal("")),
  amount: z.coerce.number().min(0, "Amount >=0"),
  taxAmount: z.coerce.number().min(0).optional(),
  notes: z.string().optional(),
});

export const paymentSchema = z.object({
  invoice: z.string().min(1, "Invoice required"),
  amount: z.coerce.number().min(0.01, "Amount >0"),
  paymentDate: z.string().optional(),
  paymentMethod: z.enum(["CASH", "BANK_TRANSFER", "UPI", "CHEQUE", "OTHER"]).default("OTHER"),
  referenceNumber: z.string().optional(),
  remarks: z.string().optional(),
});

export const serviceExpenseSchema = z.object({
  serviceCall: z.string().min(1, "ServiceCall required"),
  serviceVisit: z.string().optional().or(z.literal("")),
  category: z.enum(["PARTS", "TRAVEL", "LABOUR", "TRANSPORT", "ACCOMMODATION", "FOOD", "TOOLS", "OTHER"]),
  description: z.string().min(3, "Description required"),
  amount: z.coerce.number().min(0.01, "Amount >0"),
  expenseDate: z.string().min(1),
  incurredBy: z.string().optional().or(z.literal("")),
  costSource: z.enum(["FIELD", "SERVICE_CENTER", "INTERNAL"]).default("FIELD").optional(),
  remarks: z.string().optional(),
  receipt: z.object({ url: z.string().url(), publicId: z.string(), fileName: z.string().optional(), mimeType: z.string().optional(), size: z.number().optional() }).optional(),
});

export const createUserSchema = z.object({
  name: z.string().min(2, "Name required"),
  email: z.string().email("Invalid email"),
  mobile: z.string().optional().or(z.literal("")),
  password: z.string().min(6, "Password min 6 chars"),
  confirmPassword: z.string().min(6),
  role: z.enum(["super_admin", "manager", "coordinator", "engineer", "accounts"]),
  employeeId: z.string().optional().or(z.literal("")),
  designation: z.string().optional().or(z.literal("")),
  isActive: z.boolean().default(true),
}).refine((d) => d.password === d.confirmPassword, { message: "Passwords do not match", path: ["confirmPassword"] });

export const updateUserSchema = z.object({
  name: z.string().min(2).optional(),
  email: z.string().email().optional(),
  mobile: z.string().optional().or(z.literal("")),
  role: z.enum(["super_admin", "manager", "coordinator", "engineer", "accounts"]).optional(),
  employeeId: z.string().optional().or(z.literal("")),
  designation: z.string().optional().or(z.literal("")),
  isActive: z.boolean().optional(),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password required"),
  newPassword: z.string().min(6, "New password min 6 chars"),
  confirmPassword: z.string().min(6),
}).refine((d) => d.newPassword === d.confirmPassword, { message: "Passwords do not match", path: ["confirmPassword"] });

export const adminPasswordResetSchema = z.object({
  newPassword: z.string().min(6, "New password min 6 chars"),
  confirmPassword: z.string().min(6),
}).refine((d) => d.newPassword === d.confirmPassword, { message: "Passwords do not match", path: ["confirmPassword"] });
