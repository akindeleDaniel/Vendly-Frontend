import { useEffect, useRef, useState } from "react"
import { Plus, Trash2, X } from "lucide-react"
import ImageCropDialog from "./ImageCropDialog"
import Notice from "./Notice"
import { ACCEPTED_IMAGE_TYPES, checkProductPhotoSize, validateImageFile } from "../lib/imageFile"
import {
    MAX_OPTIONS,
    MAX_SIZES_PER_OPTION,
    OPTION_LABEL_MAX_LENGTH,
    newOptionDraft,
    newSizeDraft
} from "../lib/optionDrafts"
import type { OptionDraft } from "../lib/optionDrafts"
import { STOCK_MAX } from "../lib/limits"

type ListingOptionsEditorProps = {
    drafts: OptionDraft[]
    onChange: (drafts: OptionDraft[]) => void
    pricePlaceholder: string// the product's price, shown in each option's empty price box
    disabled?: boolean
}

// An option's photo as a small square button: choose, crop to a square, and the size is checked
// like the product's own photos.
function OptionPhoto({ draft, onFile, disabled }: { draft: OptionDraft, onFile: (file: File) => void, disabled?: boolean }) {
    const inputRef = useRef<HTMLInputElement>(null)
    const [pendingFile, setPendingFile] = useState<File | null>(null)
    const [previewUrl, setPreviewUrl] = useState<string | null>(null)
    const [error, setError] = useState("")
    const name = draft.label.trim() || "this option"

    useEffect(() => () => {
        if (previewUrl) {
            URL.revokeObjectURL(previewUrl)
        }
    }, [previewUrl])

    async function handleChoose(event: React.ChangeEvent<HTMLInputElement>) {
        const input = event.currentTarget
        const file = input.files?.[0] ?? null
        input.value = ""
        setError("")
        if (!file) {
            return
        }
        const problem = validateImageFile(file) ?? await checkProductPhotoSize(file, false)
        if (problem) {
            setError(problem)
            return
        }
        setPendingFile(file)
    }

    async function handleCropDone(croppedFile: File) {
        setPendingFile(null)
        const problem = await checkProductPhotoSize(croppedFile, true)
        if (problem) {
            setError(problem)
            return
        }
        setPreviewUrl(URL.createObjectURL(croppedFile))
        onFile(croppedFile)
    }

    const shownUrl = previewUrl ?? draft.photoUrl

    return (
        <div className="option-photo">
            <button
                type="button"
                className={`option-photo-button${shownUrl ? " has-photo" : ""}`}
                onClick={() => inputRef.current?.click()}
                disabled={disabled}
                aria-label={shownUrl ? `Change the photo of ${name}` : `Add a photo of ${name} (optional)`}
            >
                {shownUrl ? <img src={shownUrl} alt="" /> : <><Plus size={20} aria-hidden="true" />Photo</>}
            </button>
            <input ref={inputRef} type="file" hidden accept={ACCEPTED_IMAGE_TYPES.join(",")} onChange={handleChoose} />
            {error && <Notice kind="error">{error}</Notice>}
            {pendingFile && <ImageCropDialog file={pendingFile} onCancel={() => setPendingFile(null)} onDone={handleCropDone} />}
        </div>
    )
}

// A product's options: each option (for example a colour) has a name, an optional price and photo,
// and either its own stock or a list of sizes with stock on each size.
function ListingOptionsEditor({ drafts, onChange, pricePlaceholder, disabled }: ListingOptionsEditorProps) {
    function update(id: string, change: Partial<OptionDraft>) {
        onChange(drafts.map((draft) => draft.id === id ? { ...draft, ...change } : draft))
    }

    let choices = 0
    let totalStock = 0
    for (const draft of drafts) {
        if (draft.hasSizes) {
            choices += draft.sizes.length
            totalStock += draft.sizes.reduce((sum, size) => sum + (Number(size.stock) || 0), 0)
        } else {
            choices += 1
            totalStock += Number(draft.stock) || 0
        }
    }

    return (
        <div className="options-editor">
            {drafts.map((draft, index) => {
                const name = draft.label.trim() || `option ${index + 1}`
                return (
                    <fieldset key={draft.id} className="option-box" disabled={disabled}>
                        <legend>Option {index + 1}</legend>
                        <div className="option-box-top">
                            <OptionPhoto draft={draft} disabled={disabled} onFile={(file) => update(draft.id, { photoFile: file })} />
                            <label className="option-field">
                                Name
                                <span className="option-input">
                                    <input maxLength={OPTION_LABEL_MAX_LENGTH} placeholder="For example: Blue" value={draft.label} onChange={(event) => update(draft.id, { label: event.target.value })} />
                                </span>
                            </label>
                            <label className="option-field option-price">
                                <span>Own price <span className="option-muted">(optional)</span></span>
                                <span className="option-input">
                                    <span aria-hidden="true">₦</span>
                                    <input inputMode="decimal" placeholder={pricePlaceholder} value={draft.price} onChange={(event) => update(draft.id, { price: event.target.value })} />
                                </span>
                            </label>
                            <button type="button" className="option-icon-button option-remove" onClick={() => onChange(drafts.filter((item) => item.id !== draft.id))} aria-label={`Remove ${name}`}>
                                <Trash2 size={18} aria-hidden="true" />
                            </button>
                        </div>

                        <button
                            type="button"
                            role="switch"
                            aria-checked={draft.hasSizes}
                            className={`option-switch${draft.hasSizes ? " is-on" : ""}`}
                            onClick={() => update(draft.id, {
                                hasSizes: !draft.hasSizes,
                                sizes: !draft.hasSizes && draft.sizes.length === 0 ? [newSizeDraft()] : draft.sizes
                            })}
                        >
                            <span className="option-switch-track" aria-hidden="true" />
                            Comes in sizes
                        </button>

                        {draft.hasSizes ? (
                            <div className="option-sizes">
                                <div className="option-sizes-head" aria-hidden="true"><span>Size</span><span>How many</span><span /></div>
                                {draft.sizes.map((size, sizeIndex) => (
                                    <div key={size.id} className="option-size-row">
                                        <span className="option-input">
                                            <input
                                                maxLength={OPTION_LABEL_MAX_LENGTH}
                                                placeholder="For example: M"
                                                aria-label={`Size ${sizeIndex + 1} of ${name}`}
                                                value={size.label}
                                                onChange={(event) => update(draft.id, { sizes: draft.sizes.map((item) => item.id === size.id ? { ...item, label: event.target.value } : item) })}
                                            />
                                        </span>
                                        <span className="option-input">
                                            <input
                                                type="number"
                                                min="0"
                                                max={STOCK_MAX}
                                                step="1"
                                                inputMode="numeric"
                                                aria-label={`How many in size ${size.label || sizeIndex + 1} of ${name}`}
                                                value={size.stock}
                                                onChange={(event) => update(draft.id, { sizes: draft.sizes.map((item) => item.id === size.id ? { ...item, stock: event.target.value } : item) })}
                                            />
                                        </span>
                                        <button
                                            type="button"
                                            className="option-icon-button"
                                            onClick={() => update(draft.id, { sizes: draft.sizes.filter((item) => item.id !== size.id) })}
                                            aria-label={`Remove size ${size.label || sizeIndex + 1} of ${name}`}
                                        >
                                            <X size={16} aria-hidden="true" />
                                        </button>
                                    </div>
                                ))}
                                {draft.sizes.length < MAX_SIZES_PER_OPTION && (
                                    <div>
                                        <button type="button" className="btn-text option-add-size" onClick={() => update(draft.id, { sizes: [...draft.sizes, newSizeDraft()] })}>
                                            <Plus size={16} aria-hidden="true" />Add a size
                                        </button>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <label className="option-field option-stock">
                                How many you have
                                <span className="option-input">
                                    <input type="number" min="0" max={STOCK_MAX} step="1" inputMode="numeric" value={draft.stock} onChange={(event) => update(draft.id, { stock: event.target.value })} />
                                </span>
                            </label>
                        )}
                    </fieldset>
                )
            })}

            {drafts.length < MAX_OPTIONS && (
                <button type="button" className="btn option-add" onClick={() => onChange([...drafts, newOptionDraft()])} disabled={disabled}>
                    <Plus size={18} aria-hidden="true" />{drafts.length === 0 ? "Add an option" : "Add another option"}
                </button>
            )}

            {drafts.length > 0 && (
                <p className="option-summary">
                    <span><b>{drafts.length}</b> {drafts.length === 1 ? "option" : "options"}</span>
                    <span><b>{choices}</b> {choices === 1 ? "choice" : "choices"} for shoppers</span>
                    <span><b>{totalStock}</b> in stock in total</span>
                </p>
            )}
        </div>
    )
}

export default ListingOptionsEditor
