import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { uploadImage } from "../lib/uploadImage"
import type { SellerProfile } from "../types/seller"
import { apiFetch } from "../lib/api"
import { buildSellerProfileBody, validateSellerProfile } from "../lib/sellerProfile"
import SellerProfileFields from "../components/SellerProfileFields"

function EditSellerProfilePage (){

    const navigate = useNavigate()

    const [formData, setFormData] = useState<SellerProfile>({
        businessName: "",
        state: "",
        lga: "",
        shippingPolicy: "FREE",
        shippingCost: ""
    })

    const [savedProfile, setSavedProfile] = useState<SellerProfile | null>(null)// last values loaded from the server, used to detect edits
    const [currentLogoUrl, setCurrentLogoUrl] = useState<string>("")
    const [logoFile, setLogoFile] = useState<File | null>(null)// only filled if the seller picks a new logo

    useEffect(() => {
        async function fetchProfile() {
            try{
                const response = await apiFetch("/seller/profile", {
                    credentials: "include"
                })

                const data = await response.json()

                if (!response.ok) {
                    alert(data.message)
                    return
                }

                const loadedProfile: SellerProfile = {
                    businessName: data.businessName,
                    state: data.state,
                    lga: data.lga,
                    shippingPolicy: data.shippingPolicy === "FIXED" ? "FIXED" : "FREE",
                    shippingCost: data.shippingCost === null || data.shippingCost === undefined ? "" : String(data.shippingCost)
                }
                setFormData(loadedProfile)
                setSavedProfile(loadedProfile)
                setCurrentLogoUrl(data.logoUrl)
            }catch {
                alert("Something went wrong. Please check your connection and try again.")
            }
        }
        fetchProfile()
    }, [])

    // Save stays disabled until the profile has loaded and something differs from the saved values.
    const hasChanges =
        savedProfile !== null &&
        (
            logoFile !== null ||
            formData.businessName !== savedProfile.businessName ||
            formData.state !== savedProfile.state ||
            formData.lga !== savedProfile.lga ||
            formData.shippingPolicy !== savedProfile.shippingPolicy ||
            (formData.shippingPolicy === "FIXED" && Number(formData.shippingCost) !== Number(savedProfile.shippingCost))
        )

    async function handleSubmit(e: React.SubmitEvent<HTMLFormElement>) {
        e.preventDefault()

        const validationError = validateSellerProfile(formData)
        if (validationError !== null) {
            alert(validationError)
            return
        }

        try{
            let logoUrl = currentLogoUrl// keeps the old logo unless a new one was picked

            if (logoFile !== null) {
                const uploadedUrl = await uploadImage(logoFile)
                if (uploadedUrl === null) {
                    alert("Image upload failed")
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

            const data = await response.json()

            if (!response.ok) {
                alert(data.message)
                return
            }

            navigate("/seller/myListing")
        }catch {
            alert("Something went wrong. Please check your connection and try again.")
        }
    }

    return(
        <div>
            <h1>Edit your store</h1>
            <form onSubmit={handleSubmit}>
                <SellerProfileFields formData={formData} setFormData={setFormData} />
                <div>
                    <p>Current logo</p>
                    {currentLogoUrl && <img src={currentLogoUrl} alt="Current logo" width="100" />}
                </div>
                <label>
                    Change logo (optional)
                    <input type="file" accept="image/*"
                        onChange={(e) => setLogoFile(e.target.files?.[0] || null)}
                    />
                </label>
                <button type="submit" disabled={!hasChanges}>Save changes</button>
            </form>
        </div>
    )
}

export default EditSellerProfilePage