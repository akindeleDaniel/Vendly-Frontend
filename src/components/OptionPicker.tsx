import { optionStock } from "../lib/listingOptions"
import type { ListingOption } from "../types/listing"

type OptionPickerProps = {
    options: ListingOption[]
    optionLabel: string | null
    sizeLabel: string | null
    onOption: (label: string) => void
    onSize: (label: string) => void
}

// Choose an option (for example a colour) and then, if it comes in sizes, a size. Options with a photo
// show as photo swatches, the rest by name. Choices that are sold out are shown but cannot be picked.
function OptionPicker({ options, optionLabel, sizeLabel, onOption, onSize }: OptionPickerProps) {
    const selected = options.find((option) => option.label === optionLabel) ?? null
    const allHavePhotos = options.every((option) => option.imageUrl)

    return (
        <div className="option-picker">
            <fieldset className="option-group">
                <legend>Option: <span>{selected ? selected.label : "choose one"}</span></legend>
                <div className="option-choices">
                    {options.map((option) => {
                        const isSoldOut = optionStock(option) === 0
                        const isSelected = option.label === optionLabel
                        return allHavePhotos ? (
                            <button
                                key={option.label}
                                type="button"
                                className={`option-swatch${isSelected ? " is-selected" : ""}`}
                                aria-pressed={isSelected}
                                aria-label={isSoldOut ? `${option.label}, sold out` : option.label}
                                title={option.label}
                                disabled={isSoldOut}
                                onClick={() => onOption(option.label)}
                            >
                                <img src={option.imageUrl as string} alt="" loading="lazy" />
                            </button>
                        ) : (
                            <button
                                key={option.label}
                                type="button"
                                className={`option-choice${isSelected ? " is-selected" : ""}`}
                                aria-pressed={isSelected}
                                disabled={isSoldOut}
                                onClick={() => onOption(option.label)}
                            >
                                {option.imageUrl && <img src={option.imageUrl} alt="" loading="lazy" />}
                                <span>{option.label}</span>
                                {isSoldOut && <span className="option-choice-note">Sold out</span>}
                            </button>
                        )
                    })}
                </div>
            </fieldset>

            {selected && selected.sizes.length > 0 && (
                <fieldset className="option-group">
                    <legend>Size: <span>{sizeLabel ?? "choose one"}</span></legend>
                    <div className="option-choices">
                        {selected.sizes.map((size) => (
                            <button
                                key={size.label}
                                type="button"
                                className={`option-size${size.label === sizeLabel ? " is-selected" : ""}`}
                                aria-pressed={size.label === sizeLabel}
                                aria-label={size.stockQuantity === 0 ? `${size.label}, sold out` : undefined}
                                disabled={size.stockQuantity === 0}
                                onClick={() => onSize(size.label)}
                            >
                                {size.label}
                            </button>
                        ))}
                    </div>
                </fieldset>
            )}
        </div>
    )
}

export default OptionPicker
