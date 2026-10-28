import { useEffect, useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import { Camera, RotateCcw, X } from "lucide-react"
import BackArrow from "../components/BackArrow"
import Notice from "../components/Notice"
import { failureMessage } from "../lib/apiRequest"
import { createDrafts } from "../lib/productBulkApi"
import { shrinkImage } from "../lib/shrinkImage"
import { uploadImageWithReason } from "../lib/uploadImage"
import { useDocumentTitle } from "../lib/useDocumentTitle"

const MAX_PHOTOS = 50
const NAME_MAX = 100

type Tile =
    | { key: number, preview: string, name: string, status: "uploading", file: File }
    | { key: number, preview: string, name: string, status: "done", url: string }
    | { key: number, preview: string, name: string, status: "failed", file: File, offline: boolean }

let nextKey = 0

// "IMG_2041.jpg" becomes "IMG_2041"; "mint-soap_trio.png" becomes "mint soap trio".
function nameFromFile(file: File): string {
    const base = file.name.replace(/\.[^.]+$/, "")
    return (/^(img|dsc|photo|pxl)[_-]?\d+/i.test(base) ? base : base.replace(/[-_]+/g, " ").trim()).slice(0, NAME_MAX)
}

// Photo first, details after: each photo becomes a draft named after it, hidden from shoppers until
// the seller adds the price, stock and the rest on the Drafts tab and publishes it. Photos start
// uploading as soon as they are picked.
function ProductsFromPhotosPage() {
    useDocumentTitle("Add products from photos")
    const navigate = useNavigate()
    const inputRef = useRef<HTMLInputElement>(null)
    const previews = useRef<string[]>([])
    const [tiles, setTiles] = useState<Tile[]>([])
    const [note, setNote] = useState("")
    const [isMaking, setIsMaking] = useState(false)
    const [error, setError] = useState("")

    useEffect(() => {
        const made = previews.current
        return () => made.forEach((preview) => URL.revokeObjectURL(preview))
    }, [])

    function update(key: number, change: (tile: Tile) => Tile) {
        setTiles((current) => current.map((tile) => tile.key === key ? change(tile) : tile))
    }

    async function upload(key: number, file: File) {
        const result = await uploadImageWithReason(file)
        update(key, (tile) => tile.status === "uploading" && tile.file === file
            ? result.ok
                ? { key, preview: tile.preview, name: tile.name, status: "done", url: result.url }
                : { key, preview: tile.preview, name: tile.name, status: "failed", file, offline: result.reason === "offline" }
            : tile)
    }

    async function addFiles(files: File[]) {
        const room = MAX_PHOTOS - tiles.length
        const images = files.filter((file) => file.type.startsWith("image/"))
        const chosen = images.slice(0, Math.max(room, 0))
        setNote(images.length > chosen.length ? `Only ${MAX_PHOTOS} photos fit at a time, so ${images.length - chosen.length} ${images.length - chosen.length === 1 ? "was" : "were"} left out.` : "")
        setError("")

        for (const original of chosen) {
            const file = await shrinkImage(original)
            const key = nextKey++
            const preview = URL.createObjectURL(file)
            previews.current.push(preview)
            setTiles((current) => [...current, { key, preview, name: nameFromFile(original), status: "uploading", file }])
            void upload(key, file)
        }
    }

    function retry(tile: Tile) {
        if (tile.status === "failed") {
            update(tile.key, () => ({ key: tile.key, preview: tile.preview, name: tile.name, status: "uploading", file: tile.file }))
            void upload(tile.key, tile.file)
        }
    }

    async function makeDrafts() {
        const photos = tiles.flatMap((tile) => tile.status === "done" ? [{ imageUrl: tile.url, title: tile.name.trim() || undefined }] : [])
        if (photos.length === 0 || isMaking) {
            return
        }

        setIsMaking(true)
        setError("")
        const result = await createDrafts(photos)
        setIsMaking(false)

        if (result.kind === "ok") {
            const count = result.data.count
            navigate("/seller/myListing?view=drafts", { state: { note: `${count} ${count === 1 ? "draft is" : "drafts are"} ready to fill in. Add a price, stock, category and description, then publish.` } })
        } else if (result.kind !== "unauthorized") {
            setError(failureMessage(result))
        }
    }

    const done = tiles.filter((tile) => tile.status === "done").length
    const failed = tiles.filter((tile) => tile.status === "failed").length
    const uploading = tiles.length - done - failed
    const status = failed > 0
        ? `${failed === 1 ? "1 photo didn't" : `${failed} photos didn't`} upload. Try ${failed === 1 ? "it" : "them"} again or remove ${failed === 1 ? "it" : "them"}.`
        : uploading > 0 ? "You can wait here while they upload." : "Each one becomes a draft."

    return (
        <div className="bulk-page">
            <BackArrow to="/seller/myListing" label="Back to my store" />
            <div className="product-form-title">
                <h1>Add products from photos</h1>
                <p>One photo for each product. Each becomes a draft named after the photo, hidden from shoppers until you add the price, stock and the rest, and publish it.</p>
            </div>

            <div className="bulk-drop">
                <span className="bulk-drop-icon" aria-hidden="true"><Camera size={26} /></span>
                <b>Choose photos</b>
                <span>Up to {MAX_PHOTOS} at a time. They upload while you carry on.</span>
                <input
                    ref={inputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    className="visually-hidden"
                    tabIndex={-1}
                    aria-label="Choose photos"
                    onChange={(event) => { const files = Array.from(event.target.files ?? []); event.target.value = ""; void addFiles(files) }}
                />
                <button type="button" className="btn" disabled={tiles.length >= MAX_PHOTOS || isMaking} onClick={() => inputRef.current?.click()}>Choose photos</button>
            </div>
            {note && <p className="product-help" role="status">{note}</p>}

            {tiles.length > 0 && (
                <ul className="bulk-tiles">
                    {tiles.map((tile, index) => (
                        <li key={tile.key} className={`bulk-tile${tile.status === "failed" ? " is-failed" : ""}`}>
                            <div className={`bulk-tile-photo is-${tile.status}`}>
                                <img src={tile.preview} alt="" />
                                {tile.status === "uploading" && (
                                    <>
                                        <span className="review-photo-bar" aria-hidden="true"><i /></span>
                                        <span className="bulk-tile-state" role="status">Uploading…</span>
                                    </>
                                )}
                                {tile.status === "failed" && (
                                    <>
                                        <button type="button" className="bulk-tile-retry" onClick={() => retry(tile)}><RotateCcw size={18} aria-hidden="true" />Try again</button>
                                        <span className="bulk-tile-state">{tile.offline ? "You're offline" : "Didn't upload"}</span>
                                    </>
                                )}
                                <button type="button" className="review-photo-remove" aria-label={`Remove photo ${index + 1}`} disabled={isMaking} onClick={() => setTiles((current) => current.filter((item) => item.key !== tile.key))}>
                                    <X size={14} strokeWidth={2.8} aria-hidden="true" />
                                </button>
                            </div>
                            <label className="bulk-tile-name">
                                Name
                                <input className="product-input" maxLength={NAME_MAX} value={tile.name} disabled={isMaking} onChange={(event) => update(tile.key, (current) => ({ ...current, name: event.target.value }))} />
                            </label>
                        </li>
                    ))}
                </ul>
            )}

            {error && <Notice kind="error">{error}</Notice>}

            {tiles.length > 0 && (
                <div className="drafts-bar" role="region" aria-label="Make drafts">
                    <p><b>{done} of {tiles.length} uploaded.</b> {status}</p>
                    <button type="button" className="btn btn-primary" disabled={isMaking || uploading > 0 || failed > 0 || done === 0} onClick={makeDrafts}>
                        {isMaking ? "Making drafts..." : `Make ${done} ${done === 1 ? "draft" : "drafts"}`}
                    </button>
                </div>
            )}
        </div>
    )
}

export default ProductsFromPhotosPage
