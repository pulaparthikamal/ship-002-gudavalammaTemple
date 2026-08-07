import { Brain, ClipboardEdit, Eye, RotateCcw, ShieldAlert, Trash2 } from 'lucide-react'
import { useMemo, useState, useCallback } from 'react'
import { Button } from 'primereact/button'
import { Message } from 'primereact/message'
import { useNavigate, useParams } from 'react-router-dom'
import { ConfirmationDialog } from '@/components/ui/ConfirmationDialog'
import { CrudPage } from '@/components/crud/CrudPage'
import { useAnalyzeClaimRejectionMutation, useDeleteClaimMutation, useGetClaimQuery, useGetClaimRejectionsQuery, useGetRejectedClaimsQuery, useSubmitClaimMutation } from '@/services/api/endpoints/claimsApi'
import { getApiErrorMessage } from '@/services/api/apiError'
import { formatDate, formatNumber } from '@/models/claimModel'
import type { Claim } from '@/types/claim'
import type { CrudListCriteria, CrudListQuery, CrudPageConfig, CrudTableColumn } from '@/types/crud'

const rejectedClaimsDefaultQuery: CrudListQuery = {
  page: 1,
  limit: 20,
  sortfield: 'updated',
  direction: 'desc',
  criteria: [],
}

const rejectedClaimsPageSizeOptions = [10, 20, 50]

function getClaimFieldValue(claim: Claim, key: string) {
  const record = claim as unknown as Record<string, unknown>

  if (key === 'updated') {
    return claim.updatedAt
  }

  return record[key]
}

function normalizeSearchValue(value: unknown) {
  if (value === null || value === undefined) {
    return ''
  }

  if (value instanceof Date) {
    return value.toISOString().toLowerCase()
  }

  return String(value).toLowerCase()
}

function toComparableDate(value: unknown) {
  if (!value) {
    return ''
  }

  const date = value instanceof Date ? value : new Date(String(value))

  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10)
}

function matchesCriterion(claim: Claim, criterion: CrudListCriteria) {
  const rawValue = getClaimFieldValue(claim, criterion.key)
  const itemValue = normalizeSearchValue(rawValue)
  const criterionValue = Array.isArray(criterion.value)
    ? criterion.value.map((value) => normalizeSearchValue(value))
    : normalizeSearchValue(criterion.value)

  switch (criterion.type) {
    case 'eq':
    case 'equals':
      return itemValue === criterionValue
    case 'ne':
    case 'notEquals':
      return itemValue !== criterionValue
    case 'sw':
      return itemValue.startsWith(String(criterionValue))
    case 'ew':
      return itemValue.endsWith(String(criterionValue))
    case 'in':
      return Array.isArray(criterionValue) && criterionValue.includes(itemValue)
    case 'nin':
      return Array.isArray(criterionValue) && !criterionValue.includes(itemValue)
    case 'dateis':
      return toComparableDate(rawValue) === toComparableDate(criterion.value)
    case 'dateIsNot':
      return toComparableDate(rawValue) !== toComparableDate(criterion.value)
    case 'datelt':
      return toComparableDate(rawValue) < toComparableDate(criterion.value)
    case 'dategt':
      return toComparableDate(rawValue) > toComparableDate(criterion.value)
    case 'notContains':
      return !itemValue.includes(String(criterionValue))
    case 'contains':
    case 'regexOr':
    default:
      return itemValue.includes(String(criterionValue))
  }
}

function filterRejectedClaims(claims: Claim[], query: CrudListQuery) {
  const searchValue = query.globalSearch?.value.trim().toLowerCase()

  return claims.filter((claim) => {
    const matchesSearch = searchValue
      ? [
        claim._id,
        claim.claimId,
        claim.claimDate,
        claim.rejectionReason,
        claim.claimStatus,
        claim.submissionStatus,
        claim.version,
        claim.resubmissionCount,
        claim.updatedAt,
      ].some((value) => normalizeSearchValue(value).includes(searchValue))
      : true

    return matchesSearch && query.criteria.every((criterion) => matchesCriterion(claim, criterion))
  })
}

function sortRejectedClaims(claims: Claim[], query: CrudListQuery) {
  if (!query.sortfield) {
    return claims
  }

  const direction = query.direction === 'asc' ? 1 : -1

  return [...claims].sort((firstClaim, secondClaim) => {
    const firstValue = getClaimFieldValue(firstClaim, query.sortfield as string)
    const secondValue = getClaimFieldValue(secondClaim, query.sortfield as string)

    if (firstValue === secondValue) {
      return 0
    }

    if (typeof firstValue === 'number' && typeof secondValue === 'number') {
      return (firstValue - secondValue) * direction
    }

    const firstDate = firstValue ? new Date(String(firstValue)).getTime() : Number.NaN
    const secondDate = secondValue ? new Date(String(secondValue)).getTime() : Number.NaN

    if (!Number.isNaN(firstDate) && !Number.isNaN(secondDate)) {
      return (firstDate - secondDate) * direction
    }

    return normalizeSearchValue(firstValue).localeCompare(normalizeSearchValue(secondValue)) * direction
  })
}

export function RejectedClaimsPage() {
  const navigate = useNavigate()
  const listQuery = useGetRejectedClaimsQuery()
  const { refetch } = listQuery
  const [analyzeClaimRejection, analyzeState] = useAnalyzeClaimRejectionMutation()
  const [submitClaim, submitState] = useSubmitClaimMutation()
  const [deleteClaim, deleteState] = useDeleteClaimMutation()
  const [message, setMessage] = useState<{ severity: 'success' | 'error' | 'warn'; text: string } | null>(null)
  const [claimPendingDelete, setClaimPendingDelete] = useState<Claim | null>(null)

  const runAnalysis = async (claim: Claim) => {
    setMessage(null)

    try {
      const result = await analyzeClaimRejection(claim._id).unwrap()
      setMessage({
        severity: 'success',
        text: `${result.rootCause}: ${result.suggestion} Confidence ${result.confidence}%.`,
      })
      void refetch()
    } catch (error) {
      setMessage({ severity: 'error', text: getApiErrorMessage(error) })
    }
  }

  const runResubmission = async (claim: Claim) => {
    setMessage(null)

    try {
      const result = await submitClaim(claim._id).unwrap()
      const rejected = result.claim.claimStatus === 'Rejected' || result.claim.submissionStatus === 'Rejected'
      setMessage({
        severity: rejected ? 'warn' : 'success',
        text: rejected
          ? `Claim rejected again. ${result.claim.rejectionReason ?? 'Review rejection details.'}`
          : `Claim resubmitted through claim submission as ${result.claim._id}.`,
      })
      void refetch()
    } catch (error) {
      setMessage({ severity: 'error', text: getApiErrorMessage(error) })
    }
  }

  const openDeleteDialog = (claim: Claim) => {
    if (!(claim.claimStatus === 'Rejected' || claim.submissionStatus === 'Rejected')) {
      setMessage({ severity: 'warn', text: 'Only rejected claims can be deleted from this queue.' })
      return
    }

    setClaimPendingDelete(claim)
  }

  const runDelete = async () => {
    if (!claimPendingDelete) {
      return
    }

    setMessage(null)

    try {
      await deleteClaim(claimPendingDelete._id).unwrap()
      setMessage({ severity: 'success', text: 'Rejected claim deleted.' })
      setClaimPendingDelete(null)
      void refetch()
    } catch (error) {
      setMessage({ severity: 'error', text: getApiErrorMessage(error) })
    }
  }

  const useRejectedClaimsListQuery = useCallback((query: CrudListQuery) => {
    const { data, error, isLoading, isFetching, refetch: queryRefetch } = listQuery

    const processed = useMemo(() => {
      if (!data?.data) return []
      const filtered = filterRejectedClaims(data.data, query)
      return sortRejectedClaims(filtered, query)
    }, [data, query])

    const paginated = useMemo(() => {
      const first = (query.page - 1) * query.limit
      return processed.slice(first, first + query.limit)
    }, [processed, query.limit, query.page])

    return {
      data: {
        data: paginated,
        total: processed.length,
        page: query.page,
        limit: query.limit,
      },
      error,
      isLoading,
      isFetching,
      refetch: queryRefetch,
    }
  }, [listQuery])

  const tableColumns = useMemo<Array<CrudTableColumn<Claim>>>(
    () => [
      {
        key: 'claim',
        header: 'Claim',
        sortField: 'claimDate',
        exportValue: (item) => [formatDate(item.claimDate), item._id].filter(Boolean).join(' '),
        render: (item) => (
          <div>
            <p className="font-semibold text-[var(--color-text-strong)]">{formatDate(item.claimDate)}</p>
            <p className="text-xs text-[var(--color-text-muted)]">{item._id}</p>
          </div>
        ),
        filter: {
          key: '_id',
          input: 'text',
          placeholder: 'Claim ID',
        },
      },
      {
        key: 'rejectionReason',
        header: 'Reason',
        field: 'rejectionReason',
        sortField: 'rejectionReason',
        exportValue: (item) => item.rejectionReason ?? 'Rejected by payer or clearinghouse.',
        render: (item) => (
          <div className="flex items-start gap-2 text-sm text-neutral-700">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-red-600" aria-hidden="true" />
            <span>{item.rejectionReason ?? 'Rejected by payer or clearinghouse.'}</span>
          </div>
        ),
        filter: {
          key: 'rejectionReason',
          input: 'text',
          placeholder: 'Reason',
        },
      },
      {
        key: 'claimStatus',
        header: 'Claim Status',
        field: 'claimStatus',
        sortField: 'claimStatus',
        exportValue: (item) => item.claimStatus ?? '-',
        render: (item) => item.claimStatus ?? '-',
        filter: {
          key: 'claimStatus',
          input: 'select',
          placeholder: 'Status',
          options: [{ label: 'Rejected', value: 'Rejected' }],
        },
      },
      {
        key: 'submissionStatus',
        header: 'Submission Status',
        field: 'submissionStatus',
        sortField: 'submissionStatus',
        exportValue: (item) => item.submissionStatus ?? '-',
        render: (item) => item.submissionStatus ?? '-',
        filter: {
          key: 'submissionStatus',
          input: 'select',
          placeholder: 'Submission',
          options: [
            { label: 'Rejected', value: 'Rejected' },
            { label: 'Failed', value: 'Failed' },
          ],
        },
      },
      {
        key: 'version',
        header: 'Version',
        sortField: 'version',
        exportValue: (item) => `Version ${formatNumber(item.version)} / Resubmissions ${formatNumber(item.resubmissionCount)}`,
        render: (item) => (
          <div className="text-sm text-neutral-700">
            <p>Version {formatNumber(item.version)}</p>
            <p>Resubmissions {formatNumber(item.resubmissionCount)}</p>
          </div>
        ),
      },
      {
        key: 'updatedAt',
        header: 'Updated',
        field: 'updatedAt',
        sortField: 'updated',
        exportValue: (item) => formatDate(item.updatedAt),
        render: (item) => formatDate(item.updatedAt),
        filter: {
          key: 'updatedAt',
          input: 'date',
          placeholder: 'Updated date',
        },
      },
    ],
    [],
  )

  const crudConfig = useMemo<CrudPageConfig<Claim, any, any, any>>(
    () => ({
      title: 'Rejected Claims',
      resourceName: 'Rejected Claim',
      showCreateButton: false,
      emptyMessage: 'No rejected claims need correction.',
      exportFileName: 'rejected-claims',
      pageSizeOptions: rejectedClaimsPageSizeOptions,
      defaultQuery: rejectedClaimsDefaultQuery,
      permissions: {
        module: 'claims',
      },
      getRowId: (item) => item._id,
      getRowLabel: (item) => item._id,
      table: {
        columns: tableColumns,
      },
      form: {
        schema: {} as any,
        defaultValues: {},
        fields: [],
      },
      api: {
        useListQuery: useRejectedClaimsListQuery,
        useDeleteMutation: useDeleteClaimMutation,
      },
      mapItemToFormValues: () => ({}) as any,
      mapFormValuesToCreatePayload: () => ({}) as any,
      mapFormValuesToUpdatePayload: () => ({}) as any,
      deleteDialogMessage: (item) => `This will permanently delete rejected claim ${item._id}.`,
      slots: {
        beforeContent: () => (
          <>
            {message ? <Message severity={message.severity} text={message.text} className="w-full justify-start mb-3" /> : null}
          </>
        ),
        toolbarRight: () => (
          <Button label="All Claims" className="p-button-outlined h-8 text-xs font-semibold px-3" onClick={() => navigate('/rcm/claims')} />
        ),
        rowActions: () => [
          {
            label: 'Details',
            icon: <Eye className="h-4 w-4" aria-hidden="true" />,
            onClick: (claim) => navigate(`/rcm/claims/rejected/${claim._id}`),
          },
          {
            label: 'AI Root Cause',
            icon: <Brain className="h-4 w-4" aria-hidden="true" />,
            disabled: analyzeState.isLoading,
            loading: analyzeState.isLoading,
            onClick: (claim) => {
              void runAnalysis(claim)
            },
          },
          {
            label: 'Correct Claim',
            icon: <ClipboardEdit className="h-4 w-4" aria-hidden="true" />,
            onClick: () => navigate('/rcm/claims'),
          },
          {
            label: 'Delete Claim',
            icon: <Trash2 className="h-4 w-4" aria-hidden="true" />,
            tone: 'danger',
            disabled: deleteState.isLoading,
            loading: deleteState.isLoading,
            onClick: openDeleteDialog,
          },
          {
            label: 'Resubmit',
            icon: <RotateCcw className="h-4 w-4" aria-hidden="true" />,
            disabled: submitState.isLoading,
            loading: submitState.isLoading,
            onClick: (claim) => {
              void runResubmission(claim)
            },
          },
        ],
      },
    }),
    [
      tableColumns,
      useRejectedClaimsListQuery,
      message,
      analyzeState.isLoading,
      deleteState.isLoading,
      submitState.isLoading,
      navigate,
    ],
  )

  return (
    <>
      <CrudPage config={crudConfig} />
      <ConfirmationDialog
        open={Boolean(claimPendingDelete)}
        title="Delete rejected claim?"
        message={`This will permanently delete rejected claim ${claimPendingDelete?._id ?? 'record'}.`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        tone="danger"
        confirmLoading={deleteState.isLoading}
        onClose={() => setClaimPendingDelete(null)}
        onConfirm={() => void runDelete()}
      />
    </>
  )
}

export function RejectedClaimDetailsPage() {
  const navigate = useNavigate()
  const { id = '' } = useParams()
  const { data: claim, isLoading } = useGetClaimQuery(id, { skip: !id })
  const { data: rejections = [], refetch } = useGetClaimRejectionsQuery(id, { skip: !id })
  const [analyzeClaimRejection, analyzeState] = useAnalyzeClaimRejectionMutation()
  const [submitClaim, submitState] = useSubmitClaimMutation()
  const [deleteClaim, deleteState] = useDeleteClaimMutation()
  const [message, setMessage] = useState<{ severity: 'success' | 'error' | 'warn'; text: string } | null>(null)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const rejected = claim?.claimStatus === 'Rejected' || claim?.submissionStatus === 'Rejected'

  const runAnalysis = async () => {
    if (!claim) return
    setMessage(null)

    try {
      const result = await analyzeClaimRejection(claim._id).unwrap()
      setMessage({
        severity: 'success',
        text: `${result.rootCause}: ${result.suggestion} Confidence ${result.confidence}%.`,
      })
      void refetch()
    } catch (error) {
      setMessage({ severity: 'error', text: getApiErrorMessage(error) })
    }
  }

  const runResubmission = async () => {
    if (!claim) return
    setMessage(null)

    try {
      const result = await submitClaim(claim._id).unwrap()
      const rejected = result.claim.claimStatus === 'Rejected' || result.claim.submissionStatus === 'Rejected'
      setMessage({
        severity: rejected ? 'warn' : 'success',
        text: rejected
          ? `Claim rejected again. ${result.claim.rejectionReason ?? 'Review rejection details.'}`
          : `Claim resubmitted through claim submission as ${result.claim._id}.`,
      })
    } catch (error) {
      setMessage({ severity: 'error', text: getApiErrorMessage(error) })
    }
  }

  const openDeleteDialog = () => {
    if (!claim || !rejected) {
      setMessage({ severity: 'warn', text: 'Only rejected claims can be deleted.' })
      return
    }

    setIsDeleteDialogOpen(true)
  }

  const runDelete = async () => {
    if (!claim) {
      return
    }

    try {
      await deleteClaim(claim._id).unwrap()
      navigate('/rcm/claims/rejected')
    } catch (error) {
      setMessage({ severity: 'error', text: getApiErrorMessage(error) })
    }
  }

  if (isLoading) {
    return <Message severity="info" text="Loading rejected claim..." className="w-full justify-start" />
  }

  if (!claim) {
    return <Message severity="warn" text="Rejected claim was not found." className="w-full justify-start" />
  }

  return (
    <main className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text-strong)]">Rejected Claim Details</h1>
          <p className="text-sm text-[var(--color-text-muted)]">{claim._id}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button label="Queue" className="p-button-outlined" onClick={() => navigate('/rcm/claims/rejected')} />
          <Button label="All Claims" className="p-button-outlined" onClick={() => navigate('/rcm/claims')} />
        </div>
      </div>

      {message ? <Message severity={message.severity} text={message.text} className="w-full justify-start" /> : null}

      <section className="rounded-lg border border-[var(--color-border)] bg-white p-4">
        <div className="grid gap-3 md:grid-cols-4">
          <Summary label="Claim status" value={claim.claimStatus ?? '-'} />
          <Summary label="Submission status" value={claim.submissionStatus ?? '-'} />
          <Summary label="Version" value={formatNumber(claim.version)} />
          <Summary label="Resubmissions" value={formatNumber(claim.resubmissionCount)} />
        </div>
        <p className="mt-4 text-sm text-neutral-700">{claim.rejectionReason ?? 'Rejected by payer or clearinghouse.'}</p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-[var(--color-text-strong)]">Rejection History</h2>
        {rejections.length ? rejections.map((rejection) => (
          <div key={rejection._id} className="rounded-lg border border-red-100 bg-red-50/40 p-4">
            <div className="flex flex-wrap justify-between gap-2">
              <p className="font-semibold text-red-900">{[rejection.rejectionCode, rejection.category].filter(Boolean).join(' / ') || 'Payer rejection'}</p>
              <span className="text-xs font-semibold uppercase tracking-normal text-red-700">{rejection.status ?? 'Open'}</span>
            </div>
            <p className="mt-2 text-sm text-neutral-700">{rejection.rejectionReason ?? '-'}</p>
            {rejection.aiSuggestion ? (
              <div className="mt-3 rounded-md bg-white p-3 text-sm">
                <p className="font-semibold text-neutral-900">{rejection.aiSuggestion.rootCause}</p>
                <p className="mt-1 text-neutral-700">{rejection.aiSuggestion.suggestion}</p>
                <p className="mt-1 text-xs font-semibold text-neutral-500">Confidence {rejection.aiSuggestion.confidence}%</p>
              </div>
            ) : null}
          </div>
        )) : <Message severity="warn" text="No rejection records found for this claim." className="w-full justify-start" />}
      </section>

      <div className="flex flex-wrap gap-2">
        <Button icon={<Brain className="h-4 w-4" aria-hidden="true" />} label="AI Suggestion" loading={analyzeState.isLoading} onClick={() => void runAnalysis()} />
        <Button icon={<ClipboardEdit className="h-4 w-4" aria-hidden="true" />} label="Correct in Claims" outlined onClick={() => navigate('/rcm/claims')} />
        <Button icon={<RotateCcw className="h-4 w-4" aria-hidden="true" />} label="Resubmit" loading={submitState.isLoading} onClick={() => void runResubmission()} />
        <Button icon={<Trash2 className="h-4 w-4" aria-hidden="true" />} label="Delete Rejected Claim" severity="danger" outlined disabled={!rejected} loading={deleteState.isLoading} onClick={openDeleteDialog} />
      </div>
      <ConfirmationDialog
        open={isDeleteDialogOpen}
        title="Delete rejected claim?"
        message={`This will permanently delete rejected claim ${claim._id}.`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        tone="danger"
        confirmLoading={deleteState.isLoading}
        onClose={() => setIsDeleteDialogOpen(false)}
        onConfirm={() => void runDelete()}
      />
    </main>
  )
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-normal text-[var(--color-text-muted)]">{label}</p>
      <p className="mt-1 font-semibold text-[var(--color-text-strong)]">{value}</p>
    </div>
  )
}
