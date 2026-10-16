import { useEffect, useRef, useState } from "react"
import { Link, useSearchParams } from "react-router-dom"
import ListingCard from "../components/ListingCard"
import { ChevronLeftIcon, ChevronRightIcon, SearchIcon } from "../components/Icons"
import { CATEGORIES } from "../data/categories"
import { apiFetch, getErrorMessage } from "../lib/api"
import type { Listing } from "../types/listing"
import type { ShopSummary } from "../types/seller"
import type { UserRole } from "../types/user"
import { useDocumentTitle } from "../lib/useDocumentTitle"

type DiscoveryPageProps = {
  userRole: UserRole | null
}

type ConsumerLocation = {
  latitude: number
  longitude: number
}

type LocationStatus =
  | "not-requested"
  | "requesting"
  | "available"
  | "unavailable"
  | "refreshing"
  | "refresh-error"

type RequestStatus = "idle" | "loading" | "error" | "success"

const SEARCH_DEBOUNCE_MS = 300

// Tile colours, in category order. Neighbouring tiles never share a tint at 2, 3 or 6 columns.
const TILE_TINTS = [
  "forest", "sand", "amber", "sage", "clay", "stone",
  "sand", "forest", "sage", "amber", "stone", "clay",
  "forest", "amber", "sand", "stone", "sage", "forest"
] as const

// Skeleton of the marketplace "search" page. One route ("/") with three views, chosen by the URL:
//   1. no category, no search  -> a grid of category tiles
//   2. a search, no category   -> product results across all categories
//   3. a category              -> products in that category (optionally searched) and its shops
function DiscoveryPage ({ userRole }: DiscoveryPageProps) {
  const [searchParams, setSearchParams] = useSearchParams()
  const categoryParam = searchParams.get("category")
  const selectedCategory = CATEGORIES.find((category) => category === categoryParam) ?? null
  const search = (searchParams.get("search") ?? "").trim()
  const [searchText, setSearchText] = useState(search)
  useDocumentTitle(selectedCategory ?? (search ? "Search results" : null))
  const [products, setProducts] = useState<Listing[]>([])
  const [shops, setShops] = useState<ShopSummary[]>([])
  const [productRequestStatus, setProductRequestStatus] = useState<RequestStatus>("idle")
  const [shopRequestStatus, setShopRequestStatus] = useState<RequestStatus>("idle")
  const [productRequestError, setProductRequestError] = useState<string | null>(null)
  const [shopRequestError, setShopRequestError] = useState<string | null>(null)
  const [productRetryCount, setProductRetryCount] = useState(0)
  const [shopRetryCount, setShopRetryCount] = useState(0)
  const [consumerLocation, setConsumerLocation] = useState<ConsumerLocation | null>(null)
  const [locationStatus, setLocationStatus] = useState<LocationStatus>("not-requested")
  const showProducts = selectedCategory !== null || search !== ""
  // Results are tagged with the filters they were fetched for, so results from older filters are
  // never shown as if they matched the current ones (not even for the moment before a new fetch starts).
  const productsQueryKey = JSON.stringify([selectedCategory, search])
  const shopsQueryKey = JSON.stringify([selectedCategory, search, consumerLocation])
  const [productsKey, setProductsKey] = useState("")
  const [shopsKey, setShopsKey] = useState("")
  const visibleProductStatus: RequestStatus = productsKey === productsQueryKey ? productRequestStatus : "loading"
  const visibleShopStatus: RequestStatus = shopsKey === shopsQueryKey ? shopRequestStatus : "loading"
  const setSearchParamsRef = useRef(setSearchParams)
  const lastWrittenSearchRef = useRef(search)// the search value this page last put into the URL itself

  useEffect(() => {
    setSearchParamsRef.current = setSearchParams
  }, [setSearchParams])

  // The typed search is copied into the URL shortly after the shopper stops typing, so each
  // keystroke does not trigger a request and the search survives a visit to a shop and back.
  // This effect depends only on the typed text: the URL setter changes on every navigation, and
  // re-running on those would overwrite the URL after the browser's Back button.
  useEffect(() => {
    const trimmed = searchText.trim()
    const timer = window.setTimeout(() => {
      setSearchParamsRef.current((current) => {
        if ((current.get("search") ?? "") === trimmed) {
          return current
        }
        lastWrittenSearchRef.current = trimmed
        const next = new URLSearchParams(current)
        if (trimmed) {
          next.set("search", trimmed)
        } else {
          next.delete("search")
        }
        return next
      }, { replace: true, preventScrollReset: true })
    }, SEARCH_DEBOUNCE_MS)

    return () => window.clearTimeout(timer)
  }, [searchText])

  // When the URL's search changes for a reason other than this page's own typing (the browser's
  // Back or Forward buttons, a link), the search box follows it.
  useEffect(() => {
    if (search !== lastWrittenSearchRef.current) {
      lastWrittenSearchRef.current = search
      setSearchText(search)
    }
  }, [search])

  // Products load for views 2 and 3 only. The backend decides the order (it shuffles the
  // results), so they are shown exactly as received.
  useEffect(() => {
    if (!showProducts) {
      return
    }

    const controller = new AbortController()
    const query = new URLSearchParams()
    if (selectedCategory) {
      query.set("category", selectedCategory)
    }
    if (search) {
      query.set("search", search)
    }

    async function fetchProducts() {
      setProductsKey(productsQueryKey)
      setProductRequestStatus("loading")
      setProductRequestError(null)
      setProducts([])// never leave results from an older search on screen

      try {
        const response = await apiFetch(`/listings?${query.toString()}`, {
          signal: controller.signal
        })

        if (!response.ok) {
          const message = await getErrorMessage(response, "Unable to load products. Please try again.")
          if (!controller.signal.aborted) {
            setProductRequestError(message)
            setProductRequestStatus("error")
          }
          return
        }

        const data: Listing[] = await response.json()
        if (controller.signal.aborted) {
          return
        }
        setProducts(data)
        setProductRequestStatus("success")
      } catch {
        if (controller.signal.aborted) {
          return
        }
        setProductRequestError("Unable to load products. Check your connection and try again.")
        setProductRequestStatus("error")
      }
    }

    fetchProducts()

    return () => controller.abort()
  }, [showProducts, selectedCategory, search, productsQueryKey, productRetryCount])

  // The shops endpoint requires a category, so shops load for view 3 only.
  // Location ordering is done by the backend; the list is shown as received.
  useEffect(() => {
    if (!selectedCategory) {
      return
    }

    const controller = new AbortController()
    const query = new URLSearchParams({ category: selectedCategory })
    if (search) {
      query.set("search", search)
    }
    if (consumerLocation) {
      query.set("latitude", String(consumerLocation.latitude))
      query.set("longitude", String(consumerLocation.longitude))
    }

    async function fetchShops() {
      setShopsKey(shopsQueryKey)
      setShopRequestStatus("loading")
      setShopRequestError(null)
      setShops([])

      try {
        const response = await apiFetch(`/seller/shops?${query.toString()}`, {
          signal: controller.signal
        })

        if (!response.ok) {
          throw new Error(`Shop request failed with status ${response.status}`)
        }

        const data: ShopSummary[] = await response.json()
        if (controller.signal.aborted) {
          return
        }
        setShops(data)
        setShopRequestStatus("success")
      } catch {
        if (controller.signal.aborted) {
          return
        }
        setShopRequestError("Unable to load shops. Check your connection and try again.")
        setShopRequestStatus("error")
      }
    }

    fetchShops()

    return () => controller.abort()
  }, [selectedCategory, search, consumerLocation, shopsQueryKey, shopRetryCount])

  function requestLocation() {
    if (!navigator.geolocation) {
      setLocationStatus(consumerLocation ? "refresh-error" : "unavailable")
      return
    }

    const isRefresh = consumerLocation !== null
    setLocationStatus(isRefresh ? "refreshing" : "requesting")

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setConsumerLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude
        })
        setLocationStatus("available")
      },
      () => {
        setLocationStatus(isRefresh ? "refresh-error" : "unavailable")
      }
    )
  }

  // Opening a category starts a fresh search inside it; going back returns to the tile grid.
  function resetSearchAndStatuses() {
    setSearchText("")
    setShops([])
    setShopRequestError(null)
    setShopRequestStatus("idle")
  }

  const searchLabel = selectedCategory ? `Search in ${selectedCategory}` : "Search products"

  return (
    <div>
      {selectedCategory && (
        <Link to="/" className="back-link" onClick={resetSearchAndStatuses}>
          <ChevronLeftIcon />
          All categories
        </Link>
      )}

      <h1>{selectedCategory ?? (search ? "Search results" : "What are you looking for?")}</h1>

      <form role="search" className="search-form" onSubmit={(event) => event.preventDefault()}>
        <label className="search-field">
          <span className="visually-hidden">{searchLabel}</span>
          <SearchIcon />
          <input
            type="search"
            placeholder={searchLabel}
            value={searchText}
            onChange={(event) => setSearchText(event.currentTarget.value)}
          />
        </label>
      </form>

      {/* View 1: category tiles */}
      {!showProducts && (
        <section aria-labelledby="categories-heading">
          <h2 id="categories-heading">Browse all</h2>
          <ul className="tile-grid">
            {CATEGORIES.map((category, index) => (
              <li key={category}>
                <Link
                  className={`tile tile-${TILE_TINTS[index % TILE_TINTS.length]}`}
                  to={`/?${new URLSearchParams({ category }).toString()}`}
                  onClick={resetSearchAndStatuses}
                >
                  <span>{category}</span>
                  <ChevronRightIcon />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Views 2 and 3: products */}
      {showProducts && (
        <section aria-labelledby="products-heading">
          <h2 id="products-heading">Products</h2>
          <div aria-live="polite">
            {visibleProductStatus === "loading" && <p>Loading products...</p>}
          </div>
          {visibleProductStatus === "error" && (
            <div role="alert" className="alert alert-error">
              <p>{productRequestError}</p>
              <button type="button" onClick={() => setProductRetryCount((count) => count + 1)}>
                Retry products
              </button>
            </div>
          )}
          {visibleProductStatus === "success" && products.length === 0 && (
            <p>{search ? "No products match your search." : "No products in this category yet."}</p>
          )}
          {visibleProductStatus === "success" && products.length > 0 && (
            <ul className="product-grid">
              {products.map((product) => (
                <li key={product.id}>
                  <ListingCard listing={product} isEditable={false} userRole={userRole} shopLinkSearch={searchParams.toString()} />
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {/* View 3: shops */}
      {selectedCategory && (
        <section aria-labelledby="shops-heading">
          <h2 id="shops-heading">Shops that sell {selectedCategory}</h2>
          <div className="card location-panel" aria-live="polite">
            {locationStatus === "not-requested" && (
              <>
                <p>Use your location to see nearby shops first. This is optional.</p>
                <button type="button" onClick={requestLocation}>Use my location</button>
              </>
            )}
            {(locationStatus === "requesting" || locationStatus === "refreshing") && (
              <p>{locationStatus === "requesting" ? "Getting your location..." : "Refreshing your location..."}</p>
            )}
            {locationStatus === "available" && (
              <>
                <p>Nearby shops are shown first. All matching shops remain available.</p>
                <button type="button" onClick={requestLocation}>Refresh location</button>
              </>
            )}
            {locationStatus === "unavailable" && (
              <>
                <p>Location could not be obtained. You can continue browsing shops without it.</p>
                <button type="button" onClick={requestLocation}>Use my location</button>
              </>
            )}
            {locationStatus === "refresh-error" && (
              <>
                <p>Location refresh failed. Continuing with your previously provided location.</p>
                <button type="button" onClick={requestLocation}>Refresh location</button>
              </>
            )}
          </div>
          {visibleShopStatus === "loading" && <p>Loading shops...</p>}
          {visibleShopStatus === "error" && (
            <div role="alert" className="alert alert-error">
              <p>{shopRequestError}</p>
              <button type="button" onClick={() => setShopRetryCount((count) => count + 1)}>
                Retry shops
              </button>
            </div>
          )}
          {visibleShopStatus === "success" && shops.length === 0 && (
            <p>No shops found in this category.</p>
          )}
          {visibleShopStatus === "success" && shops.length > 0 && (
            <ul className="shop-list">
              {shops.map((shop) => (
                <li key={shop.id}>
                  <Link className="shop-row" to={`/shop/${encodeURIComponent(shop.slug)}?${searchParams.toString()}`}>
                    {shop.logoUrl
                      ? <img className="avatar" src={shop.logoUrl} alt="" />
                      : <span className="avatar avatar-initial" aria-hidden="true">{shop.businessName.charAt(0).toUpperCase()}</span>}
                    <span className="shop-row-text">
                      <span className="shop-row-name">{shop.businessName}</span>
                      <span className="shop-row-meta">
                        {shop.location || [shop.lga, shop.state].filter(Boolean).join(", ")}
                      </span>
                    </span>
                    <ChevronRightIcon />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  )
}

export default DiscoveryPage
