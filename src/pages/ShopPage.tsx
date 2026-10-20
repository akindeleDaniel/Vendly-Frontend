import { useEffect, useState } from "react"
import { usePendingCartAdd } from "../lib/usePendingCartAdd"
import { useParams } from "react-router-dom"
import type { Listing } from "../types/listing"
import type { AuthStatus, UserRole } from "../types/user"
import ListingCard from "../components/ListingCard"
import { Link, useNavigate, useSearchParams } from "react-router-dom"
import Notice from "../components/Notice"
import { ChevronLeftIcon, MapPinIcon, SearchIcon } from "../components/Icons"
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
    const pendingCartResult = usePendingCartAdd(userRole)// adds the product a visitor chose before logging in
    const [isLoading, setIsLoading] = useState(true)
    const [loadError, setLoadError] = useState("")
    const [loadAttempt, setLoadAttempt] = useState(0)
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
            setLoadError("")

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
                if(!response.ok){
                    if (!controller.signal.aborted) {
                        if (response.status === 404) {
                            setNotFoundSlug(shopSlug)
                        } else {
                            setLoadError("We could not load this shop right now. Please try again.")
                        }
                    }
                    return
                }

                const data = await response.json()

                if (controller.signal.aborted) {
                    return
                }
                setProfile(data.profile)
                setProfileSlug(shopSlug)
                setListings(data.listings)
            }catch{
                if (!controller.signal.aborted) {
                    setLoadError("We could not load this shop. Please check your connection and try again.")
                }
            }finally{
                if (!controller.signal.aborted) {
                    setIsLoading(false)
                }
            }
        }

        fetchShop()
        return () => controller.abort()
    }, [slug, search, loadAttempt])

    if(notFoundSlug === slug){
        return (
            <div>
                <h1>Store not found</h1>
                <p>We could not find that shop. It may have been renamed or removed.</p>
                <Link to="/">Keep browsing</Link>
            </div>
        )
    }

    if(!profile || profileSlug !== slug){
        if (loadError) {
            return (
                <div>
                    <h1>Shop</h1>
                    <Notice kind="error">
                        <p>{loadError}</p>
                        <button type="button" onClick={() => setLoadAttempt((attempt) => attempt + 1)}>Try again</button>
                    </Notice>
                    <Link to="/">Keep browsing</Link>
                </div>
            )
        }

        return (
            <div>
                <p role="status">Loading...</p>
            </div>
        )
    }

    return (
        <div>
            <button type="button" className="back-link" onClick={handleBackToCategory}>
                <ChevronLeftIcon />
                Back to search
            </button>

            {pendingCartResult && (
                <p role={pendingCartResult.isError ? "alert" : "status"} className={`alert ${pendingCartResult.isError ? "alert-error" : "alert-success"}`}>
                    {pendingCartResult.text}
                    {!pendingCartResult.isError && <>{" "}<Link to="/cart">View cart</Link></>}
                </p>
            )}

            <section aria-labelledby="shop-name" className="card shop-header">
                {profile.logoUrl
                    ? <img className="avatar avatar-lg" src={profile.logoUrl} alt="" />
                    : <span className="avatar avatar-lg avatar-initial" aria-hidden="true">{profile.businessName.charAt(0).toUpperCase()}</span>}
                <div>
                    <h1 id="shop-name">{profile.businessName}</h1>
                    {profile.location && (
                        <p className="shop-location">
                            <MapPinIcon />
                            {profile.location}
                        </p>
                    )}
                </div>
            </section>

            <form role="search" className="search-form" onSubmit={(event) => event.preventDefault()}>
                <label className="search-field">
                    <span className="visually-hidden">Search this shop</span>
                    <SearchIcon />
                    <input
                        type="search"
                        placeholder="Search this shop"
                        value={searchText}
                        onChange={(event) => setSearchText(event.currentTarget.value)}
                    />
                </label>
            </form>

            <section aria-labelledby="shop-products">
                <h2 id="shop-products">Products</h2>
                {loadError && (
                    <Notice kind="error">
                        <p>{loadError}</p>
                        <button type="button" onClick={() => setLoadAttempt((attempt) => attempt + 1)}>Try again</button>
                    </Notice>
                )}
                {isLoading && <p role="status">Loading products...</p>}
                {!isLoading && listings.length === 0 && (
                    <p>{search ? "No products match your search." : "This shop has no products yet."}</p>
                )}
                {!isLoading && listings.length > 0 && (
                    <ul className="product-grid">
                        {listings.map((listing) => (
                            <li key={listing.id}>
                                <ListingCard
                                    isEditable={false}
                                    allowAddToCart
                                    isLoggedOut={authStatus === "unauthenticated"}
                                    listing={listing}
                                    userRole={userRole}
                                />
                            </li>
                        ))}
                    </ul>
                )}
            </section>
        </div>
    )
}

export default ShopPage