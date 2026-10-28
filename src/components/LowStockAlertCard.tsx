import { useId, useRef } from "react"
import { Mail, Minus, Plus } from "lucide-react"
import { ALERT_MAX, LOW_STOCK_THRESHOLD } from "../lib/stock"

type LowStockAlertCardProps = {
    value: number // the shop's alert number; 0 means the alerts are off
    onChange: (value: number) => void
    disabled?: boolean
}

// Shop details: when StoreHatch emails the seller that stock is running out. One number for the
// whole shop; a product can have its own on its edit page.
function LowStockAlertCard({ value, onChange, disabled = false }: LowStockAlertCardProps) {
    const numberId = useId()
    const lastOn = useRef(value > 0 ? value : LOW_STOCK_THRESHOLD)// what the number goes back to when the alerts are turned on again
    const isOn = value > 0

    function set(next: number) {
        const clamped = Math.min(ALERT_MAX, Math.max(1, Math.round(next)))
        lastOn.current = clamped
        onChange(clamped)
    }

    function scrollHere(element: HTMLElement | null) {
        // Opened from My store's "Change the alert number": bring the card into view once.
        if (element && window.location.hash === "#low-stock" && !element.dataset.scrolled) {
            element.dataset.scrolled = "true"
            element.scrollIntoView({ block: "center" })
        }
    }

    return (
        <section id="low-stock" ref={scrollHere} className="product-form-card" aria-labelledby="low-stock-heading">
            <h2 id="low-stock-heading">Low-stock alerts</h2>
            <p className="product-help settings-card-lead">
                We email you when a product is running out, so you can restock before you lose sales. Options and sizes are checked one by one.
            </p>

            <label className="settings-switch">
                <input
                    type="checkbox"
                    role="switch"
                    checked={isOn}
                    disabled={disabled}
                    onChange={(event) => onChange(event.target.checked ? lastOn.current : 0)}
                />
                <span>
                    <b>Email me when stock runs low</b>
                    <span>{isOn ? "On. A product can still have its own number, or none." : "Off for every product, unless a product has its own number."}</span>
                </span>
            </label>

            {isOn && (
                <>
                    <div className="settings-stepper">
                        <label htmlFor={numberId}>Alert me at</label>
                        <span className="settings-step">
                            <button type="button" aria-label="One fewer" disabled={disabled || value <= 1} onClick={() => set(value - 1)}><Minus size={18} aria-hidden="true" /></button>
                            <input
                                id={numberId}
                                type="number"
                                min="1"
                                max={ALERT_MAX}
                                step="1"
                                inputMode="numeric"
                                value={value}
                                disabled={disabled}
                                onChange={(event) => { const next = Number(event.target.value); if (Number.isFinite(next) && event.target.value !== "") set(next) }}
                            />
                            <button type="button" aria-label="One more" disabled={disabled || value >= ALERT_MAX} onClick={() => set(value + 1)}><Plus size={18} aria-hidden="true" /></button>
                        </span>
                        <span>or fewer left</span>
                    </div>

                    <div className="settings-example" aria-label="What this means">
                        <b>With {value}, for example</b>
                        <p><span className="settings-example-dot" aria-hidden="true">–</span>A sale from {value + 3} to {value + 1} left: no email.</p>
                        <p><span className="settings-example-dot is-mail" aria-hidden="true"><Mail size={14} /></span>A sale from {value + 1} to {value} left: one "Running low" email.</p>
                        <p>
                            <span className="settings-example-dot" aria-hidden="true">–</span>
                            {value > 1 ? `More sales below ${value}: no more emails until you restock.` : "Restock above 1, and the next drop alerts you again."}
                        </p>
                        <p><span className="settings-example-dot is-out" aria-hidden="true"><Mail size={14} /></span>Selling the last one sends a "Sold out" email.</p>
                    </div>
                </>
            )}

            <p className="product-help">A product can have its own number, or none, on its edit page. Several items from one sale come in one email.</p>
        </section>
    )
}

export default LowStockAlertCard
