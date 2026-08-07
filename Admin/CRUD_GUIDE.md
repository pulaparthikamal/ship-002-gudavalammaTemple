# How To Add A New CRUD

This guide shows the simplest way to add a new CRUD screen in this template.

If you are new to the project, use `Users` as the main example:

- Page: `src/pages/UsersPage.tsx`
- Model/config: `src/models/userModel.tsx`
- API: `src/services/api/endpoints/usersApi.ts`
- Types: `src/types/user.ts`

If your CRUD needs permission management like Roles, also look at:

- Page: `src/pages/RolesPage.tsx`
- Model/config: `src/models/roleModel.tsx`
- API: `src/services/api/endpoints/rolesApi.ts`

## Quick Idea

Every CRUD screen in this template is made from 4 main parts:

1. A `type` file that describes the resource.
2. A `model` file that defines form fields, table columns, defaults, and mappers.
3. An `api` file that connects to the backend.
4. A `page` file that plugs everything into `CrudPage`.

Then you add:

5. A route in `src/routes/AppRouter.tsx`.
6. A backend menu item from `/menus` if you want it to appear in the sidebar.

## File Naming Pattern

For a resource called `Product`, use:

- `src/types/product.ts`
- `src/models/productModel.tsx`
- `src/services/api/endpoints/productsApi.ts`
- `src/pages/ProductsPage.tsx`

Use singular names for types and model values like `Product`.
Use plural names for list pages and API files like `ProductsPage` and `productsApi`.

## Step 1: Create The Type File

Create `src/types/product.ts`.

Start with 3 things:

- The item returned by the API
- The form values used by `react-hook-form`
- The create/update payloads sent to the backend

Example:

```ts
export interface Product {
  _id: string
  name: string
  code: string
  description?: string
  price: number
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface ProductFormValues {
  _id?: string
  name: string
  code: string
  description: string
  price: number
  isActive: boolean
}

export interface ProductCreatePayload {
  name: string
  code: string
  description?: string
  price: number
  isActive: boolean
}

export type ProductUpdatePayload = ProductCreatePayload
```

## Step 2: Create The Model File

Create `src/models/productModel.tsx`.

This file is the heart of the CRUD screen.

It usually contains:

- API metadata
- form schema
- default values
- form field config
- table column config
- form-to-payload mapper
- item-to-form mapper
- optional custom view/grid renderers

### 2.1 Add API details

This tells the API layer how your backend responds.

```ts
export const productApiDetails = {
  endpoint: '/products',
  filterQueryParam: 'filter',
  responseDataPath: 'data',
  responseTotalPath: 'meta.total',
} as const
```

### 2.2 Add form schema and defaults

```ts
import { z } from 'zod'
import type { CrudFormConfig, CrudTableColumn } from '@/types/crud'
import type {
  Product,
  ProductCreatePayload,
  ProductFormValues,
  ProductUpdatePayload,
} from '@/types/product'

export const productFormSchema = z.object({
  _id: z.string().optional(),
  name: z.string().trim().min(2, 'Name must be at least 2 characters'),
  code: z.string().trim().min(2, 'Code must be at least 2 characters'),
  description: z.string().trim(),
  price: z.number().min(0, 'Price must be 0 or more'),
  isActive: z.boolean(),
}) as z.ZodType<ProductFormValues>

export const productDefaultValues: ProductFormValues = {
  _id: '',
  name: '',
  code: '',
  description: '',
  price: 0,
  isActive: true,
}
```

### 2.3 Add form field config

The field `type` must match one of the supported types from `src/types/crud.ts`.

Supported field types:

```text
text, email, password, number, textarea, select, autocomplete, permissions, date, upload, checkbox, switch, hidden
```

Example:

```ts
export const productFormConfig: CrudFormConfig<ProductFormValues> = {
  schema: productFormSchema,
  defaultValues: productDefaultValues,
  columns: 2,
  fields: [
    {
      name: '_id',
      label: 'ID',
      type: 'hidden',
    },
    {
      name: 'name',
      label: 'Product name',
      type: 'text',
      placeholder: 'Enter product name',
    },
    {
      name: 'code',
      label: 'Code',
      type: 'text',
      placeholder: 'Enter code',
    },
    {
      name: 'description',
      label: 'Description',
      type: 'textarea',
      placeholder: 'Enter description',
      fullWidth: true,
      rows: 4,
    },
    {
      name: 'price',
      label: 'Price',
      type: 'number',
      min: 0,
      step: 0.01,
    },
    {
      name: 'isActive',
      label: 'Active',
      type: 'switch',
    },
  ],
}
```

### 2.4 Add table columns

Example:

```ts
export const productTableColumns: Array<CrudTableColumn<Product>> = [
  {
    key: 'name',
    header: 'Name',
    field: 'name',
    sortField: 'name',
    filter: {
      key: 'name',
      type: 'regexOr',
      placeholder: 'Search name',
      matchModes: ['contains', 'startsWith', 'endsWith', 'equals', 'notEquals'],
    },
  },
  {
    key: 'code',
    header: 'Code',
    field: 'code',
    filter: {
      key: 'code',
      type: 'regexOr',
      placeholder: 'Search code',
      matchModes: ['contains', 'startsWith', 'endsWith', 'equals', 'notEquals'],
    },
  },
  {
    key: 'price',
    header: 'Price',
    field: 'price',
    sortField: 'price',
  },
  {
    key: 'updatedAt',
    header: 'Updated',
    field: 'updatedAt',
    sortField: 'updatedAt',
  },
]
```

### 2.5 Add mapper functions

These functions are required by `CrudPage`.

```ts
function optionalText(value: string) {
  const trimmedValue = value.trim()
  return trimmedValue ? trimmedValue : undefined
}

export function mapProductToFormValues(product: Product): ProductFormValues {
  return {
    _id: product._id,
    name: product.name,
    code: product.code,
    description: product.description ?? '',
    price: product.price,
    isActive: product.isActive,
  }
}

export function mapProductFormToCreatePayload(values: ProductFormValues): ProductCreatePayload {
  return {
    name: values.name.trim(),
    code: values.code.trim(),
    description: optionalText(values.description),
    price: values.price,
    isActive: values.isActive,
  }
}

export function mapProductFormToUpdatePayload(values: ProductFormValues): ProductUpdatePayload {
  return mapProductFormToCreatePayload(values)
}
```

### 2.6 Optional: custom details/grid UI

If the default `CrudPage` view is enough, you can skip this.

If you want richer layout in the details dialog or grid cards, add:

```ts
export function renderProductDetails(product: Product) {
  return <div>{product.name}</div>
}

export function renderProductGridItem(product: Product) {
  return <div>{product.name}</div>
}
```

## Step 3: Create The API File

Create `src/services/api/endpoints/productsApi.ts`.

Use `usersApi.ts` as the easiest starting point.

Example:

```ts
import { productApiDetails } from '@/models/productModel'
import { apiSlice } from '@/services/api/apiSlice'
import { normalizeCrudListResponse } from '@/services/api/listResponse'
import { readResponsePath } from '@/services/api/responseTransform'
import type { EntityId } from '@/types/common'
import type { CrudListQuery, CrudListResponse } from '@/types/crud'
import type { Product, ProductCreatePayload, ProductUpdatePayload } from '@/types/product'

const productListDataPaths = [
  productApiDetails.responseDataPath,
  'data.data',
  'data.docs',
  'items',
]

const productListTotalPaths = [
  productApiDetails.responseTotalPath,
  'meta.totalRecords',
  'data.total',
  'data.totalRecords',
  'total',
  'totalRecords',
]

function normalizeProductListResponse(
  response: unknown,
  query: CrudListQuery,
): CrudListResponse<Product> {
  return normalizeCrudListResponse<Product>({
    response,
    query,
    dataPaths: productListDataPaths,
    totalPaths: productListTotalPaths,
  })
}

export const productsApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getProducts: builder.query<CrudListResponse<Product>, CrudListQuery>({
      query: (query) => ({
        url: productApiDetails.endpoint,
        method: 'GET',
        params: {
          [productApiDetails.filterQueryParam]: JSON.stringify(query),
        },
      }),
      transformResponse: (response, _meta, query) => normalizeProductListResponse(response, query),
      providesTags: (result) =>
        result
          ? [
              ...result.data.map((product) => ({ type: 'Product' as const, id: product._id })),
              { type: 'Product' as const, id: 'LIST' },
            ]
          : [{ type: 'Product' as const, id: 'LIST' }],
    }),
    getProduct: builder.query<Product, EntityId>({
      query: (id) => ({
        url: `${productApiDetails.endpoint}/${id}`,
        method: 'GET',
      }),
      transformResponse: (response) =>
        readResponsePath<Product>(response, productApiDetails.responseDataPath),
      providesTags: (_result, _error, id) => [{ type: 'Product', id }],
    }),
    createProduct: builder.mutation<Product, ProductCreatePayload>({
      query: (payload) => ({
        url: productApiDetails.endpoint,
        method: 'POST',
        data: payload,
      }),
      transformResponse: (response) =>
        readResponsePath<Product>(response, productApiDetails.responseDataPath),
      invalidatesTags: [{ type: 'Product', id: 'LIST' }],
    }),
    updateProduct: builder.mutation<Product, { id: EntityId; data: ProductUpdatePayload }>({
      query: ({ id, data }) => ({
        url: `${productApiDetails.endpoint}/${id}`,
        method: 'PUT',
        data,
      }),
      transformResponse: (response) =>
        readResponsePath<Product>(response, productApiDetails.responseDataPath),
      invalidatesTags: (_result, _error, { id }) => [
        { type: 'Product', id },
        { type: 'Product', id: 'LIST' },
      ],
    }),
    deleteProduct: builder.mutation<EntityId, EntityId>({
      query: (id) => ({
        url: `${productApiDetails.endpoint}/${id}`,
        method: 'DELETE',
      }),
      transformResponse: (_response, _meta, id) => id,
      invalidatesTags: (_result, _error, id) => [
        { type: 'Product', id },
        { type: 'Product', id: 'LIST' },
      ],
    }),
  }),
})

export const {
  useGetProductsQuery,
  useCreateProductMutation,
  useUpdateProductMutation,
  useDeleteProductMutation,
  useGetProductQuery,
} = productsApi
```

### Optional bulk delete

If your backend supports bulk delete:

```ts
bulkDeleteProducts: builder.mutation<EntityId[], { selectedIds: EntityId[] }>({
  query: (payload) => ({
    url: `${productApiDetails.endpoint}/multiDelete`,
    method: 'POST',
    data: payload,
  }),
  transformResponse: (_response, _meta, payload) => payload.selectedIds,
  invalidatesTags: (_result, _error, payload) => [
    ...payload.selectedIds.map((id) => ({ type: 'Product' as const, id })),
    { type: 'Product' as const, id: 'LIST' },
  ],
}),
```

Then export `useBulkDeleteProductsMutation`.

## Step 4: Create The Page File

Create `src/pages/ProductsPage.tsx`.

This file connects everything to `CrudPage`.

Example:

```ts
import { CrudPage } from '@/components/crud/CrudPage'
import {
  mapProductFormToCreatePayload,
  mapProductFormToUpdatePayload,
  mapProductToFormValues,
  productFormConfig,
  productTableColumns,
  renderProductDetails,
  renderProductGridItem,
} from '@/models/productModel'
import {
  useCreateProductMutation,
  useDeleteProductMutation,
  useGetProductsQuery,
  useUpdateProductMutation,
} from '@/services/api/endpoints/productsApi'
import type { CrudPageConfig } from '@/types/crud'
import type { Product, ProductCreatePayload, ProductFormValues, ProductUpdatePayload } from '@/types/product'

const productsCrudConfig: CrudPageConfig<
  Product,
  ProductFormValues,
  ProductCreatePayload,
  ProductUpdatePayload
> = {
  title: 'Products',
  resourceName: 'Product',
  createButtonLabel: 'Add Product',
  createDialogTitle: 'Add Product',
  editDialogTitle: 'Edit product',
  viewDialogTitle: 'Product details',
  emptyMessage: 'No products found.',
  exportFileName: 'products',
  pageSizeOptions: [10, 20, 50],
  defaultQuery: {
    page: 1,
    limit: 20,
    sortfield: 'updatedAt',
    direction: 'desc',
    criteria: [],
  },
  permissions: {
    module: 'Products',
  },
  getRowId: (product) => product._id,
  getRowLabel: (product) => product.name,
  table: {
    columns: productTableColumns,
  },
  form: productFormConfig,
  api: {
    useListQuery: useGetProductsQuery,
    useCreateMutation: useCreateProductMutation,
    useUpdateMutation: useUpdateProductMutation,
    useDeleteMutation: useDeleteProductMutation,
  },
  mapItemToFormValues: mapProductToFormValues,
  mapFormValuesToCreatePayload: mapProductFormToCreatePayload,
  mapFormValuesToUpdatePayload: mapProductFormToUpdatePayload,
  deleteDialogMessage: (product) => `This will permanently delete ${product.name}.`,
  slots: {
    viewContent: renderProductDetails,
    gridItem: renderProductGridItem,
  },
}

export function ProductsPage() {
  return <CrudPage config={productsCrudConfig} />
}
```

### Optional bulk delete in page config

If you exported `useBulkDeleteProductsMutation`, add:

```ts
type ProductBulkDeletePayload = {
  selectedIds: EntityId[]
}
```

Then update the page config generics and API:

```ts
const productsCrudConfig: CrudPageConfig<
  Product,
  ProductFormValues,
  ProductCreatePayload,
  ProductUpdatePayload,
  ProductBulkDeletePayload
> = {
  ...
  api: {
    useBulkDeleteMutation: useBulkDeleteProductsMutation,
    ...
  },
  bulkDelete: {
    buttonLabel: 'Delete Selected',
    confirmTitle: 'Delete selected products?',
    confirmLabel: 'Delete Selected',
    confirmMessage: (products) =>
      `This will permanently delete ${products.length} selected products.`,
    successMessage: (products) =>
      `${products.length} products deleted successfully.`,
    mapSelectedItemsToPayload: (products) => ({
      selectedIds: products.map((product) => product._id),
    }),
  },
}
```

## Step 5: Add The Route

Update `src/routes/AppRouter.tsx`.

Example:

```tsx
import { ProductsPage } from '@/pages/ProductsPage'
```

Then add the route:

```tsx
<Route path="/products" element={<ProductsPage />} />
```

## Step 6: Make It Show In The Sidebar

Important: the sidebar is not hardcoded.

The sidebar loads from:

- `src/services/api/endpoints/menusApi.ts`
- backend `/menus`

So adding a route is not enough.

To make the page visible in the sidebar, your backend menu response must include a menu item for the new route.

That menu item should contain the correct:

- `route`
- `title`
- `iconName`
- `permissionKey`
- `sequenceNo`

Also make sure the logged-in user permissions include the same module key.

## Step 7: Permissions

`CrudPage` reads permissions from:

```ts
permissions: {
  module: 'Products',
}
```

That `module` value must match the permission key used by your backend role/permission payload.

If the module name does not match, the page can be hidden or blocked even though the route exists.

## Step 8: If Your Form Needs Dropdown Options From Another API

Use the `UsersPage` pattern.

Example use case:

- Product form needs Category dropdown
- Categories come from `/categories`

Then:

1. Query categories in the page.
2. Convert them to `{ label, value }`.
3. Pass those options into a model factory like `createProductFormConfig(categoryOptions)`.

This is better than hardcoding options in the model file.

## Step 9: Test Checklist

After adding a new CRUD, check these one by one:

- The route opens.
- The page appears in sidebar after backend menu is added.
- Table loads data.
- Filters send the expected query.
- Create works.
- Edit works.
- Delete works.
- Bulk delete works if enabled.
- Export works.
- Permissions allow/deny access correctly.
- Dark mode still looks correct.

Then run:

```bash
npm run typecheck
npm run lint
npm run build
```

## Common Mistakes

### 1. Route added, but menu not visible

Cause:

- Backend `/menus` does not include the new item
- or permissions do not match

### 2. Table loads no data

Cause:

- wrong `responseDataPath`
- wrong fallback path list
- backend response shape is different from your assumptions

### 3. Total count is wrong

Cause:

- wrong `responseTotalPath`
- backend total is in another field

### 4. Form opens, but edit values are wrong

Cause:

- `mapItemToFormValues` is incomplete
- nested object values were not converted into form-friendly values

### 5. Create works, edit fails

Cause:

- create and update payloads are not the same
- you reused the wrong mapper

### 6. Page opens but shows forbidden

Cause:

- `permissions.module` does not match backend permission key

## Simplest Copy Workflow

If you want the fastest safe path:

1. Copy `src/types/user.ts` to your new type file and rename fields.
2. Copy `src/models/userModel.tsx` and remove user-specific fields.
3. Copy `src/services/api/endpoints/usersApi.ts` and replace names/paths.
4. Copy `src/pages/UsersPage.tsx` and remove any extra dependent API logic.
5. Add route in `AppRouter.tsx`.
6. Add backend menu and permissions.
7. Run typecheck, lint, and build.

## Good Resources Inside This Repo

- `src/pages/UsersPage.tsx`: best standard CRUD example
- `src/models/userModel.tsx`: standard form/table/mappers
- `src/services/api/endpoints/usersApi.ts`: standard CRUD API example
- `src/pages/RolesPage.tsx`: example with bulk delete
- `src/models/roleModel.tsx`: example of advanced custom form field (`permissions`)
- `src/types/crud.ts`: all shared CRUD contracts

## Final Advice

When adding a new CRUD:

- keep resource-specific logic in the model/page/api files
- do not edit `CrudPage` unless the feature is truly reusable
- if one screen needs special UI, use `slots`
- if more than one screen needs it, then move it into the shared CRUD layer

