import { optionStock } from "../lib/listingOptions"
import type { ListingOption } from "../types/listing"

type OptionPickerProps = {
    options: ListingOption[]
    optionLabel: string | null
    sizeLabel: string | null
    onOption: (label: string) => void
    onSize: (label: string) => void
}

// Choose a colour (or other option) and then, if it comes in sizes, a size. Choices that are sold out
// are shown but cannot be picked.
function OptionPicker({ options, optionLabel, sizeLabel, onOption, onSize }: OptionPickerProps) {
    const selected = options.find((option) => option.label === optionLabel) ?? null

    return (
        <div className="option-picker">
            <fieldset className="option-group">
                <legend>Choose an option{selected ? `: ${selected.label}` : ""}</legend>
                <div className="option-choices">
                    {options.map((option) => {
                        const isSoldOut = optionStock(option) === 0
                        return (
                            <button
                                key={option.label}
                                type="button"
                                className={`option-choice${option.label === optionLabel ? " is-selected" : ""}`}
                                aria-pressed={option.label === optionLabel}
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
                    <legend>Choose a size{sizeLabel ? `: ${sizeLabel}` : ""}</legend>
                    <div className="option-choices">
                        {selected.sizes.map((size) => (
                            <button
                                key={size.label}
                                type="button"
                                className={`option-choice${size.label === sizeLabel ? " is-selected" : ""}`}
                                aria-pressed={size.label === sizeLabel}
                                disabled={size.stockQuantity === 0}
                                onClick={() => onSize(size.label)}
                            >
                                <span>{size.label}</span>
                                {size.stockQuantity === 0 && <span className="option-choice-note">Sold out</span>}
                            </button>
                        ))}
                    </div>
                </fieldset>
            )}
        </div>
    )
}

export default OptionPicker
