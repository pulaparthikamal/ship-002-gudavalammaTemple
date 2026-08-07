import { useMemo } from 'react'
import { CrudPage } from '@/components/crud/CrudPage'
import type { CrudPageConfig } from '@/types/crud'
import {
  useGetSocialAccountsQuery,
  useDisconnectSocialAccountMutation,
  useUpdateSocialAccountMutation,
} from '@/services/api/endpoints/socialApi'
import { createSocialAccountFormConfig } from '@/models/socialModel'
import type { SocialAccount } from '@/types/social'
import { Button } from 'primereact/button'
import { useAppSelector } from '@/hooks/redux'
import { selectCurrentUser } from '@/features/auth/authSlice'
import { AUTH_BASE_URL } from '@/services/api/apiConfig'

export function SocialAccountsPage() {
  const user = useAppSelector(selectCurrentUser)

  const handleConnect = async (platform: string) => {
    if (!user?.id) {
      console.error('User ID not found, cannot connect account')
      return
    }

    // Real OAuth redirect
    window.location.href = `${AUTH_BASE_URL}/auth/${platform}?userId=${user.id}`
  }

  const config: CrudPageConfig<SocialAccount, any, any, any, any> = useMemo(() => ({
    title: 'Social Media Connections',
    resourceName: 'Account',
    createButtonLabel: 'Connect Account',
    hideCreateButton: true,
    emptyMessage: 'No social accounts connected.',
    pageSizeOptions: [10, 20, 50],
    defaultQuery: {
      page: 1,
      limit: 20,
      sortfield: 'platform',
      direction: 'asc',
      criteria: [],
    },
    permissions: {
      module: 'SocialMedia',
    },

    getRowId: (item) => item._id,
    getRowLabel: (item) => item.platformAccountName,
    table: {
      columns: [
        { key: 'platform', header: 'Platform', field: 'platform' },
        { key: 'name', header: 'Account Name', field: 'platformAccountName' },
        { key: 'status', header: 'Status', field: 'status' },
      ],
    },
    api: {
      useListQuery: useGetSocialAccountsQuery,
      useCreateMutation: () => [async () => ({}), { isLoading: false }] as any,
      useUpdateMutation: useUpdateSocialAccountMutation,
      useDeleteMutation: useDisconnectSocialAccountMutation,
    },
    form: createSocialAccountFormConfig(),
    mapItemToFormValues: (item) => item,
    mapFormValuesToCreatePayload: (values) => values,
    mapFormValuesToUpdatePayload: (values) => {
      const { _id, ...data } = values as any
      return data
    },


    slots: {
      toolbarRight: () => (
        <div className="flex gap-2">
          <Button label="Connect Facebook" icon="pi pi-facebook" onClick={() => handleConnect('facebook')} className="p-button-sm" />
          <Button label="Connect Instagram" icon="pi pi-instagram" onClick={() => handleConnect('instagram')} className="p-button-sm p-button-secondary" />
          <Button label="Connect LinkedIn" icon="pi pi-linkedin" onClick={() => handleConnect('linkedin')} className="p-button-sm p-button-info" />
          <Button label="Connect YouTube" icon="pi pi-youtube" onClick={() => handleConnect('youtube')} className="p-button-sm p-button-danger" />
        </div>
      )
    }
  }), [user?.id])

  return <CrudPage config={config} />
}
