import { useState, useEffect } from "react"
import { Link, useNavigate } from "react-router-dom"
import { markShopSetupPromptDismissed } from "../lib/shopSetupPrompt"
import type {ListingFormData, Listing} from "../types/listing"
import ListingCard from "../components/ListingCard"
import CreateListingForm, { type CreateListingFormData } from "../components/CreateListingForm"
import { photosChanged, savedPhotos, uploadListingPhotos, type ListingPhoto } from "../lib/listingPhotos"
import { buildOptionsBody, draftsFromListing, validateOptionDrafts } from "../lib/optionDrafts"
import type { OptionDraft } from "../lib/optionDrafts"
import { apiFetch, getErrorMessage } from "../lib/api"
import { apiRequest, failureMessage } from "../lib/apiRequest"
import { validateListingFields } from "../lib/limits"
import { useDocumentTitle } from "../lib/useDocumentTitle"
import Notice from "../components/Notice"
import Greeting from "../components/Greeting"
import SellerStandingNotice from "../components/SellerStandingNotice"
import StoreOverview, { StoreShortcuts } from "../components/StoreOverview"
import type { StoreProfile } from "../components/StoreOverview"
import StoreProductRow from "../components/StoreProductRow"
import { toStoreProfile } from "../lib/storeProfile"
import { LOW_STOCK_THRESHOLD } from "../lib/stock"
import { Plus, ShoppingBag } from "lucide-react"

type ProductView = "on-sale" | "low" | "archived"

function MyListingsPage({ userName = "" }: { userName?: string }) {
    const navigate = useNavigate()
    useDocumentTitle("My store")

    const [listings, setListings] = useState<Listing[]>([])
    const [profile, setProfile] = useState<StoreProfile | null>(null)
    const [isAddOpen, setIsAddOpen] = useState(false)
    const [photos, setPhotos] = useState<ListingPhoto[]>([])
    const [editPhotos, setEditPhotos] = useState<ListingPhoto[]>([])
    const [optionDrafts, setOptionDrafts] = useState<OptionDraft[] | null>(null)// null: the new product has no options
    const [editOptions, setEditOptionsState] = useState<OptionDraft[] | null>(null)
    const [editOptionsTouched, setEditOptionsTouched] = useState(false)
    const [formKey, setFormKey] = useState(0)
    const [loadError, setLoadError] = useState<string | null>(null)
    const [isCreating, setIsCreating] = useState(false)
    const [createError, setCreateError] = useState("")
    const [deleteError, setDeleteError] = useState("")
    const [isSaving, setIsSaving] = useState(false)
    const [saveError, setSaveError] = useState("")
    const [loadAttempt, setLoadAttempt] = useState(0)
    const [view, setView] = useState<ProductView>("on-sale")
    const [archivePrompt, setArchivePrompt] = useState<{ id: number, title: string } | null>(null)
    const [isArchiving, setIsArchiving] = useState(false)
    const [needsShop, setNeedsShop] = useState(false)// no shop yet: listings need one, so setup is offered first
    
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

  async function handleSubmit(e: React.SubmitEvent<HTMLFormElement>)//this function is because whenever we click the submit button it reloads the page
   {
    e.preventDefault();

    if (isCreating) {
      return
    }

    if(formData.title === "" || formData.category === "" || formData.price === "" || (optionDrafts === null && formData.stockQuantity === "") || formData.description === ""){
      setCreateError("Please fill in every field.")
      return
    }
    if (photos.length === 0) {
      setCreateError("Please choose at least one photo.")
      return
    }
    // A product with options is stocked on its options, so the stock box is not used.
    const createProblem = validateListingFields(optionDrafts ? { ...formData, stockQuantity: "0" } : formData) ?? (optionDrafts ? validateOptionDrafts(optionDrafts) : null)
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

      const optionsBody = optionDrafts ? await buildOptionsBody(optionDrafts) : undefined
      if (optionsBody === null) {
        setCreateError("A photo of an option could not be uploaded. Please check your connection and try again.")
        return
      }

      const response = await apiFetch("/listings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: formData.title,
          description: formData.description,
          category: formData.category,
          price: Number(formData.price),
          imageUrls,
          ...(optionsBody ? { options: optionsBody } : { stockQuantity: Number(formData.stockQuantity) })
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
      setOptionDrafts(null)
      setFormKey(formKey + 1)// starts the form (and its photo picker) afresh
      setIsAddOpen(false)
      setView("on-sale")
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
    setEditOptionsState(listing.hasOptions ? draftsFromListing(listing) : null)
    setEditOptionsTouched(false)
    setSaveError("")
    setEditFormData({
      title: listing.title,
      description: listing.description,
      price: String(listing.price),
      category: listing.category,
      stockQuantity: String(listing.stockQuantity)
    })
  }

  // Any change to the options counts as an edit; they are sent whole when saved.
  function setEditOptions(drafts: OptionDraft[] | null) {
    setEditOptionsState(drafts)
    setEditOptionsTouched(true)
  }

  // The Save button stays disabled until the edit form, its photos or its options differ from the saved listing.
  function hasListingChanges(listing: Listing) {
    return (
      editOptionsTouched ||
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

    // With options, price and stock belong to the options, so only the rest of the form is checked here.
    const hasOptionsNow = editOptions !== null
    const savedForOptions = listings.find((candidate) => candidate.id === id)
    const saveProblem =
      validateListingFields(hasOptionsNow ? { ...editFormData, stockQuantity: "0", ...(savedForOptions?.hasOptions ? { price: "1" } : {}) } : editFormData) ??
      (hasOptionsNow ? validateOptionDrafts(editOptions) : null)
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

      // A product with options refuses a price and stock of its own, so they are left out and sent with the options.
      const hadOptions = savedListing?.hasOptions === true
      const response = await apiFetch(`/listings/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: editFormData.title,
          description: editFormData.description,
          category: editFormData.category,
          imageUrls,
          ...(hasOptionsNow ? {} : { price: Number(editFormData.price), stockQuantity: Number(editFormData.stockQuantity) })
        }),
        credentials:"include"
      })

      if(!response.ok){
        // Shows the backend's own message, for example the reserved-stock conflict returned with HTTP 409.
        setSaveError(await getErrorMessage(response, `Unable to save this listing (status ${response.status}).`))
        return
      }

      const updatedListing: Listing = await response.json()

      // The options are replaced as a whole. The page reloads afterwards, as the saved options come from the list.
      if (hasOptionsNow && editOptionsTouched) {
        const optionsBody = await buildOptionsBody(editOptions)
        if (optionsBody === null) {
          setSaveError("A photo of an option could not be uploaded. Please check your connection and try again.")
          return
        }

        const optionsResponse = await apiFetch(`/listings/${id}/options`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ options: optionsBody, ...(hadOptions ? {} : { price: Number(editFormData.price) }) }),
          credentials: "include"
        })

        if (!optionsResponse.ok) {
          // For example when stock would go below what shoppers have reserved: the backend says which option.
          setSaveError(await getErrorMessage(optionsResponse, `Unable to save the options (status ${optionsResponse.status}).`))
          return
        }

        setLoadAttempt((attempt) => attempt + 1)
      }

      // The saved listing becomes the new baseline for the dirty-state check.
      setListings((currentListings) =>
        currentListings.map((listing) =>
          listing.id === id ? updatedListing : listing
        )
      );
      setEditingId(null);
      setEditPhotos([])
      setEditOptionsState(null)
      setEditOptionsTouched(false)
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
      setEditOptionsState(null)
      setEditOptionsTouched(false)
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

                if (profileResponse.status === 404) {// no shop yet: offered on the page, not forced
                    setNeedsShop(true)
                    return
                }

                if (profileResponse.status === 401 || listingsResponse.status === 401) {
                    return// the session guard handles an expired session
                }

                if (!profileResponse.ok || !listingsResponse.ok) {
                    setLoadError("We could not load your store. Please try again.")
                    return
                }

                const profile: unknown = await profileResponse.json()
                const myListings = await listingsResponse.json()
                if (controller.signal.aborted) {
                    return
                }
                setProfile(toStoreProfile(profile))
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
    const lowListings = onSaleListings.filter((listing) => listing.stockQuantity <= LOW_STOCK_THRESHOLD)
    const archivedListings = listings.filter((listing) => listing.archivedAt)
    // An empty tab other than On sale is gone, so the page goes back to the products on sale.
    const shownListings = view === "archived" && archivedListings.length > 0
        ? archivedListings
        : view === "low" && lowListings.length > 0 ? lowListings : onSaleListings
    const shownView: ProductView = shownListings === onSaleListings ? "on-sale" : view

    function openAddForm() {
        setIsAddOpen(true)
        window.requestAnimationFrame(() => document.getElementById("add-product")?.scrollIntoView({ behavior: "smooth", block: "start" }))
    }

    // Without a shop there is nothing to list yet: setting one up is required to add a listing, and
    // shopping stays open in the meantime.
    if (needsShop) {
        return (
            <div>
                <Greeting name={userName} />
                <section className="card setup-shop" aria-labelledby="setup-shop-heading">
                    <h1 id="setup-shop-heading">Set up your shop to start selling</h1>
                    <p>Add your shop's name, where you are and how you deliver. Then you can add your first products.</p>
                    <div className="action-row">
                        <Link to="/seller/onboarding" className="btn btn-primary btn-lg">Set up my shop</Link>
                        <Link to="/" className="btn btn-lg" onClick={markShopSetupPromptDismissed}>Browse products</Link>
                    </div>
                    <p className="field-help">You can shop on StoreHatch with this same account while you decide.</p>
                </section>
            </div>
        )
    }

    const firstName = userName.trim().split(/\s+/)[0] ?? ""
    const tabs: Array<{ value: ProductView, label: string, count: number }> = [
        { value: "on-sale", label: "On sale", count: onSaleListings.length },
        ...(lowListings.length > 0 ? [{ value: "low" as const, label: "Low or sold out", count: lowListings.length }] : []),
        ...(archivedListings.length > 0 ? [{ value: "archived" as const, label: "Archived", count: archivedListings.length }] : [])
    ]

    return (
        <div className="store-page">
            {loadError && (
              <Notice kind="error">
                <p>{loadError}</p>
                <button type="button" className="btn" onClick={() => setLoadAttempt((attempt) => attempt + 1)}>Try again</button>
              </Notice>
            )}

            <SellerStandingNotice />

            {profile && (
                <StoreOverview firstName={firstName} profile={profile} productsOnSale={onSaleListings.length} productsLow={lowListings.length} />
            )}

            <section aria-labelledby="products-heading">
              <div className="store-section-title">
                <h2 id="products-heading">Your products</h2>
                <button type="button" className="btn btn-primary" onClick={openAddForm} aria-controls="add-product" aria-expanded={isAddOpen}>
                  <Plus size={18} aria-hidden="true" />Add a product
                </button>
              </div>

              {isAddOpen && (
                <section id="add-product" aria-labelledby="add-listing-heading" className="store-add">
                  <div className="store-add-head">
                    <h3 id="add-listing-heading">Add a product</h3>
                    <button type="button" className="btn-text" onClick={() => setIsAddOpen(false)}>Close</button>
                  </div>
                  {createError && <Notice kind="error">{createError}</Notice>}
                  <CreateListingForm
                    key={formKey}
                    formData={formData}
                    handleSubmit={handleSubmit}
                    setFormData={setFormData}
                    photos={photos}
                    setPhotos={setPhotos}
                    optionDrafts={optionDrafts}
                    setOptionDrafts={setOptionDrafts}
                    isCreating={isCreating}
                  />
                </section>
              )}

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
                    <button type="button" className="btn" disabled={isArchiving} onClick={() => setArchivePrompt(null)}>Cancel</button>
                  </div>
                </Notice>
              )}

              {tabs.length > 1 && (
                <div className="orders-filters" aria-label="Show products">
                  {tabs.map((tab) => (
                    <button
                      key={tab.value}
                      type="button"
                      className={`orders-filter${tab.value === shownView ? " is-active" : ""}`}
                      aria-pressed={tab.value === shownView}
                      onClick={() => setView(tab.value)}
                    >
                      {tab.label}<span className="orders-filter-count">{tab.count}</span>
                    </button>
                  ))}
                </div>
              )}

              {shownListings.length === 0 ? (
                <div className="store-empty">
                  <span className="store-empty-icon" aria-hidden="true"><ShoppingBag size={30} /></span>
                  <h3>No products yet</h3>
                  <p>Add your first product with a few clear photos, a price and how many you have. You can add options like sizes and colours too.</p>
                  {!isAddOpen && <button type="button" className="btn btn-primary" onClick={openAddForm}>Add your first product</button>}
                </div>
              ) : (
                <div className="store-products">
                  <div className="store-products-head" aria-hidden="true">
                    <span /><span>Product</span><span>Price</span><span>Stock</span><span>Status</span><span />
                  </div>
                  <ul>
                    {shownListings.map((listing) => (
                      <li key={listing.id}>
                        <StoreProductRow
                          listing={listing}
                          isArchived={shownView === "archived"}
                          onEdit={() => handleEditClick(listing)}
                          onDelete={() => handleDelete(listing.id)}
                          onRestore={() => handleRestore(listing.id)}
                        />
                        {listing.id === editingId && (
                          <div className="store-edit">
                            <ListingCard
                              isEditable={true}
                              listing={listing}
                              editingId={editingId}
                              editFormData={editFormData}
                              hasChanges={hasListingChanges(listing)}
                              isSaving={isSaving}
                              saveError={saveError}
                              setEditFormData={setEditFormData}
                              editPhotos={editPhotos}
                              setEditPhotos={setEditPhotos}
                              editOptions={editOptions}
                              setEditOptions={setEditOptions}
                              handleEditClick={handleEditClick}
                              handleDelete={handleDelete}
                              isArchived={shownView === "archived"}
                              handleRestore={handleRestore}
                              handleCancel={handleCancel}
                              handleSave={handleSave}
                            />
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </section>

            <StoreShortcuts />
        </div>
    )
}

export default MyListingsPage
