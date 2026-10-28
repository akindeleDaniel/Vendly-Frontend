import { useEffect, useMemo } from "react"

// A temporary address for a picked file, so a preview can show it before it is uploaded. The address
// is freed when the file changes or the component goes away.
export function useFileUrl(file: File | null): string | null {
    const url = useMemo(() => file ? URL.createObjectURL(file) : null, [file])

    useEffect(() => {
        return () => {
            if (url) {
                URL.revokeObjectURL(url)
            }
        }
    }, [url])

    return url
}
