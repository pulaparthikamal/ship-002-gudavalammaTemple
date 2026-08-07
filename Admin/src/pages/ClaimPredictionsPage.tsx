import { useMemo, useState } from 'react'
import { CrudPage } from '@/components/crud/CrudPage'
import type { CrudPageConfig } from '@/types/crud'
import {
  createClaimPredictionTableColumns,
  renderClaimPredictionDetails,
} from '@/models/claimPredictionModel'
import {
  useGetClaimPredictionsQuery,
  usePredictClaimAmountMutation,
} from '@/services/api/endpoints/claimPredictionsApi'
import type { RcmReferenceOptions } from '@/models/rcmReferenceOptions'
import type { ClaimPrediction } from '@/types/claimPrediction'
import { Button } from 'primereact/button'
import { Wand2 } from 'lucide-react'
import { Dialog } from 'primereact/dialog'
import { InputText } from 'primereact/inputtext'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

const readonlyPredictionFormSchema = z.object({})
type ReadonlyPredictionFormValues = z.infer<typeof readonlyPredictionFormSchema>

export function ClaimPredictionsPage() {
  const referenceOptions: RcmReferenceOptions = useMemo(() => ({}), [])
  const [isPredictOpen, setIsPredictOpen] = useState(false)
  const [predictClaimAmount, { isLoading: isPredicting }] = usePredictClaimAmountMutation()

  const { register, handleSubmit, reset } = useForm({
    defaultValues: {
      cptCode: '',
      payerId: '',
    },
  })

  async function onPredict(values: { cptCode: string; payerId: string }) {
    try {
      await predictClaimAmount(values).unwrap()
      setIsPredictOpen(false)
      reset()
      // Note: Toast removed due to missing sonner dependency
    } catch (error) {
      console.error('Failed to generate prediction', error)
    }
  }

  const crudConfig: CrudPageConfig<ClaimPrediction, ReadonlyPredictionFormValues, never, never> = useMemo(
    () => ({
      title: 'Claim Predictions',
      resourceName: 'Claim Prediction',
      showCreateButton: false,
      viewDialogTitle: 'Prediction Details',
      emptyMessage: 'No predictions found.',
      exportFileName: 'claim_predictions',
      pageSizeOptions: [10, 20, 50],
      defaultQuery: {
        page: 1,
        limit: 20,
        sortfield: 'created',
        direction: 'desc',
        criteria: [],
      },
      permissions: {
        module: 'claim-predictions',
      },
      getRowId: (item) => item._id,
      getRowLabel: (item) => `Prediction for ${item.cptCode}`,
      table: {
        columns: createClaimPredictionTableColumns(referenceOptions),
      },
      form: {
        schema: readonlyPredictionFormSchema,
        defaultValues: {},
        fields: [],
      },
      api: {
        useListQuery: useGetClaimPredictionsQuery,
      },
      mapItemToFormValues: () => ({}),
      mapFormValuesToCreatePayload: () => {
        throw new Error('Claim predictions are generated from the prediction dialog.')
      },
      mapFormValuesToUpdatePayload: () => {
        throw new Error('Claim predictions are read-only.')
      },
      slots: {
        viewContent: (item) => renderClaimPredictionDetails(item, referenceOptions),
      },
    }),
    [referenceOptions],
  )

  return (
    <div className="relative">
      <div className="absolute top-0 right-0 z-10 pt-4 pr-6">
        <Button 
          label="New Prediction" 
          icon={<Wand2 className="h-4 w-4 mr-2" />} 
          className="shadow-lg"
          onClick={() => setIsPredictOpen(true)}
        />

        <Dialog 
          visible={isPredictOpen} 
          onHide={() => setIsPredictOpen(false)}
          header="Generate New Prediction"
          className="w-[min(94vw,30rem)]"
        >
          <form onSubmit={handleSubmit(onPredict)} className="space-y-4 pt-4">
            <div className="flex flex-col gap-2">
              <label htmlFor="cptCode" className="text-sm font-medium">CPT Code</label>
              <InputText 
                id="cptCode"
                placeholder="e.g. 99213" 
                {...register('cptCode', { required: true })} 
                className="w-full"
              />
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="payerId" className="text-sm font-medium">Payer ID</label>
              <InputText 
                id="payerId"
                placeholder="e.g. AETNA" 
                {...register('payerId', { required: true })} 
                className="w-full"
              />
            </div>
            <Button 
              type="submit" 
              label={isPredicting ? 'Generating...' : 'Predict Amount'} 
              className="w-full mt-2" 
              disabled={isPredicting} 
            />
          </form>
        </Dialog>
      </div>
      <CrudPage config={crudConfig} />
    </div>
  )
}

export default ClaimPredictionsPage
