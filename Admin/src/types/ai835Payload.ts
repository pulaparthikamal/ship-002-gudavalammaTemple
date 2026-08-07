export interface Ai835Payload {
  _id: string
  claimId: string
  claimSubmissionId: string
  eraEobProcessingId?: string
  fullPayment835: string
  denialPayment835: string
  denialCorrection835: string
  generatedAt: string
  createdAt?: string
  updatedAt?: string
}
