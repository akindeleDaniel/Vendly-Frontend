import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { uploadImage } from "./lib/uploadImage"

type SellerProfile = {
    businessName: string
    location: string
}

function EditSellerProfilePage (){

    const navigate = useNavigate()

    const [formData, setFormData] = useState<SellerProfile>({
        businessName: "",
        location: ""
    })

    const [currentLogoUrl, setCurrentLogoUrl] = useState<string>("")
    const [logoFile, setLogoFile] = useState<File | null>(null)// only filled if the seller picks a new logo

    useEffect(() => {
        async function fetchProfile() {
            try{
                const response = await fetch("http://localhost:3000/seller/profile", {
                    credentials: "include"
                })

                const data = await response.json()

                if (!response.ok) {
                    alert(data.message)
                    return
                }

                setFormData({
                    businessName: data.businessName,
                    location: data.location
                })
                setCurrentLogoUrl(data.logoUrl)
            }catch(error){
                alert("Something went wrong. Please check your connection and try again.")
            }
        }
        fetchProfile()
    }, [])

    async function handleSubmit(e: React.SubmitEvent<HTMLFormElement>) {
        e.preventDefault()

        if (formData.businessName === "" || formData.location === "") {
            alert("All areas must be filled")
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

            const response = await fetch("http://localhost:3000/seller/profile", {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    ...formData,
                    logoUrl
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
            <h1>Edit your store</h1>
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
                <button type="submit">Save changes</button>
            </form>
        </div>
    )
}

export default EditSellerProfilePage