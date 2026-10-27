import type { BrandColor } from "./branding"

// The shop a cart item comes from (GET /cart: listing.user.sellerProfile).
export type CartShop = {
  businessName: string
  slug: string
  logoUrl?: string | null
  location?: string | null
  brandColor?: BrandColor // the resolved preset, as on the shop page
}

export type CartItem = {
  listingId: number
  quantity: number
  availableQuantity: number// what the server will currently let this shopper buy (stock minus other shoppers' reservations)
  listing: {
    id: number
    title: string // a chosen option's own title reads "Product — Blue / M"; show productTitle and the labels instead
    productTitle?: string // the product's plain name
    optionLabel?: string | null // set when the item is one option (and size) of a product
    sizeLabel?: string | null
    parentId?: number | null
    description: string
    price: number
    stockQuantity: number
    category: string
    imageUrl: string | null // the option's photo, or the product's main photo
    user: {
      sellerProfile: CartShop | null// a listing's owner may not have a store profile
    }
  }
}

export type CartResponse = {
  cart: {
    cartItems: CartItem[]
  } | null// null when the user has no cart yet
}
