// The backend's limits for listings and shops. They are checked here too, so most mistakes are
// caught before a request is sent; the backend checks them again and its message is shown if it
// refuses anything else.

export const TITLE_MAX_LENGTH = 120
export const DESCRIPTION_MAX_LENGTH = 5000
export const SHOP_NAME_MAX_LENGTH = 80
export const PRICE_MAX = 100_000_000
export const STOCK_MAX = 1_000_000

// The most one order from one shop can be, delivery included, as a naira amount. It is the backend's
// MAX_ORDER_VALUE (in its .env), so change both together. Shoppers and sellers are told it plainly.
export const ORDER_MAX_VALUE = "100000"

type ListingFields = {
    title: string
    description: string
    price: string
    stockQuantity: string
}

// Returns what is wrong with the title, description, price or stock, or null when all are acceptable.
export function validateListingFields(fields: ListingFields): string | null {
    if (fields.title.length > TITLE_MAX_LENGTH) {
        return `The title must be ${TITLE_MAX_LENGTH} characters or fewer`
    }

    if (fields.description.length > DESCRIPTION_MAX_LENGTH) {
        return `The description must be ${DESCRIPTION_MAX_LENGTH} characters or fewer`
    }

    const price = fields.price.trim()

    if (!Number.isFinite(Number(price)) || Number(price) <= 0) {
        return "Price must be a number greater than 0"
    }

    if (!/^\d+(\.\d{1,2})?$/.test(price)) {
        return "Price can have at most two decimal places"
    }

    if (Number(price) > PRICE_MAX) {
        return `Price must be ${PRICE_MAX.toLocaleString("en-NG")} or less`
    }

    if (fields.stockQuantity.trim() === "") {
        return "Stock quantity must be a whole number greater than or equal to 0"
    }

    const stock = Number(fields.stockQuantity)

    if (!Number.isInteger(stock) || stock < 0) {
        return "Stock quantity must be a whole number greater than or equal to 0"
    }

    if (stock > STOCK_MAX) {
        return `Stock quantity must be ${STOCK_MAX.toLocaleString("en-NG")} or fewer`
    }

    return null
}
