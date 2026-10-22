import { useState, useEffect } from "react"
import { Link, useNavigate } from "react-router-dom"
import type {ListingFormData, Listing} from "../types/listing"
import ListingCard from "../components/ListingCard"
import CreateListingForm, { type CreateListingFormData } from "../components/CreateListingForm"
import { photosChanged, savedPhotos, uploadListingPhotos, type ListingPhoto } from "../lib/listingPhotos"
import { apiFetch, getErrorMessage } from "../lib/api"
import { apiRequest, failureMessage } from "../lib/apiRequest"
import { validateListingFields } from "../lib/limits"
import { useDocumentTitle } from "../lib/useDocumentTitle"
import Notice from "../components/Notice"
import Greeting from "../components/Greeting"
import SellerStandingNotice from "../components/SellerStandingNotice"

function MyListingsPage({ userName = "" }: { userName?: string }) {
    const navigate = useNavigate()
    useDocumentTitle("My store")

    const [listings, setListings] = useState<Listing[]>([])
    const [storeLogoUrl, setStoreLogoUrl] = useState<string>("")
    const [storeName, setStoreName] = useState<string>("")
    const [storeSlug, setStoreSlug] = useState<string>("")
    const [photos, setPhotos] = useState<ListingPhoto[]>([])
    const [editPhotos, setEditPhotos] = useState<ListingPhoto[]>([])
    const [formKey, setFormKey] = useState(0)
    const [linkCopied, setLinkCopied] = useState(false)
    const [loadError, setLoadError] = useState<string | null>(null)
    const [isCreating, setIsCreating] = useState(false)
    const [createError, setCreateError] = useState("")
    const [deleteError, setDeleteError] = useState("")
    const [isSaving, setIsSaving] = useState(false)
    const [saveError, setSaveError] = useState("")
    const [loadAttempt, setLoadAttempt] = useState(0)
    const [view, setView] = useState<"on-sale" | "archived">("on-sale")
    const [archivePrompt, setArchivePrompt] = useState<{ id: number, title: string } | null>(null)
    const [isArchiving, setIsArchiving] = useState(false)
    
    const [formData, setFormData] =useState<CreateListingFormData>({
    title: "",
    description: "",
    price: "",
    category: "",
    stockQuantity: ""
  })

  const [editingId, setEditingId] = useState<number | null>(null)
  const [editFormData, setEditFormData] = useState<ListingFormData>({
    title: "",
    description: "",
    price: "",
    category: "",
    stockQuantity: ""
  })

  const handleCopyShopLink = async () => {
      if (!storeSlug) return

      const shopUrl = `${window.location.origin}/shop/${storeSlug}`

      try {
          await navigator.clipboard.writeText(shopUrl)

          setLinkCopied(true)

          setTimeout(() => {
              setLinkCopied(false)
          }, 2000)
      } catch {
          // Keep the UI unchanged if copying fails.
      }
  }

  async function handleSubmit(e: React.SubmitEvent<HTMLFormElement>)//this function is because whenever we click the submit button it reloads the page
   {
    e.preventDefault();

    if (isCreating) {
      return
    }

    if(formData.title === "" || formData.category === "" || formData.price === "" || formData.stockQuantity === "" || formData.description === ""){
      setCreateError("Please fill in every field.")
      return
    }
    if (photos.length === 0) {
      setCreateError("Please choose at least one photo.")
      return
    }
    const createProblem = validateListingFields(formData)
    if (createProblem) {
      setCreateError(createProblem)
      return
    }

    setIsCreating(true)
    setCreateError("")

    try{
      const imageUrls = await uploadListingPhotos(photos)
      if (imageUrls === null) {
        setCreateError("A photo could not be uploaded. Please check your connection and try again.")
        return
      }

      const response = await apiFetch("/listings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...formData,
          price: Number(formData.price),
          stockQuantity: Number(formData.stockQuantity),
          imageUrls
        }),
        credentials:"include"
      })

      if(!response.ok){
        setCreateError(await getErrorMessage(response, `Unable to create this listing (status ${response.status}).`))
        return
      }

      const createdListing: Listing = await response.json()
      setListings((currentListings) => [...currentListings, createdListing]);
      setFormData({ title: "", description: "", price: "", category: "", stockQuantity: "" })
      setPhotos([])
      setFormKey(formKey + 1)// starts the form (and its photo picker) afresh
    }catch {
      setCreateError("Something went wrong. Please check your connection and try again.")
    }finally{
      setIsCreating(false)
    }
  }

  async function handleDelete(id: number){
    const listing = listings.find((candidate) => candidate.id === id)
    if (!window.confirm(`Delete "${listing?.title ?? "this listing"}"? This cannot be undone.`)) {
      return
    }

    setDeleteError("")

    try{
      const response = await apiFetch(`/listings/${id}`,{
        method: "DELETE",
        credentials:"include"
      })

      if(!response.ok){
        const body: unknown = await response.json().catch(() => null)

        // A listing that has been ordered, or is in someone's cart, cannot be deleted. It can be taken
        // off sale instead, which leaves paid orders alone.
        if (response.status === 409 && typeof body === "object" && body !== null && "code" in body && body.code === "LISTING_HAS_HISTORY") {
          setArchivePrompt({ id, title: listing?.title ?? "this listing" })
          return
        }

        setDeleteError(
          typeof body === "object" && body !== null && "message" in body && typeof body.message === "string" && body.message
            ? body.message
            : `Unable to delete this listing (status ${response.status}).`
        )
        return
      }

      setListings((currentListings) => currentListings.filter((candidate) => candidate.id !== id))
    }catch{
      setDeleteError("Something went wrong. Please check your connection and try again.")
    }
  }

  // Takes a listing off sale: it is hidden from shoppers and removed from every cart, and paid orders are not touched.
  async function handleArchive() {
    if (archivePrompt === null || isArchiving) {
      return
    }

    setIsArchiving(true)
    const result = await apiRequest<{ listing: Listing }>(`/listings/${archivePrompt.id}/archive`, { method: "POST", body: {} })
    setIsArchiving(false)

    if (result.kind === "ok") {
      setListings((current) => current.map((candidate) => candidate.id === archivePrompt.id ? result.data.listing : candidate))
      setArchivePrompt(null)
      setDeleteError("")
    } else if (result.kind !== "unauthorized") {
      setDeleteError(failureMessage(result))
      setArchivePrompt(null)
    }
  }

  async function handleRestore(id: number) {
    setDeleteError("")
    const result = await apiRequest<{ listing: Listing }>(`/listings/${id}/unarchive`, { method: "POST", body: {} })

    if (result.kind === "ok") {
      setListings((current) => current.map((candidate) => candidate.id === id ? result.data.listing : candidate))
    } else if (result.kind !== "unauthorized") {
      setDeleteError(failureMessage(result))
    }
  }

    function handleEditClick(listing: Listing){
    setEditingId(listing.id)
    setEditPhotos(savedPhotos(listing))
    setSaveError("")
    setEditFormData({
      title: listing.title,
      description: listing.description,
      price: String(listing.price),
      category: listing.category,
      stockQuantity: String(listing.stockQuantity)
    })
  }

  // The Save button stays disabled until the edit form, or its photos, differ from the saved listing.
  function hasListingChanges(listing: Listing) {
    return (
      photosChanged(listing, editPhotos) ||
      editFormData.title !== listing.title ||
      editFormData.description !== listing.description ||
      editFormData.category !== listing.category ||
      Number(editFormData.price) !== listing.price ||
      Number(editFormData.stockQuantity) !== listing.stockQuantity
    )
  }

   async function handleSave(id: number) {
    if (isSaving) {
      return
    }

    if(editFormData.title === "" || editFormData.category === "" || editFormData.price === "" || editFormData.stockQuantity === "" || editFormData.description === ""){
      setSaveError("This cannot be blank")
      return
    }

    const saveProblem = validateListingFields(editFormData)
    if (saveProblem) {
      setSaveError(saveProblem)
      return
    }

    setIsSaving(true)
    setSaveError("")

    try{
      // Photos are only sent when they changed; a save without them leaves the photos alone.
      let imageUrls: string[] | undefined = undefined
      const savedListing = listings.find((candidate) => candidate.id === id)

      if (savedListing && photosChanged(savedListing, editPhotos)) {
        if (editPhotos.length === 0) {
          setSaveError("A listing needs at least one photo.")
          return
        }

        const uploadedUrls = await uploadListingPhotos(editPhotos)
        if (uploadedUrls === null) {
          setSaveError("A photo could not be uploaded. Please check your connection and try again.")
          return
        }
        imageUrls = uploadedUrls
      }

      const response = await apiFetch(`/listings/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...editFormData,
          price: Number(editFormData.price),
          stockQuantity: Number(editFormData.stockQuantity),
          imageUrls
        }),
        credentials:"include"
      })

      if(!response.ok){
        // Shows the backend's own message, for example the reserved-stock conflict returned with HTTP 409.
        setSaveError(await getErrorMessage(response, `Unable to save this listing (status ${response.status}).`))
        return
      }

      const updatedListing: Listing = await response.json()

      // The saved listing becomes the new baseline for the dirty-state check.
      setListings((currentListings) =>
        currentListings.map((listing) =>
          listing.id === id ? updatedListing : listing
        )
      );
      setEditingId(null);
      setEditPhotos([])
    }catch {
      setSaveError("Something went wrong. Please check your connection and try again.")
    }finally{
      setIsSaving(false)
    }
  }

    function handleCancel() {
      setSaveError("")
      setEditingId(null);
      setEditPhotos([])
    }

    useEffect(() => {
        const controller = new AbortController()

        async function loadStore() {
            setLoadError(null)

            try {
                const [profileResponse, listingsResponse] = await Promise.all([
                    apiFetch("/seller/profile", { credentials: "include", signal: controller.signal }),
                    apiFetch("/listings/Mylisting?archived=all", { credentials: "include", signal: controller.signal })
                ])

                if (controller.signal.aborted) {
                    return
                }

                if (profileResponse.status === 404) {// no store profile yet, so the seller still has to onboard
                    navigate("/seller/onboarding", { replace: true })
                    return
                }

                if (profileResponse.status === 401 || listingsResponse.status === 401) {
                    return// the session guard handles an expired session
                }

                if (!profileResponse.ok || !listingsResponse.ok) {
                    setLoadError("We could not load your store. Please try again.")
                    return
                }

                const profile = await profileResponse.json()
                const myListings = await listingsResponse.json()
                if (controller.signal.aborted) {
                    return
                }
                setStoreLogoUrl(profile.logoUrl)
                setStoreName(profile.businessName)
                setStoreSlug(profile.slug)
                setListings(myListings)
            } catch {
                if (!controller.signal.aborted) {
                    setLoadError("We could not load your store. Please check your connection and try again.")
                }
            }
        }

        loadStore()
        return () => controller.abort()
    }, [navigate, loadAttempt])
    
    const onSaleListings = listings.filter((listing) => !listing.archivedAt)
    const archivedListings = listings.filter((listing) => listing.archivedAt)
    // With nothing archived left, the Archived tab is gone, so the page goes back to the listings on sale.
    const shownListings = view === "archived" && archivedListings.length > 0 ? archivedListings : onSaleListings

    return (
        <div>
            {loadError && (
              <Notice kind="error">
                <p>{loadError}</p>
                <button type="button" onClick={() => setLoadAttempt((attempt) => attempt + 1)}>Try again</button>
              </Notice>
            )}

            <Greeting name={userName} />
            <SellerStandingNotice />

            <section aria-labelledby="store-heading" className="card shop-header store-header">
              {storeLogoUrl
                ? <img className="avatar avatar-lg" src={storeLogoUrl} alt="" />
                : <span className="avatar avatar-lg avatar-initial" aria-hidden="true">{(storeName || "S").charAt(0).toUpperCase()}</span>}
              <div>
                <h1 id="store-heading">{storeName || "My store"}</h1>
                {storeSlug && (
                  <p className="shop-location">
                    Your shop link: <Link to={`/shop/${storeSlug}`}>/shop/{storeSlug}</Link>
                  </p>
                )}
                <div className="action-row">
                  {storeSlug && (
                    <button type="button" onClick={handleCopyShopLink}>
                      {linkCopied ? "Copied!" : "Copy shop link"}
                    </button>
                  )}
                </div>
              </div>
            </section>

            <section aria-labelledby="add-listing-heading" className="card form-card store-section">
              <h2 id="add-listing-heading">Add a listing</h2>
              {createError && <Notice kind="error">{createError}</Notice>}
              <CreateListingForm
                key={formKey}
                formData={formData}
                handleSubmit={handleSubmit}
                setFormData={setFormData}
                photos={photos}
                setPhotos={setPhotos}
                isCreating={isCreating}
              />
            </section>

            <section aria-labelledby="listings-heading">
              <h2 id="listings-heading">Your listings</h2>
              {deleteError && <Notice kind="error">{deleteError}</Notice>}
              {archivePrompt && (
                <Notice kind="warning">
                  <p>
                    &ldquo;{archivePrompt.title}&rdquo; cannot be deleted because it has been ordered or is in a cart. You can archive it instead.
                    It is taken off sale and removed from carts, and orders already paid are not affected. You can restore it later.
                  </p>
                  <div className="action-row">
                    <button type="button" className="btn btn-primary" disabled={isArchiving} onClick={handleArchive}>
                      {isArchiving ? "Archiving..." : "Archive it"}
                    </button>
                    <button type="button" disabled={isArchiving} onClick={() => setArchivePrompt(null)}>Cancel</button>
                  </div>
                </Notice>
              )}
              {archivedListings.length > 0 && (
                <div className="view-tabs" role="group" aria-label="Which listings to show">
                  <button type="button" aria-pressed={view === "on-sale"} className={view === "on-sale" ? "view-tab is-active" : "view-tab"} onClick={() => setView("on-sale")}>
                    On sale ({onSaleListings.length})
                  </button>
                  <button type="button" aria-pressed={view === "archived"} className={view === "archived" ? "view-tab is-active" : "view-tab"} onClick={() => setView("archived")}>
                    Archived ({archivedListings.length})
                  </button>
                </div>
              )}
              {shownListings.length === 0 ? (
                <p>{view === "archived" ? "You have no archived listings." : "You have no listings yet. Add your first one above."}</p>
              ) : (
                <div className="product-grid">
                  {shownListings.map((listing) => (
                    <ListingCard
                      isEditable={true}
                      listing={listing}
                      editingId={editingId}
                      editFormData={editFormData}
                      hasChanges={listing.id === editingId && hasListingChanges(listing)}
                      isSaving={isSaving}
                      saveError={listing.id === editingId ? saveError : ""}
                      setEditFormData={setEditFormData}
                      editPhotos={editPhotos}
                      setEditPhotos={setEditPhotos}
                      handleEditClick={handleEditClick}
                      handleDelete={handleDelete}
                      isArchived={view === "archived"}
                      handleRestore={handleRestore}
                      handleCancel={handleCancel}
                      handleSave={handleSave}
                      key={listing.id}
                    />
                  ))}
                </div>
              )}
            </section>
        </div>
    )
}

export default MyListingsPage
