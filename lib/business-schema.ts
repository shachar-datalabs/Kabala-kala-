import { z } from "zod";

const optionalText = (max: number) => z.string().trim().max(max).optional().default("");

export const businessInputSchema = z.object({
  businessName: optionalText(150),
  ownerName: optionalText(150),
  businessNumber: optionalText(20),
  email: optionalText(254).refine((value) => !value || z.string().email().safeParse(value).success, "כתובת האימייל אינה תקינה"),
  phone: optionalText(30),
  address: optionalText(300),
  taxYear: z.coerce.number().int().min(2000).max(2200).nullable().optional(),
  exemptDealerCeiling: z.coerce.number().positive().max(10000000).nullable().optional(),
});
