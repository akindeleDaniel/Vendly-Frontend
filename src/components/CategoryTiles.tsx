import { Link } from "react-router-dom"
import { ChevronRight } from "lucide-react"
import { CATEGORY_TILES } from "../data/categoryTiles"

type CategoryTilesProps = {
    limit?: number // show only the first few, for example on the page-not-found page
    onPick?: () => void
}

// Every category as a coloured tile with a photo in a round window, each a link to that category.
function CategoryTiles({ limit, onPick }: CategoryTilesProps) {
    const tiles = limit ? CATEGORY_TILES.slice(0, limit) : CATEGORY_TILES

    return (
        <ul className="category-tiles">
            {tiles.map((tile) => (
                <li key={tile.category}>
                    <Link
                        to={`/?${new URLSearchParams({ category: tile.category }).toString()}`}
                        className="category-tile"
                        style={{ background: tile.background }}
                        onClick={onPick}
                    >
                        <b>{tile.category}</b>
                        <span className="category-tile-go">Shop now<ChevronRight size={14} aria-hidden="true" /></span>
                        <span className="category-tile-window" aria-hidden="true">
                            <img src={tile.src} alt="" loading="lazy" style={tile.position ? { objectPosition: tile.position } : undefined} />
                        </span>
                    </Link>
                </li>
            ))}
        </ul>
    )
}

export default CategoryTiles
