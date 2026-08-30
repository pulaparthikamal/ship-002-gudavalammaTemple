import { apiSlice } from '@/services/api/apiSlice'
import type {
  AuthMutationResponse,
  AuthUser,
  ForgotPasswordRequest,
  LoginRequest,
  LoginResponse,
  RegisterRequest,
  RequestOtpRequest,
  RequestOtpResponse,
  VerifyOtpRequest,
} from '@/types/auth'

export const authApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    login: builder.mutation<LoginResponse, LoginRequest>({
      query: (credentials) => ({
        url: '/auth/login',
        method: 'POST',
        data: credentials.phone
          ? { phone: credentials.phone, password: credentials.password }
          : { email: credentials.email, password: credentials.password },
        secured: false,
        skipGlobalErrorHandler: true,
      }),
      invalidatesTags: ['Auth'],
    }),
    requestOtp: builder.mutation<RequestOtpResponse, RequestOtpRequest>({
      query: (payload) => ({
        url: '/auth/otp/request',
        method: 'POST',
        data: payload,
        secured: false,
        skipGlobalErrorHandler: true,
      }),
    }),
    verifyOtp: builder.mutation<LoginResponse, VerifyOtpRequest>({
      query: (payload) => ({
        url: '/auth/otp/verify',
        method: 'POST',
        data: payload,
        secured: false,
        skipGlobalErrorHandler: true,
      }),
      invalidatesTags: ['Auth'],
    }),
    register: builder.mutation<AuthMutationResponse, RegisterRequest>({
      query: (payload) => ({
        url: '/auth/register',
        method: 'POST',
        data: payload,
        secured: false,
        skipGlobalErrorHandler: true,
      }),
    }),
    forgotPassword: builder.mutation<AuthMutationResponse, ForgotPasswordRequest>({
      query: ({ email, ...payload }) => ({
        url: '/auth/forgotPassword',
        method: 'POST',
        params: {
          email,
        },
        data: payload,
        secured: false,
        skipGlobalErrorHandler: true,
      }),
    }),
    getProfile: builder.query<AuthUser, void>({
      query: () => ({
        url: '/auth/me',
        method: 'GET',
      }),
      providesTags: ['Auth'],
    }),
    refreshToken: builder.mutation<{ accessToken: string }, { refreshToken: string }>({
      query: (payload) => ({
        url: '/auth/refresh-token',
        method: 'POST',
        data: payload,
        secured: false,
        skipGlobalErrorHandler: true,
      }),
    }),
  }),
})

export const {
  useForgotPasswordMutation,
  useGetProfileQuery,
  useLoginMutation,
  useRegisterMutation,
  useRefreshTokenMutation,
  useRequestOtpMutation,
  useVerifyOtpMutation,
} = authApi
