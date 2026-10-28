import { useId, useState } from "react"
import { Link } from "react-router-dom"
import { BellRing, Search, ShoppingBag } from "lucide-react"
import BackArrow from "../components/BackArrow"
import Notice from "../components/Notice"
import { CATEGORIES } from "../data/categories"
import { apiRequest, failureMessage } from "../lib/apiRequest"
import { formatNaira } from "../lib/money"
import { readFieldProblems, saveBulkChanges } from "../lib/productBulkApi"
import type { BulkChange, FieldProblem } from "../lib/productBulkApi"
import { ALERT_MAX, LOW_STOCK_THRESHOLD, sellerStockStatus } from "../lib/stock"
import { useApiResource } from "../lib/useApiResource"
import { useDocumentTitle } from "../lib/useDocumentTitle"
import type { Listing } from "../types/listing"

type Filter = "all" | "low" | "sold-out"
type Edit = { price?: string, stock?: string, alert?: string, category?: string }
type Variant = { listingId: number, label: string, price: number, stock: number }

const FIELD_OF: Record<keyof Edit, string> = { price: "price", stock: "stockQuantity", alert: "lowStockThreshold", category: "category" }

function variantsOf(product: Listing): Variant[] {
    return (product.options ?? []).flatMap((option) => option.sizes.length > 0
        ? option.sizes.map((size) => ({ listingId: size.listingId, label: `${option.label} / ${size.label}`, price: option.price, stock: size.stockQuantity }))
        : option.listingId !== null ? [{ listingId: option.listingId, label: option.label, price: option.price, stock: option.stockQuantity ?? 0 }] : [])
}

function toPrice(value: string): number | null {
    const number = Number(value.replace(/[₦,\s]/g, ""))
    return value.trim() !== "" && Number.isFinite(number) && number > 0 ? number : null
}

function toWhole(value: string, max: number): number | null {
    return /^\d+$/.test(value.trim()) && Number(value) <= max ? Number(value) : null
}

// Many products' prices, stock, low-stock alerts and categories in one table. Nothing is saved until
// Save all, and then everything is saved together or nothing is. Products with options show each
// option's price and stock under them.
function QuickEditPage() {
    useDocumentTitle("Quick edit")
    const searchId = useId()
    const { state, reload } = useApiResource("quick-edit", (signal) => apiRequest<Listing[]>("/listings/Mylisting", { signal, isValid: (value): value is Listing[] => Array.isArray(value) }))
    // The shop's low-stock alert number, which a product without its own uses.
    const profile = useApiResource("quick-edit-profile", (signal) => apiRequest<{ lowStockThreshold?: number }>("/seller/profile", { signal }))
    const shopAlert = profile.state.kind === "ready" && typeof profile.state.data.lowStockThreshold === "number" ? profile.state.data.lowStockThreshold : LOW_STOCK_THRESHOLD
    const shopAlertText = shopAlert === 0 ? "Off" : String(shopAlert)
    const [edits, setEdits] = useState<Record<number, Edit>>({})
    const [search, setSearch] = useState("")
    const [filter, setFilter] = useState<Filter>("all")
    const [problems, setProblems] = useState<FieldProblem[]>([])
    const [isSaving, setIsSaving] = useState(false)
    const [error, setError] = useState("")
    const [saved, setSaved] = useState("")

    function edit(listingId: number, patch: Edit) {
        setEdits((current) => ({ ...current, [listingId]: { ...current[listingId], ...patch } }))
        setProblems((current) => current.filter((problem) => problem.listingId !== listingId))
        setSaved("")
    }

    if (state.kind === "loading") {
        return <div className="bulk-page"><p role="status">Loading your products...</p></div>
    }

    if (state.kind === "error") {
        return (
            <div className="bulk-page">
                <Notice kind="error">
                    <p>{state.message}</p>
                    <button type="button" onClick={reload}>Try again</button>
                </Notice>
            </div>
        )
    }

    const products = state.data.filter((product) => !product.archivedAt && !product.isDraft)
    const originals = new Map<number, { price: string, stock: string, alert: string, category: string }>()
    for (const product of products) {
        originals.set(product.id, {
            price: String(product.price),
            stock: String(product.stockQuantity),
            alert: product.lowStockThreshold === null || product.lowStockThreshold === undefined ? "" : String(product.lowStockThreshold),
            category: product.category
        })
        for (const variant of variantsOf(product)) {
            originals.set(variant.listingId, { price: String(variant.price), stock: String(variant.stock), alert: "", category: "" })
        }
    }

    // Only the fields that differ from what is saved.
    const changed: Array<{ listingId: number, field: keyof Edit, value: string }> = []
    for (const [id, edit] of Object.entries(edits)) {
        const original = originals.get(Number(id))
        if (!original) continue
        for (const field of Object.keys(edit) as Array<keyof Edit>) {
            const value = edit[field] ?? ""
            if (value.trim() !== original[field].trim()) changed.push({ listingId: Number(id), field, value })
        }
    }

    const low = products.filter((product) => sellerStockStatus(product) === "low")
    const soldOut = products.filter((product) => sellerStockStatus(product) === "sold_out")
    const term = search.trim().toLowerCase()
    const shown = products
        .filter((product) => filter === "all" || (filter === "low" ? sellerStockStatus(product) === "low" : sellerStockStatus(product) === "sold_out"))
        .filter((product) => term === "" || product.title.toLowerCase().includes(term))

    function valueOf(listingId: number, field: keyof Edit): string {
        return edits[listingId]?.[field] ?? originals.get(listingId)?.[field] ?? ""
    }

    function isChanged(listingId: number, field: keyof Edit): boolean {
        return changed.some((change) => change.listingId === listingId && change.field === field)
    }

    function problemFor(listingId: number, field: keyof Edit): string | null {
        return problems.find((problem) => problem.listingId === listingId && (problem.field === FIELD_OF[field] || problem.field === field))?.message ?? null
    }

    async function saveAll() {
        const byListing = new Map<number, BulkChange>()

        for (const change of changed) {
            const bulk = byListing.get(change.listingId) ?? { listingId: change.listingId }
            if (change.field === "price") {
                const price = toPrice(change.value)
                if (price === null) { setError("Write each price as a number above 0, like 15000."); return }
                bulk.price = price
            } else if (change.field === "stock") {
                const stock = toWhole(change.value, 100_000)
                if (stock === null) { setError("Write each stock count as a whole number."); return }
                bulk.stockQuantity = stock
            } else if (change.field === "alert") {
                if (change.value.trim() === "") {
                    bulk.lowStockThreshold = null
                } else {
                    const alert = toWhole(change.value, ALERT_MAX)
                    if (alert === null) { setError(`Write each alert as a whole number from 0 to ${ALERT_MAX}, or leave it empty for your shop's number.`); return }
                    bulk.lowStockThreshold = alert
                }
            } else if (change.value !== "") {
                bulk.category = change.value
            }
            byListing.set(change.listingId, bulk)
        }

        const changes = [...byListing.values()].filter((change) => Object.keys(change).length > 1)
        if (changes.length === 0) {
            return
        }

        setIsSaving(true)
        setError("")
        const result = await saveBulkChanges(changes)
        setIsSaving(false)

        if (result.kind === "ok") {
            setEdits({})
            setProblems([])
            setSaved(`${result.data.count} ${result.data.count === 1 ? "product" : "products"} saved.`)
            reload()
        } else if (result.kind !== "unauthorized") {
            setProblems(readFieldProblems(result))
            setError(result.kind === "failed" && result.code === "BULK_STOCK_RESERVED"
                ? "Nothing was saved. Some stock can't go that low while shoppers are paying for it. Fix the ones in red."
                : failureMessage(result))
        }
    }

    function numberCell(listingId: number, field: "price" | "stock", label: string) {
        const problem = problemFor(listingId, field)
        const original = originals.get(listingId)?.[field] ?? ""
        const changedNow = isChanged(listingId, field)
        const input = (
            <input
                className={`product-input${problem ? " is-error" : changedNow ? " is-changed" : ""}`}
                aria-label={label}
                aria-invalid={problem ? true : undefined}
                inputMode={field === "price" ? "decimal" : "numeric"}
                value={valueOf(listingId, field)}
                disabled={isSaving}
                onChange={(event) => edit(listingId, { [field]: event.target.value })}
            />
        )

        return (
            <label className="quick-cell">
                <span className="quick-key">{field === "price" ? "Price" : "Stock"}</span>
                {field === "price" ? <span className="product-input product-money quick-money"><span aria-hidden="true">₦</span>{input}</span> : input}
                {changedNow && !problem && <span className="quick-was">was <s>{field === "price" ? formatNaira(original) : original}</s></span>}
                {problem && <span className="quick-error">{problem}</span>}
            </label>
        )
    }

    const filters: Array<{ value: Filter, label: string, count: number }> = [
        { value: "all", label: "All", count: products.length },
        ...(low.length > 0 ? [{ value: "low" as const, label: "Running low", count: low.length }] : []),
        ...(soldOut.length > 0 ? [{ value: "sold-out" as const, label: "Sold out", count: soldOut.length }] : [])
    ]

    return (
        <div className="bulk-page">
            <BackArrow to="/seller/myListing" label="Back to my store" />
            <div className="product-form-title">
                <h1>Quick edit</h1>
                <p>Change prices, stock and alerts for many products at once. Nothing is saved until you press Save all, and then everything is saved together.</p>
            </div>

            <div className="quick-tools">
                <div className="product-input product-money quick-search">
                    <Search size={18} aria-hidden="true" />
                    <label htmlFor={searchId} className="visually-hidden">Find a product</label>
                    <input id={searchId} type="search" placeholder="Find a product" value={search} onChange={(event) => setSearch(event.target.value)} />
                </div>
                {filters.length > 1 && (
                    <div className="money-chips quick-filters" role="group" aria-label="Show">
                        {filters.map((option) => (
                            <button key={option.value} type="button" className={`money-chip${filter === option.value ? " is-on" : ""}`} aria-pressed={filter === option.value} onClick={() => setFilter(option.value)}>
                                {option.label}<span className="money-chip-count">{option.count}</span>
                            </button>
                        ))}
                    </div>
                )}
            </div>

            <p className="quick-alert-help">
                <BellRing size={18} aria-hidden="true" />
                <span>
                    <b>Low-stock alert:</b> we email you when a product drops to this many or fewer, so you can restock in time.
                    Leave it empty to use your shop's number ({shopAlert === 0 ? "alerts are off" : shopAlert}), or put 0 for no emails about that product.{" "}
                    <Link to="/seller/profile/edit#low-stock">Change your shop's number</Link>
                </span>
            </p>

            {saved && <Notice kind="success">{saved}</Notice>}

            {products.length === 0 ? (
                <div className="store-empty"><h3>No products on sale</h3><p>Products you add show here, ready to change in one go.</p></div>
            ) : shown.length === 0 ? (
                <p className="product-help">No products match.</p>
            ) : (
                <div className="quick-table">
                    <div className="quick-head" aria-hidden="true"><span /><span>Product</span><span>Price</span><span>Stock</span><span>Low-stock alert</span><span>Category</span></div>
                    <ul>
                        {shown.map((product) => {
                            const variants = product.hasOptions ? variantsOf(product) : []
                            const alertProblem = problemFor(product.id, "alert")
                            const categoryProblem = problemFor(product.id, "category")

                            return (
                                <li key={product.id} className="quick-group">
                                    <div className="quick-row">
                                        {product.imageUrl
                                            ? <img className="quick-photo" src={product.imageUrl} alt="" loading="lazy" />
                                            : <span className="quick-photo" aria-hidden="true"><ShoppingBag size={18} /></span>}
                                        <span className="quick-name"><b>{product.title}</b><small>{variants.length > 0 ? `${variants.length} ${variants.length === 1 ? "option" : "options"}` : `${product.stockQuantity} in stock`}</small></span>
                                        {variants.length > 0 ? <span className="quick-on-options">On each option</span> : (
                                            <>
                                                {numberCell(product.id, "price", `Price of ${product.title}`)}
                                                {numberCell(product.id, "stock", `Stock of ${product.title}`)}
                                            </>
                                        )}
                                        <label className="quick-cell">
                                            <span className="quick-key">Low-stock alert</span>
                                            <input
                                                className={`product-input${alertProblem ? " is-error" : isChanged(product.id, "alert") ? " is-changed" : ""}`}
                                                aria-label={`Low-stock alert for ${product.title}`}
                                                inputMode="numeric"
                                                placeholder={`Shop: ${shopAlertText}`}
                                                value={valueOf(product.id, "alert")}
                                                disabled={isSaving}
                                                onChange={(event) => edit(product.id, { alert: event.target.value })}
                                            />
                                            {alertProblem && <span className="quick-error">{alertProblem}</span>}
                                        </label>
                                        <label className="quick-cell quick-category">
                                            <span className="quick-key">Category</span>
                                            <select
                                                className={`product-input${categoryProblem ? " is-error" : isChanged(product.id, "category") ? " is-changed" : ""}`}
                                                aria-label={`Category of ${product.title}`}
                                                value={valueOf(product.id, "category")}
                                                disabled={isSaving}
                                                onChange={(event) => edit(product.id, { category: event.target.value })}
                                            >
                                                {CATEGORIES.map((category) => <option key={category} value={category}>{category}</option>)}
                                            </select>
                                            {categoryProblem && <span className="quick-error">{categoryProblem}</span>}
                                        </label>
                                    </div>
                                    {variants.map((variant) => (
                                        <div key={variant.listingId} className="quick-row is-option">
                                            <span />
                                            <span className="quick-option-name">{variant.label}</span>
                                            {numberCell(variant.listingId, "price", `Price of ${product.title}, ${variant.label}`)}
                                            {numberCell(variant.listingId, "stock", `Stock of ${product.title}, ${variant.label}`)}
                                        </div>
                                    ))}
                                </li>
                            )
                        })}
                    </ul>
                </div>
            )}

            {error && <Notice kind="error">{error}</Notice>}

            {changed.length > 0 && (
                <div className="drafts-bar" role="region" aria-label="Save changes">
                    <p><b>{changed.length} {changed.length === 1 ? "change" : "changes"}.</b> {problems.length > 0 ? "Fix the ones in red before saving." : "They're saved together, or not at all."}</p>
                    <button type="button" className="btn" disabled={isSaving} onClick={() => { setEdits({}); setProblems([]); setError("") }}>Discard</button>
                    <button type="button" className="btn btn-primary" disabled={isSaving} onClick={saveAll}>{isSaving ? "Saving..." : "Save all"}</button>
                </div>
            )}
        </div>
    )
}

export default QuickEditPage
