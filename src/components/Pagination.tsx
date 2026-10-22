type PaginationProps = {
    page: number
    pageSize: number
    total: number
    onChange: (page: number) => void
}

// Previous and Next with "Page 2 of 5". Nothing is drawn when everything fits on one page.
function Pagination({ page, pageSize, total, onChange }: PaginationProps) {
    if (total <= pageSize) {
        return null
    }

    return (
        <div className="action-row">
            <button type="button" onClick={() => onChange(page - 1)} disabled={page <= 1}>Previous</button>
            <span>Page {page} of {Math.ceil(total / pageSize)}</span>
            <button type="button" onClick={() => onChange(page + 1)} disabled={page * pageSize >= total}>Next</button>
        </div>
    )
}

export default Pagination
