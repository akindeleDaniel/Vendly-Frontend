import { useEffect, useRef, useState } from "react"
import { useLocation, useNavigate } from "react-router-dom"
import { apiFetch } from "../lib/api"
import { markShopSetupPromptDismissed, readShopSetupPromptDismissed } from "../lib/shopSetupPrompt"
import type { AuthStatus, UserRole } from "../types/user"

type ShopSetupPromptProps = {
    authStatus: AuthStatus
    userRole: UserRole | null
}

// Pages where the pop-up would get in the way: shop setup itself, My store (which says the same
// thing on the page) and the sign-in pages.
const QUIET_PATHS = ["/seller/onboarding", "/seller/myListing", "/login", "/register", "/consumer/register", "/seller/register", "/forgot-password"]

// Every account can sell and buy. A seller account without a shop yet is offered to set one up, but
// it is not required: "Later" closes the pop-up for the rest of the visit, and the person can shop in
// the meantime. Setting up a shop only becomes required to add a listing (on My store).
function ShopSetupPrompt({ authStatus, userRole }: ShopSetupPromptProps) {
    const dialogRef = useRef<HTMLDialogElement>(null)
    const navigate = useNavigate()
    const { pathname } = useLocation()
    const [isDismissed, setIsDismissed] = useState(readShopSetupPromptDismissed)
    const [hasShop, setHasShop] = useState<boolean | null>(null)// null until checked
    const isSeller = authStatus === "authenticated" && userRole === "SELLER"
    const isQuietPage = QUIET_PATHS.includes(pathname)
    // Read again on each render: "Browse products" on My store also counts as "Later".
    const isOpen = isSeller && !isDismissed && !readShopSetupPromptDismissed() && hasShop === false && !isQuietPage

    // Checked again on each page until a shop exists, so the pop-up stops once setup is done.
    useEffect(() => {
        if (!isSeller || isDismissed || hasShop === true || isQuietPage) {
            return
        }
        const controller = new AbortController()

        apiFetch("/seller/profile", { credentials: "include", signal: controller.signal })
            .then((response) => {
                if (!controller.signal.aborted && (response.ok || response.status === 404)) {
                    setHasShop(response.ok)
                }
            })
            .catch(() => {
                // Unknown for now: no pop-up rather than a wrong one.
            })
        return () => controller.abort()
    }, [isSeller, isDismissed, hasShop, isQuietPage, pathname])

    useEffect(() => {
        const dialog = dialogRef.current

        if (!dialog) {
            return
        }

        if (isOpen && !dialog.open) {
            dialog.showModal()
        } else if (!isOpen && dialog.open) {
            dialog.close()
        }
    }, [isOpen])

    function later() {
        markShopSetupPromptDismissed()
        setIsDismissed(true)
    }

    function setUpNow() {
        later()
        navigate("/seller/onboarding")
    }

    return (
        <dialog ref={dialogRef} className="logout-dialog" aria-labelledby="shop-setup-title" onClose={later}>
            <div className="logout-dialog-body">
                <h2 id="shop-setup-title">Set up your shop</h2>
                <p>Your account is ready. Add your shop's name, where you are and how you deliver, and you can start adding products.</p>
                <p className="field-help">You can also shop on StoreHatch with this same account, now or any time.</p>
                <button type="button" className="btn btn-primary btn-block" onClick={setUpNow}>Set up my shop</button>
                <button type="button" className="btn-text" onClick={later}>Later</button>
            </div>
        </dialog>
    )
}

export default ShopSetupPrompt
