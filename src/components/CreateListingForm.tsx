import type { ListingFormData } from "../types/listing"
import type { SubmitEventHandler } from "react"
import { CATEGORIES } from "../data/categories"
import ListingPhotosPicker from "./ListingPhotosPicker"
import type { ListingPhoto } from "../lib/listingPhotos"
import { DESCRIPTION_MAX_LENGTH, PRICE_MAX, STOCK_MAX, TITLE_MAX_LENGTH } from "../lib/limits"

export type CreateListingFormData = ListingFormData

type CreateListingFormProps = {
    formData: CreateListingFormData
    handleSubmit: SubmitEventHandler<HTMLFormElement>
    setFormData: (data: CreateListingFormData) => void
    photos: ListingPhoto[]
    setPhotos: (photos: ListingPhoto[]) => void
    isCreating: boolean
}

function CreateListingForm ({handleSubmit, formData, setFormData, photos, setPhotos, isCreating}: CreateListingFormProps){
    return(
        <form onSubmit={handleSubmit}>
        <label>
          Title
          <input name="title"
            maxLength={TITLE_MAX_LENGTH}
            value={formData.title}
            disabled={isCreating}
            onChange={(e) => setFormData({...formData, [e.target.name]: e.target.value})}
          />
        </label>
        <label>
          Description
          <textarea name="description"
          maxLength={DESCRIPTION_MAX_LENGTH}
          value={formData.description}
          disabled={isCreating}
          onChange={(e) => setFormData({...formData, [e.target.name]: e.target.value})}
        />
        </label>
        <div className="form-row">
          <label>
            Price
            <input type="number" min="0.01" max={PRICE_MAX} step="0.01" required name="price"
            value={formData.price}
            disabled={isCreating}
            onChange={(e) => setFormData({...formData, [e.target.name]: e.target.value})}
            />
          </label>
          <label>
            Stock Quantity
            <input type="number" min="0" max={STOCK_MAX} step="1" required name="stockQuantity"
            value={formData.stockQuantity}
            disabled={isCreating}
            onChange={(e) => setFormData({...formData, [e.target.name]: e.target.value})}
            />
          </label>
        </div>
        <label>
          Category
          <select
            name="category"
            value={formData.category}
            disabled={isCreating}
            onChange={(e) => setFormData({...formData, [e.target.name]: e.target.value})}
          >
            <option value="">Select a category</option>
            {CATEGORIES.map((category) => (
              <option key={category} value={category}>{category}</option>
            ))}
          </select>
        </label>
        <ListingPhotosPicker photos={photos} onChange={setPhotos} disabled={isCreating} />
        <button type="submit" className="btn-block btn-lg" disabled={isCreating}>{isCreating ? "Creating..." : "Create listing"}</button>
      </form>
    )
}

export default CreateListingForm
