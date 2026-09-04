import type {FormData, Listing} from "./App"

type ListingCardProps = {
    listing: Listing
    editingId: number | null
    editFormData: FormData
    setEditFormData: (data: FormData) => void
    handleEditClick: (listing: Listing) => void
    handleDelete: (id: number) => void
    handleSave: (id: number) => void
    handleCancel: () => void
}

function ListingCard({ listing, editingId, editFormData, setEditFormData, handleEditClick, handleDelete, handleSave, handleCancel }: ListingCardProps) {
  return (
    <div>
          {listing.id === editingId ? (
            <>
              <label>
                Title
                <input name="title" value={editFormData.title}
                  onChange={(e) => setEditFormData({...editFormData, [e.target.name]: e.target.value})}
                />
              </label>
              <label>
                Description
                <input name="description" value={editFormData.description}
                  onChange={(e) => setEditFormData({...editFormData, [e.target.name]: e.target.value})}
                />
              </label>
              <label>
                Price
                <input name="price" value={editFormData.price}
                  onChange={(e) => setEditFormData({...editFormData, [e.target.name]: e.target.value})}
                />
              </label>
              <label>
                Category
                <input name="category" value={editFormData.category}
                  onChange={(e) => setEditFormData({...editFormData, [e.target.name]: e.target.value})}
                />
              </label>
              <button onClick={() => handleSave(listing.id)}>Save</button>
              <button onClick={handleCancel}>Cancel</button>
            </>
          ) : (
            <>
              <div>{listing.id}</div>
              <div>{listing.title}</div>
              <div>{listing.price}</div>
              <div>{listing.description}</div>
              <div>{listing.category}</div>
              <button onClick={() => handleEditClick(listing)}>Edit Listing</button>
              <button onClick={() => handleDelete(listing.id)}>Delete Listing</button>
            </>
          )}
        </div>
  );
}

export default ListingCard;