import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { uploadImage } from "../lib/uploadImage"
import type { SellerProfile } from "../types/seller"
import { apiFetch, getErrorMessage } from "../lib/api"
import { buildSellerProfileBody, validateSellerProfile } from "../lib/sellerProfile"
import SellerProfileFields from "../components/SellerProfileFields"
import { useDocumentTitle } from "../lib/useDocumentTitle"
import Notice from "../components/Notice"
import ImagePicker from "../components/ImagePicker"

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

    const [savedProfile, setSavedProfile] = useState<SellerProfile | null>(null)// last values loaded from or saved to the server, used to detect edits
    const [currentLogoUrl, setCurrentLogoUrl] = useState<string>("")
    const [logoFile, setLogoFile] = useState<File | null>(null)// only filled if the seller picks a new logo
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
                setFormData(loadedProfile)
                setSavedProfile(loadedProfile)
                setCurrentLogoUrl(data.logoUrl ?? "")
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

            const response = await apiFetch("/seller/profile", {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(buildSellerProfileBody(formData, logoUrl)),
                credentials: "include"
            })

            if (!response.ok) {
                setError(await getErrorMessage(response, `Unable to save your store (status ${response.status}).`))
                return
            }

            // Only now are the submitted values the new baseline.
            setSavedProfile(formData)
            setCurrentLogoUrl(logoUrl)
            setLogoFile(null)
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
                <SellerProfileFields formData={formData} setFormData={setFormData} />
                <ImagePicker
                    label="Change logo (optional)"
                    currentUrl={currentLogoUrl || undefined}
                    onChange={setLogoFile}
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
