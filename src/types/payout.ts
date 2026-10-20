export type PayoutProvider = "PAYSTACK" | "FLUTTERWAVE"

export type PayoutStatus = "PENDING" | "ACTIVE" | "FAILED"

export type PayoutBank = {
    id: string
    name: string
}

export type PayoutAccount = {
    provider: PayoutProvider
    status: PayoutStatus
    bankId: string
    bankName: string
    accountName: string
    accountNumberLast4: string
    failureReason: string | null
}

export type FeeTerms = {
    version: string
    text: string
}

export type PayoutOverview = {
    feeTerms: FeeTerms
    acceptedFeeTermsVersion: string | null
    feeTermsAcceptedAt: string | null
    businessPhone: string | null
    accounts: PayoutAccount[]
}

export type PayoutSetupInput = {
    bankId: string
    accountNumber: string
    businessPhone: string
    feeTermsVersion: string
}
