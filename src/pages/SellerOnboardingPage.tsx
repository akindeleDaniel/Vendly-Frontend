import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { uploadImage } from "../lib/uploadImage"
import type { SellerProfile } from "../types/seller"
import { apiFetch } from "../lib/api"
import { buildSellerProfileBody, validateSellerProfile } from "../lib/sellerProfile"
import SellerProfileFields from "../components/SellerProfileFields"

function SellerOnboardingPage (){

    const navigate = useNavigate()

    const [formData, setFormData] = useState<SellerProfile>({
        businessName: "",
        state: "",
        lga: "",
        shippingPolicy: "FREE",
        shippingCost: ""
    })

    const [logoFile, setLogoFile] = useState<File | null>(null)// separate from formData because a file is not a string

    async function handleSubmit(e: React.SubmitEvent<HTMLFormElement>) {
        e.preventDefault()

        const validationError = validateSellerProfile(formData)
        if (validationError !== null || logoFile === null) {
            alert(validationError ?? "All areas must be filled")
            return
        }

        try{
            const logoUrl = await uploadImage(logoFile)
            if (logoUrl === null) {
                alert("Image upload failed")
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
            <h1>Set up your store</h1>
            <form onSubmit={handleSubmit}>
                <SellerProfileFields formData={formData} setFormData={setFormData} />
                <label>
                    Logo
                    <input type="file" accept="image/*"
                        onChange={(e) => setLogoFile(e.target.files?.[0] || null)}
                    />
                </label>
                <button type="submit">Save store</button>
            </form>
        </div>
    )
}

export default SellerOnboardingPage