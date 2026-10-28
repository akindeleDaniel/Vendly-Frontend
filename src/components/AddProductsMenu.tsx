import { Link } from "react-router-dom"
import { Camera, ChevronDown, FileSpreadsheet, Plus, Rows3 } from "lucide-react"

// My store's buttons over the products: add one product, a menu of the other ways to add many (from
// photos, or from a spreadsheet or Shopify export), and the quick edit of prices and stock.
function AddProductsMenu({ hasProducts }: { hasProducts: boolean }) {
    return (
        <div className="add-products">
            {hasProducts && (
                <Link to="/seller/products/quick-edit" className="btn"><Rows3 size={16} aria-hidden="true" />Quick edit</Link>
            )}
            <div className="add-products-split">
                <Link to="/seller/products/new" className="btn btn-primary"><Plus size={18} aria-hidden="true" />Add a product</Link>
                <details className="add-products-more">
                    <summary className="btn btn-primary" aria-label="More ways to add products"><ChevronDown size={18} aria-hidden="true" /></summary>
                    <div className="add-products-menu">
                        <Link to="/seller/products/new">
                            <span className="add-products-icon" aria-hidden="true"><Plus size={20} /></span>
                            <span><b>One product</b><span>Photos, details, price and options, one at a time.</span></span>
                        </Link>
                        <Link to="/seller/products/from-photos">
                            <span className="add-products-icon" aria-hidden="true"><Camera size={20} /></span>
                            <span><b>From photos</b><span>Pick up to 50 photos. Each becomes a draft you fill in after.</span></span>
                        </Link>
                        <Link to="/seller/products/import">
                            <span className="add-products-icon" aria-hidden="true"><FileSpreadsheet size={20} /></span>
                            <span><b>From a spreadsheet or Shopify</b><span>Up to 200 products from a CSV file, or a Shopify product export as it is.</span></span>
                        </Link>
                    </div>
                </details>
            </div>
        </div>
    )
}

export default AddProductsMenu
