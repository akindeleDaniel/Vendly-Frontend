// The small part of Google's sign-in script (https://accounts.google.com/gsi/client) that Vendly uses.
export {}

declare global {
    interface Window {
        google?: {
            accounts: {
                id: {
                    initialize: (config: {
                        client_id: string
                        callback: (response: { credential: string }) => void
                    }) => void
                    renderButton: (parent: HTMLElement, options: Record<string, string | number>) => void
                }
            }
        }
    }
}
