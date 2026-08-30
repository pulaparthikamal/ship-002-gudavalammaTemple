# Project Structure

## Repo root

```
gudavalammaTemple/
├── server/            Backend — Node/TS/Express/Mongoose (the app described in ARCHITECTURE.md)
├── Admin/             Frontend — React/TS/Vite (staff admin + devotee portal, same app)
├── AgenticServer/     Unrelated Python/Django project living in this repo. Not part of the
│                      temple app; only referenced by one now-removed static-file mount in
│                      server/src/app.ts (deleted in this session's cleanup). Leave alone.
├── binarysearch/      Unrelated coding-practice scripts (binary search variants). Not part
│                      of the temple app. Leave alone.
├── ARCHITECTURE.md    Read first — system design, module map, data flow
├── PROJECT_STRUCTURE.md  This file
└── MEMORY.md          Running log of what's been built, in what order, and what's left
```

## `server/src/`

```
server/src/
├── app.ts                  Express app assembly: middleware chain, route mounting, swagger
├── server.ts                Entry point: connectDB() -> http server -> listen
├── config/                 env.config.ts (typed env vars), db.config.ts, llm.config.ts, translation.config.ts, swagger.config.ts, cors.config.ts, app.config.ts
├── constants/               roles.constants.ts (RoleEnum + SEED_ROLES permission map), httpStatus.constants.ts, common.constants.ts
├── middlewares/             auth.middleware.ts, optionalAuth.middleware.ts (guest-checkout routes only), role.middleware.ts (permissionGuard/roleGuard), locale.middleware.ts (negotiates req.locale against every currently-enabled Language, Phase 13b), otpRateLimiter.middleware.ts (Phase 18 — phone-keyed limiter for /auth/otp/request), validate.middleware.ts, errorHandler, rateLimiter, requestLogger
├── modules/                 One folder per domain — see ARCHITECTURE.md's module table.
│                            Pattern: <name>.model.ts / .schema.ts / .service.ts / .controller.ts / .route.ts / .docs.ts
│                            Notable non-obvious ones: language/ (Language registry), translation/ (TranslationCache model — the service lives in services/translation/), pageContent/ (screen-customizer draft/published widget trees),
│                            templeEvent/ (TempleEvent + EventRegistration, exports a second router `eventRegistrationRouter` mounted separately at /event-registrations), nearbyPlace/ (simple public-read/staff-write catalog, no booking side),
│                            templeReconfigure/ (Phase 11 — SUPER_ADMIN-only catalog reset wizard backend, not a CRUD resource),
│                            analytics/ (Phase 12 — analyticsEvent.model.ts + analyticsDailyRollup.model.ts + analytics.constants.ts for the fixed funnel/click-label lists)
├── jobs/
│   └── analyticsRollup.job.ts   Phase 12 — node-cron nightly job, started from server.ts
├── routes/
│   └── index.ts             Every module's router is mounted here. Source of truth for the API surface.
├── i18n/
│   ├── index.ts              Merges en/te/hi into one `translations` map, exports t(key, params, locale)
│   ├── en/ te/ hi/            One file per module, e.g. seva.i18n.ts, booking.i18n.ts
├── database/
│   ├── seeds/index.ts        `npm run seed` entrypoint — roles, menus, LLM settings, seva/darshan catalogs, languages
│   └── seeds/menu.seed.ts     Sidebar's defaultMenus array
├── services/
│   ├── llm/llm.service.ts     Switchable LLM provider call — used directly by staff and as translation's fallback
│   ├── translation/translation.service.ts   LibreTranslate-primary, LLM-fallback, cached in TranslationCache
│   ├── notification/bookingEmail.service.ts  Guest/devotee booking confirmation emails, translated to preferredLocale
│   └── notification/whatsapp.service.ts     Phase 16 — WhatsApp confirmations via Meta Cloud API (direct REST call)
├── scripts/                 One-off maintenance scripts (list-users.ts etc.) — run manually via ts-node, never imported by app code.
│                            seed-demo-data.ts (Phase 20) — populates realistic, cross-linked demo data (donors, properties,
│                            assets, liabilities, donations, all 4 booking types + ledger rows, events, announcements,
│                            expense tracker, 21 days of analytics + rollups) for the government/Minister-of-Parliament demo.
│                            Guarded to no-op if `Donor` documents already exist — safe to re-run defensively.
├── types/                   common.types.ts (BaseDocument, ObjectIdType), pagination.types.ts, express.d.ts (Request augmentation)
└── utils/                   resp.util.ts (response shape builders), pagination.util.ts, service.util.ts (generateListQuery), error.util.ts, asyncHandler.util.ts, logger.util.ts, token.util.ts, mail.util.ts (nodemailer sendMail), guestCheckout.util.ts (resolveBooker), upi.util.ts (Phase 15 — builds upi://pay deep links), otp.util.ts (Phase 18 — generateOtp/hashOtp + TTL/attempts/cooldown constants)
```

## `Admin/src/`

```
Admin/src/
├── main.tsx                  Vite entry — imports PrimeReact theme CSS, index.css, templeTheme.css
├── App.tsx                    Top-level providers + <AppRouter/>
├── app/
│   ├── store.ts / store/rootReducer.ts   Redux store: auth, session, preferences (persisted) + apiSlice
│   └── providers/AppProviders.tsx         Wraps the app in Redux Provider, etc.
├── routes/
│   ├── AppRouter.tsx           The whole site map — read this to see every route
│   ├── HomeGate.tsx             Guards "/" — redirects authenticated staff to /dashboard, everyone else sees the home page
│   ├── ProtectedRoute.tsx / PublicOnlyRoute.tsx           staff-side guards
│   └── DevoteeRoutes.tsx / DevoteeProtectedRoute.tsx / DevoteePublicOnlyRoute.tsx   devotee-side guards + nested route tree
├── layouts/
│   ├── AppLayout.tsx / Sidebar.tsx / AppHeader.tsx        staff shell (DB-driven sidebar nav)
│   └── DevoteeLayout.tsx                                   devotee/public shell (header adapts to auth state, footer has temple info + social links)
├── pages/
│   ├── devotee/                 All devotee-facing pages (Dashboard/Darshan/Seva/Accommodation/Prasadam/Donation/Live/Bookings/Facilities/Profile/Login/Register/ForgotPassword/Events/NearbyPlaces)
│   ├── <Generic>Page.tsx        UsersPage, RolesPage, SettingsPage, ProfilePage, DashboardMain — pre-existing generic admin
│   ├── <TempleManagement>Page.tsx  DonorsPage, PropertiesPage, AssetsPage, LiabilitiesPage, ExpenseTrackerPage,
│   │                                SevaCatalogPage, DarshanQuotaPage, AccommodationRoomTypePage, PrasadamItemPage,
│   │                                DonationFundPage, FacilityPage, AnnouncementsPage, TempleProfilePage, LanguagesPage,
│   │                                EventsPage, NearbyPlacesPage (Phase 10, generic CrudPage wrappers via toStaticCrudListResult)
│   ├── DonationsPage.tsx / BookingsPage.tsx  Phase 10b — read-only, paginated, filterable staff ledgers (bespoke DataTable, not CrudPage)
│   ├── ReconfigureTemplePage.tsx  Phase 11 — SUPER_ADMIN-only "reconfigure for a new temple" wizard (links to TempleProfilePage for the bulk-edit step, then per-catalog reset-to-empty/reset-to-defaults with a confirmation dialog)
│   ├── AnalyticsPage.tsx        Phase 12 — visits/top-pages/top-clicks/funnel-dropoff/feature-usage charts (recharts, dataviz-skill palette)
│   └── ScreenBuilderPage.tsx    The drag-and-drop screen customizer (see ARCHITECTURE.md)
├── components/
│   ├── crud/                   CrudPage.tsx, CommonTable.tsx, CommonForm.tsx, CommonGrid.tsx, EditableGrid.tsx (Excel-like grid)
│   ├── screenBuilder/           BuilderCanvas.tsx, WidgetPalette.tsx, WidgetInspector.tsx,
│   │                            WidgetTreeRenderer.tsx (shared static layout), widgetRenderers.tsx (per-type),
│   │                            ScreenRenderer.tsx (mounted in the 10 devotee pages; reads `published`, or
│   │                            `draft` when loaded with `?previewDraft=1` — Phase 14a real-preview iframe)
│   ├── AnnouncementPopup.tsx    Fetches active announcements, shows highest-priority undismissed one as a modal;
│   │                             renders a "View Event" CTA when the announcement has a `linkedEventId` (Phase 10a)
│   └── LanguageSwitcher.tsx     Mounted in every header/auth page; options come from GET /languages/enabled
├── components/ui/
│   ├── PageHeader.tsx            Shared page title/eyebrow/description/actions header
│   └── YearFilter.tsx            Phase 10b — quick year-picker dropdown + `yearToDateRange()` helper (see ARCHITECTURE.md)
├── features/devotee/
│   ├── hooks/useGuestCheckout.ts        Shared guest-vs-authenticated state for the 5 booking/order/donation forms
│   ├── components/GuestContactFields.tsx  Name/email/phone inputs, shown when not authenticated
│   └── components/UpiPaymentPanel.tsx     Phase 15 — QR + "Pay Now" UPI link + optional UTR self-report,
│                                            shown on all 5 booking/donation pages when amount > 0
├── models/                     Per-resource form/table/schema config, one file per CRUD screen (e.g. donorModel.tsx).
│                                  Modules converted for Phase 13d export **factory functions taking `t`**
│                                  (e.g. `getDonorTableColumns(t)`, `getDonorFormConfig(t)`) instead of plain consts,
│                                  called + memoized from inside the matching `pages/<Name>Page.tsx` — see donorModel.tsx
│                                  for the reference pattern. Not-yet-converted modules still export plain consts.
├── services/api/
│   ├── apiSlice.ts               ONE shared RTK Query slice — tagTypes array is the single source of truth for cache tags
│   ├── axiosInstance.ts          attachAuthorizationHeader + attachLocaleHeader interceptors (Phase 13b)
│   ├── authSessionBridge.ts / localeSessionBridge.ts   "read the Redux store from outside React" helpers used by
│   │                                                     axiosInstance.ts (localeSessionBridge added Phase 13b)
│   └── endpoints/<x>Api.ts       One file per resource (usersApi.ts, donorsApi.ts, sevaApi.ts, expenseEntriesApi.ts,
│                                   languagesApi.ts, translationsApi.ts, pageContentApi.ts, ...)
├── i18n/
│   ├── useTranslation.ts         useStaffTranslation()/useDevoteeTranslation() (Phase 13a) — each reads/writes its own
│   │                              Redux preferences.staffLocale/devoteeLocale field, fully independent of the other.
│   │                              Bundled locales resolve instantly; others lazily fetch+cache via POST /translations/:locale
│   │                              (see flatten.ts). A dot-free key is a "content" key (Phase 13d) — see ARCHITECTURE.md.
│   └── translations/{en,te,hi}.ts   Dot-path keyed dictionaries (e.g. devotee.homeHeroTitle, sidebar.*, dashboard.*,
│                                      staff.crud.* — Phase 13c) plus a `content` namespace (Phase 13d, literal-English-
│                                      string-keyed per-page content) — the source-of-truth English strings that get
│                                      flattened for on-demand translation
├── styles/
│   ├── index.css                 Neutral admin theme (--color-* tokens), PrimeReact overrides
│   └── templeTheme.css            Devotional theme, scoped via `.temple-scope` class (see ARCHITECTURE.md)
├── features/
│   ├── auth/                     Staff login form + styles (templeLogin.css)
│   └── devotee/                  Devotee login/register/forgot-password forms + styles (devoteePortal.css)
├── types/, schemas/, utils/, hooks/, data/    Shared TS types, zod schemas, helpers, hooks, and small static data (devoteeCatalogs.ts)
│                                                 Notable utils: crudStaticList.ts (adapts a flat unpaginated list hook into CrudPage's shape),
│                                                 bookingHours.ts (formats optional bookingOpensAt/bookingClosesAt into a display string, Phase 10e),
│                                                 analytics.ts (Phase 12 — trackPageview/trackClick/trackFunnelStep, batched + beacon-flushed),
│                                                 upi.ts (Phase 15 — builds upi://pay deep links, mirrors server's upi.util.ts),
│                                                 templeName.ts (Phase 19 — resolveTempleName() reads nameTranslations for the current locale)
└── CRUD_GUIDE.md                Read before building another generic CRUD screen
```

## Where a new feature's pieces live (checklist)

Backend module → `server/src/modules/<name>/*`, registered in `server/src/routes/index.ts`, i18n in `server/src/i18n/{en,te,hi}/<name>.i18n.ts` registered in `server/src/i18n/index.ts`, permission key added to `server/src/constants/roles.constants.ts`.

Staff screen → `Admin/src/models/<name>Model.tsx` + `Admin/src/services/api/endpoints/<name>Api.ts` (tag added to `apiSlice.ts`'s `tagTypes`) + `Admin/src/pages/<Name>Page.tsx`, route added to `AppRouter.tsx`, menu entry added to `server/src/database/seeds/menu.seed.ts` (+ re-run `npm run seed`).

Devotee screen → wire an existing `Admin/src/pages/devotee/<Name>Page.tsx` to a real backend module the same way; if it's a bookable thing, write a `booking.registry.ts` cancel handler and call `bookingService.createLedgerEntry` on creation.
