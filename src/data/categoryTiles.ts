import { BRAND_COLORS } from "../types/branding"
import type { Category } from "./categories"

// The home page's "Shop by category" tiles: every category, each in one of the shop colours with a photo
// in a round window. The photos are from Unsplash (free for commercial use, no credit required; the
// sources are listed in the README). Popular categories come first.

export type CategoryTile = {
    category: Category
    background: string // a shop colour; white text passes contrast on all of them
    src: string
    position?: string // where to crop: the part of the photo that matters
}

function colour(key: string): string {
    return BRAND_COLORS.find((brand) => brand.key === key)?.background ?? BRAND_COLORS[0].background
}

export const CATEGORY_TILES: CategoryTile[] = [
    { category: "Fashion & Clothing", background: colour("plum"), src: "/images/categories/fashion-dress.jpg", position: "50% 25%" },
    { category: "Food & Grocery", background: colour("terracotta"), src: "/images/categories/food-market.jpg", position: "50% 60%" },
    { category: "Beauty & Personal Care", background: colour("wine"), src: "/images/categories/beauty-serum.jpg" },
    { category: "Phones & Accessories", background: colour("teal"), src: "/images/categories/phones-phone.jpg", position: "45% 50%" },
    { category: "Jewelry & Accessories", background: colour("brown"), src: "/images/categories/jewelry-pieces.jpg", position: "45% 40%" },
    { category: "Home & Furniture", background: colour("navy"), src: "/images/categories/home-armchair.jpg", position: "50% 55%" },
    { category: "Electronics", background: colour("charcoal"), src: "/images/categories/electronics-headphones.jpg", position: "50% 65%" },
    { category: "Health & Wellness", background: colour("forest"), src: "/images/categories/health-supplements.jpg", position: "60% 60%" },
    { category: "Computers & Accessories", background: colour("indigo"), src: "/images/categories/computers-laptop.jpg", position: "45% 45%" },
    { category: "Sports & Fitness", background: colour("terracotta"), src: "/images/categories/sports-sneakers.jpg", position: "50% 70%" },
    { category: "Baby & Kids", background: colour("plum"), src: "/images/categories/baby-clothes.jpg", position: "50% 60%" },
    { category: "Books & Stationery", background: colour("teal"), src: "/images/categories/books-stack.jpg", position: "30% 50%" },
    { category: "Toys & Games", background: colour("navy"), src: "/images/categories/toys-collection.jpg" },
    { category: "Arts, Crafts & Hobbies", background: colour("forest"), src: "/images/categories/crafts-paints.jpg", position: "72% 50%" },
    { category: "Pet Supplies", background: colour("brown"), src: "/images/categories/pets-dog-toy.jpg", position: "55% 35%" },
    { category: "Automotive", background: colour("charcoal"), src: "/images/categories/automotive-dashboard.jpg", position: "25% 55%" },
    { category: "Tools & Hardware", background: colour("wine"), src: "/images/categories/tools-hammer.jpg", position: "60% 30%" },
    { category: "Other", background: colour("indigo"), src: "/images/categories/other-gift.jpg" }
]
