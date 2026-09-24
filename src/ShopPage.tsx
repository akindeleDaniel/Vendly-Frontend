import { useEffect, useState } from "react"
import { useParams } from "react-router-dom"
import type { Listing } from "./DiscoveryPage"
import ListingCard from "./ListingCard"

type ShopProfile = {
    businessName: string
    location: string
    logoUrl: string
    slug: string
}

function ShopPage () {
    const { slug } = useParams()
    const [profile, setProfile] = useState<ShopProfile | null>(null)
    const [listings, setListings] = useState<Listing[]>([])
    const [notFound, setNotFound] = useState(false)

    useEffect(() => {
        async function fetchShop() {
            setNotFound(false)
            setProfile(null)

            try{
                const response = await fetch(`http://localhost:3000/seller/shop/${slug}`)
                const data = await response.json()

                if(!response.ok){
                    setNotFound(true)
                    return
                }

                setProfile(data.profile)
                setListings(data.listings)
            }catch(error){
                alert("Something went wrong. Please check your connection and try again.")
            }
        }

        fetchShop()
    }, [slug])

    if(notFound){
        return (
            <div>
                <h1>Store not found</h1>
            </div>
        )
    }

    if(!profile){
        return (
            <div>
                <p>Loading...</p>
            </div>
        )
    }

    return (
        <div>
            {profile.logoUrl && <img src={profile.logoUrl} alt={profile.businessName} width="80" />}
            <h1>{profile.businessName}</h1>
            <p>{profile.location}</p>
            {listings.map((listing) => {
                return (
                    <ListingCard
                        isEditable={false}
                        listing={listing}
                        key={listing.id}
                    />
                )
            })}
        </div>
    )
}

export default ShopPage