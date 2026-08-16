import { createApi } from '@reduxjs/toolkit/query/react'
import { axiosBaseQuery } from './axiosBaseQuery'

export const apiSlice = createApi({
  reducerPath: 'api',
  baseQuery: axiosBaseQuery(),
  tagTypes: [
    'Auth', 'User', 'Role', 'Menu', 'Tone', 'Platform', 'Settings', 'TableView', 'Document',
    'Seva', 'DarshanQuota', 'AccommodationRoomType', 'PrasadamItem', 'DonationFund', 'Donation',
    'Facility', 'Announcement', 'Booking',
    'Donor', 'Property', 'Asset', 'Liability', 'ExpenseEntry', 'ExpenseEvent', 'TempleProfile',
    'Language', 'PageContent', 'TempleEvent', 'EventRegistration', 'NearbyPlace', 'ReconfigureCatalog',
    'AnalyticsSummary',
  ],

  invalidationBehavior: 'immediately',
  keepUnusedDataFor: 60,
  refetchOnFocus: false,
  refetchOnReconnect: true,
  endpoints: () => ({}),
})
