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
}

// One paid checkout in a customer's history (GET /orders).
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
  } & Fulfilment>
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
  } & Fulfilment>
}

// One order in a seller's list (GET /seller/orders), with what was bought and where it goes, so
// the seller can pack it without opening it. The fee fields are null when the payment
// provider did not report them.
export type SellerOrderSummary = Fulfilment & {
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
export type SellerOrder = Fulfilment & {
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
