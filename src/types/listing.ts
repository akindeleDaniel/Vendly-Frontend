export type Listing = {
  id: number
  title: string
  description: string
  price: number
  category: string
  imageUrl: string
  createdAt: string // date is a string because when coming from express or json, it comes as a string(stringify)
  stockQuantity: number
  sellerSlug?: string | null
  sellerName?: string | null
}

export type ListingFormData = {
  title: string
  description: string
  price: string
  category: string
  stockQuantity: string
}
