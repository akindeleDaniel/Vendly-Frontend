import { useEffect, useState } from "react"
import type { ReactNode } from "react"
import { NavLink } from "react-router-dom"
import { Landmark, Store, Truck } from "lucide-react"
import type { LucideIcon } from "lucide-react"
import BackArrow from "./BackArrow"
import { fetchPayoutOverview } from "../lib/payoutApi"
import { ALL_STATES, choicesFromRates, fetchShippingRates } from "../lib/shippingApi"

type SettingsStatus = {
    delivery: { text: string, ok: boolean } | null
    payouts: { text: string, ok: boolean } | null
}

// A line under each menu item: where the shop delivers, and whether buyers can pay it. Loaded again
// when `version` changes, so a save on the page shows straight away. Left out when it cannot be read.
function useSettingsStatus(version: number): SettingsStatus {
    const [status, setStatus] = useState<SettingsStatus>({ delivery: null, payouts: null })

    useEffect(() => {
        const controller = new AbortController()
        const { signal } = controller
        const update = (part: Partial<SettingsStatus>) => {
            if (!signal.aborted) {
                setStatus((current) => ({ ...current, ...part }))
            }
        }

        fetchShippingRates(signal).then((result) => {
            if (result.kind !== "ok") {
                return
            }
            const { everywhere, chosen } = choicesFromRates(result.data)
            update({
                delivery: chosen.length === 0
                    ? { text: "Not set yet", ok: false }
                    : { text: everywhere ? `All ${ALL_STATES.length} states` : chosen.length === 1 ? "1 state" : `${chosen.length} states`, ok: true }
            })
        })
        fetchPayoutOverview(signal).then((result) => {
            if (result.kind !== "ok") {
                return
            }
            const accounts = result.data.accounts
            const active = accounts.find((account) => account.status === "ACTIVE")
            update({
                payouts: accounts.length > 0 && accounts.every((account) => account.status === "ACTIVE") && active
                    ? { text: `${active.bankName} •• ${active.accountNumberLast4}`, ok: true }
                    : accounts.some((account) => account.status === "PENDING")
                        ? { text: "Setting up", ok: false }
                        : { text: "Needed before buyers can pay", ok: false }
            })
        })

        return () => controller.abort()
    }, [version])

    return status
}

type SettingsLayoutProps = {
    title: string
    lead: string
    version?: number // change it after a save to refresh the menu's status lines
    children: ReactNode
}

// The frame of the shop settings pages (shop details, delivery, payouts): a back arrow, the title, and
// a menu between the three pages, which turns into a row of tabs on a phone.
function SettingsLayout({ title, lead, version = 0, children }: SettingsLayoutProps) {
    const status = useSettingsStatus(version)
    const items: Array<{ to: string, icon: LucideIcon, label: string, line: { text: string, ok: boolean } | null }> = [
        { to: "/seller/profile/edit", icon: Store, label: "Shop details", line: { text: "Name, logo and look", ok: true } },
        { to: "/seller/delivery", icon: Truck, label: "Delivery", line: status.delivery },
        { to: "/seller/payouts", icon: Landmark, label: "Payouts", line: status.payouts }
    ]

    return (
        <div className="settings-page">
            <BackArrow to="/seller/myListing" label="Back to my store" />
            <div className="product-form-title">
                <h1>{title}</h1>
                <p>{lead}</p>
            </div>
            <div className="settings-layout">
                <nav className="settings-menu" aria-label="Shop settings">
                    {items.map(({ to, icon: Icon, label, line }) => (
                        <NavLink key={to} to={to} className={({ isActive }) => `settings-menu-item${isActive ? " is-on" : ""}`}>
                            <span className="settings-menu-icon" aria-hidden="true"><Icon size={20} /></span>
                            <span className="settings-menu-text">
                                <b>{label}</b>
                                {line && (
                                    <span>
                                        <i className={line.ok ? "is-ok" : "is-bad"} aria-hidden="true" />
                                        {line.text}
                                    </span>
                                )}
                            </span>
                        </NavLink>
                    ))}
                </nav>
                <div className="settings-content">{children}</div>
            </div>
        </div>
    )
}

export default SettingsLayout
