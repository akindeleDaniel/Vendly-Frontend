import { useEffect, useId, useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { Check } from "lucide-react"
import { ShopLinksFields, ShopLookFields } from "../components/BrandingFields"
import ImagePicker from "../components/ImagePicker"
import LowStockAlertCard from "../components/LowStockAlertCard"
import Notice from "../components/Notice"
import SettingsLayout from "../components/SettingsLayout"
import ShopBasicsFields from "../components/ShopBasicsFields"
import ShopPreview from "../components/ShopPreview"
import UploadStatus from "../components/UploadStatus"
import { apiFetch, getErrorMessage } from "../lib/api"
import { EMPTY_BRANDING_FORM, brandingBody, brandingChanged, brandingFormFrom } from "../lib/branding"
import { buildSellerProfileBody, validateSellerProfile } from "../lib/sellerProfile"
import { LOW_STOCK_THRESHOLD } from "../lib/stock"
import { uploadFailureMessage } from "../lib/uploadImage"
import { useBackgroundUpload } from "../lib/useBackgroundUpload"
import { useDocumentTitle } from "../lib/useDocumentTitle"
import { useFileUrl } from "../lib/useFileUrl"
import type { BrandingForm } from "../types/branding"
import type { FoodOrderType } from "../types/preOrder"
import type { SellerProfile } from "../types/seller"

type LoadStatus = "loading" | "ready" | "error"

const FOOD_CHOICES: Array<{ value: FoodOrderType, title: string, text: string }> = [
    { value: "NOW", title: "Ready now", text: "Buyers order and pay straight away." },
    { value: "PRE_ORDER", title: "Pre-orders only", text: "Buyers ask for a ready time first." },
    { value: "BOTH", title: "Both", text: "Order now, or pre-order for later." }
]

// The shop's name, place and look, with a preview of the shop page beside the form.
function EditSellerProfilePage() {
    const navigate = useNavigate()
    const foodName = useId()
    useDocumentTitle("Shop details")

    const [formData, setFormData] = useState<SellerProfile>({ businessName: "", state: "", lga: "", shippingPolicy: "FREE", shippingCost: "" })
    const [savedProfile, setSavedProfile] = useState<SellerProfile | null>(null)// last values loaded from or saved to the server
    const [slug, setSlug] = useState("")
    const [foodOrderType, setFoodOrderType] = useState<FoodOrderType>("NOW")
    const [savedFoodOrderType, setSavedFoodOrderType] = useState<FoodOrderType>("NOW")
    const [sellsFood, setSellsFood] = useState(false)// has a Food & Grocery listing on sale
    const [alertNumber, setAlertNumber] = useState(LOW_STOCK_THRESHOLD)// the shop's low-stock alert number; 0 is off
    const [savedAlertNumber, setSavedAlertNumber] = useState<number | null>(null)// null: the backend did not send one, so the card is hidden
    const [currentLogoUrl, setCurrentLogoUrl] = useState("")
    const [logoFile, setLogoFile] = useState<File | null>(null)// only filled if the seller picks a new logo
    const [branding, setBranding] = useState<BrandingForm>(EMPTY_BRANDING_FORM)
    const [savedBranding, setSavedBranding] = useState<BrandingForm>(EMPTY_BRANDING_FORM)
    const [bannerUrl, setBannerUrl] = useState<string | null>(null)// the saved banner
    const [bannerFile, setBannerFile] = useState<File | null>(null)// a new banner, uploaded on save
    const [removeBanner, setRemoveBanner] = useState(false)
    const [pickerKey, setPickerKey] = useState(0)// remounts the image pickers to clear unsaved picks
    const [loadStatus, setLoadStatus] = useState<LoadStatus>("loading")
    const [loadAttempt, setLoadAttempt] = useState(0)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [isSaved, setIsSaved] = useState(false)
    const [error, setError] = useState("")
    const logoPreview = useFileUrl(logoFile)
    const bannerPreview = useFileUrl(bannerFile)
    // A new logo or banner starts uploading as soon as it is picked, so saving is quick on a slow connection.
    const logoUpload = useBackgroundUpload()
    const bannerUpload = useBackgroundUpload()

    useEffect(() => {
        const controller = new AbortController()

        async function fetchProfile() {
            try {
                const response = await apiFetch("/seller/profile", { credentials: "include", signal: controller.signal })

                if (controller.signal.aborted) {
                    return
                }

                if (response.status === 404) {// no store profile yet, so the seller still has to onboard
                    navigate("/seller/onboarding", { replace: true })
                    return
                }

                if (!response.ok) {
                    if (response.status !== 401) {// a 401 is handled by the session guard
                        setLoadStatus("error")
                    }
                    return
                }

                const data = await response.json()
                const loadedProfile: SellerProfile = {
                    businessName: data.businessName,
                    state: data.state,
                    lga: data.lga,
                    shippingPolicy: data.shippingPolicy === "FIXED" ? "FIXED" : "FREE",
                    shippingCost: data.shippingCost === null || data.shippingCost === undefined ? "" : String(data.shippingCost)
                }
                // Pre-orders are only for shops with a food listing. A failed check just leaves the setting hidden.
                const listingsResponse = await apiFetch("/listings/Mylisting", { credentials: "include", signal: controller.signal }).catch(() => null)
                const myListings: unknown = listingsResponse?.ok ? await listingsResponse.json().catch(() => null) : null
                if (controller.signal.aborted) {
                    return
                }
                setSellsFood(Array.isArray(myListings) && myListings.some((listing) => listing?.category === "Food & Grocery"))
                const loadedFoodOrderType: FoodOrderType = data.foodOrderType === "PRE_ORDER" || data.foodOrderType === "BOTH" ? data.foodOrderType : "NOW"
                setFormData(loadedProfile)
                setSavedProfile(loadedProfile)
                setSlug(typeof data.slug === "string" ? data.slug : "")
                setFoodOrderType(loadedFoodOrderType)
                setSavedFoodOrderType(loadedFoodOrderType)
                const loadedAlertNumber = typeof data.lowStockThreshold === "number" ? data.lowStockThreshold : null
                setAlertNumber(loadedAlertNumber ?? LOW_STOCK_THRESHOLD)
                setSavedAlertNumber(loadedAlertNumber)
                setCurrentLogoUrl(data.logoUrl ?? "")
                const loadedBranding = brandingFormFrom(data.branding)
                setBranding(loadedBranding)
                setSavedBranding(loadedBranding)
                setBannerUrl(data.branding?.bannerUrl ?? null)
                setLoadStatus("ready")
            } catch {
                if (!controller.signal.aborted) {
                    setLoadStatus("error")
                }
            }
        }
        fetchProfile()

        return () => controller.abort()
    }, [navigate, loadAttempt])

    const validationError = validateSellerProfile(formData)

    // The save bar only shows once the profile has loaded and something differs from the saved values.
    const hasChanges =
        savedProfile !== null &&
        (
            logoFile !== null ||
            bannerFile !== null ||
            removeBanner ||
            brandingChanged(branding, savedBranding) ||
            foodOrderType !== savedFoodOrderType ||
            (savedAlertNumber !== null && alertNumber !== savedAlertNumber) ||
            formData.businessName.trim() !== savedProfile.businessName.trim() ||
            formData.state !== savedProfile.state ||
            formData.lga !== savedProfile.lga
        )

    function edit(change: () => void) {
        change()
        setIsSaved(false)
    }

    function discardChanges() {
        if (savedProfile === null) {
            return
        }
        setFormData(savedProfile)
        setBranding(savedBranding)
        setFoodOrderType(savedFoodOrderType)
        setAlertNumber(savedAlertNumber ?? LOW_STOCK_THRESHOLD)
        setLogoFile(null)
        setBannerFile(null)
        logoUpload.start(null)
        bannerUpload.start(null)
        setRemoveBanner(false)
        setPickerKey((key) => key + 1)
        setError("")
    }

    async function handleSubmit(event: React.SubmitEvent<HTMLFormElement>) {
        event.preventDefault()

        if (isSubmitting || !hasChanges) {
            return
        }

        if (validationError !== null) {
            setError(validationError)
            return
        }

        setIsSubmitting(true)
        setError("")

        try {
            let logoUrl = currentLogoUrl// keeps the old logo unless a new one was picked

            if (logoFile !== null) {
                const uploaded = await logoUpload.urlFor(logoFile)
                if (!uploaded.ok) {
                    setError(uploadFailureMessage(uploaded.reason, "logo"))
                    return
                }
                logoUrl = uploaded.url
            }

            let nextBannerUrl = removeBanner ? null : bannerUrl
            if (bannerFile !== null) {
                const uploaded = await bannerUpload.urlFor(bannerFile)
                if (!uploaded.ok) {
                    setError(uploadFailureMessage(uploaded.reason, "banner"))
                    return
                }
                nextBannerUrl = uploaded.url
            }

            const response = await apiFetch("/seller/profile", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    ...buildSellerProfileBody(formData, logoUrl),
                    ...brandingBody(branding, nextBannerUrl),
                    ...(foodOrderType !== savedFoodOrderType ? { foodOrderType } : {}),
                    ...(savedAlertNumber !== null && alertNumber !== savedAlertNumber ? { lowStockThreshold: alertNumber } : {})
                }),
                credentials: "include"
            })

            if (!response.ok) {
                setError(await getErrorMessage(response, `Unable to save your shop (status ${response.status}).`))
                return
            }

            // Only now are the submitted values the new baseline.
            setSavedProfile(formData)
            setSavedFoodOrderType(foodOrderType)
            if (savedAlertNumber !== null) {
                setSavedAlertNumber(alertNumber)
            }
            setCurrentLogoUrl(logoUrl)
            setLogoFile(null)
            logoUpload.start(null)
            setSavedBranding(branding)
            setBannerUrl(nextBannerUrl)
            setBannerFile(null)
            bannerUpload.start(null)
            setRemoveBanner(false)
            setPickerKey((key) => key + 1)
            setIsSaved(true)
            window.scrollTo({ top: 0, behavior: "smooth" })
        } catch {
            setError("Something went wrong. Please check your connection and try again.")
        } finally {
            setIsSubmitting(false)
        }
    }

    const lead = "Your shop's name, where you are, how your shop page looks, and when we email you about stock."

    if (loadStatus === "loading") {
        return <SettingsLayout title="Shop details" lead={lead}><p role="status">Loading your shop...</p></SettingsLayout>
    }

    if (loadStatus === "error") {
        return (
            <SettingsLayout title="Shop details" lead={lead}>
                <Notice kind="error">
                    <p>We could not load your shop details. Please check your connection and try again.</p>
                    <button type="button" onClick={() => {
                        setLoadStatus("loading")
                        setLoadAttempt((attempt) => attempt + 1)
                    }}>Try again</button>
                </Notice>
            </SettingsLayout>
        )
    }

    const shownBanner = removeBanner ? null : bannerPreview ?? bannerUrl

    return (
        <SettingsLayout title="Shop details" lead={lead}>
            <form className="settings-grid" onSubmit={handleSubmit}>
                <div className="product-form-main">
                    {isSaved && (
                        <Notice kind="success"><p><Check size={16} aria-hidden="true" /> <b>Your shop is saved.</b> Shoppers see the changes straight away.</p></Notice>
                    )}

                    <section className="product-form-card" aria-labelledby="shop-heading">
                        <h2 id="shop-heading">Your shop</h2>
                        <fieldset className="settings-fieldset" disabled={isSubmitting}>
                            <ImagePicker
                                key={pickerKey}
                                label="Logo (optional)"
                                currentUrl={currentLogoUrl || undefined}
                                onChange={(file) => edit(() => { setLogoFile(file); logoUpload.start(file) })}
                                disabled={isSubmitting}
                                maxWidth={600}
                            />
                            <UploadStatus state={logoUpload.state} thing="logo" onRetry={logoUpload.retry} />
                            <ShopBasicsFields formData={formData} onChange={(next) => edit(() => setFormData(next))} />
                            <p className="product-help">Where you send orders from. Delivery fees are set on the <Link to="/seller/delivery">Delivery</Link> page.</p>
                        </fieldset>
                    </section>

                    <ShopLookFields
                        form={branding}
                        setForm={(next) => edit(() => setBranding(next))}
                        bannerUrl={removeBanner ? null : bannerUrl}
                        onBannerFile={(file) => edit(() => { setBannerFile(file); bannerUpload.start(file); if (file) setRemoveBanner(false) })}
                        onRemoveBanner={() => edit(() => { setRemoveBanner(true); setBannerFile(null); bannerUpload.start(null) })}
                        bannerStatus={<UploadStatus state={bannerUpload.state} thing="banner" onRetry={bannerUpload.retry} />}
                        disabled={isSubmitting}
                        pickerKey={pickerKey}
                    />

                    <ShopLinksFields form={branding} setForm={(next) => edit(() => setBranding(next))} disabled={isSubmitting} />

                    {(sellsFood || savedFoodOrderType !== "NOW") && (
                        <section className="product-form-card" aria-labelledby="food-heading">
                            <h2 id="food-heading">How your food is sold</h2>
                            <p className="product-help settings-card-lead">You see this because you sell food. It's set once for the whole shop.</p>
                            <fieldset className="settings-choices" disabled={isSubmitting}>
                                <legend className="visually-hidden">How your food is sold</legend>
                                {FOOD_CHOICES.map((choice) => (
                                    <label key={choice.value} className={`settings-choice${foodOrderType === choice.value ? " is-on" : ""}`}>
                                        <input type="radio" name={foodName} checked={foodOrderType === choice.value} onChange={() => edit(() => setFoodOrderType(choice.value))} />
                                        <span><b>{choice.title}</b><span>{choice.text}</span></span>
                                    </label>
                                ))}
                            </fieldset>
                            <p className="product-help">
                                With pre-orders, buyers ask for a ready time and you have 48 hours to approve or decline before they pay. "Pre-orders only" applies to everything you sell, not just food.
                            </p>
                        </section>
                    )}

                    {savedAlertNumber !== null && (
                        <LowStockAlertCard value={alertNumber} onChange={(next) => edit(() => setAlertNumber(next))} disabled={isSubmitting} />
                    )}

                    {error && <Notice kind="error">{error}</Notice>}

                    {hasChanges && (
                        <div className="settings-savebar" role="region" aria-label="Unsaved changes">
                            <p>{validationError ?? "You have unsaved changes"}</p>
                            <button type="button" className="btn" onClick={discardChanges} disabled={isSubmitting}>Discard</button>
                            <button type="submit" className="btn btn-primary" disabled={validationError !== null || isSubmitting}>
                                {isSubmitting ? "Saving..." : "Save changes"}
                            </button>
                        </div>
                    )}
                </div>

                <ShopPreview
                    label="How shoppers see your shop"
                    businessName={formData.businessName}
                    state={formData.state}
                    lga={formData.lga}
                    branding={branding}
                    logoUrl={logoPreview ?? (currentLogoUrl || null)}
                    bannerUrl={shownBanner}
                >
                    {slug && <Link to={`/shop/${slug}`} className="btn">See your shop page</Link>}
                </ShopPreview>
            </form>
        </SettingsLayout>
    )
}

export default EditSellerProfilePage
