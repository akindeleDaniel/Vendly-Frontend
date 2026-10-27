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

export type Listing = {
  id: number
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
}

export type ListingFormData = {
  title: string
  description: string
  price: string
  category: string
  stockQuantity: string
}
