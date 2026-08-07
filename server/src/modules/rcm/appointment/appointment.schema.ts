import { z } from 'zod';
import {
  APPOINTMENT_STATUS_OPTIONS,
  APPOINTMENT_TYPE_OPTIONS,
  CANCELLATION_REASON_OPTIONS,
  CANONICAL_APPOINTMENT_TIME_REGEX,
  CHECK_IN_STATUS_OPTIONS,
  VISIT_TYPE_OPTIONS,
} from './appointment.constants';

const referralSchema = z.object({
  required: z.boolean().optional(),
  referralNumber: z.string().trim().optional(),
  validFrom: z.coerce.date().optional(),
  validTo: z.coerce.date().optional(),
});

const estimateSchema = z.object({
  estimatedPatientResponsibility: z.coerce.number().optional(),
  depositAmount: z.coerce.number().optional(),
  depositCollected: z.boolean().optional(),
});

const appointmentTimeSchema = z
  .string()
  .trim()
  .regex(
    /^(\d{1,2}):(\d{2})(?:\s*([APap][Mm]))?$/,
    'Appointment time must use HH:mm or h:mm AM/PM format.'
  );

const canonicalAppointmentTimeSchema = z
  .string()
  .trim()
  .regex(CANONICAL_APPOINTMENT_TIME_REGEX, 'Appointment time must use HH:mm.');

const appointmentTypeSchema = z.enum(APPOINTMENT_TYPE_OPTIONS);
const visitTypeSchema = z.enum(VISIT_TYPE_OPTIONS);
const appointmentStatusSchema = z.enum(APPOINTMENT_STATUS_OPTIONS);
const checkInStatusSchema = z.enum(CHECK_IN_STATUS_OPTIONS);
const cancellationReasonSchema = z.enum(CANCELLATION_REASON_OPTIONS);

export const createAppointmentSchema = z.object({
  body: z
    .object({
      patientId: z.string().trim().min(1),
      providerId: z.string().trim().min(1),
      facilityId: z.string().trim().min(1),
      appointmentDate: z.coerce.date(),
      appointmentTime: appointmentTimeSchema,
      appointmentType: appointmentTypeSchema,
      visitType: visitTypeSchema,
      reason: z.string().trim().min(1),
      appointmentStatus: appointmentStatusSchema.optional(),
      checkInStatus: checkInStatusSchema.optional(),
      checkInTime: z.coerce.date().optional(),
      checkOutTime: z.coerce.date().optional(),
      noShowFlag: z.boolean().optional(),
      cancellationReason: cancellationReasonSchema.optional(),
      notes: z.string().trim().optional(),
      referral: referralSchema.partial().optional(),
      estimate: estimateSchema.partial().optional(),
      active: z.boolean().optional(),
    })
    .superRefine((values, ctx) => {
      if (values.appointmentStatus === 'Cancelled' && !values.cancellationReason) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['cancellationReason'],
          message: 'Cancellation reason is required when the appointment is cancelled.',
        });
      }

      if (values.appointmentStatus === 'No Show' && !values.noShowFlag) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['noShowFlag'],
          message: 'No-show flag must be enabled when the appointment status is No Show.',
        });
      }

      if (values.estimate?.depositCollected && values.estimate.depositAmount === undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['estimate', 'depositAmount'],
          message: 'Deposit amount is required when a deposit has been collected.',
        });
      }
    }),
});

export const updateAppointmentSchema = z.object({
  body: z
    .object({
      patientId: z.string().trim().min(1).optional(),
      providerId: z.string().trim().min(1).optional(),
      facilityId: z.string().trim().min(1).optional(),
      appointmentDate: z.coerce.date().optional(),
      appointmentTime: appointmentTimeSchema.optional(),
      appointmentType: appointmentTypeSchema.optional(),
      visitType: visitTypeSchema.optional(),
      reason: z.string().trim().min(1).optional(),
      appointmentStatus: appointmentStatusSchema.optional(),
      checkInStatus: checkInStatusSchema.optional(),
      checkInTime: z.coerce.date().optional(),
      checkOutTime: z.coerce.date().optional(),
      noShowFlag: z.boolean().optional(),
      cancellationReason: cancellationReasonSchema.optional(),
      notes: z.string().trim().optional(),
      referral: referralSchema.partial().optional(),
      estimate: estimateSchema.partial().optional(),
      active: z.boolean().optional(),
    })
    .refine(
      (values) => values.appointmentTime === undefined || canonicalAppointmentTimeSchema.safeParse(values.appointmentTime).success || appointmentTimeSchema.safeParse(values.appointmentTime).success,
      {
        path: ['appointmentTime'],
        message: 'Appointment time must use HH:mm or h:mm AM/PM format.',
      }
    ),
  params: z.object({
    id: z.string().min(24),
  }),
});

export const bulkUpdateAppointmentSchema = z.object({
  body: z.object({
    ids: z.array(z.string().min(24)).min(1),
    data: z
      .object({
        patientId: z.string().trim().min(1).optional(),
        providerId: z.string().trim().min(1).optional(),
        facilityId: z.string().trim().min(1).optional(),
        appointmentDate: z.coerce.date().optional(),
        appointmentTime: appointmentTimeSchema.optional(),
        appointmentType: appointmentTypeSchema.optional(),
        visitType: visitTypeSchema.optional(),
        reason: z.string().trim().min(1).optional(),
        appointmentStatus: appointmentStatusSchema.optional(),
        checkInStatus: checkInStatusSchema.optional(),
        checkInTime: z.coerce.date().optional(),
        checkOutTime: z.coerce.date().optional(),
        noShowFlag: z.boolean().optional(),
        cancellationReason: cancellationReasonSchema.optional(),
        notes: z.string().trim().optional(),
        referral: referralSchema.partial().optional(),
        estimate: estimateSchema.partial().optional(),
        active: z.boolean().optional(),
      })
      .refine((data) => Object.keys(data).length > 0, {
        message: 'Bulk update data cannot be empty.',
      }),
  }),
});

export const checkInAppointmentSchema = z.object({
  params: z.object({
    id: z.string().min(24),
  }),
});
