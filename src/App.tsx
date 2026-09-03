import { useState, useEffect } from "react";

type Listing = {
id: number;
title: string;
description: string;
price: number;
category: string;
createdAt: string;// date is a string because when coming from express or json, it comes as a string(stringify)
};

type FormData = {
  title: string
  description: string
  price: string
  category: string
}

function App () {


  const [listings, setListings] = useState<Listing[]>([])

  const [formData, setFormData] =useState<FormData>({
    title: "",
    description: "",
    price: "",
    category: ""
  })

  useEffect(() =>{
    fetch("http://localhost:3000/listings")
    .then((response) => response.json())
    .then((data) => setListings(data))
  }, [])

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
      fetch(`http://localhost:3000/listing/${id}`,{
        method: "DELETE",
      })
      .then(()=>{
        setListings(listings.filter((listing) => listing.id != id))
      })
    }

  return (
    <div>
      <h1>Vendly</h1>
      <form onSubmit={handleSubmit}>
        <label>
          Title
          <input name="title"
            value={formData.title}
            onChange={(e) => setFormData({...formData, [e.target.name]: e.target.value})}
          />
        </label>
        <label>
          Description
          <input name="description"
          value={formData.description}
          onChange={(e) => setFormData({...formData, [e.target.name]: e.target.value})}
        />
        </label>
        <label>
          Price
          <input name="price"
          value={formData.price}
          onChange={(e) => setFormData({...formData, [e.target.name]: e.target.value})}
          />
        </label>
        <label>
          Category
          <input name="category"
          value={formData.category}
          onChange={(e) => setFormData({...formData, [e.target.name]: e.target.value})}
          />
        </label>
        <button type="submit">Create Listing</button>
      </form>

      {listings.map((listing) => {
        return (
          <div key={listing.id}>
            <div>{listing.id}</div>
            <div>{listing.title}</div>
            <div>{listing.price}</div>
            <div>{listing.description}</div>
            <div>{listing.category}</div>
            <button onClick={() => handleDelete(listing.id)}>Delete</button>
          </div>
        )

      })}
    </div>
  )

}


export default App