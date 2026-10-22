import type { OrderDisputeLink } from "./dispute"
import type { BuyerRefund, SellerRefund } from "./refund"

// Shapes of the order endpoints as implemented by the backend (orderController.ts).
// Money values are strings with two decimals, calculated by the server.

export type OrderSeller = {
  businessName: string
  slug: string
} | null

export type OrderPayment = {
  reference: string
  provider: "PAYSTACK" | "FLUTTERWAVE"
  paidAt: string | null
} | null

export type OrderItem = {
  listingId: number
  title: string
  unitPrice: string
  quantity: number
  lineTotal: string
}

export type DeliveryAddress = {
  fullName: string
  phone: string
  address: string
  state: string
  lga: string
  instructions: string | null
}

// Where an order is in fulfilment. The seller reports shipping and delivery, but an order is only
// DELIVERED once the buyer confirms: while deliveryReportedAt is set and the status is still SHIPPED,
// the seller says it was delivered and the buyer has yet to confirm.
export type Fulfilment = {
  shippedAt: string | null
  shippingNote: string | null
  deliveryReportedAt: string | null
  deliveryConfirmedAt: string | null
  // Set when the order was closed as delivered after 7 days without an answer from the buyer.
  // Then the status is DELIVERED but deliveryConfirmedAt is null.
  deliveryAutoClosedAt?: string | null
  // PRE_ORDER for a food order the shop approved for readyAt; otherwise NOW.
  fulfilmentType?: "NOW" | "PRE_ORDER"
  readyAt?: string | null
}

// One paid checkout in a customer's history (GET /orders).
// What a shopper sees about refunds and complaints on one seller's order.
export type BuyerOrderExtras = {
  refundedAmount: string
  refunds: BuyerRefund[]
  dispute: OrderDisputeLink | null
}

export type CustomerOrderSummary = {
  id: number
  status: string
  total: string
  createdAt: string
  payment: OrderPayment
  sellerOrders: Array<{
    id: number
    status: string
    total: string
    seller: OrderSeller
    itemCount: number
    items: OrderItem[]
  } & Fulfilment & BuyerOrderExtras>
}

// GET /orders/:id
export type CustomerOrder = {
  id: number
  status: string
  total: string
  createdAt: string
  payment: OrderPayment
  delivery: DeliveryAddress
  sellerOrders: Array<{
    id: number
    status: string
    seller: OrderSeller
    subtotal: string
    shipping: string
    total: string
    items: OrderItem[]
  } & Fulfilment & BuyerOrderExtras>
}

// One order in a seller's list (GET /seller/orders), with what was bought and where it goes, so
// the seller can pack it without opening it. The fee fields are null when the payment
// provider did not report them.
// What a seller sees about refunds, complaints and money kept back on one order.
export type SellerOrderExtras = {
  liabilityDeduction: string
  refundedAmount: string
  refunds: SellerRefund[]
  dispute: OrderDisputeLink | null
}

export type SellerOrderSummary = Fulfilment & SellerOrderExtras & {
  id: number
  status: string
  createdAt: string
  paidAt: string | null
  provider: "PAYSTACK" | "FLUTTERWAVE" | null
  total: string
  providerFee: string | null
  sellerReceives: string | null
  itemCount: number
  items: OrderItem[]
  delivery: DeliveryAddress
}

// GET /seller/orders/:id
export type SellerOrder = Fulfilment & SellerOrderExtras & {
  id: number
  status: string
  createdAt: string
  paidAt: string | null
  provider: "PAYSTACK" | "FLUTTERWAVE" | null
  subtotal: string
  shipping: string
  total: string
  providerFee: string | null
  sellerReceives: string | null
  items: OrderItem[]
  delivery: DeliveryAddress
}

export type OrderPage<T> = {
  page: number
  pageSize: number
  total: number
  orders: T[]
}
