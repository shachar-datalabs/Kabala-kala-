export type EasycountRuntimeConfig = {
  EASYCOUNT_ENABLED?: string;
  EASYCOUNT_ALLOW_PRODUCTION?: string;
  EZCOUNT_API_KEY?: string;
  EZCOUNT_DEVELOPER_EMAIL?: string;
  EZCOUNT_BASE_URL?: string;
};

export const EASYCOUNT_DEMO_BASE_URL = "https://demo.ezcount.co.il";
export const EASYCOUNT_PRODUCTION_BASE_URL = "https://api.ezcount.co.il";

export function evaluateEasycountConfiguration(
  runtime: EasycountRuntimeConfig,
) {
  const enabled = runtime.EASYCOUNT_ENABLED === "true";
  const isDemo = runtime.EZCOUNT_BASE_URL === EASYCOUNT_DEMO_BASE_URL;
  const isProduction =
    runtime.EZCOUNT_BASE_URL === EASYCOUNT_PRODUCTION_BASE_URL;
  const productionAllowed =
    runtime.EASYCOUNT_ALLOW_PRODUCTION === "true";
  const environmentAllowed =
    isDemo || (isProduction && productionAllowed);

  return {
    enabled,
    configured: Boolean(
      enabled &&
        runtime.EZCOUNT_API_KEY &&
        runtime.EZCOUNT_DEVELOPER_EMAIL &&
        environmentAllowed,
    ),
    environment: isDemo
      ? "demo"
      : isProduction && productionAllowed
        ? "production"
        : "blocked",
  } as const;
}

export function assertEasycountIssuingEnabled(
  runtime: EasycountRuntimeConfig,
) {
  const status = evaluateEasycountConfiguration(runtime);
  if (!status.enabled) {
    throw new Error("החיבור לשירות הפקת המסמכים אינו פעיל כרגע");
  }
  if (!status.configured) {
    throw new Error("EasyCount עדיין אינו מוגדר במלואו לסביבה שנבחרה");
  }
  return status;
}
