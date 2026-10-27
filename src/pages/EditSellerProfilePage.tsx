import { useState, useEffect } from "react"
import { Link, useNavigate } from "react-router-dom"
import { uploadImage } from "../lib/uploadImage"
import type { SellerProfile } from "../types/seller"
import { apiFetch, getErrorMessage } from "../lib/api"
import { buildSellerProfileBody, validateSellerProfile } from "../lib/sellerProfile"
import SellerProfileFields from "../components/SellerProfileFields"
import { FOOD_ORDER_TYPE_OPTIONS } from "../types/preOrder"
import type { FoodOrderType } from "../types/preOrder"
import { useDocumentTitle } from "../lib/useDocumentTitle"
import Notice from "../components/Notice"
import ImagePicker from "../components/ImagePicker"
import BrandingFields from "../components/BrandingFields"
import { EMPTY_BRANDING_FORM, brandingBody, brandingChanged, brandingFormFrom } from "../lib/branding"
import type { BrandingForm } from "../types/branding"

type LoadStatus = "loading" | "ready" | "error"

function EditSellerProfilePage (){

    const navigate = useNavigate()
    useDocumentTitle("Edit your store")

    const [formData, setFormData] = useState<SellerProfile>({
        businessName: "",
        state: "",
        lga: "",
        shippingPolicy: "FREE",
        shippingCost: ""
    })

    const [foodOrderType, setFoodOrderType] = useState<FoodOrderType>("NOW")
    const [savedFoodOrderType, setSavedFoodOrderType] = useState<FoodOrderType>("NOW")
    const [sellsFood, setSellsFood] = useState(false)// has a Food & Grocery listing on sale
    const [savedProfile, setSavedProfile] = useState<SellerProfile | null>(null)// last values loaded from or saved to the server, used to detect edits
    const [currentLogoUrl, setCurrentLogoUrl] = useState<string>("")
    const [logoFile, setLogoFile] = useState<File | null>(null)// only filled if the seller picks a new logo
    const [branding, setBranding] = useState<BrandingForm>(EMPTY_BRANDING_FORM)
    const [savedBranding, setSavedBranding] = useState<BrandingForm>(EMPTY_BRANDING_FORM)
    const [bannerUrl, setBannerUrl] = useState<string | null>(null)// the saved banner
    const [bannerFile, setBannerFile] = useState<File | null>(null)// a new banner, uploaded on save
    const [removeBanner, setRemoveBanner] = useState(false)
    const [loadStatus, setLoadStatus] = useState<LoadStatus>("loading")
    const [loadAttempt, setLoadAttempt] = useState(0)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [error, setError] = useState("")

    useEffect(() => {
        const controller = new AbortController()

        async function fetchProfile() {
            try{
                const response = await apiFetch("/seller/profile", {
                    credentials: "include",
                    signal: controller.signal
                })

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
                setFoodOrderType(loadedFoodOrderType)
                setSavedFoodOrderType(loadedFoodOrderType)
                setCurrentLogoUrl(data.logoUrl ?? "")
                const loadedBranding = brandingFormFrom(data.branding)
                setBranding(loadedBranding)
                setSavedBranding(loadedBranding)
                setBannerUrl(data.branding?.bannerUrl ?? null)
                setLoadStatus("ready")
            }catch {
                if (!controller.signal.aborted) {
                    setLoadStatus("error")
                }
            }
        }
        fetchProfile()

        return () => controller.abort()
    }, [navigate, loadAttempt])

    const validationError = validateSellerProfile(formData)

    // Save stays disabled until the profile has loaded and something differs from the saved values.
    const hasChanges =
        savedProfile !== null &&
        (
            logoFile !== null ||
            bannerFile !== null ||
            removeBanner ||
            brandingChanged(branding, savedBranding) ||
            foodOrderType !== savedFoodOrderType ||
            formData.businessName.trim() !== savedProfile.businessName.trim() ||
            formData.state !== savedProfile.state ||
            formData.lga !== savedProfile.lga ||
            formData.shippingPolicy !== savedProfile.shippingPolicy ||
            (formData.shippingPolicy === "FIXED" && Number(formData.shippingCost) !== Number(savedProfile.shippingCost))
        )

    async function handleSubmit(e: React.SubmitEvent<HTMLFormElement>) {
        e.preventDefault()

        if (isSubmitting || !hasChanges) {
            return
        }

        if (validationError !== null) {
            setError(validationError)
            return
        }

        setIsSubmitting(true)
        setError("")

        try{
            let logoUrl = currentLogoUrl// keeps the old logo unless a new one was picked

            if (logoFile !== null) {
                const uploadedUrl = await uploadImage(logoFile)
                if (uploadedUrl === null) {
                    setError("Image upload failed")
                    return
                }
                logoUrl = uploadedUrl
            }

            let nextBannerUrl = removeBanner ? null : bannerUrl
            if (bannerFile !== null) {
                nextBannerUrl = await uploadImage(bannerFile)
                if (nextBannerUrl === null) {
                    setError("The banner could not be uploaded. Please check your connection and try again.")
                    return
                }
            }

            const response = await apiFetch("/seller/profile", {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    ...buildSellerProfileBody(formData, logoUrl),
                    ...brandingBody(branding, nextBannerUrl),
                    ...(foodOrderType !== savedFoodOrderType ? { foodOrderType } : {})
                }),
                credentials: "include"
            })

            if (!response.ok) {
                setError(await getErrorMessage(response, `Unable to save your store (status ${response.status}).`))
                return
            }

            // Only now are the submitted values the new baseline.
            setSavedProfile(formData)
            setSavedFoodOrderType(foodOrderType)
            setCurrentLogoUrl(logoUrl)
            setLogoFile(null)
            setSavedBranding(branding)
            setBannerUrl(nextBannerUrl)
            setBannerFile(null)
            setRemoveBanner(false)
            navigate("/seller/myListing")
        }catch {
            setError("Something went wrong. Please check your connection and try again.")
        }finally{
            setIsSubmitting(false)
        }
    }

    if (loadStatus === "loading") {
        return <p role="status">Loading your store...</p>
    }

    if (loadStatus === "error") {
        return (
            <div className="form-page-wide">
                <h1>Edit your store</h1>
                <Notice kind="error">
                    <p>We could not load your store details. Please check your connection and try again.</p>
                    <button type="button" onClick={() => {
                        setLoadStatus("loading")
                        setLoadAttempt((attempt) => attempt + 1)
                    }}>Try again</button>
                </Notice>
            </div>
        )
    }

    return(
        <div className="form-page-wide">
            <h1>Edit your store</h1>
            <form onSubmit={handleSubmit} className="card form-card">
                <SellerProfileFields formData={formData} setFormData={setFormData} showShipping={false} />
                <p className="field-help">Delivery fees, and the states you deliver to, are set on the <Link to="/seller/delivery">Delivery</Link> page.</p>
                {(sellsFood || savedFoodOrderType !== "NOW") && (
                    <>
                        <label>
                            How your food is sold
                            <select value={foodOrderType} disabled={isSubmitting} onChange={(event) => setFoodOrderType(event.target.value as FoodOrderType)}>
                                {FOOD_ORDER_TYPE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                            </select>
                        </label>
                        <p className="field-help">
                            This is set once for the whole shop, not for each listing. With pre-orders, buyers ask for a ready time and you have 48 hours to approve or decline before they pay.
                        </p>
                        <p className="field-help">
                            "Pre-orders only" applies to everything you sell, not just food. If you sell other things too, choose "Both" so buyers can still order those for delivery now.
                        </p>
                    </>
                )}
                <ImagePicker
                    label="Change logo (optional)"
                    currentUrl={currentLogoUrl || undefined}
                    onChange={setLogoFile}
                    disabled={isSubmitting}
                />
                <BrandingFields
                    form={branding}
                    setForm={setBranding}
                    bannerUrl={removeBanner ? null : bannerUrl}
                    onBannerFile={(file) => { setBannerFile(file); if (file) setRemoveBanner(false) }}
                    onRemoveBanner={() => { setRemoveBanner(true); setBannerFile(null) }}
                    disabled={isSubmitting}
                />
                {hasChanges && validationError && <Notice kind="error">{validationError}</Notice>}
                {error && <Notice kind="error">{error}</Notice>}
                <button type="submit" className="btn-block btn-lg" disabled={!hasChanges || validationError !== null || isSubmitting}>
                    {isSubmitting ? "Saving..." : "Save changes"}
                </button>
            </form>
        </div>
    )
}

export default EditSellerProfilePage
