import { z } from "zod";

const websiteSchema = z.union([
  z.literal(""),
  z.string().trim().url("Please enter a valid website, starting with https://").max(300),
]);

export const submissionSchema = z.object({
  requestType: z.enum(["add", "edit"], { message: "Please choose a request type." }),
  companyName: z.string().trim().min(2, "Company name needs at least 2 characters.").max(120, "Company name must be 120 characters or fewer."),
  companySlug: z.string().trim().max(120).optional(),
  website: websiteSchema.optional(),
  submitterName: z.string().trim().min(2, "Your name needs at least 2 characters.").max(80, "Your name must be 80 characters or fewer."),
  submitterEmail: z.string().trim().email("Please enter a valid email address.").max(120, "Email must be 120 characters or fewer."),
  message: z.string().trim().min(20, "Please add at least 20 characters so we can review the request properly.").max(4000, "Message must be 4000 characters or fewer."),
  isPortalRequest: z.boolean(),
  subscribeToUpdates: z.boolean().optional(),
  acceptPolicy: z
    .boolean({ message: "You must accept the Privacy Policy and Terms." })
    .refine((v) => v === true, { message: "You must accept the Privacy Policy and Terms." }),
  captchaToken: z.string().optional(),
  captchaAnswer: z.number().optional(),
  websiteField: z.string().optional(),
  formStartedAt: z.number().optional(),
}).superRefine((value, context) => {
  if (value.requestType === "edit" && !value.companySlug?.trim()) {
    context.addIssue({
      code: "custom",
      path: ["companySlug"],
      message: "Select the existing company you want to update.",
    });
  }
});

export const feedbackSchema = z.object({
  name: z.string().trim().min(2, "Your name is required").max(80),
  email: z.string().trim().email("Enter a valid email").max(120),
  helped: z.enum(["yes", "somewhat", "no"], { message: "Please select an option" }),
  message: z.string().trim().max(2000).optional(),
  acceptPolicy: z
    .boolean({ message: "You must accept the Privacy Policy and Terms" })
    .refine((v) => v === true, { message: "You must accept the Privacy Policy and Terms" }),
  captchaToken: z.string().optional(),
  captchaAnswer: z.number().optional(),
  websiteField: z.string().optional(),
  formStartedAt: z.number().optional(),
});

export const contactSchema = z.object({
  name: z.string().trim().min(2, "Your name is required").max(80),
  email: z.string().trim().email("Enter a valid email").max(120),
  topic: z.enum(["general", "privacy", "partnership", "other"], {
    message: "Please select a topic",
  }),
  message: z.string().trim().min(20, "Please include a short message (min 20 characters)").max(4000),
  acceptPolicy: z
    .boolean({ message: "You must accept the Privacy Policy and Terms" })
    .refine((v) => v === true, { message: "You must accept the Privacy Policy and Terms" }),
  captchaToken: z.string().optional(),
  captchaAnswer: z.number().optional(),
  websiteField: z.string().optional(),
  formStartedAt: z.number().optional(),
});

export type SubmissionInput = z.infer<typeof submissionSchema>;
export type FeedbackInput = z.infer<typeof feedbackSchema>;
export type ContactInput = z.infer<typeof contactSchema>;
