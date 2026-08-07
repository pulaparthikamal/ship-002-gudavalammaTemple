import { createApi } from '@reduxjs/toolkit/query/react'
import { axiosBaseQuery } from './axiosBaseQuery'

export const apiSlice = createApi({
  reducerPath: 'api',
  baseQuery: axiosBaseQuery(),
  tagTypes: ['Auth', 'User', 'Role', 'Menu', 'InterestedTopic', 'PublishingFrequency', 'SocialMediaTopic', 'Tone', 'Platform', 'Settings', 'Patient', 'InsurancePolicy', 'EligibilityVerification', 'EraException', 'Appointment', 'Referral', 'PriorAuthorization', 'Provider', 'Facility', 'Payer', 'Encounter', 'ChargeMaster', 'Charge', 'CodingReview', 'Claim', 'ClaimAiReview', 'ClaimSubmission', 'ClaimTracking', 'PaymentPosting', 'EraEobProcessing', 'Adjustment', 'ArWorkItem', 'Denial', 'Appeal', 'CorrectedClaim', 'PatientBilling', 'PatientPayment', 'Refund', 'Collection', 'Document', 'Task', 'AuditLog', 'Report', 'FeeSchedule', 'ClaimPrediction', 'ProcedureCode', 'Rule', 'TimelyFilingAlert', 'DocumentationComplianceAlert', 'Server', 'ServerProject', 'ScanResult', 'Config', 'Metric', 'MonitoringMetric', 'MonitoringHealth', 'MonitoringSpike', 'Log', 'Alert', 'ServerReport', 'MediaCategory', 'SocialCategory', 'SocialAutomation', 'SocialAccount', 'SocialPost', 'Prediction', 'Remediation', 'Ai835Payload', 'DeploymentCredential', 'DeploymentTarget', 'DeploymentApplication', 'Deployment', 'DeploymentLog', 'MineCareAi', 'DeploymentPrediction', 'TableView'],

  invalidationBehavior: 'immediately',
  keepUnusedDataFor: 60,
  refetchOnFocus: false,
  refetchOnReconnect: true,
  endpoints: () => ({}),
})
