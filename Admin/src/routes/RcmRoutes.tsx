import { Route, Routes } from 'react-router-dom'
import { DashboardPage } from '@/pages/DashboardPage'
import { PatientsPage } from '@/pages/PatientsPage'
import { InsurancePoliciesPage } from '@/pages/InsurancePoliciesPage'
import { EligibilityVerificationsPage } from '@/pages/EligibilityVerificationsPage'
import { AppointmentsPage } from '@/pages/AppointmentsPage'
import { ReferralsPage } from '@/pages/ReferralsPage'
import { PriorAuthorizationsPage } from '@/pages/PriorAuthorizationsPage'
import { ProvidersPage } from '@/pages/ProvidersPage'
import { FacilitiesPage } from '@/pages/FacilitiesPage'
import { PayersPage } from '@/pages/PayersPage'
import { ClaimPredictionsPage } from '@/pages/ClaimPredictionsPage'
import { ProcedureCodesPage } from '@/pages/ProcedureCodesPage'
import { RulesPage } from '@/pages/RulesPage'
import { CoverageRulesPage } from '@/pages/CoverageRulesPage'
import { EncountersPage } from '@/pages/EncountersPage'
import { ChargeMastersPage } from '@/pages/ChargeMastersPage'
import { FeeSchedulesPage } from '@/pages/FeeSchedulesPage'
import { ChargesPage } from '@/pages/ChargesPage'
import { CodingReviewsPage } from '@/pages/CodingReviewsPage'
import { ClaimsPage } from '@/pages/ClaimsPage'
import { RejectedClaimDetailsPage, RejectedClaimsPage } from '@/pages/RejectedClaimsPage'
import { ClaimReadinessPage } from '@/pages/ClaimReadinessPage'
import { ClaimAiReviewsPage } from '@/pages/ClaimAiReviewsPage'
import { ClaimSubmissionsPage } from '@/pages/ClaimSubmissionsPage'
import { ClaimTrackingsPage } from '@/pages/ClaimTrackingsPage'
import { PaymentPostingsPage } from '@/pages/PaymentPostingsPage'
import { EraEobProcessingsPage } from '@/pages/EraEobProcessingsPage'
import { ERAExceptionsPage } from '@/pages/ERAExceptionsPage'
import { AdjustmentsPage } from '@/pages/AdjustmentsPage'
import { ArWorkItemsPage } from '@/pages/ArWorkItemsPage'
import { DenialsPage } from '@/pages/DenialsPage'
import { AppealsPage } from '@/pages/AppealsPage'
import { CorrectedClaimsPage } from '@/pages/CorrectedClaimsPage'
import { PatientBillingsPage } from '@/pages/PatientBillingsPage'
import { PatientPaymentsPage } from '@/pages/PatientPaymentsPage'
import { RefundsPage } from '@/pages/RefundsPage'
import { CollectionsPage } from '@/pages/CollectionsPage'
import { DocumentsPage } from '@/pages/DocumentsPage'
import { TasksPage } from '@/pages/TasksPage'
import { AuditLogsPage } from '@/pages/AuditLogsPage'
import { ReportsPage } from '@/pages/ReportsPage'
import { TimelyFilingAlertsPage } from '@/pages/TimelyFilingAlertsPage'
import { DocumentationComplianceAlertsPage } from '@/pages/DocumentationComplianceAlertsPage'

export function RcmRoutes() {
  return (
    <Routes>
      <Route path="dashboard" element={<DashboardPage />} />
      <Route path="patients" element={<PatientsPage />} />
      <Route path="insurance-policies" element={<InsurancePoliciesPage />} />
      <Route path="eligibility-verifications" element={<EligibilityVerificationsPage />} />
      <Route path="appointments" element={<AppointmentsPage />} />
      <Route path="referrals" element={<ReferralsPage />} />
      <Route path="prior-authorizations" element={<PriorAuthorizationsPage />} />
      <Route path="providers" element={<ProvidersPage />} />
      <Route path="facilities" element={<FacilitiesPage />} />
      <Route path="payers" element={<PayersPage />} />
      <Route path="claim-predictions" element={<ClaimPredictionsPage />} />
      <Route path="procedure-codes" element={<ProcedureCodesPage />} />
      <Route path="rules" element={<RulesPage />} />
      <Route path="coverage-rules" element={<CoverageRulesPage />} />
      <Route path="encounters" element={<EncountersPage />} />
      <Route path="charge-masters" element={<ChargeMastersPage />} />
      <Route path="fee-schedules" element={<FeeSchedulesPage />} />
      <Route path="charges" element={<ChargesPage />} />
      <Route path="coding-reviews" element={<CodingReviewsPage />} />
      <Route path="claims" element={<ClaimsPage />} />
      <Route path="claims/rejected" element={<RejectedClaimsPage />} />
      <Route path="claims/rejected/:id" element={<RejectedClaimDetailsPage />} />
      <Route path="claims/:id/readiness" element={<ClaimReadinessPage />} />
      <Route path="claim-ai-reviews" element={<ClaimAiReviewsPage />} />
      <Route path="claim-submissions" element={<ClaimSubmissionsPage />} />
      <Route path="claim-trackings" element={<ClaimTrackingsPage />} />
      <Route path="payment-postings" element={<PaymentPostingsPage />} />
      <Route path="era-eob-processings" element={<EraEobProcessingsPage />} />
      <Route path="era-exceptions" element={<ERAExceptionsPage />} />
      <Route path="adjustments" element={<AdjustmentsPage />} />
      <Route path="ar-work-items" element={<ArWorkItemsPage />} />
      <Route path="denials" element={<DenialsPage />} />
      <Route path="appeals" element={<AppealsPage />} />
      <Route path="corrected-claims" element={<CorrectedClaimsPage />} />
      <Route path="patient-billings" element={<PatientBillingsPage />} />
      <Route path="patient-payments" element={<PatientPaymentsPage />} />
      <Route path="refunds" element={<RefundsPage />} />
      <Route path="collections" element={<CollectionsPage />} />
      <Route path="documents" element={<DocumentsPage />} />
      <Route path="tasks" element={<TasksPage />} />
      <Route path="audit-logs" element={<AuditLogsPage />} />
      <Route path="timely-filing-alerts" element={<TimelyFilingAlertsPage />} />
      <Route path="documentation-compliance-alerts" element={<DocumentationComplianceAlertsPage />} />
      <Route path="reports" element={<ReportsPage />} />
    </Routes>
  )
}
