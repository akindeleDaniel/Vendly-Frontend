import { useEffect, useId, useRef, useState } from "react"
import type { PayoutBank } from "../types/payout"
import { SearchIcon } from "./Icons"

type BankPickerProps = {
    banks: PayoutBank[]
    value: string// the chosen bank's id, or "" when none is chosen
    onChange: (bankId: string) => void
    disabled?: boolean
    invalid?: boolean
    describedBy?: string
}

// A type-to-search list of banks. It follows the standard "combobox with a list" pattern, so it
// works with a keyboard and a screen reader: the field stays focused while the arrow keys move
// through the list, Enter chooses, and Escape closes.
function BankPicker({ banks, value, onChange, disabled, invalid, describedBy }: BankPickerProps) {
    const inputId = useId()
    const listId = useId()
    const listRef = useRef<HTMLUListElement>(null)
    const selectedBank = banks.find((bank) => bank.id === value)

    const [typedText, setTypedText] = useState<string | null>(null)// null: show the chosen bank's name
    const [isOpen, setIsOpen] = useState(false)
    const [activeIndex, setActiveIndex] = useState(0)

    const searchText = typedText?.trim().toLowerCase() ?? ""
    const matches = searchText === ""
        ? banks
        : banks.filter((bank) => bank.name.toLowerCase().includes(searchText))
    const activeBank = matches[Math.min(activeIndex, matches.length - 1)]
    const showList = isOpen && !disabled

    // Keeps the highlighted bank in view while the arrow keys move through a long list.
    useEffect(() => {
        if (showList && activeBank) {
            listRef.current?.querySelector(`[data-bank-id="${CSS.escape(activeBank.id)}"]`)?.scrollIntoView({ block: "nearest" })
        }
    }, [showList, activeBank])

    function chooseBank(bank: PayoutBank) {
        onChange(bank.id)
        setTypedText(null)
        setIsOpen(false)
    }

    function handleInputChange(event: React.ChangeEvent<HTMLInputElement>) {
        setTypedText(event.target.value)
        setActiveIndex(0)
        setIsOpen(true)

        if (value !== "") {
            onChange("")// editing the text means the earlier choice no longer applies
        }
    }

    function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
        if (event.key === "ArrowDown") {
            event.preventDefault()
            if (!isOpen) {
                setIsOpen(true)
                return
            }
            setActiveIndex(Math.min(activeIndex + 1, matches.length - 1))
        } else if (event.key === "ArrowUp") {
            event.preventDefault()
            setActiveIndex(Math.max(activeIndex - 1, 0))
        } else if (event.key === "Enter" && showList) {
            event.preventDefault()// the form must not be submitted by choosing a bank
            if (activeBank) {
                chooseBank(activeBank)
            }
        } else if (event.key === "Escape" && showList) {
            event.preventDefault()
            setIsOpen(false)
            setTypedText(null)
        }
    }

    function handleBlur() {
        setIsOpen(false)
        setTypedText(null)// an unfinished search goes back to the chosen bank, or to empty
    }

    return (
        <div className="bank-picker">
            <label htmlFor={inputId} className="bank-picker-label">Bank</label>
            <div className="bank-picker-field">
                <input
                    id={inputId}
                    type="text"
                    role="combobox"
                    autoComplete="off"
                    placeholder="Search for your bank"
                    aria-expanded={showList}
                    aria-controls={listId}
                    aria-autocomplete="list"
                    aria-activedescendant={showList && activeBank ? `${listId}-${activeBank.id}` : undefined}
                    aria-invalid={invalid ? true : undefined}
                    aria-describedby={describedBy}
                    value={typedText ?? selectedBank?.name ?? ""}
                    disabled={disabled}
                    onChange={handleInputChange}
                    onFocus={() => setIsOpen(true)}
                    onClick={() => setIsOpen(true)}
                    onBlur={handleBlur}
                    onKeyDown={handleKeyDown}
                />
                <span className="bank-picker-icon"><SearchIcon size={18} /></span>

                {/* The mouse-down guard keeps focus in the field, so picking with a mouse or finger
                    does not close the list before the choice registers. */}
                {showList && (
                    <div className="bank-picker-popup" onMouseDown={(event) => event.preventDefault()}>
                        {matches.length > 0
                            ? (
                                <ul id={listId} role="listbox" aria-label="Banks" ref={listRef} className="bank-picker-list">
                                    {matches.map((bank) => (
                                        <li
                                            key={bank.id}
                                            id={`${listId}-${bank.id}`}
                                            data-bank-id={bank.id}
                                            role="option"
                                            aria-selected={bank.id === value}
                                            className={bank === activeBank ? "bank-picker-option is-active" : "bank-picker-option"}
                                            onClick={() => chooseBank(bank)}
                                        >
                                            {bank.name}
                                        </li>
                                    ))}
                                </ul>
                            )
                            : <p className="bank-picker-empty">No bank matches &ldquo;{typedText?.trim()}&rdquo;.</p>}
                    </div>
                )}
            </div>
            <span role="status" className="visually-hidden">
                {showList ? `${matches.length} ${matches.length === 1 ? "bank" : "banks"} found` : ""}
            </span>
        </div>
    )
}

export default BankPicker
