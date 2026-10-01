import { useEffect, useState } from "react"
import { useParams } from "react-router-dom"
import type { Listing } from "../pages/DiscoveryPage"
import ListingCard from "../components/ListingCard"
import { useNavigate, useSearchParams } from "react-router-dom"

type ShopProfile = {
    businessName: string
    location: string
    logoUrl: string
    slug: string
}

function ShopPage () {
    const navigate = useNavigate()
    const [searchParams] = useSearchParams()

    const handleBackToCategory = () => {
  const category = searchParams.get("category")
  const search = searchParams.get("search")

  const nextSearchParams = new URLSearchParams()

  if (category) {
    nextSearchParams.set("category", category)
  }

  if (search) {
    nextSearchParams.set("search", search)
  }

  const query = nextSearchParams.toString()

  navigate(query ? `/?${query}` : "/")
}

    const { slug } = useParams()
    const [profile, setProfile] = useState<ShopProfile | null>(null)
    const [profileSlug, setProfileSlug] = useState<string | null>(null)
    const [listings, setListings] = useState<Listing[]>([])
    const [notFoundSlug, setNotFoundSlug] = useState<string | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [searchText, setSearchText] = useState("")
    const search = searchText.trim()

    useEffect(() => {
        if (!slug) {
            return
        }
        const shopSlug = slug

        const controller = new AbortController()

        async function fetchShop() {
            setIsLoading(true)
            setNotFoundSlug(null)

            try{
                const query = new URLSearchParams()
                if (search) {
                    query.set("search", search)
                }
                const queryString = query.toString()
                const response = await fetch(
                    `http://localhost:3000/seller/shop/${encodeURIComponent(shopSlug)}${queryString ? `?${queryString}` : ""}`,
                    { signal: controller.signal }
                )
                const data = await response.json()

                if(!response.ok){
                    if (!controller.signal.aborted) {
                        setNotFoundSlug(shopSlug)
                    }
                    return
                }

                if (controller.signal.aborted) {
                    return
                }
                setProfile(data.profile)
                setProfileSlug(shopSlug)
                setListings(data.listings)
            }catch{
                if (!controller.signal.aborted) {
                    alert("Something went wrong. Please check your connection and try again.")
                }
            }finally{
                if (!controller.signal.aborted) {
                    setIsLoading(false)
                }
            }
        }

        fetchShop()
        return () => controller.abort()
    }, [slug, search])

    if(notFoundSlug === slug){
        return (
            <div>
                <h1>Store not found</h1>
            </div>
        )
    }

    if(!profile || profileSlug !== slug){
        return (
            <div>
                <p>Loading...</p>
            </div>
        )
    }

    return (
        <div>
            <button
                type="button"
                onClick={handleBackToCategory}
                >
                Back to Search
            </button>
            {profile.logoUrl && <img src={profile.logoUrl} alt={profile.businessName} width="80" />}
            <h1>{profile.businessName}</h1>
            <p>{profile.location}</p>
            <label>
                Search this shop
                <input
                    type="search"
                    value={searchText}
                    onChange={(event) => setSearchText(event.currentTarget.value)}
                />
            </label>
            {isLoading && <p>Loading products...</p>}
            {!isLoading && listings.length === 0 && (
                <p>{search ? "No products match your search." : "This shop has no products yet."}</p>
            )}
            {!isLoading && listings.map((listing) => (
                <ListingCard
                    isEditable={false}
                    listing={listing}
                    key={listing.id}
                />
            ))}
        </div>
    )
}

export default ShopPage