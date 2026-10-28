import { useId, useState } from "react"
import type { ReactNode } from "react"
import { Check, Search } from "lucide-react"
import Pagination from "./Pagination"

// The pieces every administrator list shares: the title, the search box, the filter buttons, an
// "all clear" box and the pages.

export function AdminListHead({ title, intro, action }: { title: string, intro: string, action?: ReactNode }) {
    return (
        <div className="admin-head admin-head-row">
            <div>
                <h1>{title}</h1>
                <p>{intro}</p>
            </div>
            {action}
        </div>
    )
}

type SearchProps = {
    label: string
    placeholder: string
    initial: string
    onSearch: (term: string) => void
}

// A search box with its button. The list only changes when the search is sent.
export function AdminSearch({ label, placeholder, initial, onSearch }: SearchProps) {
    const id = useId()
    const [value, setValue] = useState(initial)

    return (
        <form className="admin-search" role="search" onSubmit={(event) => { event.preventDefault(); onSearch(value.trim()) }}>
            <div className="product-input product-money admin-find-box">
                <Search size={18} aria-hidden="true" />
                <label htmlFor={id} className="visually-hidden">{label}</label>
                <input id={id} type="search" maxLength={100} placeholder={placeholder} value={value} onChange={(event) => setValue(event.target.value)} />
            </div>
            <button type="submit" className="btn btn-primary">Search</button>
        </form>
    )
}

export type FilterOption<T extends string> = { value: T, label: string, count?: number }

type FiltersProps<T extends string> = {
    label: string
    options: Array<FilterOption<T>>
    value: T
    onChange: (value: T) => void
}

// One row of filter buttons, the chosen one filled in. A count shows when something there waits for you.
export function AdminFilters<T extends string>({ label, options, value, onChange }: FiltersProps<T>) {
    return (
        <div className="admin-filters" role="group" aria-label={label}>
            {options.map((option) => (
                <button
                    key={option.value}
                    type="button"
                    className={`orders-filter${option.value === value ? " is-active" : ""}`}
                    aria-pressed={option.value === value}
                    onClick={() => onChange(option.value)}
                >
                    {option.label}
                    {option.count !== undefined && option.count > 0 && (
                        <span className="admin-filter-count">{option.count}<span className="visually-hidden"> waiting</span></span>
                    )}
                </button>
            ))}
        </div>
    )
}

export function AdminAllClear({ title, text }: { title: string, text: string }) {
    return (
        <div className="admin-clear" role="status">
            <span className="admin-clear-icon" aria-hidden="true"><Check size={22} strokeWidth={2.6} /></span>
            <div>
                <b>{title}</b>
                <span>{text}</span>
            </div>
        </div>
    )
}

type PagerProps = { page: number, pageSize: number, total: number, onChange: (page: number) => void }

export function AdminPager({ page, pageSize, total, onChange }: PagerProps) {
    function go(next: number) {
        onChange(next)
        window.scrollTo({ top: 0, behavior: "instant" })
    }

    if (total <= pageSize) {
        return null
    }

    return (
        <nav className="admin-pager" aria-label="Pages">
            <Pagination page={page} pageSize={pageSize} total={total} onChange={go} />
        </nav>
    )
}
