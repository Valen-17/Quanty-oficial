import { useSettingsStore } from "@/stores/settingsStore";

export interface CloudProfileFields {
  full_name: string | null;
  business_name: string | null;
  phone: string | null;
  has_employees: boolean | null;
  employee_count: number | null;
  currency: string | null;
  language: string | null;
}

const DEFAULT_CLOUD_CURRENCY = "COP";
const DEFAULT_CLOUD_LANGUAGE = "es";

// Copia el perfil de la nube a los ajustes locales.
export function mergeCloudProfileIntoSettings(row: CloudProfileFields): void {
  const settings = useSettingsStore.getState();
  const current = settings.profile;
  const cloudCurrency = row.currency?.trim();
  const cloudLanguage = row.language?.trim();
  settings.updateProfile({
    ...current,
    fullName: row.full_name?.trim() || current.fullName,
    businessName: row.business_name ?? current.businessName,
    phone: row.phone ?? current.phone,
    hasEmployees: row.has_employees ?? current.hasEmployees,
    employeeCount: row.employee_count ?? current.employeeCount,
    currency:
      cloudCurrency && cloudCurrency !== DEFAULT_CLOUD_CURRENCY ? cloudCurrency : current.currency,
    language: cloudLanguage && cloudLanguage !== DEFAULT_CLOUD_LANGUAGE ? "en" : current.language,
  });
}
