import { useEffect, useState } from "react"
import { clearPendingCartItem, readPendingCartItem } from "../lib/pendingCartItem"
import { getErrorMessage } from "../lib/api"
import { useParams } from "react-router-dom"
import type { Listing } from "../types/listing"
import type { AuthStatus, UserRole } from "../types/user"
import ListingCard from "../components/ListingCard"
import { useNavigate, useSearchParams } from "react-router-dom"
import { apiFetch } from "../lib/api"
import { useDocumentTitle } from "../lib/useDocumentTitle"

type ShopProfile = {
    businessName: string
    location: string
    logoUrl: string
    slug: string
}

type ShopPageProps = {
    userRole: UserRole | null
    authStatus: AuthStatus
}

function ShopPage ({ userRole, authStatus }: ShopPageProps) {
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
    useDocumentTitle(profile ? profile.businessName : "Shop")
    const [listings, setListings] = useState<Listing[]>([])
    const [notFoundSlug, setNotFoundSlug] = useState<string | null>(null)
    const [pendingCartResult, setPendingCartResult] = useState<{ text: string, isError: boolean } | null>(null)
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
                const response = await apiFetch(
                    `/seller/shop/${encodeURIComponent(shopSlug)}${queryString ? `?${queryString}` : ""}`,
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

    // A shopper who was sent to log in or register from this storefront returns here, and the
    // product they chose is added to their cart now.
    useEffect(() => {
        if (userRole === null) {
            return
        }

        const pending = readPendingCartItem()
        if (!pending) {
            return
        }

        if (userRole !== "CONSUMER") {
            clearPendingCartItem()
            return
        }

        if (pending.returnTo.split("?")[0] !== window.location.pathname) {
            return
        }

        clearPendingCartItem()// cleared before the request so the item can never be added twice

        async function addPendingItem() {
            try {
                const response = await apiFetch("/cart/items", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    credentials: "include",
                    body: JSON.stringify({
                        listingId: pending!.listingId,
                        quantity: pending!.quantity
                    })
                })

                if (!response.ok) {
                    setPendingCartResult({
                        text: await getErrorMessage(response, "We could not add your chosen item to the cart. Please add it again."),
                        isError: true
                    })
                    return
                }

                setPendingCartResult({ text: "The item you chose has been added to your cart.", isError: false })
            } catch {
                setPendingCartResult({
                    text: "We could not add your chosen item to the cart. Please check your connection and add it again.",
                    isError: true
                })
            }
        }

        addPendingItem()
    }, [userRole])

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
            {pendingCartResult && (
                <p role={pendingCartResult.isError ? "alert" : "status"}>{pendingCartResult.text}</p>
            )}
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
                    allowAddToCart
                    isLoggedOut={authStatus === "unauthenticated"}
                    listing={listing}
                    userRole={userRole}
                    key={listing.id}
                />
            ))}
        </div>
    )
}

export default ShopPage
