// This module is the single application boundary for the external document
// provider. UI components and routes must not call EasyCount directly.
import { issueReceipt as createReceipt } from "@/lib/ezcount";
export {
  EzcountUncertainError,
  getEzcountStatus,
  issueReceipt,
  type IssuedReceipt,
} from "@/lib/ezcount";
export {
  EASYCOUNT_DEMO_BASE_URL,
  assertEasycountIssuingEnabled,
  evaluateEasycountConfiguration,
  type EasycountRuntimeConfig,
} from "./config";

export type EasycountService = {
  createReceipt: typeof import("@/lib/ezcount").issueReceipt;
  getDocument: (externalDocumentId: string) => Promise<never>;
  getDocumentPdf: (externalDocumentId: string) => Promise<never>;
};

export const easycountService: EasycountService = {
  createReceipt,
  async getDocument() {
    throw new Error("TODO: יש לאמת endpoint רשמי של EasyCount לפני מימוש");
  },
  async getDocumentPdf() {
    throw new Error("TODO: יש לאמת endpoint רשמי של EasyCount לפני מימוש");
  },
};
