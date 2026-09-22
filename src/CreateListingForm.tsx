import type { FormData } from "./HomePage"
import type { SubmitEventHandler } from "react"
import { CATEGORIES } from "./categories"

type CreateListingFormProps = {
    formData: FormData
    handleSubmit: SubmitEventHandler<HTMLFormElement>
    setFormData: (data: FormData) => void
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
          <input name="price"
          value={formData.price}
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