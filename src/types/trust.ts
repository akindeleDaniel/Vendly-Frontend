// Trust numbers the server works out from real orders, so a seller cannot type them in (lib/trust.ts).

export type ShopTrust = {
  confirmedDeliveries: number // orders whose buyer confirmed delivery and that were not refunded
  complaintsSettled: number // buyers' complaints that are finished
  complaintsOpen: number
  payoutVerified: boolean // the bank account was checked with a payment provider and is active
  sellingSince: string
}
