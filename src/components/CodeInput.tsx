import { useEffect, useId, useRef } from "react"

export const CODE_LENGTH = 6

type CodeInputProps = {
    value: string// the digits entered so far, at most CODE_LENGTH
    onChange: (value: string) => void
    disabled?: boolean
    invalid?: boolean
    describedBy?: string
    label?: string
}

// A code entered one digit per box. Typing moves on to the next box, Backspace moves back, the
// arrow keys move between boxes, and pasting (or a phone's "fill from message" suggestion) spreads
// the digits across the boxes. It behaves like one text field that happens to be drawn as six, so
// the value is a plain string and boxes can only be filled from left to right.
function CodeInput({ value, onChange, disabled, invalid, describedBy, label = "6-digit code" }: CodeInputProps) {
    const labelId = useId()
    const boxes = useRef<Array<HTMLInputElement | null>>([])
    // How many digits are entered, kept up to date the moment a digit is typed. The `value` above is only
    // new after the page redraws, which is too late for the focus event of the next box.
    const enteredCount = useRef(value.length)

    useEffect(() => {
        enteredCount.current = value.length
    }, [value])

    function change(next: string) {
        enteredCount.current = next.length
        onChange(next)
    }

    function focusBox(index: number) {
        boxes.current[Math.max(0, Math.min(index, CODE_LENGTH - 1))]?.focus()
    }

    function handleChange(index: number, text: string) {
        const digits = text.replace(/\D/g, "")

        if (digits === "") {
            // The digit in this box was deleted.
            change(value.slice(0, index) + value.slice(index + 1))
            return
        }

        // One typed digit replaces the one in the box; several (a paste, an autofill) fill the boxes
        // from here on.
        const next = (value.slice(0, index) + digits + value.slice(index + digits.length)).slice(0, CODE_LENGTH)
        change(next)
        focusBox(Math.min(index + digits.length, CODE_LENGTH - 1))
    }

    function handleKeyDown(index: number, event: React.KeyboardEvent<HTMLInputElement>) {
        if (event.key === "Backspace" && value[index] === undefined && index > 0) {
            // An empty box: Backspace removes the digit before it and steps back.
            event.preventDefault()
            change(value.slice(0, index - 1) + value.slice(index))
            focusBox(index - 1)
        } else if (event.key === "ArrowLeft") {
            event.preventDefault()
            focusBox(index - 1)
        } else if (event.key === "ArrowRight") {
            event.preventDefault()
            focusBox(Math.min(index + 1, value.length))
        }
    }

    return (
        <div role="group" aria-labelledby={labelId} className="code-boxes-group">
            <span id={labelId} className="visually-hidden">{label}</span>
            <div className="code-boxes">
                {Array.from({ length: CODE_LENGTH }, (_, index) => (
                    <input
                        key={index}
                        ref={(element) => { boxes.current[index] = element }}
                        className="code-box"
                        inputMode="numeric"
                        autoComplete={index === 0 ? "one-time-code" : "off"}
                        aria-label={`Digit ${index + 1} of ${CODE_LENGTH}`}
                        aria-invalid={invalid ? true : undefined}
                        aria-describedby={describedBy}
                        value={value[index] ?? ""}
                        disabled={disabled}
                        autoFocus={index === 0}
                        onChange={(event) => handleChange(index, event.target.value)}
                        onKeyDown={(event) => handleKeyDown(index, event)}
                        onFocus={(event) => {
                            // Boxes fill from the left, so a tap on a box further along goes to the next empty one.
                            if (index > enteredCount.current) {
                                focusBox(enteredCount.current)
                            } else {
                                event.currentTarget.select()
                            }
                        }}
                    />
                ))}
            </div>
        </div>
    )
}

export default CodeInput
