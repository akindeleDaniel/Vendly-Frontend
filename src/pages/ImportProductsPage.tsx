import { useId, useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import { Check, FileSpreadsheet, ShoppingBag } from "lucide-react"
import BackArrow from "../components/BackArrow"
import Notice from "../components/Notice"
import { failureMessage } from "../lib/apiRequest"
import { formatNaira } from "../lib/money"
import { checkImport, downloadFile, readImportProblems, saveImport } from "../lib/productBulkApi"
import type { ImportCheck, ImportProblem } from "../lib/productBulkApi"
import { useDocumentTitle } from "../lib/useDocumentTitle"

type Source = "storehatch" | "shopify"

type Step =
    | { kind: "choose" }
    | { kind: "checked", check: ImportCheck }
    | { kind: "problems", message: string, problems: ImportProblem[] }

const MAX_FILE_CHARACTERS = 1_500_000
const PREVIEW_ROWS = 50

function priceText(price: ImportCheck["products"][number]["price"]): string {
    return price === null || price === "" ? "—" : formatNaira(String(price))
}

function photoCount(photos: ImportCheck["products"][number]["photos"]): number {
    return Array.isArray(photos) ? photos.length : typeof photos === "number" ? photos : 1
}

// Adds up to 200 products from a spreadsheet saved as CSV: the StoreHatch template, or a Shopify
// product export as it is. The file is checked first and nothing is added until the seller confirms.
// Shopify products come in as drafts, to be given a StoreHatch category on the Drafts tab.
function ImportProductsPage() {
    useDocumentTitle("Import products")
    const navigate = useNavigate()
    const sourceName = useId()
    const inputRef = useRef<HTMLInputElement>(null)
    const [source, setSource] = useState<Source>("storehatch")
    const [file, setFile] = useState<{ name: string, size: number, text: string } | null>(null)
    const [step, setStep] = useState<Step>({ kind: "choose" })
    const [isWorking, setIsWorking] = useState(false)
    const [error, setError] = useState("")

    async function chooseFile(chosen: File | undefined) {
        setError("")
        setStep({ kind: "choose" })

        if (!chosen) {
            return
        }

        const text = await chosen.text().catch(() => null)

        if (text === null) {
            setError("That file couldn't be read. Save it again as CSV and choose it again.")
            return
        }

        if (text.length > MAX_FILE_CHARACTERS) {
            setError("That file is too big. Import up to 200 products at a time.")
            return
        }

        setFile({ name: chosen.name, size: chosen.size, text })
    }

    async function check() {
        if (!file || isWorking) {
            return
        }

        setIsWorking(true)
        setError("")
        const result = await checkImport(file.text)
        setIsWorking(false)

        if (result.kind === "ok") {
            setStep({ kind: "checked", check: result.data })
        } else if (result.kind === "failed" && result.code === "IMPORT_INVALID") {
            setStep({ kind: "problems", message: result.message, problems: readImportProblems(result) })
        } else if (result.kind !== "unauthorized") {
            setError(failureMessage(result))
        }
    }

    async function add() {
        if (!file || isWorking) {
            return
        }

        setIsWorking(true)
        setError("")
        const result = await saveImport(file.text)
        setIsWorking(false)

        if (result.kind === "ok") {
            const { count } = result.data
            const asDrafts = result.data.asDrafts === true
            navigate(asDrafts ? "/seller/myListing?view=drafts" : "/seller/myListing", {
                state: {
                    note: asDrafts
                        ? `${count} ${count === 1 ? "product came" : "products came"} in as drafts. Choose a category for them, check the stock, then publish.`
                        : `${count} ${count === 1 ? "product is" : "products are"} on sale now.`
                }
            })
        } else if (result.kind === "failed" && result.code === "IMPORT_INVALID") {
            setStep({ kind: "problems", message: result.message, problems: readImportProblems(result) })
        } else if (result.kind !== "unauthorized") {
            setError(failureMessage(result))
        }
    }

    async function downloadTemplate() {
        const failure = await downloadFile("/listings/import/template", "storehatch-products-template.csv")
        setError(failure ?? "")
    }

    const stepIndex = step.kind === "choose" ? 0 : 1
    const steps = ["Choose the file", "Check it", "Add them"]

    return (
        <div className="bulk-page">
            <BackArrow to="/seller/myListing" label="Back to my store" />
            <div className="product-form-title">
                <h1>Import products</h1>
                <p>Add up to 200 products at once from a spreadsheet saved as CSV. You check them before anything is added.</p>
            </div>

            <ol className="bulk-steps">
                {steps.map((label, index) => (
                    <li key={label} className={index === stepIndex ? "is-on" : index < stepIndex ? "is-done" : undefined} aria-current={index === stepIndex ? "step" : undefined}>
                        <i>{index < stepIndex ? <Check size={13} strokeWidth={3} aria-hidden="true" /> : index + 1}</i>{label}
                    </li>
                ))}
            </ol>

            {step.kind === "choose" && (
                <>
                    <fieldset className="bulk-sources">
                        <legend>Where is the file from?</legend>
                        <label className={`bulk-source${source === "storehatch" ? " is-on" : ""}`}>
                            <input type="radio" name={sourceName} checked={source === "storehatch"} onChange={() => setSource("storehatch")} />
                            <span><b>A StoreHatch spreadsheet</b><span>Fill in our template in Excel or Google Sheets. Products go on sale when you add them. Add options like sizes on each product afterwards.</span></span>
                        </label>
                        <label className={`bulk-source${source === "shopify" ? " is-on" : ""}`}>
                            <input type="radio" name={sourceName} checked={source === "shopify"} onChange={() => setSource("shopify")} />
                            <span><b>A Shopify product export</b><span>Upload it as it is, with its photos and options. Products come in as drafts so you can choose a StoreHatch category for each.</span></span>
                        </label>
                    </fieldset>

                    {source === "storehatch" ? (
                        <div className="bulk-howto">
                            <section className="money-card">
                                <h2>Make the file</h2>
                                <ol>
                                    <li><button type="button" className="btn-text bulk-inline-link" onClick={downloadTemplate}>Download the template</button> and open it.</li>
                                    <li>One product per row. Keep the first row as it is.</li>
                                    <li>Save it as CSV (in Excel: File, Save as, CSV UTF-8).</li>
                                </ol>
                            </section>
                            <section className="money-card">
                                <h2>The columns</h2>
                                <p className="product-help">Prices like 15000 or ₦15,000 both work. Photos are links starting https://.</p>
                                <div className="bulk-columns">
                                    {["title", "description", "price", "stock", "category", "photo_1"].map((column) => <code key={column}>{column}</code>)}
                                    <code className="is-optional">photo_2 to photo_5</code>
                                </div>
                            </section>
                        </div>
                    ) : (
                        <div className="bulk-howto">
                            <section className="money-card">
                                <h2>Get the file from Shopify</h2>
                                <ol>
                                    <li>In Shopify admin, open Products.</li>
                                    <li>Choose Export, then "All products" and "CSV for Excel".</li>
                                    <li>Upload that file here without changing it.</li>
                                </ol>
                            </section>
                            <section className="money-card">
                                <h2>How it comes in</h2>
                                <ul>
                                    <li>Options and sizes come with each product.</li>
                                    <li>The first 5 photos of each product.</li>
                                    <li>Stock, if your export has it. Newer exports keep stock apart, so it may start at 0.</li>
                                </ul>
                            </section>
                        </div>
                    )}

                    <input ref={inputRef} type="file" accept=".csv,text/csv" className="visually-hidden" tabIndex={-1} aria-label="Choose a CSV file" onChange={(event) => { void chooseFile(event.target.files?.[0]); event.target.value = "" }} />
                    {file ? (
                        <div className="money-card bulk-file">
                            <span className="bulk-file-icon" aria-hidden="true"><FileSpreadsheet size={22} /></span>
                            <p><b>{file.name}</b><span>{Math.max(1, Math.round(file.size / 1024))} KB</span></p>
                            <button type="button" className="btn-text" onClick={() => inputRef.current?.click()}>Choose another</button>
                        </div>
                    ) : (
                        <div className="bulk-drop">
                            <span className="bulk-drop-icon" aria-hidden="true"><FileSpreadsheet size={26} /></span>
                            <b>Choose a CSV file</b>
                            <span>Up to 200 products.</span>
                            <button type="button" className="btn" onClick={() => inputRef.current?.click()}>Choose a file</button>
                        </div>
                    )}
                    {error && <Notice kind="error">{error}</Notice>}
                    <div className="bulk-actions">
                        <button type="button" className="btn btn-primary" disabled={!file || isWorking} onClick={check}>{isWorking ? "Checking..." : "Check the file"}</button>
                        <span className="product-help">Nothing is added until you confirm.</span>
                    </div>
                </>
            )}

            {step.kind === "checked" && (() => {
                const { check: result } = step
                const asDrafts = result.asDrafts === true
                const shown = result.products.slice(0, PREVIEW_ROWS)

                return (
                    <>
                        <div className="money-card bulk-summary">
                            <span className="bulk-summary-icon" aria-hidden="true"><Check size={22} strokeWidth={2.6} /></span>
                            <p>
                                <b>{result.count} {result.count === 1 ? "product is" : "products are"} ready to add</b>
                                <span>
                                    From {file?.name}.{" "}
                                    {asDrafts ? "They come in as drafts, so you can choose a StoreHatch category for each before they go on sale." : "They go on sale as soon as you add them."}
                                </span>
                            </p>
                        </div>
                        {result.warnings.length > 0 && (
                            <div className="bulk-warnings" role="status">
                                <b>{result.warnings.length === 1 ? "1 thing" : `${result.warnings.length} things`} to look at. They won't stop the import.</b>
                                <ul>
                                    {result.warnings.map((warning, index) => <li key={index}><span>Row {warning.row}</span>{warning.message}</li>)}
                                </ul>
                            </div>
                        )}
                        <div className="bulk-table">
                            <div className="bulk-table-head" aria-hidden="true"><span>Row</span><span /><span>Name</span><span>Price</span><span>Stock</span><span>{asDrafts ? "Options" : "Category"}</span><span>Photos</span></div>
                            <ul>
                                {shown.map((product) => (
                                    <li key={product.row} className={`bulk-table-row${result.warnings.some((warning) => warning.row === product.row) ? " is-flagged" : ""}`}>
                                        <span className="bulk-row-number">{product.row}</span>
                                        {product.imageUrl
                                            ? <img src={product.imageUrl} alt="" loading="lazy" />
                                            : <span className="bulk-no-photo" aria-hidden="true"><ShoppingBag size={18} /></span>}
                                        <span className="bulk-row-title">{product.title}</span>
                                        <span>{priceText(product.price)}</span>
                                        <span className="bulk-hide-small">{product.stockQuantity ?? "—"}</span>
                                        <span className="bulk-hide-small">{asDrafts ? (product.options ? `${product.options}` : "None") : product.category ?? "—"}</span>
                                        <span className="bulk-hide-small product-help">{photoCount(product.photos)}</span>
                                    </li>
                                ))}
                            </ul>
                            {result.products.length > shown.length && <p className="bulk-more">And {result.products.length - shown.length} more</p>}
                        </div>
                        {error && <Notice kind="error">{error}</Notice>}
                        <div className="bulk-actions">
                            <button type="button" className="btn btn-primary" disabled={isWorking} onClick={add}>
                                {isWorking ? "Adding..." : asDrafts ? `Add ${result.count} as drafts` : `Add ${result.count} ${result.count === 1 ? "product" : "products"}`}
                            </button>
                            <button type="button" className="btn" disabled={isWorking} onClick={() => setStep({ kind: "choose" })}>Choose another file</button>
                        </div>
                    </>
                )
            })()}

            {step.kind === "problems" && (
                <>
                    <section className="bulk-problems" role="alert" aria-labelledby="import-problems-heading">
                        <h2 id="import-problems-heading">
                            Nothing was added. Fix {step.problems.length === 1 ? "this" : `these ${step.problems.length} things`} in your file.
                        </h2>
                        <p>{step.problems.length > 0 ? "Row numbers match your spreadsheet: the column names are row 1." : step.message}</p>
                        {step.problems.length > 0 && (
                            <ul>
                                {step.problems.map((problem, index) => (
                                    <li key={index}>
                                        <b>Row {problem.row}{problem.column && <span>{problem.column}</span>}</b>
                                        <span>{problem.message}</span>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </section>
                    <div className="bulk-actions">
                        <button type="button" className="btn btn-primary" onClick={() => { setFile(null); setStep({ kind: "choose" }) }}>Choose the fixed file</button>
                        <button type="button" className="btn-text" onClick={downloadTemplate}>Download the template</button>
                    </div>
                    {error && <Notice kind="error">{error}</Notice>}
                </>
            )}
        </div>
    )
}

export default ImportProductsPage
