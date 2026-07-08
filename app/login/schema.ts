import { z } from "zod";

// Shared password rule — kept to a sensible standard (min 8 chars). better-auth
// stores the hash in the `account` table (providerId "credential").
const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters");

export const signInSchema = z.object({
  email: z.email("Enter a valid email address"),
  password: passwordSchema,
});

export const signUpSchema = signInSchema
  .extend({
    name: z.string().trim().min(2, "Please enter your name"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export type SignInValues = z.infer<typeof signInSchema>;
export type SignUpValues = z.infer<typeof signUpSchema>;
