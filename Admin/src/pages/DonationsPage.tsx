import { useMemo, useState } from 'react'
import { Button } from 'primereact/button'
import { Column } from 'primereact/column'
import { DataTable } from 'primereact/datatable'
import { Dropdown } from 'primereact/dropdown'
import { CheckCircle2 } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { ConfirmationDialog } from '@/components/ui/ConfirmationDialog'
import { YearFilter, yearToDateRange } from '@/components/ui/YearFilter'
import { useToast } from '@/hooks/useToast'
import { getApiErrorMessage } from '@/services/api/apiError'
import { useGetDonationFundsQuery } from '@/services/api/endpoints/donationApi'
import { useGetDonationLedgerQuery, useMarkDonationPaidMutation } from '@/services/api/endpoints/donationApi'
import type { DonationLedgerEntry } from '@/services/api/endpoints/donationApi'
import { useStaffTranslation } from '@/i18n/useTranslation'
import { formatDateTime } from '@/utils/date'

const ALL = '__all__'

type Option = { label: string; value: string }

function getOptionLabel(value: string, options: Option[]) {
  return options.find((option) => option.value === value)?.label ?? value
}

function getStatusOptions(t: (key: string) => string): Option[] {
  return [
    { label: t('All statuses'), value: ALL },
    { label: t('Confirmed'), value: 'confirmed' },
    { label: t('Cancelled'), value: 'cancelled' },
  ]
}

function getPaymentStatusOptions(t: (key: string) => string): Option[] {
  return [
    { label: t('All payment statuses'), value: ALL },
    { label: t('Pending'), value: 'pending' },
    { label: t('Paid'), value: 'paid' },
    { label: t('Waived'), value: 'waived' },
  ]
}

function donorLabel(row: DonationLedgerEntry, t: (key: string, params?: Record<string, string | number>) => string) {
  if (row.devotee) return `${row.devotee.firstName} ${row.devotee.lastName}`.trim()
  if (row.donorId) return row.donorId.name
  if (row.guestName) return t('{{name}} (guest)', { name: row.guestName })
  return t('Guest')
}

function donorContact(row: DonationLedgerEntry) {
  return row.devotee?.email ?? row.donorId?.email ?? row.guestEmail ?? row.donorId?.phone ?? row.guestPhone ?? '-'
}

export function DonationsPage() {
  const { t } = useStaffTranslation()
  const [page, setPage] = useState(1)
  const [rowsPerPage, setRowsPerPage] = useState(20)
  const [sortField, setSortField] = useState('created')
  const [direction, setDirection] = useState<'asc' | 'desc'>('desc')
  const [year, setYear] = useState<number | null>(null)
  const [fundId, setFundId] = useState<string>(ALL)
  const [status, setStatus] = useState<string>(ALL)
  const [paymentStatus, setPaymentStatus] = useState<string>(ALL)
  const [markPaidTarget, setMarkPaidTarget] = useState<DonationLedgerEntry | null>(null)
  const { showToast } = useToast()

  const statusOptions = getStatusOptions(t)
  const paymentStatusOptions = getPaymentStatusOptions(t)

  const fundsQuery = useGetDonationFundsQuery()
  const fundOptions = useMemo(
    () => [
      { label: t('All funds'), value: ALL },
      ...(fundsQuery.data ?? []).map((fund) => ({ label: fund.name, value: fund._id })),
    ],
    [fundsQuery.data, t],
  )

  const { from, to } = yearToDateRange(year)

  const ledgerQuery = useGetDonationLedgerQuery({
    page,
    limit: rowsPerPage,
    sortfield: sortField,
    direction,
    criteria: [],
    fundId: fundId === ALL ? undefined : fundId,
    status: status === ALL ? undefined : status,
    paymentStatus: paymentStatus === ALL ? undefined : paymentStatus,
    from,
    to,
  })
  const [markDonationPaid, { isLoading: isMarkingPaid }] = useMarkDonationPaidMutation()

  const rows = ledgerQuery.data?.data ?? []
  const totalRecords = ledgerQuery.data?.total ?? 0

  const handleMarkPaid = async () => {
    if (!markPaidTarget) return
    try {
      await markDonationPaid({ id: markPaidTarget._id }).unwrap()
      showToast({ severity: 'success', summary: t('Marked as paid') })
    } catch (error) {
      showToast({ severity: 'error', summary: t('Could not mark as paid'), detail: getApiErrorMessage(error) })
    } finally {
      setMarkPaidTarget(null)
    }
  }

  const referenceSuffix = markPaidTarget?.paymentReference
    ? ` ${t('(UPI reference: {{reference}})', { reference: markPaidTarget.paymentReference })}`
    : ''

  return (
    <div className="temple-scope w-full space-y-4">
      <PageHeader
        eyebrow={t('Finance')}
        title={t('Donations')}
        description={t('All donation transactions across devotees, walk-in donors, and guests — filterable by year, fund, and status.')}
      />

      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">{t('Year')}</label>
          <YearFilter value={year} onChange={(value) => { setYear(value); setPage(1) }} />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">{t('Fund')}</label>
          <Dropdown
            value={fundId}
            options={fundOptions}
            onChange={(e) => { setFundId(e.value); setPage(1) }}
            className="w-56"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">{t('Status')}</label>
          <Dropdown
            value={status}
            options={statusOptions}
            onChange={(e) => { setStatus(e.value); setPage(1) }}
            className="w-48"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">{t('Payment')}</label>
          <Dropdown
            value={paymentStatus}
            options={paymentStatusOptions}
            onChange={(e) => { setPaymentStatus(e.value); setPage(1) }}
            className="w-56"
          />
        </div>
      </div>

      <DataTable
        value={rows}
        loading={ledgerQuery.isLoading || ledgerQuery.isFetching}
        emptyMessage={t('No donations found for the selected filters.')}
        lazy
        paginator
        first={(page - 1) * rowsPerPage}
        rows={rowsPerPage}
        totalRecords={totalRecords}
        onPage={(e) => { setPage(Math.floor((e.first ?? 0) / (e.rows ?? rowsPerPage)) + 1); setRowsPerPage(e.rows ?? rowsPerPage) }}
        sortField={sortField}
        sortOrder={direction === 'asc' ? 1 : -1}
        onSort={(e) => { setSortField(e.sortField); setDirection(e.sortOrder === 1 ? 'asc' : 'desc') }}
        className="text-sm"
      >
        <Column field="created" header={t('Date')} sortable body={(row: DonationLedgerEntry) => formatDateTime(row.created)} />
        <Column header={t('Fund')} body={(row: DonationLedgerEntry) => row.fundId?.name ?? '-'} />
        <Column header={t('Donor')} body={(row: DonationLedgerEntry) => donorLabel(row, t)} />
        <Column header={t('Contact')} body={(row: DonationLedgerEntry) => donorContact(row)} />
        <Column field="amount" header={t('Amount')} sortable body={(row: DonationLedgerEntry) => `₹${row.amount.toLocaleString('en-IN')}`} />
        <Column field="receiptNo" header={t('Receipt No')} />
        <Column field="paymentReference" header={t('UPI Reference')} body={(row: DonationLedgerEntry) => row.paymentReference || '-'} />
        <Column field="paymentStatus" header={t('Payment')} sortable body={(row: DonationLedgerEntry) => getOptionLabel(row.paymentStatus, paymentStatusOptions)} />
        <Column field="status" header={t('Status')} sortable body={(row: DonationLedgerEntry) => getOptionLabel(row.status, statusOptions)} />
        <Column
          header={t('Actions')}
          body={(row: DonationLedgerEntry) =>
            row.paymentStatus !== 'paid' ? (
              <Button
                type="button"
                text
                size="small"
                icon={<CheckCircle2 className="h-4 w-4" aria-hidden="true" />}
                label={t('Mark as paid')}
                onClick={() => setMarkPaidTarget(row)}
              />
            ) : null
          }
        />
      </DataTable>

      <ConfirmationDialog
        open={markPaidTarget !== null}
        title={t('Mark this donation as paid?')}
        message={
          markPaidTarget
            ? t('This confirms {{amount}} for receipt {{receiptNo}} has been received{{referenceSuffix}}.', {
                amount: `₹${markPaidTarget.amount.toLocaleString('en-IN')}`,
                receiptNo: markPaidTarget.receiptNo,
                referenceSuffix,
              })
            : ''
        }
        confirmLabel={t('Mark as paid')}
        confirmLoading={isMarkingPaid}
        onConfirm={() => void handleMarkPaid()}
        onClose={() => setMarkPaidTarget(null)}
      />
    </div>
  )
}
