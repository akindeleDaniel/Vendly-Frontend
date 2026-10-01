import { useEffect, useState } from "react"
import { Link, useSearchParams } from "react-router-dom"
import ListingCard from "../components/ListingCard"
import { CATEGORIES } from "../data/categories"

export type Listing = {
id: number;
title: string;
description: string;
price: number;
category: string;
imageUrl: string;
createdAt: string;// date is a string because when coming from express or json, it comes as a string(stringify)
sellerSlug?: string | null;
sellerName?: string | null;
};

export type FormData = {
  title: string
  description: string
  price: string
  category: string
}

type ShopSummary = {
  id: number | string
  businessName: string
  state?: string | null
  lga?: string | null
  location?: string | null
  logoUrl?: string | null
  slug: string
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

function DiscoveryPage () {
  const [searchParams, setSearchParams] = useSearchParams()
  const categoryParam = searchParams.get("category")
  const selectedCategory = CATEGORIES.find((category) => category === categoryParam) ?? null
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
  const [categorySearch, setCategorySearch] = useState("")
  const [searchText, setSearchText] = useState("")
  const search = searchText.trim()
  const filteredCategories = CATEGORIES.filter((category) =>
    category.toLowerCase().includes(categorySearch.trim().toLowerCase())
  )

  useEffect(() => {
    if (!selectedCategory || !search) {
      return
    }

    const controller = new AbortController()
    const query = new URLSearchParams({ category: selectedCategory })
    if (search) {
      query.set("search", search)
    }

    async function fetchProducts() {
      setProductRequestStatus("loading")
      setProductRequestError(null)
      setProducts([])

      try {
        const response = await fetch(`http://localhost:3000/listings?${query.toString()}`, {
          signal: controller.signal
        })

        if (!response.ok) {
          throw new Error(`Product request failed with status ${response.status}`)
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
  }, [selectedCategory, search, productRetryCount])

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
      setShopRequestStatus("loading")
      setShopRequestError(null)
      setShops([])

      try {
        const response = await fetch(`http://localhost:3000/seller/shops?${query.toString()}`, {
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
  }, [selectedCategory, search, consumerLocation, shopRetryCount])

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

  function handleCategoryChange(value: string) {
    const category = CATEGORIES.find((candidate) => candidate === value)
    const nextSearchParams = new URLSearchParams()
    if (category) {
      nextSearchParams.set("category", category)
    }
    setSearchParams(nextSearchParams, { preventScrollReset: true })
    setSearchText("")
    setShops([])
    setProducts([])
    setShopRequestError(null)
    setProductRequestError(null)
    setShopRequestStatus("idle")
    setProductRequestStatus("idle")
  }

  function handleSearchChange(value: string) {
    setSearchText(value)

    if (!value.trim()) {
      setProducts([])
      setProductRequestError(null)
      setProductRequestStatus("idle")
    }
  }

  return (
    <div>
      <h1>Vendly</h1>

      {!selectedCategory ? (
        <section>
          <label>
            Search categories
            <input
              type="search"
              value={categorySearch}
              onChange={(event) => setCategorySearch(event.currentTarget.value)}
            />
          </label>
          <ul>
            {filteredCategories.map((category) => (
              <li key={category}>
                <button type="button" onClick={() => handleCategoryChange(category)}>
                  {category}
                </button>
              </li>
            ))}
          </ul>
          {filteredCategories.length === 0 && <p>No matching categories.</p>}
        </section>
      ) : (
        <section>
          <h2>{selectedCategory}</h2>
          <button
            type="button"
            onClick={() => handleCategoryChange("")}
          >
            Back to Home
          </button>
          <section aria-live="polite">
            {locationStatus === "not-requested" && (
              <>
                <p>Use your location to prioritize nearby shops. Location is optional.</p>
                <button type="button" onClick={requestLocation}>Use my location</button>
              </>
            )}
            {(locationStatus === "requesting" || locationStatus === "refreshing") && (
              <p>{locationStatus === "requesting" ? "Getting your location..." : "Refreshing your location..."}</p>
            )}
            {locationStatus === "available" && (
              <>
                <p>Nearby shops are prioritized. All matching shops remain available.</p>
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
          </section>
          <label>
            Search this category
            <input
              type="search"
              value={searchText}
              onChange={(event) => handleSearchChange(event.currentTarget.value)}
            />
          </label>
          {search && (
            <section>
              <h3>Products</h3>
              {productRequestStatus === "loading" && <p>Loading products...</p>}
              {productRequestStatus === "error" && (
                <div role="alert">
                  <p>{productRequestError}</p>
                  <button type="button" onClick={() => setProductRetryCount((count) => count + 1)}>
                    Retry products
                  </button>
                </div>
              )}
              {productRequestStatus === "success" && products.length === 0 && (
                <p>No products found in this category.</p>
              )}
              {productRequestStatus === "success" && products.length > 0 && (
                <ul>
                  {products.map((product) => (
                    <li key={product.id}>
                      <ListingCard listing={product} isEditable={false} />
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}
          <section>
            <h3>Shops</h3>
            {shopRequestStatus === "loading" && <p>Loading shops...</p>}
            {shopRequestStatus === "error" && (
              <div role="alert">
                <p>{shopRequestError}</p>
                <button type="button" onClick={() => setShopRetryCount((count) => count + 1)}>
                  Retry shops
                </button>
              </div>
            )}
            {shopRequestStatus === "success" && shops.length === 0 && (
              <p>No shops found in this category.</p>
            )}
            {shopRequestStatus === "success" && shops.length > 0 && (
              <ul>
                {shops.map((shop) => (
                  <li key={shop.id}>
                    <Link to={`/shop/${shop.slug}?${searchParams.toString()}`}>
                      {shop.logoUrl && <img src={shop.logoUrl} alt="" width="48" />}
                      <span>{shop.businessName}</span>
                      <span>
                        {shop.location || [shop.lga, shop.state].filter(Boolean).join(", ")}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </section>
      )}
    </div>
  )
}


export default DiscoveryPage