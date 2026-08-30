import { z } from 'zod';

export const registerSchema = z.object({
  body: z.object({
    firstName: z.string().min(2, 'First name is too short'),
    lastName: z.string().min(2, 'Last name is too short'),
    email: z.string().email('Invalid email format'),
    password: z.string().min(8, 'Password must be at least 8 characters long'),
    phone: z.string().optional(),
  }),
});

export const loginSchema = z.object({
  body: z
    .object({
      email: z.string().email('Invalid email format').optional(),
      phone: z.string().trim().min(8, 'Invalid phone number').optional(),
      password: z.string().min(1, 'Password is required'),
    })
    .refine((data) => Boolean(data.email || data.phone), {
      message: 'Email or phone number is required',
      path: ['email'],
    }),
});

export const requestOtpSchema = z.object({
  body: z.object({
    phone: z.string().trim().min(8, 'Invalid phone number'),
  }),
});

export const verifyOtpSchema = z.object({
  body: z.object({
    phone: z.string().trim().min(8, 'Invalid phone number'),
    otp: z.string().trim().length(6, 'Enter the 6-digit code'),
  }),
});

export const refreshTokenSchema = z.object({
  body: z.object({
    refreshToken: z.string().min(1, 'Refresh token is required'),
  }),
});

export const changePasswordSchema = z.object({
  body: z.object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: z.string().min(8, 'New password must be at least 8 characters long'),
  }),
});
