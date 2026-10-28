import { useId, useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { Search } from "lucide-react"
import CategoryTiles from "../components/CategoryTiles"
import { LogoBadge } from "../components/Logo"
import { useDocumentTitle } from "../lib/useDocumentTitle"

// Shown for any address that matches no page, so a mistyped or outdated link is never a dead end: a
// search, the way home, and a few categories to start from.
function NotFoundPage() {
    useDocumentTitle("Page not found")
    const navigate = useNavigate()
    const searchId = useId()
    const [search, setSearch] = useState("")

    function submit(event: React.SubmitEvent<HTMLFormElement>) {
        event.preventDefault()
        const term = search.trim()
        navigate(term ? `/?${new URLSearchParams({ search: term }).toString()}` : "/")
    }

    return (
        <div className="not-found">
            <section className="not-found-main" aria-labelledby="not-found-heading">
                <div>
                    <span className="not-found-code">Error 404</span>
                    <h1 id="not-found-heading">This page didn't hatch</h1>
                    <p>The link may be mistyped, or the page may have moved or been taken down. A product that's no longer on sale also lands here.</p>
                    <form className="not-found-search" role="search" onSubmit={submit}>
                        <div className="product-input product-money not-found-box">
                            <Search size={18} aria-hidden="true" />
                            <label htmlFor={searchId} className="visually-hidden">Search products</label>
                            <input id={searchId} type="search" placeholder="Search for what you wanted" value={search} onChange={(event) => setSearch(event.target.value)} />
                        </div>
                        <button type="submit" className="btn btn-primary">Search</button>
                    </form>
                    <div className="not-found-actions">
                        <Link to="/" className="btn">Go to the home page</Link>
                        <Link to="/orders" className="btn">My orders</Link>
                    </div>
                </div>
                <div className="not-found-art" aria-hidden="true">
                    <span className="not-found-ring" />
                    <span className="not-found-ring is-dashed" />
                    <LogoBadge size={160} />
                    <span className="not-found-question">?</span>
                </div>
            </section>

            <section aria-labelledby="not-found-categories">
                <h2 id="not-found-categories" className="not-found-more">Or start with a category</h2>
                <CategoryTiles limit={4} />
            </section>
        </div>
    )
}

export default NotFoundPage
