export interface AppMenuItem {
  _id?: string
  iconName?: string
  route: string
  sequenceNo: number
  title: string
  name?: string
  permissionKey: string
  roleId?: string
  roleName?: string
  submenu?: AppMenuItem[]
  createdAt?: string
  updatedAt?: string
  __v?: number
}
