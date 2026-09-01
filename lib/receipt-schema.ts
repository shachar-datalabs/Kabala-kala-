import { z } from "zod";

export const paymentMethods = [
  { value: 4, label: "העברה בנקאית" },
  { value: 91, label: "Bit, PayBox או אפליקציה" },
  { value: 1, label: "מזומן" },
  { value: 3, label: "כרטיס אשראי" },
  { value: 2, label: "המחאה" },
  { value: 9, label: "אחר" },
] as const;

const optionalText = z.string().trim().max(200).optional().default("");

export const receiptInputSchema = z
  .object({
    idempotencyKey: z.string().trim().min(8).max(100),
    clientId: z.string().uuid().optional().or(z.literal("")),
    documentType: z.enum(["receipt", "proforma"]),
    customerName: z.string().trim().min(2, "יש להזין שם לקוח").max(150),
    customerEmail: z
      .string()
      .trim()
      .max(200)
      .refine((value) => !value || z.string().email().safeParse(value).success, {
        message: "כתובת האימייל אינה תקינה",
      })
      .optional()
      .default(""),
    customerPhone: optionalText,
    customerCrn: z
      .string()
      .trim()
      .max(20)
      .regex(/^$|^[0-9]+$/, "ת״ז או ח״פ יכולים להכיל ספרות בלבד")
      .optional()
      .default(""),
    amount: z.coerce
      .number()
      .positive("יש להזין סכום גדול מאפס")
      .max(500000, "הסכום גבוה מדי"),
    documentDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "יש לבחור תאריך מסמך"),
    paymentDate: z.string().regex(/^$|^\d{4}-\d{2}-\d{2}$/, "תאריך התשלום אינו תקין").optional().default(""),
    dueDate: z
      .string()
      .regex(/^$|^\d{4}-\d{2}-\d{2}$/, "תאריך היעד אינו תקין")
      .optional()
      .default(""),
    paymentType: z.coerce
      .number()
      .refine((value) => [1, 2, 3, 4, 9, 91].includes(value), {
        message: "יש לבחור אמצעי תשלום",
      }),
    description: z.string().trim().max(500).optional().default(""),
    notes: z.string().trim().max(1000).optional().default(""),
    paymentReference: optionalText,
    webVendor: optionalText,
    checkBankName: optionalText,
    checkNumber: optionalText,
    checkBranch: optionalText,
    checkAccount: optionalText,
    cardType: optionalText,
    cardLastFour: z
      .string()
      .trim()
      .regex(/^$|^[0-9]{4}$/, "יש להזין 4 ספרות אחרונות")
      .optional()
      .default(""),
    otherPaymentName: optionalText,
    sendEmail: z.boolean().default(true),
  })
  .superRefine((value, context) => {
    if (value.sendEmail && !value.customerEmail) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["customerEmail"],
        message: "יש להזין אימייל או לבטל שליחה אוטומטית",
      });
    }
    if (value.documentType === "proforma" && !value.description) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["description"],
        message: "בחשבונית עסקה יש לתאר את השירות",
      });
    }
    if (value.documentType !== "receipt") return;

    if (value.paymentType === 91 && !value.webVendor) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["webVendor"],
        message: "יש לבחור אפליקציית תשלום",
      });
    }
    if (value.paymentType === 2 && (!value.checkBankName || !value.checkNumber)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["checkNumber"],
        message: "בהמחאה נדרשים שם הבנק ומספר ההמחאה",
      });
    }
    if (value.paymentType === 3 && (!value.cardType || !value.cardLastFour)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["cardLastFour"],
        message: "בכרטיס אשראי נדרשים סוג הכרטיס ו-4 ספרות אחרונות",
      });
    }
    if (value.paymentType === 9 && !value.otherPaymentName) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["otherPaymentName"],
        message: "יש לכתוב את אמצעי התשלום",
      });
    }
  });

export type ReceiptInput = z.infer<typeof receiptInputSchema>;

export function documentTypeLabel(value: ReceiptInput["documentType"]) {
  return value === "receipt" ? "קבלה" : "חשבונית עסקה";
}

export function paymentMethodLabel(value: number) {
  return paymentMethods.find((method) => method.value === value)?.label ?? "אחר";
}
