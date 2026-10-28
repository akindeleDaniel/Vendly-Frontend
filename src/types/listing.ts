// A size of an option: bought by its own listingId, with its own stock.
export type ListingSize = {
  label: string
  listingId: number
  stockQuantity: number
}

// One option of a product, for example a colour. It either has sizes, or (listingId, stockQuantity)
// of its own when it has none. `price` is this option's price.
export type ListingOption = {
  label: string
  price: number
  imageUrl: string | null
  listingId: number | null
  stockQuantity: number | null
  sizes: ListingSize[]
}

import type { ShopTrust } from "./trust"

// Where a product or option stands against its low-stock alert number (the seller's own list only).
export type StockStatus = "in_stock" | "low" | "sold_out"

// An option or size that is running low or sold out, on the seller's own list.
export type LowStockOption = {
  listingId: number
  optionLabel: string | null
  sizeLabel: string | null
  stockQuantity: number
  lowStockThreshold: number | null
  effectiveLowStockThreshold: number
  stockStatus: StockStatus
}

export type Listing = {
  id: number
  // GET /listings/:id only: a WhatsApp link with a message naming the product, its price and a link to it.
  // Null when the shop has no WhatsApp number.
  whatsappEnquiry?: { number: string, message: string, url: string } | null
  title: string
  description: string
  price: number
  category: string
  imageUrl: string // always the first photo
  ratingAverage?: number | null // one decimal; null until the first review
  ratingCount?: number
  images?: string[] // every photo, in the order shoppers see them (up to 5)
  createdAt: string // date is a string because when coming from express or json, it comes as a string(stringify)
  stockQuantity: number
  sellerSlug?: string | null
  sellerName?: string | null
  deliveredCount?: number // buyer-confirmed, unrefunded orders that contained this product
  shopTrust?: ShopTrust // on the product page: the shop's trust numbers
  hasOptions?: boolean // the product is bought through one of its options
  hasPriceRange?: boolean // its options differ in price, so `price` is the lowest ("from")
  options?: ListingOption[] // on the product page and the seller's own list
  selectedListingId?: number | null // set when the page was opened with one choice's id
  archivedAt?: string | null // set when the seller has taken the listing off sale; null while it is on sale
  // The seller's own list only: the low-stock alert. An item is "low" at this many or fewer; 0 means no alerts.
  lowStockThreshold?: number | null // its own number, or null to use the shop's
  effectiveLowStockThreshold?: number // the number in force
  stockStatus?: StockStatus // with options: sold out when every option is, low when any is low or sold out
  lowStockOptions?: LowStockOption[] // the options that are low or sold out
  // Drafts (GET /listings/Mylisting?drafts=only): hidden from shoppers until published.
  isDraft?: boolean
  draftMissing?: DraftField[] // what a draft still needs before it can be published
}

export type DraftField = "title" | "description" | "price" | "stockQuantity" | "category" | "imageUrl"

export type ListingFormData = {
  title: string
  description: string
  price: string
  category: string
  stockQuantity: string
}
