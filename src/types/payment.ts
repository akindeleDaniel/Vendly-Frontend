// Shapes of the payment endpoints as implemented by the backend (paymentController.ts).

export type PaymentProvider = "PAYSTACK" | "FLUTTERWAVE"

export type PaymentStatus = "PENDING" | "SUCCESS" | "FAILED"

// Returned by POST /checkout/:id/payments and GET /payments/:reference.
// The amount is a string with two decimals, calculated by the server.
export type Payment = {
  reference: string
  provider: PaymentProvider
  status: PaymentStatus
  amount: string
  currency: string
  // Paystack's payment page; only present while the payment is pending.
  authorizationUrl: string | null
  failureReason: string | null
  checkout: {
    id: number
    status: string
    expiresAt: string
  }
}
