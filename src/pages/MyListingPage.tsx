import { useState, useEffect } from "react"
import { Link, useNavigate } from "react-router-dom"
import type {ListingFormData, Listing} from "../types/listing"
import ListingCard from "../components/ListingCard"
import CreateListingForm, { type CreateListingFormData } from "../components/CreateListingForm"
import { uploadImage } from "../lib/uploadImage"
import { apiFetch, getErrorMessage } from "../lib/api"

function MyListingsPage() {
    const navigate = useNavigate()

    const [listings, setListings] = useState<Listing[]>([])
    const [storeLogoUrl, setStoreLogoUrl] = useState<string>("")
    const [storeName, setStoreName] = useState<string>("")
    const [storeSlug, setStoreSlug] = useState<string>("")
    const [imageFile, setImageFile] = useState<File | null>(null)
    const [editImageFile, setEditImageFile] = useState<File | null>(null)
    const [formKey, setFormKey] = useState(0)
    const [linkCopied, setLinkCopied] = useState(false)
    const [loadError, setLoadError] = useState<string | null>(null)
    const [isSaving, setIsSaving] = useState(false)
    const [saveError, setSaveError] = useState("")
    const [loadAttempt, setLoadAttempt] = useState(0)
    
    const [formData, setFormData] =useState<CreateListingFormData>({
    title: "",
    description: "",
    price: "",
    category: "",
    stockQuantity: ""
  })

  const [editingId, setEditingId] = useState<number | null>(null)
  const [editFormData, setEditFormData] = useState<ListingFormData>({
    title: "",
    description: "",
    price: "",
    category: "",
    stockQuantity: ""
  })

  const handleCopyShopLink = async () => {
      if (!storeSlug) return

      const shopUrl = `${window.location.origin}/shop/${storeSlug}`

      try {
          await navigator.clipboard.writeText(shopUrl)

          setLinkCopied(true)

          setTimeout(() => {
              setLinkCopied(false)
          }, 2000)
      } catch {
          // Keep the UI unchanged if copying fails.
      }
  }

  async function handleSubmit(e: React.SubmitEvent<HTMLFormElement>)//this function is because whenever we click the submit button it reloads the page
   {
    e.preventDefault();
    
    if(formData.title === "" || formData.category === "" || formData.price === "" || formData.stockQuantity === "" || formData.description === "" || imageFile === null){
      alert("This cannot be blank")
      return
    }
    if (!Number.isFinite(Number(formData.price)) || Number(formData.price) <= 0){
      alert("Price must be a number greater than 0")
      return
    }
    if (!Number.isInteger(Number(formData.stockQuantity)) || Number(formData.stockQuantity) < 0) {
      alert("Stock quantity must be a whole number greater than or equal to 0")
      return
    }

    try{
      const imageUrl = await uploadImage(imageFile)
      if (imageUrl === null) {
        alert("Image upload failed")
        return
      }

      const response = await apiFetch("/listings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...formData,
          price: Number(formData.price),
          stockQuantity: Number(formData.stockQuantity),
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
      setFormData({ title: "", description: "", price: "", category: "", stockQuantity: "" })
      setImageFile(null)
      setFormKey(formKey + 1)
    }catch {
      alert("Something went wrong. Please check your connection and try again.")
    }
  }

  async function handleDelete(id: number){
      try{
        const response = await apiFetch(`/listings/${id}`,{
          method: "DELETE",
          credentials:"include"
        })
  
        const data = await response.json()
  
        if(!response.ok){
          alert(data.message)
          return
        }
        
          setListings(listings.filter((listing) => listing.id !== id))

      }catch {
        alert("Something went wrong. Please check your connection and try again.")
      }
    }

    function handleEditClick(listing: Listing){
    setEditingId(listing.id)
    setEditImageFile(null)
    setSaveError("")
    setEditFormData({
      title: listing.title,
      description: listing.description,
      price: String(listing.price),
      category: listing.category,
      stockQuantity: String(listing.stockQuantity)
    })
  }

  // The Save button stays disabled until the edit form differs from the saved listing or a new photo is chosen.
  function hasListingChanges(listing: Listing) {
    return (
      editImageFile !== null ||
      editFormData.title !== listing.title ||
      editFormData.description !== listing.description ||
      editFormData.category !== listing.category ||
      Number(editFormData.price) !== listing.price ||
      Number(editFormData.stockQuantity) !== listing.stockQuantity
    )
  }

   async function handleSave(id: number) {
    if (isSaving) {
      return
    }

    if(editFormData.title === "" || editFormData.category === "" || editFormData.price === "" || editFormData.stockQuantity === "" || editFormData.description === ""){
      setSaveError("This cannot be blank")
      return
    }

    if (isNaN(Number(editFormData.price)) === true || Number(editFormData.price) <= 0){
      setSaveError("Price must be a number greater than 0")
      return
    }

    if (!Number.isInteger(Number(editFormData.stockQuantity)) || Number(editFormData.stockQuantity) < 0) {
      setSaveError("Stock quantity must be a whole number greater than or equal to 0")
      return
    }

    setIsSaving(true)
    setSaveError("")

    try{
      let imageUrl: string | undefined = undefined

      if (editImageFile !== null) {
        const uploadedUrl = await uploadImage(editImageFile)
        if (uploadedUrl === null) {
          setSaveError("Image upload failed")
          return
        }
        imageUrl = uploadedUrl
      }

      const response = await apiFetch(`/listings/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...editFormData,
          price: Number(editFormData.price),
          stockQuantity: Number(editFormData.stockQuantity),
          imageUrl
        }),
        credentials:"include"
      })

      if(!response.ok){
        // Shows the backend's own message, for example the reserved-stock conflict returned with HTTP 409.
        setSaveError(await getErrorMessage(response, `Unable to save this listing (status ${response.status}).`))
        return
      }

      const savedListing: Listing = await response.json()

      // The saved listing becomes the new baseline for the dirty-state check.
      setListings((currentListings) =>
        currentListings.map((listing) =>
          listing.id === id ? savedListing : listing
        )
      );
      setEditingId(null);
      setEditImageFile(null)
    }catch {
      setSaveError("Something went wrong. Please check your connection and try again.")
    }finally{
      setIsSaving(false)
    }
  }

    function handleCancel() {
      setSaveError("")
      setEditingId(null);
      setEditImageFile(null)
    }

    useEffect(() => {
        const controller = new AbortController()

        async function loadStore() {
            setLoadError(null)

            try {
                const [profileResponse, listingsResponse] = await Promise.all([
                    apiFetch("/seller/profile", { credentials: "include", signal: controller.signal }),
                    apiFetch("/listings/Mylisting", { credentials: "include", signal: controller.signal })
                ])

                if (controller.signal.aborted) {
                    return
                }

                if (profileResponse.status === 404) {// no store profile yet, so the seller still has to onboard
                    navigate("/seller/onboarding", { replace: true })
                    return
                }

                if (profileResponse.status === 401 || listingsResponse.status === 401) {
                    return// the session guard handles an expired session
                }

                if (!profileResponse.ok || !listingsResponse.ok) {
                    setLoadError("We could not load your store. Please try again.")
                    return
                }

                const profile = await profileResponse.json()
                const myListings = await listingsResponse.json()
                if (controller.signal.aborted) {
                    return
                }
                setStoreLogoUrl(profile.logoUrl)
                setStoreName(profile.businessName)
                setStoreSlug(profile.slug)
                setListings(myListings)
            } catch {
                if (!controller.signal.aborted) {
                    setLoadError("We could not load your store. Please check your connection and try again.")
                }
            }
        }

        loadStore()
        return () => controller.abort()
    }, [navigate, loadAttempt])
    
    return (
        <div>
            {loadError && (
              <div role="alert">
                <p>{loadError}</p>
                <button type="button" onClick={() => setLoadAttempt((attempt) => attempt + 1)}>Try again</button>
              </div>
            )}
            {storeLogoUrl && <img src={storeLogoUrl} alt={storeName || "Store logo"} width="80" />}
            {storeName && <h1>{storeName}</h1>}
            {storeName && <Link to="/seller/profile/edit">Edit store details</Link>}
            {storeSlug && (
              <div>
                  <p>Your shop link: /shop/{storeSlug}</p>

                  <button type="button" onClick={handleCopyShopLink}>
                      {linkCopied ? "Copied!" : "Copy shop link"}
                  </button>
              </div>
            )}

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
                        hasChanges={listing.id === editingId && hasListingChanges(listing)}
                        isSaving={isSaving}
                        saveError={listing.id === editingId ? saveError : ""}
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