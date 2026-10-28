import { useRef, useState } from "react"
import { ImageUp, RotateCw } from "lucide-react"
import { shrinkImage } from "../lib/shrinkImage"
import { uploadFailureMessage, uploadImageWithReason } from "../lib/uploadImage"

const MAX_PHOTOS = 20

type Row = { key: string, file: File, preview: string, status: "uploading" | "done" | "failed", url: string, problem: string }

// For the spreadsheet import, which needs a link for each photo: photos are uploaded the way product photos are,
// and each gets a link to copy into the sheet (or all of them at once, one per line).
function PhotoLinksHelper() {
    const inputRef = useRef<HTMLInputElement>(null)
    const [rows, setRows] = useState<Row[]>([])
    const [copied, setCopied] = useState<string | null>(null)// a row's key, or "all"
    const [note, setNote] = useState("")
    const doneRows = rows.filter((row) => row.status === "done")

    function patch(key: string, change: Partial<Row>) {
        setRows((current) => current.map((row) => row.key === key ? { ...row, ...change } : row))
    }

    async function upload(row: Row) {
        patch(row.key, { status: "uploading", problem: "" })
        const result = await uploadImageWithReason(await shrinkImage(row.file))
        patch(row.key, result.ok
            ? { status: "done", url: result.url }
            : { status: "failed", problem: uploadFailureMessage(result.reason, "photo") })
    }

    function choose(list: FileList | null) {
        const files = [...(list ?? [])].filter((file) => file.type.startsWith("image/"))
        const room = MAX_PHOTOS - rows.length
        setNote(files.length > room ? `You can add ${MAX_PHOTOS} photos at a time, so ${files.length - room} were left out.` : "")
        const added = files.slice(0, Math.max(room, 0)).map((file, index): Row => ({
            key: `${Date.now()}-${index}-${file.name}`,
            file,
            preview: URL.createObjectURL(file),
            status: "uploading",
            url: "",
            problem: ""
        }))
        setRows((current) => [...current, ...added])
        added.forEach((row) => { void upload(row) })
    }

    async function copy(text: string, which: string) {
        try {
            await navigator.clipboard.writeText(text)
            setCopied(which)
        } catch {
            setCopied(null)// copying can be blocked; the link can still be selected and copied by hand
        }
    }

    return (
        <section className="money-card photo-links" aria-labelledby="photo-links-heading">
            <h2 id="photo-links-heading">Need links for your photos?</h2>
            <p className="product-help">The spreadsheet needs a link for each photo. Upload them here, then copy each link into a photo column.</p>

            <input ref={inputRef} type="file" accept="image/*" multiple className="visually-hidden" tabIndex={-1} aria-label="Choose photos" onChange={(event) => { choose(event.target.files); event.target.value = "" }} />
            <div className="photo-links-drop">
                <ImageUp size={26} aria-hidden="true" />
                <b>Choose photos</b>
                <span>Up to {MAX_PHOTOS} at a time, from your gallery or saved from WhatsApp</span>
                <button type="button" className="btn" onClick={() => inputRef.current?.click()} disabled={rows.length >= MAX_PHOTOS}>Choose photos</button>
            </div>
            {note && <p className="product-help" role="status">{note}</p>}

            {rows.length > 0 && (
                <ul className="photo-links-list">
                    {rows.map((row) => (
                        <li key={row.key} className="photo-links-row">
                            <img src={row.preview} alt="" />
                            <span className="photo-links-text">
                                <b>{row.file.name}</b>
                                {row.status === "uploading" && <span role="status">Uploading...</span>}
                                {row.status === "done" && <code>{row.url}</code>}
                                {row.status === "failed" && <span className="field-error">{row.problem}</span>}
                            </span>
                            {row.status === "done" && (
                                <button type="button" className="btn" onClick={() => copy(row.url, row.key)}>
                                    {copied === row.key ? "Copied" : "Copy link"}<span className="visually-hidden"> for {row.file.name}</span>
                                </button>
                            )}
                            {row.status === "failed" && (
                                <button type="button" className="btn" onClick={() => upload(row)}><RotateCw size={16} aria-hidden="true" />Try again</button>
                            )}
                        </li>
                    ))}
                </ul>
            )}

            {doneRows.length > 1 && (
                <div className="photo-links-all">
                    <button type="button" className="btn btn-primary" onClick={() => copy(doneRows.map((row) => row.url).join("\n"), "all")}>
                        {copied === "all" ? `All ${doneRows.length} links copied` : "Copy all links"}
                    </button>
                    <span className="product-help">Copies every link, one per line, in the order shown.</span>
                </div>
            )}
            <span className="visually-hidden" aria-live="polite">{copied ? "Copied" : ""}</span>
        </section>
    )
}

export default PhotoLinksHelper
