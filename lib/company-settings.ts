import { DEFAULT_SETTINGS } from "@/models/SystemSetting";

export interface CompanySettings {
  companyName: string;
  customerCare1: string;
  customerCare2: string;
  companyEmail: string;
}

export const DEFAULT_COMPANY_SETTINGS: CompanySettings = {
  companyName: DEFAULT_SETTINGS.companyName.value,
  customerCare1: DEFAULT_SETTINGS.customerCare1.value,
  customerCare2: DEFAULT_SETTINGS.customerCare2.value,
  companyEmail: DEFAULT_SETTINGS.companyEmail.value,
};

export async function getCompanySettings(): Promise<CompanySettings> {
  try {
    const { connectDB } = await import("@/lib/db");
    await connectDB();
    const { SystemSetting } = await import("@/models/SystemSetting");
    const docs = await SystemSetting.find({ key: { $in: ["companyName", "customerCare1", "customerCare2", "companyEmail"] } }).lean();
    const map: Record<string, string> = {};
    for (const d of docs) map[d.key] = d.value;
    return {
      companyName: map.companyName || DEFAULT_COMPANY_SETTINGS.companyName,
      customerCare1: map.customerCare1 || DEFAULT_COMPANY_SETTINGS.customerCare1,
      customerCare2: map.customerCare2 || DEFAULT_COMPANY_SETTINGS.customerCare2,
      companyEmail: map.companyEmail || DEFAULT_COMPANY_SETTINGS.companyEmail,
    };
  } catch {
    return { ...DEFAULT_COMPANY_SETTINGS };
  }
}
