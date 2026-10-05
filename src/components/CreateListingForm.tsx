import type { FormData } from "../pages/DiscoveryPage"
import type { SubmitEventHandler } from "react"
import { CATEGORIES } from "../data/categories"

export type CreateListingFormData = FormData & {
    stockQuantity: string
}

type CreateListingFormProps = {
    formData: CreateListingFormData
    handleSubmit: SubmitEventHandler<HTMLFormElement>
    setFormData: (data: CreateListingFormData) => void
    setImageFile: (file: File | null) => void
}

function CreateListingForm ({handleSubmit, formData, setFormData, setImageFile}: CreateListingFormProps){
    return(
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
          <input type="number" min="0.01" step="any" required name="price"
          value={formData.price}
          onChange={(e) => setFormData({...formData, [e.target.name]: e.target.value})}
          />
        </label>
        <label>
          Stock Quantity
          <input type="number" min="0" step="1" required name="stockQuantity"
          value={formData.stockQuantity}
          onChange={(e) => setFormData({...formData, [e.target.name]: e.target.value})}
          />
        </label>
        <label>
          Category
          <select
            name="category"
            value={formData.category}
            onChange={(e) => setFormData({...formData, [e.target.name]: e.target.value})}
          >
            <option value="">Select a category</option>
            {CATEGORIES.map((category) => (
              <option key={category} value={category}>{category}</option>
            ))}
          </select>
        </label>
        <label>
          Photo
          <input type="file" accept="image/*"
            onChange={(e) => setImageFile(e.target.files?.[0] || null)}
          />
        </label>
        <button type="submit">Create Listing</button>
      </form>
    )
}

export default CreateListingForm