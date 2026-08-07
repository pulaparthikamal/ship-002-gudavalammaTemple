export const APPOINTMENT_TYPE_OPTIONS = [
  'New Patient',
  'Follow-Up',
  'Consultation',
  'Procedure',
  'Annual Wellness',
  'Telehealth',
] as const;

export const VISIT_TYPE_OPTIONS = [
  'Office Visit',
  'Preventive Visit',
  'Specialist Visit',
  'Telehealth Visit',
  'Urgent Visit',
  'Procedure Visit',
] as const;

export const APPOINTMENT_STATUS_OPTIONS = [
  'Scheduled',
  'Confirmed',
  'Checked In',
  'In Progress',
  'Completed',
  'Cancelled',
  'No Show',
] as const;

export const CHECK_IN_STATUS_OPTIONS = [
  'Pending',
  'Pre-Registered',
  'Arrived',
  'Checked In',
  'Checked Out',
] as const;

export const CANCELLATION_REASON_OPTIONS = [
  'Patient Request',
  'Provider Unavailable',
  'Authorization Pending',
  'Insurance Eligibility Issue',
  'Scheduling Conflict',
  'Weather',
  'Other',
] as const;

export const CANONICAL_APPOINTMENT_TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;
