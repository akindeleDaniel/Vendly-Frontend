import { useEffect, useState } from "react"
import { Link, useSearchParams } from "react-router-dom"
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

function DiscoveryPage () {
  const [searchParams, setSearchParams] = useSearchParams()
  const categoryParam = searchParams.get("category")
  const selectedCategory = CATEGORIES.find((category) => category === categoryParam) ?? null
  const [shops, setShops] = useState<ShopSummary[]>([])
  const [requestStatus, setRequestStatus] = useState<"idle" | "loading" | "error" | "success">("idle")
  const [requestError, setRequestError] = useState<string | null>(null)
  const [retryCount, setRetryCount] = useState(0)
  const [consumerLocation, setConsumerLocation] = useState<ConsumerLocation | null>(null)
  const [locationStatus, setLocationStatus] = useState<LocationStatus>("not-requested")
  const [categorySearch, setCategorySearch] = useState("")
  const filteredCategories = CATEGORIES.filter((category) =>
    category.toLowerCase().includes(categorySearch.trim().toLowerCase())
  )

  useEffect(() => {
    if (!selectedCategory) {
      return
    }

    const controller = new AbortController()
    const query = new URLSearchParams({ category: selectedCategory })

    if (consumerLocation) {
      query.set("latitude", String(consumerLocation.latitude))
      query.set("longitude", String(consumerLocation.longitude))
    }

    async function fetchShops() {
      setRequestStatus("loading")
      setRequestError(null)
      setShops([])

      try {
        const response = await fetch(`http://localhost:3000/seller/shops?${query.toString()}`, {
          signal: controller.signal
        })

        if (!response.ok) {
          throw new Error(`Shop request failed with status ${response.status}`)
        }

        const data: ShopSummary[] = await response.json()
        setShops(data)
        setRequestStatus("success")
      } catch {
        if (controller.signal.aborted) {
          return
        }
        setRequestError("Unable to load shops. Check your connection and try again.")
        setRequestStatus("error")
      }
    }

    fetchShops()

    return () => controller.abort()
  }, [selectedCategory, consumerLocation, retryCount])

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
    setShops([])
    setRequestError(null)
    setRequestStatus("idle")
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
            Back to categories
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
          {requestStatus === "loading" && <p>Loading shops...</p>}
          {requestStatus === "error" && (
            <div role="alert">
              <p>{requestError}</p>
              <button type="button" onClick={() => setRetryCount((count) => count + 1)}>
                Retry
              </button>
            </div>
          )}
          {requestStatus === "success" && shops.length === 0 && (
            <p>No shops found in this category.</p>
          )}
          {requestStatus === "success" && shops.length > 0 && (
            <ul>
              {shops.map((shop) => (
                <li key={shop.id}>
                  <Link to={`/shop/${shop.slug}`}>
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
      )}
    </div>
  )
}


export default DiscoveryPage