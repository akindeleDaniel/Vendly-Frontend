import { useId } from "react"
import { Star } from "lucide-react"

type StarInputProps = {
    label: string
    value: number // 0 until a rating is chosen
    onChange: (rating: number) => void
    disabled?: boolean
    hideLabel?: boolean// when the row around it already names what is rated
}

// Choose 1 to 5 stars. Built from radio buttons, so the arrow keys and screen readers work.
function StarInput({ label, value, onChange, disabled, hideLabel }: StarInputProps) {
    const name = useId()

    return (
        <fieldset className="star-input" disabled={disabled}>
            <legend className={hideLabel ? "visually-hidden" : undefined}>{label}</legend>
            <div className="star-input-stars">
                {[1, 2, 3, 4, 5].map((rating) => (
                    <span key={rating} className="star-input-option">
                        <input
                            type="radio"
                            id={`${name}-${rating}`}
                            name={name}
                            checked={value === rating}
                            onChange={() => onChange(rating)}
                        />
                        <label htmlFor={`${name}-${rating}`} className={rating <= value ? "is-filled" : undefined}>
                            <Star size={26} strokeWidth={1.6} aria-hidden="true" />
                            <span className="visually-hidden">{rating} {rating === 1 ? "star" : "stars"}</span>
                        </label>
                    </span>
                ))}
            </div>
        </fieldset>
    )
}

export default StarInput
