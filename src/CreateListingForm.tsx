import type { FormData } from "./HomePage"
import type { SubmitEventHandler } from "react"

type CreateListingFormProps = {
    formData: FormData
    handleSubmit: SubmitEventHandler<HTMLFormElement>
    setFormData: (data: FormData) => void
}

function CreateListingForm ({handleSubmit, formData, setFormData}: CreateListingFormProps){
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
          <input name="category"
          value={formData.category}
          onChange={(e) => setFormData({...formData, [e.target.name]: e.target.value})}
          />
        </label>
        <button type="submit">Create Listing</button>
      </form>
    )
}

export default CreateListingForm