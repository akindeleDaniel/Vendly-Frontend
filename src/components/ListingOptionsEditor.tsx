import ImagePicker from "./ImagePicker"
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
    disabled?: boolean
}

// The seller's options for a product: each option (for example a colour) has a name, an optional
// price and photo, and either its own stock or a list of sizes with stock on each size.
function ListingOptionsEditor({ drafts, onChange, disabled }: ListingOptionsEditorProps) {
    function update(id: string, change: Partial<OptionDraft>) {
        onChange(drafts.map((draft) => draft.id === id ? { ...draft, ...change } : draft))
    }

    return (
        <div className="options-editor">
            <p className="field-help">
                Shoppers choose an option on the product page, and each option can have its own price and photo.
                If an option comes in sizes, stock is counted on each size.
            </p>

            {drafts.map((draft, index) => (
                <fieldset key={draft.id} className="option-card" disabled={disabled}>
                    <legend>Option {index + 1}</legend>
                    <label>
                        Name (for example Blue)
                        <input maxLength={OPTION_LABEL_MAX_LENGTH} value={draft.label} onChange={(event) => update(draft.id, { label: event.target.value })} />
                    </label>
                    <label>
                        Price in naira (leave empty to use the product's price)
                        <input inputMode="decimal" value={draft.price} onChange={(event) => update(draft.id, { price: event.target.value })} />
                    </label>
                    <ImagePicker
                        label="Photo of this option (optional)"
                        currentUrl={draft.photoUrl ?? undefined}
                        onChange={(file) => update(draft.id, { photoFile: file })}
                        disabled={disabled}
                    />

                    <label className="checkbox-label">
                        <input
                            type="checkbox"
                            checked={draft.hasSizes}
                            onChange={(event) => update(draft.id, {
                                hasSizes: event.target.checked,
                                sizes: event.target.checked && draft.sizes.length === 0 ? [newSizeDraft()] : draft.sizes
                            })}
                        />
                        This option comes in sizes
                    </label>

                    {draft.hasSizes ? (
                        <div className="size-list">
                            {draft.sizes.map((size, sizeIndex) => (
                                <div key={size.id} className="size-row">
                                    <label>
                                        Size {sizeIndex + 1}
                                        <input
                                            maxLength={OPTION_LABEL_MAX_LENGTH}
                                            placeholder="for example M"
                                            value={size.label}
                                            onChange={(event) => update(draft.id, { sizes: draft.sizes.map((item) => item.id === size.id ? { ...item, label: event.target.value } : item) })}
                                        />
                                    </label>
                                    <label>
                                        Stock
                                        <input
                                            type="number"
                                            min="0"
                                            max={STOCK_MAX}
                                            step="1"
                                            value={size.stock}
                                            onChange={(event) => update(draft.id, { sizes: draft.sizes.map((item) => item.id === size.id ? { ...item, stock: event.target.value } : item) })}
                                        />
                                    </label>
                                    <button type="button" className="btn-text" onClick={() => update(draft.id, { sizes: draft.sizes.filter((item) => item.id !== size.id) })}>
                                        Remove<span className="visually-hidden"> size {sizeIndex + 1}</span>
                                    </button>
                                </div>
                            ))}
                            {draft.sizes.length < MAX_SIZES_PER_OPTION && (
                                <button type="button" onClick={() => update(draft.id, { sizes: [...draft.sizes, newSizeDraft()] })}>Add a size</button>
                            )}
                        </div>
                    ) : (
                        <label>
                            Stock
                            <input type="number" min="0" max={STOCK_MAX} step="1" value={draft.stock} onChange={(event) => update(draft.id, { stock: event.target.value })} />
                        </label>
                    )}

                    <button type="button" className="btn-text" onClick={() => onChange(drafts.filter((item) => item.id !== draft.id))}>
                        Remove option {index + 1}
                    </button>
                </fieldset>
            ))}

            {drafts.length < MAX_OPTIONS && (
                <button type="button" onClick={() => onChange([...drafts, newOptionDraft()])} disabled={disabled}>
                    {drafts.length === 0 ? "Add an option" : "Add another option"}
                </button>
            )}
        </div>
    )
}

export default ListingOptionsEditor
