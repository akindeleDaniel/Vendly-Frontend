import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { uploadImage } from "../lib/uploadImage"
import type { SellerProfile } from "../types/seller"
import { apiFetch, getErrorMessage } from "../lib/api"
import { buildSellerProfileBody, validateSellerProfile } from "../lib/sellerProfile"
import SellerProfileFields from "../components/SellerProfileFields"
import { useDocumentTitle } from "../lib/useDocumentTitle"

type ProfileCheckStatus = "checking" | "needs-onboarding" | "error"

function SellerOnboardingPage (){

    const navigate = useNavigate()
    useDocumentTitle("Set up your store")

    const [formData, setFormData] = useState<SellerProfile>({
        businessName: "",
        state: "",
        lga: "",
        shippingPolicy: "FREE",
        shippingCost: ""
    })

    const [logoFile, setLogoFile] = useState<File | null>(null)// separate from formData because a file is not a string
    const [checkStatus, setCheckStatus] = useState<ProfileCheckStatus>("checking")
    const [checkAttempt, setCheckAttempt] = useState(0)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [error, setError] = useState("")

    // A seller who already has a store profile does not need onboarding.
    useEffect(() => {
        const controller = new AbortController()

        async function checkExistingProfile() {
            try {
                const response = await apiFetch("/seller/profile", {
                    credentials: "include",
                    signal: controller.signal
                })

                if (controller.signal.aborted) {
                    return
                }

                if (response.ok) {
                    navigate("/seller/myListing", { replace: true })
                } else if (response.status === 404) {
                    setCheckStatus("needs-onboarding")
                } else if (response.status !== 401) {// a 401 is handled by the session guard
                    setCheckStatus("error")
                }
            } catch {
                if (!controller.signal.aborted) {
                    setCheckStatus("error")
                }
            }
        }

        checkExistingProfile()
        return () => controller.abort()
    }, [navigate, checkAttempt])

    async function handleSubmit(e: React.SubmitEvent<HTMLFormElement>) {
        e.preventDefault()

        if (isSubmitting) {
            return
        }

        const validationError = validateSellerProfile(formData)
        if (validationError !== null) {
            setError(validationError)
            return
        }
        if (logoFile === null) {
            setError("Please choose a logo for your store")
            return
        }

        setIsSubmitting(true)
        setError("")

        try{
            const logoUrl = await uploadImage(logoFile)
            if (logoUrl === null) {
                setError("Image upload failed")
                return
            }

            const response = await apiFetch("/seller/profile", {
                method: "POST",
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

            navigate("/seller/myListing")
        }catch {
            setError("Something went wrong. Please check your connection and try again.")
        }finally{
            setIsSubmitting(false)
        }
    }

    if (checkStatus === "checking") {
        return <p role="status">Loading...</p>
    }

    if (checkStatus === "error") {
        return (
            <div role="alert">
                <p>We could not check your store details. Please check your connection and try again.</p>
                <button type="button" onClick={() => {
                    setCheckStatus("checking")
                    setCheckAttempt((attempt) => attempt + 1)
                }}>Try again</button>
            </div>
        )
    }

    return(
        <div>
            <h1>Set up your store</h1>
            <form onSubmit={handleSubmit}>
                <SellerProfileFields formData={formData} setFormData={setFormData} />
                <label>
                    Logo
                    <input type="file" accept="image/*"
                        onChange={(e) => setLogoFile(e.target.files?.[0] || null)}
                    />
                </label>
                {error && <p role="alert">{error}</p>}
                <button type="submit" disabled={isSubmitting}>{isSubmitting ? "Saving..." : "Save store"}</button>
            </form>
        </div>
    )
}

export default SellerOnboardingPage
