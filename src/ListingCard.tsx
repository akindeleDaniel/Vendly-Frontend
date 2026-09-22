import type {FormData, Listing} from "./HomePage"
import { CATEGORIES } from "./categories"

type ListingCardProps = {
  listing: Listing
  isEditable: boolean
  editingId?: number | null
  editFormData?: FormData
  setEditFormData?: (data: FormData) => void
  setEditImageFile?: (file: File | null) => void
  handleEditClick?: (listing: Listing) => void
  handleDelete?: (id: number) => void
  handleSave?: (id: number) => void
  handleCancel?: () => void
}

function ListingCard({ listing, editingId, editFormData, setEditFormData, setEditImageFile, handleEditClick, handleDelete, handleSave, handleCancel, isEditable}: ListingCardProps) {
  return (
    <div>
      {listing.id === editingId ? (
        <>
          {listing.imageUrl && <img src={listing.imageUrl} alt={listing.title} width="200" />}
          <label>
            Title
            <input name="title" value={editFormData!.title}
              onChange={(e) => setEditFormData!({...editFormData!, [e.target.name]: e.target.value})}
            />
          </label>
          <label>
            Description
            <input name="description" value={editFormData!.description}
              onChange={(e) => setEditFormData!({...editFormData!, [e.target.name]: e.target.value})}
            />
          </label>
          <label>
            Price
            <input name="price" value={editFormData!.price}
              onChange={(e) => setEditFormData!({...editFormData!, [e.target.name]: e.target.value})}
            />
          </label>
          <label>
            Category
            <select
              name="category"
              value={editFormData!.category}
              onChange={(e) => setEditFormData!({...editFormData!, [e.target.name]: e.target.value})}
            >
              <option value="">Select a category</option>
              {CATEGORIES.map((category) => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
          </label>
          <label>
            Change photo (optional)
            <input type="file" accept="image/*"
              onChange={(e) => setEditImageFile!(e.target.files?.[0] || null)}
            />
          </label>
          {isEditable && <button onClick={() => handleSave!(listing.id)}>Save</button>}
          {isEditable && <button onClick={handleCancel}>Cancel</button>}
        </>
      ) : (
        <>
          {listing.imageUrl && <img src={listing.imageUrl} alt={listing.title} width="200" />}
          <div>{listing.id}</div>
          <div>{listing.title}</div>
          <div>{listing.price}</div>
          <div>{listing.description}</div>
          <div>{listing.category}</div>
          {isEditable && <button onClick={() => handleEditClick!(listing)}>Edit Listing</button>}
          {isEditable && <button onClick={() => handleDelete!(listing.id)}>Delete Listing</button>}
        </>
      )}
    </div>
  );
}

export default ListingCard;