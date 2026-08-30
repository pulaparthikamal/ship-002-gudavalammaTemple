import { z } from 'zod';

export const createAccommodationRoomTypeSchema = z.object({
  body: z.object({
    slug: z.string().min(1),
    name: z.string().min(1),
    detail: z.string().optional(),
    pricePerNight: z.number().min(0),
    totalRooms: z.number().min(1).optional(),
    bookingOpensAt: z.string().optional(),
    bookingClosesAt: z.string().optional(),
  }),
});

export const updateAccommodationRoomTypeSchema = z.object({
  body: z.object({
    slug: z.string().min(1).optional(),
    name: z.string().min(1).optional(),
    detail: z.string().optional(),
    pricePerNight: z.number().min(0).optional(),
    totalRooms: z.number().min(1).optional(),
    bookingOpensAt: z.string().optional(),
    bookingClosesAt: z.string().optional(),
  }),
  params: z.object({
    id: z.string().min(24),
  }),
});

export const createAccommodationBookingSchema = z.object({
  body: z
    .object({
      roomTypeId: z.string().min(1),
      checkIn: z.coerce.date(),
      checkOut: z.coerce.date(),
      guests: z.number().int().min(1),
      guestName: z.string().min(1).optional(),
      guestEmail: z.string().email().optional(),
      guestPhone: z.string().min(6).optional(),
      preferredLocale: z.string().min(2).max(5).optional(),
    })
    .refine((data) => data.checkOut.getTime() > data.checkIn.getTime(), {
      message: 'checkOut must be after checkIn',
      path: ['checkOut'],
    }),
});
