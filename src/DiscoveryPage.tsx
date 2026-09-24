import { useState, useEffect } from "react";
import ListingCard from "./ListingCard";

export type Listing = {
id: number;
title: string;
description: string;
price: number;
category: string;
imageUrl: string;
createdAt: string;// date is a string because when coming from express or json, it comes as a string(stringify)
sellerSlug?: string | null;
sellerName?: string | null;
};

export type FormData = {
  title: string
  description: string
  price: string
  category: string
}

function HomePage () {
  const [listings, setListings] = useState<Listing[]>([])

  const [searchTerm, setSearchTerm] = useState<string>("")

  useEffect(() => {
  fetch(`http://localhost:3000/listings?search=${searchTerm}`)
    .then((response) => response.json())
    .then((data) => setListings(data));
}, [searchTerm])

  return (
    <div>
      <h1>Vendly</h1>
      <label>
        Search
        <input value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </label>
      {listings.map((listing) => {
        return (
          <ListingCard 
            isEditable={false}
            listing={listing} 
            key={listing.id}
          />
        );
    })}
    </div>
  )

}


export default HomePage