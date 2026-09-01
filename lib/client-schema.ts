import { z } from "zod";

const optionalText = (maximum: number) =>
  z.string().trim().max(maximum, "הערך ארוך מדי").optional().default("");

export const clientInputSchema = z.object({
  name: z.string().trim().min(1, "חובה להזין שם לקוח").max(150),
  businessNumber: optionalText(20),
  identityNumber: optionalText(20),
  email: optionalText(254).refine(
    (value) => !value || z.string().email().safeParse(value).success,
    "כתובת האימייל אינה תקינה",
  ),
  phone: optionalText(30),
  address: optionalText(300),
  notes: optionalText(2000),
});

export type ClientInput = z.infer<typeof clientInputSchema>;
