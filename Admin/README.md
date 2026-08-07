# Admin React Starter

Production-ready React starter built with Vite, TypeScript, Tailwind CSS, PrimeReact, Redux Toolkit, RTK Query, Redux Persist, Axios, React Hook Form, Zod, React Router, and Lucide React.

## Create and Run

```bash
npm create vite@latest admin -- --template react-ts
cd admin
npm install
npm install @reduxjs/toolkit react-redux redux-persist axios primereact primeicons lucide-react react-hook-form zod @hookform/resolvers react-router-dom
npm install -D tailwindcss @tailwindcss/vite
cp .env.example .env.local
npm run dev
```

For this repository, dependencies are already installed. Start it with:

```bash
npm run dev
```

## Environment

```bash
VITE_API_BASE_URL=http://localhost:3000/api
```

The app falls back to `/api` when `VITE_API_BASE_URL` is not defined.

## Folder Structure

```text
src/
  app/
    providers/        App-level providers
    store/            Redux store, root reducer, persist config
  components/
    crud/             Config-driven CRUD table/form/page primitives
    forms/            RHF + PrimeReact field wrappers
    ui/               Shared UI primitives
  features/
    auth/             Auth state and auth API endpoints
    preferences/      Persisted UI preferences
    session/          Persisted non-sensitive session metadata
  hooks/              Typed Redux hooks and reusable app hooks
  layouts/            Sidebar/header shell
  models/             Resource screen models, schemas, columns, mappers
  pages/              Route pages
  routes/             Protected and public route composition
  schemas/            Reusable Zod schemas
  services/
    api/              Axios client, interceptors, RTK Query baseQuery/endpoints
  styles/             Tailwind entrypoint and global styling
  types/              All shared TypeScript contracts
  utils/              Small shared helpers
```

## Architecture Notes

- Auth, session, and preferences are persisted through `redux-persist`.
- RTK Query cache is intentionally not persisted to avoid stale or sensitive API data.
- Axios interceptors attach bearer tokens for secured requests and centralize 401/403/error formatting.
- The Axios layer uses a small auth bridge so HTTP utilities do not import the Redux store directly.
- Logout clears auth/session state and resets the RTK Query cache.
- React Hook Form field wrappers keep PrimeReact integration consistent across pages.
- Zod schemas live in `src/schemas` so form validation is reusable outside individual components.

## Config-Driven CRUD

The `Users` and `Roles` modules demonstrate the metadata-driven CRUD pattern.

```text
src/components/crud/
  CommonForm.tsx      Renders configured PrimeReact form fields
  CommonTable.tsx     Renders configured table columns and row actions
  CrudPage.tsx        Combines list/create/read/update/delete behavior

src/components/forms/
  FormAutoComplete.tsx
  FormCheckbox.tsx
  FormDatePicker.tsx
  FormInputText.tsx
  FormDropdown.tsx
  FormFileUpload.tsx
  FormPassword.tsx
  FormPermissionsMatrix.tsx
  FormTextarea.tsx
  FormNumber.tsx
  FormSwitch.tsx

src/types/
  crud.ts                         Shared CRUD config contracts
  user.ts                         User resource contracts
  role.ts                         Role resource contracts

src/models/
  userModel.tsx                   User API details, form fields, table columns, mappers
  roleModel.tsx                   Role API details, form fields, table columns, mappers

src/services/api/endpoints/
  usersApi.ts                     User CRUD endpoints
  rolesApi.ts                     Role CRUD endpoints
```

To add another CRUD screen, copy an existing resource shape and provide:

- Types in `src/types/<resource>.ts`.
- Model/config in `src/models/<resource>Model.tsx`.
- API endpoints in `src/services/api/endpoints/<resource>Api.ts`.
- Route/sidebar entry.

`CrudPage` supports custom page behavior through `slots`, so page-specific changes should live in the resource model/page config instead of editing `CrudPage`.

Detailed guide for new developers:

- `CRUD_GUIDE.md`

Supported common form field types:

```text
text, email, password, number, textarea, select, autocomplete, permissions, date, upload, checkbox, switch, hidden
```

## Available Scripts

```bash
npm run dev
npm run build
npm run typecheck
npm run lint
npm run preview
```
