import { z } from "zod";

export const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD format.")
  .refine((value) => {
    const parsed = new Date(`${value}T00:00:00Z`);
    return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
  }, "Enter a valid date.");

const nullableDateSchema = z.union([isoDateSchema, z.literal(""), z.null()]).transform((value) => value || null);

const tripBaseSchema = z.object({
    name: z.string().trim().min(2).max(120),
    destination: z.string().trim().min(2).max(160),
    description: z.string().trim().max(1200).nullable().optional(),
    startDate: nullableDateSchema.optional(),
    endDate: nullableDateSchema.optional(),
    totalBudget: z.coerce.number().min(0).max(999999999),
    currencyCode: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/),
    travelStyle: z.string().trim().max(80).nullable().optional(),
    travelGroup: z.string().trim().max(80).nullable().optional(),
    coverStoragePath: z.string().trim().max(500).nullable().optional(),
    status: z.enum(["draft", "upcoming", "ongoing", "completed"]).optional(),
    flightNumber: z.string().trim().toUpperCase().max(12).nullable().optional(),
    flightDate: nullableDateSchema.optional(),
  });

function validTripDates(value: { startDate?: string | null; endDate?: string | null }) {
  return !value.startDate || !value.endDate || value.endDate >= value.startDate;
}

export const tripCreateSchema = tripBaseSchema.refine(validTripDates, {
  path: ["endDate"],
  message: "End date must be on or after the start date.",
});

export const tripUpdateSchema = tripBaseSchema.partial().refine(validTripDates, {
  path: ["endDate"],
  message: "End date must be on or after the start date.",
});

export const tripActivitySchema = z
  .object({
    dayNumber: z.coerce.number().int().min(1).max(365),
    activityDate: nullableDateSchema.optional(),
    title: z.string().trim().min(2).max(140),
    category: z.enum(["flight", "stay", "food", "sightseeing", "transport", "shopping", "meeting", "other"]),
    locationName: z.string().trim().min(2).max(240),
    latitude: z.coerce.number().min(-90).max(90).nullable().optional(),
    longitude: z.coerce.number().min(-180).max(180).nullable().optional(),
    startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use 24-hour HH:MM time."),
    endTime: z.union([z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/), z.literal(""), z.null()]).optional(),
    notes: z.string().trim().max(1200).nullable().optional(),
    estimatedCost: z.coerce.number().min(0).max(999999999),
  })
  .refine((value) => !value.endTime || value.endTime >= value.startTime, {
    path: ["endTime"],
    message: "End time must be after the start time.",
  });

export const budgetCategorySchema = z.object({
  name: z.string().trim().min(2).max(80),
  plannedAmount: z.coerce.number().min(0).max(999999999),
});

export const expenseSplitSchema = z.object({
  userId: z.string().uuid(),
  amount: z.coerce.number().min(0).max(999999999),
});

export const tripExpenseSchema = z.object({
  title: z.string().trim().min(2).max(140),
  description: z.string().trim().max(800).nullable().optional(),
  category: z.string().trim().min(2).max(80),
  amount: z.coerce.number().positive().max(999999999),
  expenseDate: isoDateSchema,
  paidBy: z.string().uuid(),
  splitMethod: z.enum(["equal", "exact", "payer_only"]),
  receiptStoragePath: z.string().trim().max(500).nullable().optional(),
  notes: z.string().trim().max(1200).nullable().optional(),
  splits: z.array(expenseSplitSchema).min(1).max(100),
});

export const inviteMemberSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(320),
});

export const invitationResponseSchema = z.object({
  action: z.enum(["accept", "reject"]),
});

export const flightLookupSchema = z.object({
  flightNumber: z.string().trim().toUpperCase().regex(/^[A-Z0-9]{2,10}$/),
  date: isoDateSchema.optional(),
});
