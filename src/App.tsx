import { useState, useEffect } from "react";
import ListingCard from "./ListingCard";
import CreateListingForm from "./CreateListingForm";

export type Listing = {
id: number;
title: string;
description: string;
price: number;
category: string;
createdAt: string;// date is a string because when coming from express or json, it comes as a string(stringify)
};

export type FormData = {
  title: string
  description: string
  price: string
  category: string
}

function App () {


  const [listings, setListings] = useState<Listing[]>([])

  const [searchTerm, setSearchTerm] = useState<string>("")
  
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

  useEffect(() => {
  fetch(`http://localhost:3000/listings?search=${searchTerm}`)
    .then((response) => response.json())
    .then((data) => setListings(data));
}, [searchTerm]);

  function handleSubmit(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    
    if(formData.title === "" || formData.category === "" || formData.price === "" || formData.description === ""){
      alert("This cannot be blank")
      return
    }
    if (isNaN(Number(formData.price)) === true){
      alert("Invalid number inputed(Remove comma if available)")
      return
    }

    fetch("http://localhost:3000/listings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ...formData,
        price: Number(formData.price),
      }),
    })
      .then((response) => response.json())
      .then((newListing) => {
        setListings([...listings, newListing]);
        setFormData({ title: "", description: "", price: "", category: "" });
      });
  }

  function handleDelete(id: number){
      fetch(`http://localhost:3000/listings/${id}`,{
        method: "DELETE",
      })
      .then(()=>{
        setListings(listings.filter((listing) => listing.id !== id))
      })
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

  function handleSave(id: number) {
    fetch(`http://localhost:3000/listings/${id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ...editFormData,
        price: Number(editFormData.price),
      }),
    })
      .then((response) => response.json())
      .then((updatedListing) => {
        setListings(
          listings.map((listing) =>
            listing.id === id ? updatedListing : listing
          )
        );
        setEditingId(null);
      });
  }

    function handleCancel() {
      setEditingId(null);
    }

  return (
    <div>
      <h1>Vendly</h1>
      <label>
        Search
        <input value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </label>

      <CreateListingForm 
        formData={formData}
        handleSubmit={handleSubmit}
        setFormData={setFormData}
      />
      {listings.map((listing) => {
        return (
          <ListingCard  
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
        );
    })}
    </div>
  )

}


export default App



