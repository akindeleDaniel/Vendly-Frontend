import { useEffect, useRef } from "react"
import { CircleAlert, ShoppingBag, Trash2 } from "lucide-react"

export type DeletePrompt = {
    id: number
    title: string
    imageUrl: string | null
    step: "ask" | "ordered" // "ordered": it has orders, so it can only be taken off sale
}

type DeleteProductDialogProps = {
    prompt: DeletePrompt | null // null: closed
    isWorking: boolean
    error: string
    onDelete: () => void
    onArchive: () => void
    onClose: () => void
}

// Asks before a product is deleted, in StoreHatch's own dialog rather than the browser's. A product
// that has been ordered can't be deleted, so the same dialog then offers to take it off sale.
function DeleteProductDialog({ prompt, isWorking, error, onDelete, onArchive, onClose }: DeleteProductDialogProps) {
    const dialogRef = useRef<HTMLDialogElement>(null)
    const isOpen = prompt !== null

    useEffect(() => {
        const dialog = dialogRef.current
        if (!dialog) {
            return
        }
        if (isOpen && !dialog.open) {
            dialog.showModal()
        } else if (!isOpen && dialog.open) {
            dialog.close()
        }
    }, [isOpen])

    return (
        <dialog
            ref={dialogRef}
            className="logout-dialog confirm-dialog"
            aria-labelledby="delete-product-title"
            onClose={onClose}
            onCancel={(event) => { if (isWorking) event.preventDefault() }}
        >
            {prompt && (
                <div className="logout-dialog-body">
                    {prompt.step === "ask" ? (
                        <>
                            <div className="confirm-dialog-top">
                                {prompt.imageUrl
                                    ? <img className="confirm-dialog-photo" src={prompt.imageUrl} alt="" />
                                    : <span className="confirm-dialog-icon is-danger" aria-hidden="true"><Trash2 size={20} /></span>}
                                <div>
                                    <h2 id="delete-product-title">Delete &ldquo;{prompt.title}&rdquo;?</h2>
                                    <p>It's removed from your shop for good, with its photos and options. This can't be undone.</p>
                                </div>
                            </div>
                            {error && <p role="alert" className="alert alert-error">{error}</p>}
                            <div className="confirm-dialog-actions">
                                <button type="button" className="btn" disabled={isWorking} onClick={onClose}>Keep it</button>
                                <button type="button" className="btn btn-danger" disabled={isWorking} onClick={onDelete}>{isWorking ? "Deleting..." : "Delete product"}</button>
                            </div>
                        </>
                    ) : (
                        <>
                            <div className="confirm-dialog-top">
                                <span className="confirm-dialog-icon" aria-hidden="true">{prompt.imageUrl ? <CircleAlert size={20} /> : <ShoppingBag size={20} />}</span>
                                <div>
                                    <h2 id="delete-product-title">&ldquo;{prompt.title}&rdquo; has been ordered, so it can't be deleted</h2>
                                    <p>Its orders and refunds still point to it. You can take it off sale instead:</p>
                                </div>
                            </div>
                            <ul className="confirm-dialog-list">
                                <li>Shoppers can't see or buy it, and it leaves their carts.</li>
                                <li>Paid orders aren't touched.</li>
                                <li>You can put it back on sale any time, from the Archived tab.</li>
                            </ul>
                            {error && <p role="alert" className="alert alert-error">{error}</p>}
                            <div className="confirm-dialog-actions">
                                <button type="button" className="btn" disabled={isWorking} onClick={onClose}>Keep it on sale</button>
                                <button type="button" className="btn btn-primary" disabled={isWorking} onClick={onArchive}>{isWorking ? "Taking it off sale..." : "Take it off sale"}</button>
                            </div>
                        </>
                    )}
                </div>
            )}
        </dialog>
    )
}

export default DeleteProductDialog
