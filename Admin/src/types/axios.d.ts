import 'axios'

declare module 'axios' {
  export interface AxiosRequestConfig {
    secured?: boolean
    skipGlobalErrorHandler?: boolean
  }
}
