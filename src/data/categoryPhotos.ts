// The photos on the home page's "Shop by category" tiles: 11 fixed photos, from Unsplash (free for
// commercial use, no credit required; the sources are listed in the README). On every visit five of
// them, from five different categories, are shown in a new order. They are pictures only, not links.

export type CategoryPhoto = {
    category: string
    src: string
    alt: string
    position?: string // where to crop: the part of the photo that matters
}

export const CATEGORY_PHOTOS: CategoryPhoto[] = [
    { category: "Fashion & Clothing", src: "/images/categories/fashion-dress.jpg", alt: "A woman in a strapless ankara dress", position: "50% 30%" },
    { category: "Fashion & Clothing", src: "/images/categories/fashion-suit.jpg", alt: "A man in a bright ankara suit", position: "50% 35%" },
    { category: "Arts, Crafts & Hobbies", src: "/images/categories/crafts-fabric.jpg", alt: "Rolls of colourful printed fabric" },
    { category: "Jewelry & Accessories", src: "/images/categories/accessories-headwrap.jpg", alt: "A woman in a yellow printed headwrap", position: "50% 20%" },
    { category: "Food & Grocery", src: "/images/categories/food-cake.jpg", alt: "A chocolate cake" },
    { category: "Food & Grocery", src: "/images/categories/food-market.jpg", alt: "A busy food market with peppers and tomatoes", position: "50% 60%" },
    { category: "Beauty & Personal Care", src: "/images/categories/beauty-serum.jpg", alt: "An amber glass serum bottle" },
    { category: "Phones & Accessories", src: "/images/categories/phones-phone.jpg", alt: "A smartphone on a desk", position: "45% 50%" },
    { category: "Sports & Fitness", src: "/images/categories/sports-sneakers.jpg", alt: "A pair of running shoes", position: "50% 70%" },
    { category: "Home & Furniture", src: "/images/categories/home-armchair.jpg", alt: "An armchair with cushions and a throw", position: "50% 55%" },
    { category: "Books & Stationery", src: "/images/categories/books-stack.jpg", alt: "A stack of hardback books", position: "30% 50%" }
]

// Five photos from five different categories, in a random order.
export function pickCategoryPhotos(count = 5): CategoryPhoto[] {
    const shuffled = CATEGORY_PHOTOS
        .map((photo) => ({ photo, key: Math.random() }))
        .sort((a, b) => a.key - b.key)
        .map((entry) => entry.photo)
    const picked: CategoryPhoto[] = []

    for (const photo of shuffled) {
        if (picked.length < count && !picked.some((chosen) => chosen.category === photo.category)) {
            picked.push(photo)
        }
    }

    return picked
}
