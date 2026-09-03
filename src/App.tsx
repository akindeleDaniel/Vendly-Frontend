import { useState, useEffect } from "react";

type Listing = {
id: number;
title: string;
description: string;
price: number;
category: string;
createdAt: string;// date is a string because when coming from express or json, it comes as a string(stringify)
};

function App () {


  const [listings, setListings] = useState<Listing[]>([])

  useEffect(() =>{
    fetch("http://localhost:3000/listings")
    .then((response) => response.json())
    .then((data) => setListings(data))
  }, [])

  return (
    <div>
      <h1>Vendly</h1>
      {listings.map((listing) => {
        return (
          <div key={listing.id}>
            <div>{listing.id}</div>
            <div>{listing.title}</div>
            <div>{listing.price}</div>
            <div>{listing.description}</div>
            <div>{listing.category}</div>
          </div>
        )

      })}
    </div>
  )

}


export default App