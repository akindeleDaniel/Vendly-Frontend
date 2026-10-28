// A shop's own look (lib/shopBranding.ts in the backend): a banner, one preset colour, an "about" text,
// social links and an optional WhatsApp button. Checkout and payment always keep StoreHatch's own colours.

export type BrandColor = {
  key: string
  name: string
  background: string
  text: string // passes contrast on the background
  tint: string // a soft background for panels
  light: boolean // close to the page background: draw a thin border around it
}

export type SocialLink = { handle: string, url: string } | null

export type ShopBranding = {
  bannerUrl: string | null
  brandColor: BrandColor
  about: string | null
  social: { instagram: SocialLink, tiktok: SocialLink, facebook: SocialLink, x: SocialLink }
  whatsapp: { number: string, url: string } | null
}

// The colours a seller can choose from, the same list as the backend's (which also checks the choice).
export const BRAND_COLORS: BrandColor[] = [
  { key: "forest", name: "Forest", background: "#174B3A", text: "#FFFFFF", tint: "#E8EEEB", light: false },
  { key: "navy", name: "Navy", background: "#1F3A5F", text: "#FFFFFF", tint: "#E9EBEF", light: false },
  { key: "teal", name: "Teal", background: "#0F5E63", text: "#FFFFFF", tint: "#E7EFEF", light: false },
  { key: "indigo", name: "Indigo", background: "#3B3F8F", text: "#FFFFFF", tint: "#EBECF4", light: false },
  { key: "plum", name: "Plum", background: "#5B2A4E", text: "#FFFFFF", tint: "#EFEAED", light: false },
  { key: "wine", name: "Wine", background: "#7A1F2B", text: "#FFFFFF", tint: "#F2E9EA", light: false },
  { key: "terracotta", name: "Terracotta", background: "#9C3D22", text: "#FFFFFF", tint: "#F5ECE9", light: false },
  { key: "charcoal", name: "Charcoal", background: "#2B2F33", text: "#FFFFFF", tint: "#EAEAEB", light: false },
  { key: "brown", name: "Brown", background: "#6B3E26", text: "#FFFFFF", tint: "#F0ECE9", light: false }
]

export const ABOUT_MAX_LENGTH = 500

// The branding part of the edit form. Everything is text while editing.
export type BrandingForm = {
  brandColor: string
  about: string
  instagram: string
  tiktok: string
  facebook: string
  x: string
  whatsappNumber: string
}
