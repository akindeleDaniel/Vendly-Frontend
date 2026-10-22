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
  archivedAt?: string | null // set when the seller has taken the listing off sale; null while it is on sale
}

export type ListingFormData = {
  title: string
  description: string
  price: string
  category: string
  stockQuantity: string
}
