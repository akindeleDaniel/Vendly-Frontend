import { useId, useState } from "react"
import { Check, ShoppingBag, Trash2 } from "lucide-react"
import Notice from "./Notice"
import { CATEGORIES } from "../data/categories"
import { failureMessage } from "../lib/apiRequest"
import { publishDrafts, readFieldProblems, saveBulkChanges } from "../lib/productBulkApi"
import type { BulkChange, FieldProblem } from "../lib/productBulkApi"
import type { DraftField, Listing } from "../types/listing"

type Edit = { title?: string, description?: string, price?: string, stock?: string, category?: string }

// One buyable line of a draft with options: an option, or one size of it.
type Variant = { listingId: number, label: string, price: number, stock: number }

const FIELD_WORDS: Record<DraftField, string> = {
    title: "a name",
    description: "a description",
    price: "a price",
    stockQuantity: "stock",
    category: "a category",
    imageUrl: "a photo"
}

const PLACEHOLDER_NAMES = /^(untitled product|img[_-]?\d+|dsc[_-]?\d+|photo[_-]?\d+)$/i

function variantsOf(draft: Listing): Variant[] {
    return (draft.options ?? []).flatMap((option) => option.sizes.length > 0
        ? option.sizes.map((size) => ({ listingId: size.listingId, label: `${option.label} / ${size.label}`, price: option.price, stock: size.stockQuantity }))
        : option.listingId !== null ? [{ listingId: option.listingId, label: option.label, price: option.price, stock: option.stockQuantity ?? 0 }] : [])
}

function isWholeNumber(value: string): boolean {
    return /^\d+$/.test(value.trim())
}

function isPrice(value: string): boolean {
    const number = Number(value.replace(/[₦,\s]/g, ""))
    return value.trim() !== "" && Number.isFinite(number) && number > 0
}

// What a draft still needs, with the seller's unsaved edits taken into account.
function missingOf(draft: Listing, edit: Edit): DraftField[] {
    const fromServer = new Set(draft.draftMissing ?? [])
    const hasOptions = draft.hasOptions === true
    const missing: DraftField[] = []
    const title = edit.title ?? draft.title
    if (title.trim() === "" || PLACEHOLDER_NAMES.test(title.trim())) missing.push("title")
    if ((edit.description ?? draft.description).trim() === "") missing.push("description")
    if (!hasOptions && (edit.price !== undefined ? !isPrice(edit.price) : fromServer.has("price"))) missing.push("price")
    if (!hasOptions && (edit.stock !== undefined ? !isWholeNumber(edit.stock) : fromServer.has("stockQuantity"))) missing.push("stockQuantity")
    if ((edit.category ?? draft.category ?? "") === "") missing.push("category")
    if (fromServer.has("imageUrl")) missing.push("imageUrl")
    return missing
}

function needsText(missing: DraftField[]): string {
    const words = missing.map((field) => FIELD_WORDS[field])
    return words.length > 2 ? `${words.slice(0, 2).join(", ")} and ${words.length - 2} more` : words.join(" and ")
}

// The edits as one bulk change per product or option; nothing for fields left as they were.
function changesFrom(drafts: Listing[], edits: Record<number, Edit>, variantEdits: Record<number, { price?: string, stock?: string }>): { changes: BulkChange[], problem: string } {
    const changes: BulkChange[] = []

    for (const draft of drafts) {
        const edit = edits[draft.id]
        if (!edit) continue
        const change: BulkChange = { listingId: draft.id }
        if (edit.title !== undefined && edit.title.trim() !== draft.title) change.title = edit.title.trim()
        if (edit.description !== undefined && edit.description.trim() !== draft.description) change.description = edit.description.trim()
        if (edit.category !== undefined && edit.category !== draft.category && edit.category !== "") change.category = edit.category
        if (!draft.hasOptions && edit.price !== undefined && edit.price.trim() !== "") {
            if (!isPrice(edit.price)) return { changes: [], problem: `Write the price of "${draft.title}" as a number, like 15000.` }
            change.price = Number(edit.price.replace(/[₦,\s]/g, ""))
        }
        if (!draft.hasOptions && edit.stock !== undefined && edit.stock.trim() !== "") {
            if (!isWholeNumber(edit.stock)) return { changes: [], problem: `Write the stock of "${draft.title}" as a whole number.` }
            change.stockQuantity = Number(edit.stock)
        }
        if (Object.keys(change).length > 1) changes.push(change)
    }

    for (const [id, edit] of Object.entries(variantEdits)) {
        const change: BulkChange = { listingId: Number(id) }
        if (edit.price !== undefined && edit.price.trim() !== "") {
            if (!isPrice(edit.price)) return { changes: [], problem: "Write each size's price as a number, like 15000." }
            change.price = Number(edit.price.replace(/[₦,\s]/g, ""))
        }
        if (edit.stock !== undefined && edit.stock.trim() !== "") {
            if (!isWholeNumber(edit.stock)) return { changes: [], problem: "Write each size's stock as a whole number." }
            change.stockQuantity = Number(edit.stock)
        }
        if (Object.keys(change).length > 1) changes.push(change)
    }

    return { changes, problem: "" }
}

type DraftsPanelProps = {
    drafts: Listing[]
    onChanged: () => void // reload the drafts and the products on sale
    onDelete: (id: number) => void
}

// The Drafts tab: every draft as a row to fill in place, a way to give many drafts one category, and
// publishing the ready ones. Drafts are hidden from shoppers until they are published.
function DraftsPanel({ drafts, onChanged, onDelete }: DraftsPanelProps) {
    const bulkCategoryId = useId()
    const [edits, setEdits] = useState<Record<number, Edit>>({})
    const [variantEdits, setVariantEdits] = useState<Record<number, { price?: string, stock?: string }>>({})
    const [ticked, setTicked] = useState<Set<number>>(new Set())
    const [openDescriptions, setOpenDescriptions] = useState<Set<number>>(new Set())
    const [bulkCategory, setBulkCategory] = useState("")
    const [bulkDone, setBulkDone] = useState("")
    const [isWorking, setIsWorking] = useState(false)
    const [error, setError] = useState("")
    const [problems, setProblems] = useState<FieldProblem[]>([])
    const [success, setSuccess] = useState("")

    const rows = drafts.map((draft) => ({ draft, edit: edits[draft.id] ?? {}, missing: missingOf(draft, edits[draft.id] ?? {}) }))
    const readyIds = rows.filter((row) => row.missing.length === 0).map((row) => row.draft.id)
    const tickedReady = readyIds.filter((id) => ticked.has(id))
    const withoutCategory = rows.filter((row) => (row.edit.category ?? row.draft.category ?? "") === "")
    const hasEdits = Object.keys(edits).length > 0 || Object.keys(variantEdits).length > 0

    function edit(id: number, patch: Edit) {
        setEdits((current) => ({ ...current, [id]: { ...current[id], ...patch } }))
        setSuccess("")
        setBulkDone("")
    }

    function editVariant(id: number, patch: { price?: string, stock?: string }) {
        setVariantEdits((current) => ({ ...current, [id]: { ...current[id], ...patch } }))
        setSuccess("")
    }

    function toggle(set: Set<number>, id: number): Set<number> {
        const next = new Set(set)
        if (next.has(id)) next.delete(id)
        else next.add(id)
        return next
    }

    function setCategoryFor(ids: number[]) {
        if (!bulkCategory || ids.length === 0) {
            return
        }
        setEdits((current) => {
            const next = { ...current }
            ids.forEach((id) => { next[id] = { ...next[id], category: bulkCategory } })
            return next
        })
        setBulkDone(`${ids.length} ${ids.length === 1 ? "draft" : "drafts"} set to ${bulkCategory}. Save or publish to keep it.`)
    }

    // Saves the edits; true when there was nothing to save or it worked.
    async function save(): Promise<boolean> {
        const { changes, problem } = changesFrom(drafts, edits, variantEdits)

        if (problem) {
            setError(problem)
            return false
        }

        if (changes.length === 0) {
            return true
        }

        const result = await saveBulkChanges(changes)

        if (result.kind === "ok") {
            setEdits({})
            setVariantEdits({})
            setProblems([])
            return true
        }

        if (result.kind !== "unauthorized") {
            setProblems(readFieldProblems(result))
            setError(failureMessage(result))
        }
        return false
    }

    async function handleSave() {
        setIsWorking(true)
        setError("")
        setSuccess("")
        const saved = await save()
        setIsWorking(false)
        if (saved) {
            setSuccess("Your drafts are saved.")
            onChanged()
        }
    }

    async function handlePublish() {
        if (tickedReady.length === 0) {
            return
        }
        setIsWorking(true)
        setError("")
        setSuccess("")

        if (!(await save())) {
            setIsWorking(false)
            return
        }

        const result = await publishDrafts(tickedReady)
        setIsWorking(false)

        if (result.kind === "ok") {
            const { published, problems: left } = result.data
            setTicked(new Set())
            setProblems(left)
            setSuccess(published.length > 0 ? `${published.length} ${published.length === 1 ? "product is" : "products are"} on sale now.` : "")
            if (left.length > 0) {
                setError("Some drafts still need something before they can go on sale.")
            }
            onChanged()
        } else if (result.kind !== "unauthorized") {
            setError(failureMessage(result))
        }
    }

    if (drafts.length === 0) {
        return (
            <div className="store-empty">
                <h3>No drafts</h3>
                <p>Drafts are products you've started but not put on sale, for example from photos or a Shopify import.</p>
            </div>
        )
    }

    return (
        <div className="drafts">
            <div className="drafts-intro">
                <p><b>Drafts are hidden from shoppers.</b> Fill in what each one needs, then tick the ready ones and publish them.</p>
                <button type="button" className="btn" onClick={() => setTicked(new Set(readyIds))} disabled={readyIds.length === 0}>Tick the ready ones</button>
            </div>

            <div className="drafts-category" role="group" aria-label="One category for many drafts">
                <label htmlFor={bulkCategoryId}>Set a category for</label>
                <select id={bulkCategoryId} className="product-input" value={bulkCategory} onChange={(event) => { setBulkCategory(event.target.value); setBulkDone("") }}>
                    <option value="">Choose a category</option>
                    {CATEGORIES.map((category) => <option key={category} value={category}>{category}</option>)}
                </select>
                <button type="button" className="btn" disabled={!bulkCategory || withoutCategory.length === 0} onClick={() => setCategoryFor(withoutCategory.map((row) => row.draft.id))}>
                    {withoutCategory.length === 0 ? "Every draft has one" : `The ${withoutCategory.length} ${withoutCategory.length === 1 ? "draft" : "drafts"} without one`}
                </button>
                <button type="button" className="btn-text" disabled={!bulkCategory || ticked.size === 0} onClick={() => setCategoryFor([...ticked])}>The ticked ones</button>
                {bulkDone && <span className="drafts-category-done" role="status">{bulkDone}</span>}
            </div>

            <div className="drafts-table">
                <div className="drafts-head" aria-hidden="true"><span /><span /><span>Name</span><span>Price</span><span>Stock</span><span>Category</span><span>Ready?</span></div>
                <ul>
                    {rows.map(({ draft, edit: draftEdit, missing }) => {
                        const ready = missing.length === 0
                        const isOpen = openDescriptions.has(draft.id)
                        const description = draftEdit.description ?? draft.description
                        const rowProblems = problems.filter((problem) => problem.listingId === draft.id)
                        const variants = draft.hasOptions ? variantsOf(draft) : []
                        const missingClass = (field: DraftField) => missing.includes(field) ? " is-missing" : ""

                        return (
                            <li key={draft.id} className="drafts-group">
                                <div className="drafts-row">
                                    <input type="checkbox" className="drafts-tick" aria-label={`Tick ${draft.title}`} checked={ticked.has(draft.id)} onChange={() => setTicked((current) => toggle(current, draft.id))} />
                                    {draft.imageUrl
                                        ? <img className="drafts-photo" src={draft.imageUrl} alt="" loading="lazy" />
                                        : <span className="drafts-photo" aria-hidden="true"><ShoppingBag size={20} /></span>}
                                    <div className="drafts-name">
                                        <input className={`product-input${missingClass("title")}`} aria-label="Name" maxLength={100} value={draftEdit.title ?? draft.title} disabled={isWorking} onChange={(event) => edit(draft.id, { title: event.target.value })} />
                                        {variants.length > 0 && <span>{variants.length} {variants.length === 1 ? "option" : "options"}, priced below</span>}
                                    </div>
                                    {draft.hasOptions ? <span className="drafts-on-options">On each option, below</span> : (
                                        <>
                                            <label className="drafts-cell"><span className="drafts-key">Price</span>
                                                <span className={`product-input product-money${missingClass("price")}`}><span aria-hidden="true">₦</span>
                                                    <input aria-label="Price" inputMode="decimal" value={draftEdit.price ?? (draft.draftMissing?.includes("price") ? "" : String(draft.price))} disabled={isWorking} onChange={(event) => edit(draft.id, { price: event.target.value })} />
                                                </span>
                                            </label>
                                            <label className="drafts-cell"><span className="drafts-key">Stock</span>
                                                <input className={`product-input${missingClass("stockQuantity")}`} aria-label="Stock" inputMode="numeric" value={draftEdit.stock ?? (draft.draftMissing?.includes("stockQuantity") ? "" : String(draft.stockQuantity))} disabled={isWorking} onChange={(event) => edit(draft.id, { stock: event.target.value })} />
                                            </label>
                                        </>
                                    )}
                                    <select className={`product-input drafts-category-cell${missingClass("category")}`} aria-label="Category" value={draftEdit.category ?? draft.category ?? ""} disabled={isWorking} onChange={(event) => edit(draft.id, { category: event.target.value })}>
                                        <option value="">Choose a category</option>
                                        {CATEGORIES.map((category) => <option key={category} value={category}>{category}</option>)}
                                    </select>
                                    <div className="drafts-state">
                                        {ready
                                            ? <span className="drafts-ready"><Check size={13} strokeWidth={3} aria-hidden="true" />Ready</span>
                                            : <span className="drafts-needs">Needs {needsText(missing)}</span>}
                                        <span className="drafts-row-actions">
                                            <button type="button" className="btn-text" aria-expanded={isOpen} onClick={() => setOpenDescriptions((current) => toggle(current, draft.id))}>
                                                {isOpen ? "Hide description" : description ? "Description" : "Add a description"}
                                            </button>
                                            <button type="button" className="store-icon-button" aria-label={`Delete ${draft.title}`} disabled={isWorking} onClick={() => onDelete(draft.id)}><Trash2 size={16} aria-hidden="true" /></button>
                                        </span>
                                    </div>
                                </div>
                                {isOpen && (
                                    <div className="drafts-description">
                                        <textarea
                                            className={`product-input${missingClass("description")}`}
                                            aria-label={`Description of ${draft.title}`}
                                            rows={3}
                                            maxLength={5000}
                                            placeholder="What it is, what it's made of, sizes, how to use it"
                                            value={description}
                                            disabled={isWorking}
                                            onChange={(event) => edit(draft.id, { description: event.target.value })}
                                        />
                                    </div>
                                )}
                                {variants.length > 0 && (
                                    <div className="drafts-variants">
                                        {variants.map((variant) => (
                                            <div key={variant.listingId} className="drafts-variant">
                                                <span>{variant.label}</span>
                                                <span className="product-input product-money"><span aria-hidden="true">₦</span>
                                                    <input aria-label={`Price of ${variant.label}`} inputMode="decimal" value={variantEdits[variant.listingId]?.price ?? String(variant.price)} disabled={isWorking} onChange={(event) => editVariant(variant.listingId, { price: event.target.value })} />
                                                </span>
                                                <input className="product-input" aria-label={`Stock of ${variant.label}`} inputMode="numeric" value={variantEdits[variant.listingId]?.stock ?? String(variant.stock)} disabled={isWorking} onChange={(event) => editVariant(variant.listingId, { stock: event.target.value })} />
                                            </div>
                                        ))}
                                    </div>
                                )}
                                {rowProblems.length > 0 && (
                                    <ul className="drafts-problems">
                                        {rowProblems.map((problem, index) => <li key={index}>{problem.message}</li>)}
                                    </ul>
                                )}
                            </li>
                        )
                    })}
                </ul>
            </div>

            {error && <Notice kind="error">{error}</Notice>}
            {success && <Notice kind="success">{success}</Notice>}

            <div className="drafts-bar" role="region" aria-label="Save or publish drafts">
                <p>
                    <b>{readyIds.length} of {drafts.length} {drafts.length === 1 ? "draft" : "drafts"} ready.</b>{" "}
                    {tickedReady.length > 0 ? `${tickedReady.length} ticked to publish.` : "Tick the ready ones to publish them."}
                </p>
                <button type="button" className="btn" disabled={isWorking || !hasEdits} onClick={handleSave}>{isWorking ? "Saving..." : "Save drafts"}</button>
                <button type="button" className="btn btn-primary" disabled={isWorking || tickedReady.length === 0} onClick={handlePublish}>
                    {tickedReady.length > 0 ? `Publish ${tickedReady.length}` : "Publish"}
                </button>
            </div>
        </div>
    )
}

export default DraftsPanel
