import { useEffect, useRef, useState } from "react"
import { Link, useNavigate, useSearchParams } from "react-router-dom"
import { ArrowLeft, ArrowRight, ChevronRight, MapPin, MessagesSquare, PackageCheck, Search, ShieldCheck, X } from "lucide-react"
import ProductTile from "../components/ProductTile"
import StarRating from "../components/StarRating"
import Pagination from "../components/Pagination"
import { CATEGORIES } from "../data/categories"
import CategoryTiles from "../components/CategoryTiles"
import { apiFetch, getErrorMessage } from "../lib/api"
import { becomeSeller } from "../lib/accountApi"
import type { Listing } from "../types/listing"
import type { ShopSummary } from "../types/seller"
import type { UserRole } from "../types/user"
import { useDocumentTitle } from "../lib/useDocumentTitle"

type DiscoveryPageProps = {
  userName?: string
  userRole?: UserRole | null
  onBecameSeller?: () => void
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
const NEW_ON_HOME = 8
const POPULAR = ["Fashion & Clothing", "Food & Grocery", "Beauty & Personal Care"]

function categoryPath(category: string, search?: string): string {
  const query = new URLSearchParams({ category })
  if (search) {
    query.set("search", search)
  }
  return `/?${query.toString()}`
}

// StoreHatch's home and browsing page. One route ("/") with four views, chosen by the URL:
//   1. nothing       -> home: search, a tile for every category, new products, how buying works
//   2. ?view=new     -> every product, newest first
//   3. ?search=...   -> product results across all categories
//   4. ?category=... -> products in that category (optionally searched) and its shops
function DiscoveryPage ({ userName = "", userRole = null, onBecameSeller }: DiscoveryPageProps) {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const categoryParam = searchParams.get("category")
  const selectedCategory = CATEGORIES.find((category) => category === categoryParam) ?? null
  const search = (searchParams.get("search") ?? "").trim()
  const isNewView = searchParams.get("view") === "new" && !selectedCategory && !search
  const pageParam = Number(searchParams.get("page"))
  const page = Number.isInteger(pageParam) && pageParam > 1 ? pageParam : 1
  const [searchText, setSearchText] = useState(search)
  const [heroText, setHeroText] = useState("")
  useDocumentTitle(selectedCategory ?? (search ? "Search results" : isNewView ? "New on StoreHatch" : null))
  const [products, setProducts] = useState<Listing[]>([])
  const [productTotal, setProductTotal] = useState(0)
  const [productPageSize, setProductPageSize] = useState(24)
  const [newProducts, setNewProducts] = useState<Listing[]>([])
  const [newStatus, setNewStatus] = useState<RequestStatus>("idle")
  const [newRetryCount, setNewRetryCount] = useState(0)
  const [shops, setShops] = useState<ShopSummary[]>([])
  const [productRequestStatus, setProductRequestStatus] = useState<RequestStatus>("idle")
  const [shopRequestStatus, setShopRequestStatus] = useState<RequestStatus>("idle")
  const [productRequestError, setProductRequestError] = useState<string | null>(null)
  const [shopRequestError, setShopRequestError] = useState<string | null>(null)
  const [productRetryCount, setProductRetryCount] = useState(0)
  const [shopRetryCount, setShopRetryCount] = useState(0)
  const [consumerLocation, setConsumerLocation] = useState<ConsumerLocation | null>(null)
  const [locationStatus, setLocationStatus] = useState<LocationStatus>("not-requested")
  const [isOpeningShop, setIsOpeningShop] = useState(false)
  const [openShopError, setOpenShopError] = useState("")
  const showProducts = selectedCategory !== null || search !== "" || isNewView
  const isHome = !showProducts
  // Results are tagged with the filters they were fetched for, so results from older filters are
  // never shown as if they matched the current ones (not even for the moment before a new fetch starts).
  const productsQueryKey = JSON.stringify([selectedCategory, search, page, isNewView])
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

  // Opening a category, the new products or going back home starts at the top of the page.
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" })
  }, [selectedCategory, isNewView])

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
        next.delete("page")// a new search starts on the first page
        next.delete("view")
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

  // The newest products for the home page.
  useEffect(() => {
    if (!isHome) {
      return
    }
    const controller = new AbortController()

    async function fetchNew() {
      setNewStatus("loading")
      try {
        const response = await apiFetch("/listings", { signal: controller.signal })
        if (!response.ok) {
          throw new Error(`New products request failed with status ${response.status}`)
        }
        const data: { listings?: Listing[] } = await response.json()
        if (controller.signal.aborted) {
          return
        }
        setNewProducts(Array.isArray(data.listings) ? data.listings.slice(0, NEW_ON_HOME) : [])
        setNewStatus("success")
      } catch {
        if (!controller.signal.aborted) {
          setNewStatus("error")
        }
      }
    }

    fetchNew()
    return () => controller.abort()
  }, [isHome, newRetryCount])

  // Products load for the new, search and category views, one page at a time. The backend decides
  // the order (newest first), so they are shown exactly as received.
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
    if (page > 1) {
      query.set("page", String(page))
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

        const data: { listings?: Listing[], total?: number, pageSize?: number } = await response.json()
        if (controller.signal.aborted) {
          return
        }
        if (!Array.isArray(data.listings)) {
          throw new Error("Unexpected products response")
        }
        setProducts(data.listings)
        setProductTotal(typeof data.total === "number" ? data.total : data.listings.length)
        setProductPageSize(typeof data.pageSize === "number" && data.pageSize > 0 ? data.pageSize : 24)
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
  }, [showProducts, selectedCategory, search, page, productsQueryKey, productRetryCount])

  // The shops endpoint requires a category, so shops load for the category view only.
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

  // Opening a category or going home starts a fresh search.
  function resetSearchAndStatuses() {
    setSearchText("")
    setShops([])
    setShopRequestError(null)
    setShopRequestStatus("idle")
  }

  function goToPage(nextPage: number) {
    setSearchParams((current) => {
      const next = new URLSearchParams(current)
      if (nextPage > 1) {
        next.set("page", String(nextPage))
      } else {
        next.delete("page")
      }
      return next
    }, { preventScrollReset: true })
    document.getElementById("products-heading")?.scrollIntoView()
  }

  // The home page's search goes to the results when the shopper presses Search (typing there would
  // swap the page under them as they type).
  function submitHeroSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmed = heroText.trim()
    if (trimmed) {
      navigate(`/?${new URLSearchParams({ search: trimmed }).toString()}`)
    }
  }

  const firstName = userName.trim().split(/\s+/)[0]

  // A signed-in buyer opens a shop with the same account: it becomes a seller account (which can still
  // shop), then shop setup starts.
  async function openShop() {
    setIsOpeningShop(true)
    setOpenShopError("")
    const outcome = await becomeSeller()
    setIsOpeningShop(false)

    if (outcome.kind === "ok") {
      onBecameSeller?.()
      navigate("/seller/onboarding")
    } else {
      setOpenShopError(outcome.message)
    }
  }

  const allCategories = (heading: string) => (
    <nav className="all-categories" aria-label="All categories">
      <h3>{heading}</h3>
      <ul>
        {CATEGORIES.map((category) => (
          <li key={category}>
            <Link to={categoryPath(category)} onClick={resetSearchAndStatuses}>
              <span>{category}</span>
              <ChevronRight aria-hidden="true" size={16} />
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  )

  const productGrid = (list: Listing[]) => (
    <ul className="browse-grid">
      {list.map((product) => (
        <li key={product.id}><ProductTile listing={product} /></li>
      ))}
    </ul>
  )

  const loadingGrid = (count: number) => (
    <div className="browse-grid" aria-hidden="true">
      {Array.from({ length: count }, (_, index) => <div key={index} className="skeleton browse-skeleton" />)}
    </div>
  )

  // ---- Home ----
  if (isHome) {
    return (
      <div className="browse-page">
        <section className="browse-hero" aria-labelledby="home-heading">
          <div className="browse-hero-inner">
            {firstName && <p className="browse-hello">Hi {firstName}</p>}
            <h1 id="home-heading">What are you shopping for today?</h1>
            <p className="browse-hero-lead">Clothes, food, beauty and more, from shops across Nigeria. Pay through StoreHatch and confirm when it arrives.</p>
            <form role="search" className="browse-search is-hero" onSubmit={submitHeroSearch}>
              <Search aria-hidden="true" size={20} />
              <label className="visually-hidden" htmlFor="home-search">Search products</label>
              <input id="home-search" type="search" placeholder="Search for ankara, cake, phone case..." value={heroText} onChange={(event) => setHeroText(event.currentTarget.value)} />
              <button type="submit">Search</button>
            </form>
            <p className="browse-popular">
              <span>Popular:</span>
              {POPULAR.map((category) => (
                <Link key={category} to={categoryPath(category)} onClick={resetSearchAndStatuses}>{category}</Link>
              ))}
            </p>
          </div>
        </section>

        <section className="browse-section" aria-labelledby="categories-heading">
          <h2 id="categories-heading" className="browse-heading">Shop by category</h2>
          <CategoryTiles onPick={resetSearchAndStatuses} />
        </section>

        <section className="browse-section" aria-labelledby="new-heading">
          <div className="browse-section-head">
            <h2 id="new-heading" className="browse-heading">New on StoreHatch</h2>
            <Link to="/?view=new" className="browse-see-all">See all new products<ArrowRight aria-hidden="true" size={18} /></Link>
          </div>
          {newStatus === "loading" && loadingGrid(4)}
          {newStatus === "error" && (
            <div role="alert" className="alert alert-error">
              <p>We could not load the newest products.</p>
              <button type="button" onClick={() => setNewRetryCount((count) => count + 1)}>Try again</button>
            </div>
          )}
          {newStatus === "success" && newProducts.length === 0 && <p>No products yet. Check back soon.</p>}
          {newStatus === "success" && newProducts.length > 0 && productGrid(newProducts)}
        </section>

        <section className="browse-section" aria-labelledby="safe-heading">
          <h2 id="safe-heading" className="browse-heading">Buying on StoreHatch</h2>
          <ul className="browse-safe">
            <li><ShieldCheck aria-hidden="true" size={26} /><b>Pay through StoreHatch</b>You pay once at checkout, by card, transfer or USSD. Never pay a seller in a chat.</li>
            <li><PackageCheck aria-hidden="true" size={26} /><b>Confirm when it arrives</b>An order only counts as delivered when you say so in My orders.</li>
            <li><MessagesSquare aria-hidden="true" size={26} /><b>Help if something goes wrong</b>Raise a complaint from your order. If it is not settled, StoreHatch decides.</li>
          </ul>
        </section>

        {userRole !== "SELLER" && (
          <section className="browse-section browse-sell" aria-labelledby="sell-heading">
            <div>
              <h2 id="sell-heading">Have something to sell?</h2>
              <p>{userRole === "CONSUMER" ? "Open a shop with this same account, in minutes. No commission on sales." : "Open your own shop on StoreHatch in minutes. No commission on sales."}</p>
            </div>
            {userRole === "CONSUMER"
              ? <button type="button" className="btn btn-lg" onClick={openShop} disabled={isOpeningShop}>{isOpeningShop ? "Opening..." : "Start your shop"}</button>
              : <Link to="/register" className="btn btn-lg">Start your shop</Link>}
            {openShopError && <p role="alert" className="browse-sell-error">{openShopError}</p>}
          </section>
        )}
      </div>
    )
  }

  const productsBlock = (emptyText: string) => (
    <>
      <div aria-live="polite" className="visually-hidden">
        {visibleProductStatus === "loading" && "Loading products..."}
      </div>
      {visibleProductStatus === "loading" && loadingGrid(8)}
      {visibleProductStatus === "error" && (
        <div role="alert" className="alert alert-error">
          <p>{productRequestError}</p>
          <button type="button" onClick={() => setProductRetryCount((count) => count + 1)}>Try again</button>
        </div>
      )}
      {visibleProductStatus === "success" && products.length === 0 && page === 1 && <p>{emptyText}</p>}
      {visibleProductStatus === "success" && products.length > 0 && productGrid(products)}
      {visibleProductStatus === "success" && products.length === 0 && page > 1 && (
        <button type="button" onClick={() => goToPage(1)}>Back to the first page</button>
      )}
      {visibleProductStatus === "success" && (
        <Pagination page={page} pageSize={productPageSize} total={productTotal} onChange={goToPage} />
      )}
    </>
  )

  const searchBox = (label: string, className = "browse-search") => (
    <form role="search" className={className} onSubmit={(event) => event.preventDefault()}>
      <Search aria-hidden="true" size={20} />
      <label className="visually-hidden" htmlFor="browse-search">{label}</label>
      <input id="browse-search" type="search" placeholder={label} value={searchText} onChange={(event) => setSearchText(event.currentTarget.value)} />
      {searchText && (
        <button type="button" className="browse-clear" aria-label="Clear search" onClick={() => setSearchText("")}>
          <X aria-hidden="true" size={20} />
        </button>
      )}
    </form>
  )

  // ---- A category ----
  if (selectedCategory) {
    const productCount = visibleProductStatus === "success" ? productTotal : null
    const shopCount = visibleShopStatus === "success" ? shops.length : null

    return (
      <div className="browse-page">
        <section className="browse-band" aria-labelledby="category-heading">
          <div className="browse-band-inner">
            <Link to="/" className="back-link" onClick={resetSearchAndStatuses}><ArrowLeft aria-hidden="true" size={18} />All categories</Link>
            <h1 id="category-heading">{selectedCategory}</h1>
            {productCount !== null && !search && (
              <p>
                {productCount} {productCount === 1 ? "product" : "products"}
                {shopCount !== null && shopCount > 0 ? ` from ${shopCount} ${shopCount === 1 ? "shop" : "shops"}` : ""}
              </p>
            )}
            {searchBox(`Search in ${selectedCategory}`)}
          </div>
        </section>

        <section className="browse-section is-tight" aria-labelledby="shops-heading">
          <div className="browse-section-head">
            <h2 id="shops-heading" className="browse-heading">Shops</h2>
            <button
              type="button"
              className={consumerLocation ? "browse-chip is-on" : "browse-chip"}
              aria-pressed={consumerLocation !== null}
              onClick={requestLocation}
              disabled={locationStatus === "requesting" || locationStatus === "refreshing"}
            >
              <MapPin aria-hidden="true" size={18} />
              {locationStatus === "requesting" ? "Finding you..." : locationStatus === "refreshing" ? "Updating..." : consumerLocation ? "Nearest first" : "Show shops near me"}
            </button>
          </div>
          <div aria-live="polite">
            {locationStatus === "unavailable" && <p className="browse-note">We could not get your location. Shops are shown without it.</p>}
            {locationStatus === "refresh-error" && <p className="browse-note">We could not update your location, so the last one is used.</p>}
          </div>
          {visibleShopStatus === "loading" && (
            <div className="browse-shops" aria-hidden="true">
              <div className="skeleton browse-shop-skeleton" /><div className="skeleton browse-shop-skeleton" /><div className="skeleton browse-shop-skeleton" />
            </div>
          )}
          {visibleShopStatus === "error" && (
            <div role="alert" className="alert alert-error">
              <p>{shopRequestError}</p>
              <button type="button" onClick={() => setShopRetryCount((count) => count + 1)}>Try again</button>
            </div>
          )}
          {visibleShopStatus === "success" && shops.length === 0 && <p>No shops found in this category yet.</p>}
          {visibleShopStatus === "success" && shops.length > 0 && (
            <ul className="browse-shops">
              {shops.map((shop) => {
                const place = shop.location || [shop.lga, shop.state].filter(Boolean).join(", ")
                const delivered = shop.trust?.confirmedDeliveries ?? 0
                const colour = shop.branding?.brandColor ?? null
                const banner = shop.branding?.bannerUrl ?? null
                return (
                  <li key={shop.id}>
                    <Link className="browse-shop" to={`/shop/${encodeURIComponent(shop.slug)}?${searchParams.toString()}`}>
                      {/* A strip of the shop's banner across the top, or its colour without one. */}
                      <span className="browse-shop-strip" style={colour ? { background: colour.background } : undefined} aria-hidden="true">
                        {banner && <img src={banner} alt="" loading="lazy" />}
                      </span>
                      <span className="browse-shop-body">
                        {shop.logoUrl
                          ? <img className="browse-shop-logo" src={shop.logoUrl} alt="" />
                          : <span className="browse-shop-logo is-initial" style={colour ? { background: colour.background, color: colour.text } : undefined} aria-hidden="true">{shop.businessName.charAt(0).toUpperCase()}</span>}
                        <b className="browse-shop-name">{shop.businessName}</b>
                        <span className="browse-shop-text">
                          {place && <span>{place}</span>}
                          <StarRating average={shop.ratingAverage} count={shop.ratingCount} showEmpty />
                          {shop.trust && (
                            <span className={delivered > 0 ? "is-good" : undefined}>
                              {delivered > 0 ? `${delivered.toLocaleString("en-NG")} ${delivered === 1 ? "order" : "orders"} delivered` : "New shop"}
                              {shop.trust.payoutVerified ? " · Payout verified" : ""}
                            </span>
                          )}
                        </span>
                      </span>
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        <section className="browse-section is-tight" aria-labelledby="products-heading">
          <div className="browse-section-head">
            <h2 id="products-heading" className="browse-heading">{search ? `Products matching "${search}"` : "Products"}</h2>
            <span className="browse-muted">Newest first</span>
          </div>
          {productsBlock(search ? "No products in this category match your search." : "No products in this category yet.")}
        </section>
      </div>
    )
  }

  // ---- Every product, newest first ----
  if (isNewView) {
    return (
      <div className="browse-page">
        <div className="browse-top">
          <Link to="/" className="back-link"><ArrowLeft aria-hidden="true" size={18} />Home</Link>
          <h1 id="products-heading">New on StoreHatch</h1>
          <p className="browse-muted">The newest products from every shop{visibleProductStatus === "success" ? `, ${productTotal} in all` : ""}.</p>
        </div>
        {productsBlock("No products yet. Check back soon.")}
      </div>
    )
  }

  // ---- Search results ----
  const noResults = visibleProductStatus === "success" && productTotal === 0

  return (
    <div className="browse-page">
      <div className="browse-top">
        {searchBox("Search products", "browse-search is-wide")}
        {!noResults && (
          <>
            <h1 id="products-heading">Results for "{search}"</h1>
            {visibleProductStatus === "success" && <p className="browse-muted">{productTotal} {productTotal === 1 ? "product" : "products"}</p>}
            <nav className="browse-chips" aria-label="Narrow by category">
              <span className="browse-chip is-on" aria-current="true">All categories</span>
              {CATEGORIES.map((category) => (
                <Link key={category} className="browse-chip" to={categoryPath(category, search)}>{category}</Link>
              ))}
            </nav>
          </>
        )}
      </div>

      {noResults ? (
        <section className="browse-empty" aria-labelledby="products-heading">
          <span className="browse-empty-icon" aria-hidden="true"><Search size={30} /></span>
          <h1 id="products-heading">Nothing found for "{search}"</h1>
          <p>Try fewer or different words, check the spelling, or look through a category below.</p>
          {allCategories("Look through a category")}
        </section>
      ) : productsBlock("No products match your search.")}
    </div>
  )
}

export default DiscoveryPage
