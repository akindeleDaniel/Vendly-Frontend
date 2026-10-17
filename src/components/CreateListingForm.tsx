import type { ListingFormData } from "../types/listing"
import type { SubmitEventHandler } from "react"
import { CATEGORIES } from "../data/categories"
import ImagePicker from "./ImagePicker"

export type CreateListingFormData = ListingFormData

type CreateListingFormProps = {
    formData: CreateListingFormData
    handleSubmit: SubmitEventHandler<HTMLFormElement>
    setFormData: (data: CreateListingFormData) => void
    setImageFile: (file: File | null) => void
    isCreating: boolean
}

function CreateListingForm ({handleSubmit, formData, setFormData, setImageFile, isCreating}: CreateListingFormProps){
    return(
        <form onSubmit={handleSubmit}>
        <label>
          Title
          <input name="title"
            value={formData.title}
            disabled={isCreating}
            onChange={(e) => setFormData({...formData, [e.target.name]: e.target.value})}
          />
        </label>
        <label>
          Description
          <input name="description"
          value={formData.description}
          disabled={isCreating}
          onChange={(e) => setFormData({...formData, [e.target.name]: e.target.value})}
        />
        </label>
        <div className="form-row">
          <label>
            Price
            <input type="number" min="0.01" step="any" required name="price"
            value={formData.price}
            disabled={isCreating}
            onChange={(e) => setFormData({...formData, [e.target.name]: e.target.value})}
            />
          </label>
          <label>
            Stock Quantity
            <input type="number" min="0" step="1" required name="stockQuantity"
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
        <ImagePicker label="Photo" onChange={setImageFile} disabled={isCreating} />
        <button type="submit" className="btn-block btn-lg" disabled={isCreating}>{isCreating ? "Creating..." : "Create listing"}</button>
      </form>
    )
}

export default CreateListingForm
