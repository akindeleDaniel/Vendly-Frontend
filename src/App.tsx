import { useState, useEffect } from "react";

function App () {
  const [listings, setListings] = useState([])

  useEffect(() =>{
    fetch("http://localhost:3000/listings")
    .then((response) => response.json())
    .then((data) => setListings(data))
  }, [])

  return(
    <div>
      <h1>Vendly</h1>
      <p>Number of listings: {listings.length}</p>
    </div>
  )
}

export default App