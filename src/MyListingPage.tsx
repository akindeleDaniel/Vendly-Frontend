import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import type { Listing, FormData } from "./HomePage"
import ListingCard from "./ListingCard"
import CreateListingForm from "./CreateListingForm"
import { uploadImage } from "./lib/uploadImage"

type MyListingsPageProps = {
    isLoggedIn: boolean
    isLoading: boolean
}

function MyListingsPage({ isLoggedIn, isLoading }: MyListingsPageProps) {
    const navigate = useNavigate()

    const [listings, setListings] = useState<Listing[]>([])
    const [storeLogoUrl, setStoreLogoUrl] = useState<string>("")
    const [storeName, setStoreName] = useState<string>("")
    const [imageFile, setImageFile] = useState<File | null>(null)
    const [editImageFile, setEditImageFile] = useState<File | null>(null)
    const [formKey, setFormKey] = useState(0)
    
    const [formData, setFormData] =useState<FormData>({
    title: "",
    description: "",
    price: "",
    category: ""
  })

  const [editingId, setEditingId] = useState<number | null>(null)
  const [editFormData, setEditFormData] = useState<FormData>({
    title: "",
    description: "",
    price: "",
    category: ""
  })

  async function handleSubmit(e: React.SubmitEvent<HTMLFormElement>)//this function is because whenever we click the submit button it reloads the page
   {
    e.preventDefault();
    
    if(formData.title === "" || formData.category === "" || formData.price === "" || formData.description === "" || imageFile === null){
      alert("This cannot be blank")
      return
    }
    if (isNaN(Number(formData.price)) === true || Number(formData.price) <= 0){
      alert("Price must be a number greater than 0")
      return
    }

    try{
      const imageUrl = await uploadImage(imageFile)
      if (imageUrl === null) {
        alert("Image upload failed")
        return
      }

      const response = await fetch("http://localhost:3000/listings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...formData,
          price: Number(formData.price),
          imageUrl
        }),
        credentials:"include"
      })
  
      const data = await response.json()
  
      if(!response.ok){
        alert(data.message)
        return
      }
        
        
      setListings([...listings, data]);
      setFormData({ title: "", description: "", price: "", category: "" })
      setImageFile(null)
      setFormKey(formKey + 1)
    }catch(error){
      alert("Something went wrong. Please check your connection and try again.")
    }
  }

  async function handleDelete(id: number){
      try{
        const response = await fetch(`http://localhost:3000/listings/${id}`,{
          method: "DELETE",
          credentials:"include"
        })
  
        const data = await response.json()
  
        if(!response.ok){
          alert(data.message)
          return
        }
        
          setListings(listings.filter((listing) => listing.id !== id))

      }catch(error){
        alert("Something went wrong. Please check your connection and try again.")
      }
    }

    function handleEditClick(listing: Listing){
    setEditingId(listing.id)
    setEditImageFile(null)
    setEditFormData({
      title: listing.title,
      description: listing.description,
      price: String(listing.price),
      category: listing.category
    })
  }

   async function handleSave(id: number) {
    if(editFormData.title === "" || editFormData.category === "" || editFormData.price === "" || editFormData.description === ""){
      alert("This cannot be blank")
      return
    }

    if (isNaN(Number(editFormData.price)) === true || Number(editFormData.price) <= 0){
      alert("Price must be a number greater than 0")
      return
    }

    try{
      let imageUrl: string | undefined = undefined

      if (editImageFile !== null) {
        const uploadedUrl = await uploadImage(editImageFile)
        if (uploadedUrl === null) {
          alert("Image upload failed")
          return
        }
        imageUrl = uploadedUrl
      }

      const response = await fetch(`http://localhost:3000/listings/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...editFormData,
          price: Number(editFormData.price),
          imageUrl
        }),
        credentials:"include"
      })

      const data = await response.json()

      if(!response.ok){
        alert(data.message)
        return
      }       

      setListings(
        listings.map((listing) =>
          listing.id === id ? data : listing
        )
      );
      setEditingId(null);
      setEditImageFile(null)
    }catch(error){
      alert("Something went wrong. Please check your connection and try again.")
    }
  }

    function handleCancel() {
      setEditingId(null);
      setEditImageFile(null)
    }

    useEffect(() => {
        if (!isLoggedIn && !isLoading) {
            navigate("/login")
        }
    }, [isLoggedIn, isLoading])
    
    useEffect(() => {
        async function fetchMyListings() {
            const response = await fetch("http://localhost:3000/listings/Mylisting", {
                credentials: "include"
            })
            const data = await response.json()
            if (response.ok) {
                setListings(data)
            }
        }

        async function fetchStoreProfile() {
            const response = await fetch("http://localhost:3000/seller/profile", {
                credentials: "include"
            })
            const data = await response.json()
            if (response.ok) {
                setStoreLogoUrl(data.logoUrl)
                setStoreName(data.businessName)
            }
        }

        fetchMyListings()
        fetchStoreProfile()
    }, [])
    
    return (
        <div>
            {storeLogoUrl && <img src={storeLogoUrl} alt={storeName || "Store logo"} width="80" />}
            {storeName && <h1>{storeName}</h1>}

            <CreateListingForm 
              key={formKey}
              formData={formData}
              handleSubmit={handleSubmit}
              setFormData={setFormData}
              setImageFile={setImageFile}
            />

            {listings.map((listing) => {
                return(
                    <ListingCard 
                        isEditable={true}
                        listing={listing}
                        editingId={editingId}
                        editFormData={editFormData}
                        setEditFormData={setEditFormData}
                        setEditImageFile={setEditImageFile}
                        handleEditClick={handleEditClick}
                        handleDelete={handleDelete}
                        handleCancel={handleCancel}
                        handleSave={handleSave}
                        key={listing.id}
                    />
                )})
            }
        </div>
    )
}

export default MyListingsPage