import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import type { Listing, FormData } from "./HomePage"
import ListingCard from "./ListingCard"
import CreateListingForm from "./CreateListingForm"

type MyListingsPageProps = {
    isLoggedIn: boolean
    isLoading: boolean
}

function MyListingsPage({ isLoggedIn, isLoading }: MyListingsPageProps) {
    const navigate = useNavigate()

    const [listings, setListings] = useState<Listing[]>([])
    
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
    
    if(formData.title === "" || formData.category === "" || formData.price === "" || formData.description === ""){
      alert("This cannot be blank")
      return
    }
    if (isNaN(Number(formData.price)) === true){
      alert("Invalid number inputed(Remove comma if available)")
      return
    }

    try{
      const response = await fetch("http://localhost:3000/listings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...formData,
          price: Number(formData.price),
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
    setEditFormData({
      title: listing.title,
      description: listing.description,
      price: String(listing.price),
      category: listing.category
    })
  }

   async function handleSave(id: number) {
    try{
      const response = await fetch(`http://localhost:3000/listings/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...editFormData,
          price: Number(editFormData.price),
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
    }catch(error){
      alert("Something went wrong. Please check your connection and try again.")
    }
  }

    function handleCancel() {
      setEditingId(null);
    }

    useEffect(() => {
        if (!isLoggedIn && !isLoading) {
            navigate("/login", {state:{from: "/myListing"}})
        }
    }, [isLoggedIn, isLoading])
    
    useEffect(() => {
        async function fetchMyListings() {
            const response = await fetch("http://localhost:3000/listings/Mylisting", {
                credentials: "include"
            })
            const data = await response.json()
            setListings(data)
        }
        fetchMyListings()
    }, [])
    
    return (
        <div>
            <CreateListingForm 
                formData={formData}
                handleSubmit={handleSubmit}
                setFormData={setFormData}
            />

            {listings.map((listing) => {
                return(
                    <ListingCard 
                        isEditable={true}
                        listing={listing}
                        editingId={editingId}
                        editFormData={editFormData}
                        setEditFormData={setEditFormData}
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