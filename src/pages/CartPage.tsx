import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"

type CartItem = {
  listingId: number
  quantity: number
  listing: {
    id: number
    title: string
    description: string
    price: number
    stockQuantity: number
    category: string
    imageUrl: string | null
    user: {
      sellerProfile: {
        businessName: string
        slug: string
      }
    }
  }
}

type CartResponse = {
  cart: {
    cartItems: CartItem[]
  }
}

function CartPage() {
  const navigate = useNavigate()
  const [cartItems, setCartItems] = useState<CartItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()

    async function fetchCart() {
      try {
        const response = await fetch("http://localhost:3000/cart", {
          credentials: "include",
          signal: controller.signal
        })

        if (response.status === 401) {
          navigate("/login")
          return
        }

        if (!response.ok) {
          throw new Error(`Cart request failed with status ${response.status}`)
        }

        const data: CartResponse = await response.json()
        if (!controller.signal.aborted) {
          setCartItems(data.cart.cartItems)
        }
      } catch (fetchError) {
        if (!controller.signal.aborted) {
          console.error("Unable to load cart:", fetchError)
          setError("Unable to load your cart. Please try again.")
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false)
        }
      }
    }

    fetchCart()
    return () => controller.abort()
  }, [navigate])

  if (isLoading) {
    return <p>Loading cart...</p>
  }

  if (error) {
    return <p role="alert">{error}</p>
  }

  if (cartItems.length === 0) {
    return (
      <main>
        <h1>Your Cart</h1>
        <p>Your cart is empty.</p>
      </main>
    )
  }

  return (
    <main>
      <h1>Your Cart</h1>
      {cartItems.map((item) => (
        <article key={item.listingId}>
          {item.listing.imageUrl && (
            <img
              src={item.listing.imageUrl}
              alt={item.listing.title}
              width="200"
            />
          )}
          <h2>{item.listing.title}</h2>
          <p>Seller: {item.listing.user.sellerProfile.businessName}</p>
          <p>Price: {item.listing.price}</p>
          <p>Quantity: {item.quantity}</p>
          <p>Available stock: {item.listing.stockQuantity}</p>
        </article>
      ))}
    </main>
  )
}

export default CartPage
