import { useState } from "react"
import { useNavigate } from "react-router-dom"

type SellerProfile = {
    businessName: string
    location: string
}

function SellerOnboardingPage (){

    const navigate = useNavigate()

    const [formData, setFormData] = useState<SellerProfile>({
        businessName: "",
        location: ""
    })

    const [logoFile, setLogoFile] = useState<File | null>(null)// separate from formData because a file is not a string

    async function handleSubmit(e: React.SubmitEvent<HTMLFormElement>) {
        e.preventDefault()

        if (formData.businessName === "" || formData.location === "" || logoFile === null) {
            alert("All areas must be filled")
            return
        }

        try{
            // step 1: send the image straight to cloudinary, not to our backend
            const imageData = new FormData()
            imageData.append("file", logoFile)
            imageData.append("upload_preset", import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET)

            const cloudinaryResponse = await fetch(`https://api.cloudinary.com/v1_1/${import.meta.env.VITE_CLOUDINARY_CLOUD_NAME}/image/upload`, {
                method: "POST",
                body: imageData// no Content-Type header here, FormData sets its own
            })

            const cloudinaryData = await cloudinaryResponse.json()

            if (!cloudinaryResponse.ok || !cloudinaryData.secure_url) {
                alert("Image upload failed")
                return
            }

            // step 2: send the url cloudinary gave us to our own backend
            const response = await fetch("http://localhost:3000/seller/profile", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    ...formData,
                    logoUrl: cloudinaryData.secure_url
                }),
                credentials: "include"
            })

            const data = await response.json()

            if (!response.ok) {
                alert(data.message)
                return
            }

            navigate("/seller/myListing")
        }catch(error){
            alert("Something went wrong. Please check your connection and try again.")
        }
    }

    return(
        <div>
            <h1>Set up your store</h1>
            <form onSubmit={handleSubmit}>
                <label>
                    Business name
                    <input name="businessName"
                        value={formData.businessName}
                        onChange={(e) => setFormData({...formData, [e.target.name]: e.target.value})}
                    />
                </label>
                <label>
                    Location
                    <input name="location"
                        value={formData.location}
                        onChange={(e) => setFormData({...formData, [e.target.name]: e.target.value})}
                    />
                </label>
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