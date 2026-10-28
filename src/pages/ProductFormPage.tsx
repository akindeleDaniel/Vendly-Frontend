import { useEffect, useId, useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { Check, Minus } from "lucide-react"
import BackArrow from "../components/BackArrow"
import InlineConfirm from "../components/InlineConfirm"
import ListingOptionsEditor from "../components/ListingOptionsEditor"
import ListingPhotosPicker from "../components/ListingPhotosPicker"
import Notice from "../components/Notice"
import { CATEGORIES } from "../data/categories"
import { apiFetch, getErrorMessage } from "../lib/api"
import { apiRequest, failureMessage } from "../lib/apiRequest"
import { DESCRIPTION_MAX_LENGTH, PRICE_MAX, STOCK_MAX, TITLE_MAX_LENGTH, validateListingFields } from "../lib/limits"
import { photosChanged, savedPhotos, uploadListingPhotos, type ListingPhoto } from "../lib/listingPhotos"
import { formatMinorUnits, toMinorUnits } from "../lib/money"
import { buildOptionsBody, draftsFromListing, newOptionDraft, validateOptionDrafts } from "../lib/optionDrafts"
import type { OptionDraft } from "../lib/optionDrafts"
import { useDocumentTitle } from "../lib/useDocumentTitle"
import type { Listing, ListingFormData } from "../types/listing"

const EMPTY_FORM: ListingFormData = { title: "", description: "", price: "", category: "", stockQuantity: "" }

type LoadState =
    | { kind: "loading" }
    | { kind: "ready" }
    | { kind: "not-found" }
    | { kind: "error", message: string }

type Shop = { name: string, location: string | null }

function formFrom(listing: Listing): ListingFormData {
    return {
        title: listing.title,
        description: listing.description,
        price: String(listing.price),
        category: listing.category,
        stockQuantity: String(listing.stockQuantity)
    }
}

// The lowest price shoppers will see: an option's own price, or the product's price when it has none.
function previewPrice(form: ListingFormData, options: OptionDraft[] | null): string {
    const base = Number(form.price) || 0
    const prices = options && options.length > 0 ? options.map((option) => Number(option.price) || base) : [base]
    const lowest = Math.min(...prices)
    if (!lowest) {
        return "₦—"
    }
    return `${prices.some((price) => price !== lowest) ? "From " : ""}${formatMinorUnits(toMinorUnits(lowest))}`
}

// Adds a new product, or edits one, on its own page: photos, what it is, and its price and stock
// either as one version or as options (colours, sizes and so on). A preview shows the product as
// shoppers will see it.
function ProductFormPage() {
    const { id } = useParams()
    const isEdit = id !== undefined
    useDocumentTitle(isEdit ? "Edit product" : "Add a product")
    const navigate = useNavigate()
    const titleId = useId()
    const descriptionId = useId()
    const categoryId = useId()
    const priceId = useId()
    const stockId = useId()

    const [load, setLoad] = useState<LoadState>({ kind: "loading" })
    const [shop, setShop] = useState<Shop | null>(null)
    const [listing, setListing] = useState<Listing | null>(null)// the saved product, when editing
    const [form, setForm] = useState<ListingFormData>(EMPTY_FORM)
    const [photos, setPhotos] = useState<ListingPhoto[]>([])
    const [options, setOptionsState] = useState<OptionDraft[] | null>(null)// null: one version, no options
    const [optionsTouched, setOptionsTouched] = useState(false)
    const [isWorking, setIsWorking] = useState(false)
    const [error, setError] = useState("")
    const [savedMessage, setSavedMessage] = useState("")
    const [attempt, setAttempt] = useState(0)

    useEffect(() => {
        const controller = new AbortController()

        async function loadPage() {
            try {
                const [profileResponse, listingsResponse] = await Promise.all([
                    apiFetch("/seller/profile", { credentials: "include", signal: controller.signal }),
                    isEdit ? apiFetch("/listings/Mylisting?archived=all", { credentials: "include", signal: controller.signal }) : Promise.resolve(null)
                ])

                if (controller.signal.aborted) {
                    return
                }

                // No shop yet: My store explains that a shop is needed first.
                if (profileResponse.status === 404) {
                    navigate("/seller/myListing", { replace: true })
                    return
                }

                if (!profileResponse.ok || (listingsResponse && !listingsResponse.ok)) {
                    setLoad({ kind: "error", message: "We could not load this page. Please try again." })
                    return
                }

                const profile: unknown = await profileResponse.json()
                const record = typeof profile === "object" && profile !== null ? profile as Record<string, unknown> : {}
                setShop({
                    name: typeof record.businessName === "string" ? record.businessName : "Your shop",
                    location: typeof record.location === "string" && record.location ? record.location : null
                })

                if (listingsResponse) {
                    const mine: Listing[] = await listingsResponse.json()
                    const found = mine.find((candidate) => String(candidate.id) === id)
                    if (!found) {
                        setLoad({ kind: "not-found" })
                        return
                    }
                    setListing(found)
                    setForm(formFrom(found))
                    setPhotos(savedPhotos(found))
                    setOptionsState(found.hasOptions ? draftsFromListing(found) : null)
                    setOptionsTouched(false)
                }

                setLoad({ kind: "ready" })
            } catch {
                if (!controller.signal.aborted) {
                    setLoad({ kind: "error", message: "We could not load this page. Please check your connection and try again." })
                }
            }
        }

        loadPage()
        return () => controller.abort()
    }, [id, isEdit, navigate, attempt])

    // Any change to the options counts as an edit; they are sent whole when saved.
    function setOptions(drafts: OptionDraft[] | null) {
        setOptionsState(drafts)
        setOptionsTouched(true)
        setSavedMessage("")
    }

    function change(patch: Partial<ListingFormData>) {
        setForm((current) => ({ ...current, ...patch }))
        setSavedMessage("")
    }

    const hadOptions = listing?.hasOptions === true
    const hasChanges = !isEdit || listing === null || (
        optionsTouched ||
        photosChanged(listing, photos) ||
        form.title !== listing.title ||
        form.description !== listing.description ||
        form.category !== listing.category ||
        (options === null && (Number(form.price) !== listing.price || Number(form.stockQuantity) !== listing.stockQuantity))
    )

    // The first problem to fix, or null when the product can be saved.
    function findProblem(): string | null {
        if (photos.length === 0) {
            return "Add at least one photo."
        }
        if (form.title.trim() === "" || form.description.trim() === "" || form.category === "") {
            return "Fill in the name, description and category."
        }
        if (options === null && (form.price === "" || form.stockQuantity === "")) {
            return "Add a price and how many you have."
        }
        if (options !== null && !hadOptions && form.price === "") {
            return "Add a price. Options use it unless you give them their own."
        }
        // With options, stock lives on the options; a product that already has options keeps its prices there too.
        return validateListingFields({
            ...form,
            ...(options !== null ? { stockQuantity: "0" } : {}),
            ...(options !== null && hadOptions ? { price: "1" } : {})
        }) ?? (options !== null ? validateOptionDrafts(options) : null)
    }

    async function handleCreate() {
        setIsWorking(true)
        try {
            const imageUrls = await uploadListingPhotos(photos)
            if (imageUrls === null) {
                setError("A photo could not be uploaded. Please check your connection and try again.")
                return
            }
            const optionsBody = options ? await buildOptionsBody(options) : undefined
            if (optionsBody === null) {
                setError("A photo of an option could not be uploaded. Please check your connection and try again.")
                return
            }
            const response = await apiFetch("/listings", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({
                    title: form.title.trim(),
                    description: form.description,
                    category: form.category,
                    price: Number(form.price),
                    imageUrls,
                    ...(optionsBody ? { options: optionsBody } : { stockQuantity: Number(form.stockQuantity) })
                })
            })
            if (!response.ok) {
                setError(await getErrorMessage(response, `Unable to add this product (status ${response.status}).`))
                return
            }
            navigate("/seller/myListing", { state: { added: form.title.trim() } })
        } catch {
            setError("Something went wrong. Please check your connection and try again.")
        } finally {
            setIsWorking(false)
        }
    }

    async function handleSave(saved: Listing) {
        setIsWorking(true)
        try {
            // Photos are only sent when they changed; a save without them leaves the photos alone.
            let imageUrls: string[] | undefined
            if (photosChanged(saved, photos)) {
                const uploaded = await uploadListingPhotos(photos)
                if (uploaded === null) {
                    setError("A photo could not be uploaded. Please check your connection and try again.")
                    return
                }
                imageUrls = uploaded
            }

            // A product with options refuses a price and stock of its own, so they are left out and sent with the options.
            const response = await apiFetch(`/listings/${saved.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({
                    title: form.title.trim(),
                    description: form.description,
                    category: form.category,
                    imageUrls,
                    ...(options === null ? { price: Number(form.price), stockQuantity: Number(form.stockQuantity) } : {})
                })
            })
            if (!response.ok) {
                // Shows the backend's own message, for example when stock would go below what shoppers have reserved.
                setError(await getErrorMessage(response, `Unable to save this product (status ${response.status}).`))
                return
            }

            // The options are replaced as a whole.
            if (options !== null && optionsTouched) {
                const optionsBody = await buildOptionsBody(options)
                if (optionsBody === null) {
                    setError("A photo of an option could not be uploaded. Please check your connection and try again.")
                    return
                }
                const optionsResponse = await apiFetch(`/listings/${saved.id}/options`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    credentials: "include",
                    body: JSON.stringify({ options: optionsBody, ...(hadOptions ? {} : { price: Number(form.price) }) })
                })
                if (!optionsResponse.ok) {
                    setError(await getErrorMessage(optionsResponse, `Unable to save the options (status ${optionsResponse.status}).`))
                    return
                }
            }

            setSavedMessage("Saved. Your shop shows the changes now.")
            setAttempt((count) => count + 1)// reloads the saved product, so the page starts again from it
        } catch {
            setError("Something went wrong. Please check your connection and try again.")
        } finally {
            setIsWorking(false)
        }
    }

    async function handleSubmit(event: React.SubmitEvent<HTMLFormElement>) {
        event.preventDefault()
        if (isWorking || !hasChanges) {
            return
        }
        const problem = findProblem()
        if (problem) {
            setError(problem)
            return
        }
        setError("")
        setSavedMessage("")
        if (isEdit && listing) {
            await handleSave(listing)
        } else {
            await handleCreate()
        }
    }

    async function archive(): Promise<string | null> {
        if (!listing) {
            return null
        }
        const result = await apiRequest<{ listing: Listing }>(`/listings/${listing.id}/${listing.archivedAt ? "unarchive" : "archive"}`, { method: "POST", body: {} })
        if (result.kind === "ok") {
            setListing(result.data.listing)
            setSavedMessage(result.data.listing.archivedAt ? "Taken off sale. You can put it back on sale here any time." : "Back on sale in your shop.")
            return null
        }
        return failureMessage(result)
    }

    async function remove(): Promise<string | null> {
        if (!listing) {
            return null
        }
        try {
            const response = await apiFetch(`/listings/${listing.id}`, { method: "DELETE", credentials: "include" })
            if (response.ok) {
                navigate("/seller/myListing", { replace: true })
                return null
            }
            const body: unknown = await response.json().catch(() => null)
            if (response.status === 409 && typeof body === "object" && body !== null && "code" in body && body.code === "LISTING_HAS_HISTORY") {
                return "This product has been ordered or is in a cart, so it can't be deleted. Take it off sale instead."
            }
            return typeof body === "object" && body !== null && "message" in body && typeof body.message === "string"
                ? body.message
                : `Unable to delete this product (status ${response.status}).`
        } catch {
            return "Something went wrong. Please check your connection and try again."
        }
    }

    const back = <BackArrow to="/seller/myListing" label="Back to my store" />

    if (load.kind === "loading") {
        return <div className="product-form-page">{back}<p role="status">Loading...</p></div>
    }

    if (load.kind !== "ready") {
        return (
            <div className="product-form-page">
                {back}
                <h1>{isEdit ? "Edit product" : "Add a product"}</h1>
                {load.kind === "not-found"
                    ? <Notice kind="warning">We could not find this product in your shop.</Notice>
                    : (
                        <Notice kind="error">
                            <p>{load.message}</p>
                            <button type="button" className="btn" onClick={() => { setLoad({ kind: "loading" }); setAttempt((count) => count + 1) }}>Try again</button>
                        </Notice>
                    )}
            </div>
        )
    }

    const checks = [
        { done: photos.length > 0, label: "At least one photo" },
        { done: form.title.trim() !== "", label: "A name" },
        { done: form.category !== "", label: "A category" },
        options === null
            ? { done: form.price !== "" && form.stockQuantity !== "", label: "A price and stock" }
            : { done: options.length > 0, label: "Options with stock" }
    ]
    const isArchived = Boolean(listing?.archivedAt)
    // The backend refuses option changes on a product that is off sale, so they wait until it is back on sale.
    const optionsLocked = isEdit && isArchived

    return (
        <div className="product-form-page">
            {back}
            <div className="product-form-title">
                <h1>{isEdit ? "Edit product" : "Add a product"}</h1>
                <p>{isEdit ? "Changes show in your shop as soon as you save." : "Good photos and a clear name help shoppers find and trust it."}</p>
            </div>
            {isArchived && <Notice kind="info">This product is off sale. Shoppers can't see it until you put it back on sale below.</Notice>}

            <form className="product-form-grid" onSubmit={handleSubmit} noValidate>
                <div className="product-form-main">
                    <section className="product-form-card" aria-labelledby="photos-heading">
                        <div className="product-form-card-head"><h2 id="photos-heading">Photos</h2><span>{photos.length} of 5</span></div>
                        <ListingPhotosPicker photos={photos} onChange={(next) => { setPhotos(next); setSavedMessage("") }} disabled={isWorking} />
                    </section>

                    <section className="product-form-card" aria-labelledby="about-heading">
                        <div className="product-form-card-head"><h2 id="about-heading">About the product</h2></div>
                        <div className="product-field">
                            <div className="product-field-top"><label htmlFor={titleId}>Name</label><small>{form.title.length} / {TITLE_MAX_LENGTH}</small></div>
                            <input id={titleId} className="product-input" maxLength={TITLE_MAX_LENGTH} placeholder="For example: Linen ruffle dress" value={form.title} disabled={isWorking} onChange={(event) => change({ title: event.target.value })} />
                        </div>
                        <div className="product-field">
                            <div className="product-field-top"><label htmlFor={descriptionId}>Description</label><small>{form.description.length.toLocaleString("en-NG")} / {DESCRIPTION_MAX_LENGTH.toLocaleString("en-NG")}</small></div>
                            <textarea
                                id={descriptionId}
                                className="product-input product-textarea"
                                maxLength={DESCRIPTION_MAX_LENGTH}
                                placeholder="What it is, what it's made of, sizes and how it fits, and how to care for it."
                                value={form.description}
                                disabled={isWorking}
                                onChange={(event) => change({ description: event.target.value })}
                            />
                        </div>
                        <div className="product-field">
                            <label htmlFor={categoryId}>Category</label>
                            <select id={categoryId} className="product-input" value={form.category} disabled={isWorking} onChange={(event) => change({ category: event.target.value })}>
                                <option value="">Choose a category</option>
                                {CATEGORIES.map((category) => <option key={category} value={category}>{category}</option>)}
                            </select>
                        </div>
                    </section>

                    <section className="product-form-card" aria-labelledby="stock-heading">
                        <div className="product-form-card-head"><h2 id="stock-heading">Price and stock</h2></div>
                        {optionsLocked && (
                            <p className="product-help product-locked">
                                {options === null
                                    ? "While it's off sale you can change the price and stock, but not add options. Put it back on sale first."
                                    : "While it's off sale its options, prices and stock can't be changed. Put it back on sale first."}
                            </p>
                        )}
                        <div className="product-sold" role="radiogroup" aria-label="How is it sold?">
                            <button type="button" role="radio" aria-checked={options === null} className={options === null ? "is-on" : undefined} disabled={isWorking || optionsLocked} onClick={() => options !== null && setOptions(null)}>
                                <span className="product-radio" aria-hidden="true" />
                                <span><b>One version</b><span>One price, one stock count.</span></span>
                            </button>
                            <button type="button" role="radio" aria-checked={options !== null} className={options !== null ? "is-on" : undefined} disabled={isWorking || optionsLocked} onClick={() => options === null && setOptions(listing?.hasOptions ? draftsFromListing(listing) : [newOptionDraft()])}>
                                <span className="product-radio" aria-hidden="true" />
                                <span><b>Several options</b><span>Colours, sizes or styles, each with its own stock.</span></span>
                            </button>
                        </div>

                        {options === null ? (
                            <div className="product-two">
                                <div className="product-field">
                                    <label htmlFor={priceId}>Price</label>
                                    <span className="product-input product-money"><span aria-hidden="true">₦</span><input id={priceId} type="number" min="0.01" max={PRICE_MAX} step="0.01" inputMode="decimal" value={form.price} disabled={isWorking} onChange={(event) => change({ price: event.target.value })} /></span>
                                </div>
                                <div className="product-field">
                                    <label htmlFor={stockId}>How many you have</label>
                                    <input id={stockId} className="product-input" type="number" min="0" max={STOCK_MAX} step="1" inputMode="numeric" value={form.stockQuantity} disabled={isWorking} onChange={(event) => change({ stockQuantity: event.target.value })} />
                                </div>
                            </div>
                        ) : (
                            <>
                                {!hadOptions && (
                                    <div className="product-field product-base-price">
                                        <label htmlFor={priceId}>Price</label>
                                        <span className="product-input product-money"><span aria-hidden="true">₦</span><input id={priceId} type="number" min="0.01" max={PRICE_MAX} step="0.01" inputMode="decimal" aria-describedby={`${priceId}-help`} value={form.price} disabled={isWorking} onChange={(event) => change({ price: event.target.value })} /></span>
                                        <p id={`${priceId}-help`} className="product-help">Options use this price unless you give them their own.</p>
                                    </div>
                                )}
                                <ListingOptionsEditor
                                    drafts={options}
                                    onChange={(drafts) => setOptions(drafts)}
                                    pricePlaceholder={form.price ? Number(form.price).toLocaleString("en-NG") : "Same as the product"}
                                    disabled={isWorking || optionsLocked}
                                />
                            </>
                        )}
                    </section>

                    {isEdit && listing && (
                        <section className="product-form-card product-danger" aria-labelledby="off-heading">
                            <div className="product-form-card-head"><h2 id="off-heading">{isArchived ? "Put it back on sale" : "Take it off sale"}</h2></div>
                            <div className="product-danger-row">
                                <div>
                                    <b>{isArchived ? "Put this product back on sale" : "Archive this product"}</b>
                                    <span>{isArchived
                                        ? "Shoppers can see and buy it again."
                                        : "Shoppers can't see or buy it, and it leaves their carts. Orders already paid are not affected. You can put it back on sale later."}</span>
                                </div>
                                <InlineConfirm
                                    buttonLabel={isArchived ? "Put back on sale" : "Archive"}
                                    prompt={isArchived ? "Put this product back on sale?" : "Take this product off sale?"}
                                    confirmLabel={isArchived ? "Yes, put it back" : "Yes, archive it"}
                                    onConfirm={archive}
                                />
                            </div>
                            <div className="product-danger-row">
                                <div>
                                    <b>Delete this product</b>
                                    <span>Gone for good. A product that has been ordered or is in a cart can't be deleted; archive it instead.</span>
                                </div>
                                <InlineConfirm buttonLabel="Delete" prompt="Delete this product? This cannot be undone." confirmLabel="Yes, delete it" danger onConfirm={remove} />
                            </div>
                        </section>
                    )}
                </div>

                <aside className="product-form-aside" aria-label="Preview and save">
                    <section className="product-form-card product-preview" aria-labelledby="preview-heading">
                        <h2 id="preview-heading">How shoppers see it</h2>
                        <div className="product-preview-tile">
                            {photos[0] ? <img src={photos[0].url} alt="" /> : <span className="product-preview-empty" aria-hidden="true">Your cover photo</span>}
                            <div>
                                <b>{form.title.trim() || "Your product name"}</b>
                                <span className="product-preview-price">{previewPrice(form, options)}</span>
                                {shop && <span>{[shop.name, shop.location].filter(Boolean).join(" · ")}</span>}
                            </div>
                        </div>
                    </section>

                    <section className="product-form-card product-checks" aria-labelledby="checks-heading">
                        <h2 id="checks-heading">{isEdit ? "Looks good" : "Before you publish"}</h2>
                        <ul>
                            {checks.map((check) => (
                                <li key={check.label} className={check.done ? "is-done" : undefined}>
                                    <span aria-hidden="true">{check.done ? <Check size={12} strokeWidth={3.4} /> : <Minus size={12} strokeWidth={3.4} />}</span>
                                    {check.label}<span className="visually-hidden">{check.done ? ", done" : ", still to do"}</span>
                                </li>
                            ))}
                        </ul>
                    </section>

                    <div className="product-form-actions">
                        {error && <Notice kind="error">{error}</Notice>}
                        {savedMessage && <p className="product-saved" role="status"><Check size={16} strokeWidth={3} aria-hidden="true" />{savedMessage}</p>}
                        <button type="submit" className="btn btn-primary" disabled={isWorking || !hasChanges}>
                            {isWorking ? (isEdit ? "Saving..." : "Publishing...") : isEdit ? "Save changes" : "Publish product"}
                        </button>
                        {isEdit && listing && !isArchived
                            ? <Link to={`/product/${listing.id}`} className="btn">See it in your shop</Link>
                            : !isEdit && <Link to="/seller/myListing" className="btn">Cancel</Link>}
                        <p className="product-form-note">
                            {isEdit ? (hasChanges ? "You have changes that are not saved." : "Nothing has changed yet.") : "It goes on sale in your shop straight away."}
                        </p>
                    </div>
                </aside>
            </form>
        </div>
    )
}

export default ProductFormPage
