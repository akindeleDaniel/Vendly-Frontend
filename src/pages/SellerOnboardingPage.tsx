import { useEffect, useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import { Check, Info, Landmark, Package, Truck } from "lucide-react"
import { ShopLookFields } from "../components/BrandingFields"
import ImagePicker from "../components/ImagePicker"
import Notice from "../components/Notice"
import ShopBasicsFields from "../components/ShopBasicsFields"
import ShopPreview from "../components/ShopPreview"
import UploadStatus from "../components/UploadStatus"
import { apiFetch, getErrorMessage } from "../lib/api"
import { EMPTY_BRANDING_FORM } from "../lib/branding"
import { buildSellerProfileBody, shopSlug, validateSellerProfile } from "../lib/sellerProfile"
import { uploadFailureMessage } from "../lib/uploadImage"
import { useBackgroundUpload } from "../lib/useBackgroundUpload"
import { useDocumentTitle } from "../lib/useDocumentTitle"
import { useFileUrl } from "../lib/useFileUrl"
import { BRAND_COLORS } from "../types/branding"
import type { BrandingForm } from "../types/branding"
import type { SellerProfile } from "../types/seller"

type ProfileCheckStatus = "checking" | "needs-onboarding" | "error"
type Step = 1 | 2 | 3

const STEPS: Array<{ title: string, text: string }> = [
    { title: "Your shop", text: "Name and where you are" },
    { title: "Logo and look", text: "Logo, colour and about" },
    { title: "Check and create", text: "Then open your shop" }
]

const TIPS: Record<Step, { title: string, text: string }> = {
    1: { title: "Choosing a name", text: "Use the name buyers already know you by, on Instagram or at the market. It becomes your shop link." },
    2: { title: "A clear logo helps", text: "A simple, bright logo is easy to spot in search results. If you don't have one, a clean photo of your best product works." },
    3: { title: "Nothing is final", text: "You can change your name, logo, colour and area any time in Shop details." }
}

// Setting up a new shop in three steps: the name and area, then the logo and look, then a check before
// the shop is created. Nothing is saved until the last step. Delivery starts free; the seller sets fees,
// adds products and sets up payouts from My store afterwards.
function SellerOnboardingPage() {
    const navigate = useNavigate()
    useDocumentTitle("Set up your shop")
    const headingRef = useRef<HTMLHeadingElement>(null)

    const [formData, setFormData] = useState<SellerProfile>({ businessName: "", state: "", lga: "", shippingPolicy: "FREE", shippingCost: "" })
    const [branding, setBranding] = useState<BrandingForm>(EMPTY_BRANDING_FORM)
    const [logoFile, setLogoFile] = useState<File | null>(null)
    const [bannerFile, setBannerFile] = useState<File | null>(null)
    const [step, setStep] = useState<Step>(1)
    const [showErrors, setShowErrors] = useState(false)
    const [checkStatus, setCheckStatus] = useState<ProfileCheckStatus>("checking")
    const [checkAttempt, setCheckAttempt] = useState(0)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [error, setError] = useState("")
    const logoPreview = useFileUrl(logoFile)
    const bannerPreview = useFileUrl(bannerFile)
    // The logo and banner start uploading as soon as they are picked, so a slow connection has the
    // time the seller spends on the rest of the steps.
    const logoUpload = useBackgroundUpload()
    const bannerUpload = useBackgroundUpload()

    // A seller who already has a store profile does not need onboarding.
    useEffect(() => {
        const controller = new AbortController()

        async function checkExistingProfile() {
            try {
                const response = await apiFetch("/seller/profile", { credentials: "include", signal: controller.signal })

                if (controller.signal.aborted) {
                    return
                }

                if (response.ok) {
                    navigate("/seller/myListing", { replace: true })
                } else if (response.status === 404) {
                    setCheckStatus("needs-onboarding")
                } else if (response.status !== 401) {// a 401 is handled by the session guard
                    setCheckStatus("error")
                }
            } catch {
                if (!controller.signal.aborted) {
                    setCheckStatus("error")
                }
            }
        }

        checkExistingProfile()
        return () => controller.abort()
    }, [navigate, checkAttempt])

    function goTo(next: Step) {
        setStep(next)
        setShowErrors(false)
        setError("")
        window.scrollTo({ top: 0, behavior: "smooth" })
        // Moves focus to the new step's heading, so a screen reader hears where the seller is.
        window.setTimeout(() => headingRef.current?.focus(), 0)
    }

    const basicsError = validateSellerProfile(formData)

    function goNext() {
        if ((step === 1 && basicsError !== null) || (step === 2 && logoFile === null)) {
            setShowErrors(true)
            return
        }
        goTo(step === 1 ? 2 : 3)
    }

    async function createShop() {
        if (isSubmitting || basicsError !== null || logoFile === null) {
            return
        }

        setIsSubmitting(true)
        setError("")

        try {
            const logo = await logoUpload.urlFor(logoFile)
            if (!logo.ok) {
                setError(uploadFailureMessage(logo.reason, "logo"))
                return
            }
            const logoUrl = logo.url

            let bannerUrl: string | null = null
            if (bannerFile !== null) {
                const banner = await bannerUpload.urlFor(bannerFile)
                if (!banner.ok) {
                    setError(uploadFailureMessage(banner.reason, "banner"))
                    return
                }
                bannerUrl = banner.url
            }

            const response = await apiFetch("/seller/profile", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    ...buildSellerProfileBody(formData, logoUrl),
                    brandColor: branding.brandColor,
                    about: branding.about.trim(),
                    ...(bannerUrl ? { bannerUrl } : {})
                }),
                credentials: "include"
            })

            if (!response.ok) {
                setError(await getErrorMessage(response, `Unable to create your shop (status ${response.status}).`))
                return
            }

            navigate("/seller/myListing")
        } catch {
            setError("Something went wrong. Please check your connection and try again.")
        } finally {
            setIsSubmitting(false)
        }
    }

    if (checkStatus === "checking") {
        return <p role="status">Loading...</p>
    }

    if (checkStatus === "error") {
        return (
            <div className="onboard-page">
                <h1>Set up your shop</h1>
                <Notice kind="error">
                    <p>We could not check your store details. Please check your connection and try again.</p>
                    <button type="button" onClick={() => {
                        setCheckStatus("checking")
                        setCheckAttempt((attempt) => attempt + 1)
                    }}>Try again</button>
                </Notice>
            </div>
        )
    }

    const color = BRAND_COLORS.find((choice) => choice.key === branding.brandColor) ?? BRAND_COLORS[0]

    return (
        <div className="onboard-page">
            <div className="onboard-intro">
                <small>Welcome to StoreHatch</small>
                <h1>Set up your shop</h1>
                <p>Three short steps. You can change all of this later in Shop details.</p>
            </div>

            <ol className="onboard-steps" aria-label="Steps">
                {STEPS.map((item, index) => {
                    const number = (index + 1) as Step
                    const state = number === step ? " is-on" : number < step ? " is-done" : ""
                    return (
                        <li key={item.title} className={`onboard-step${state}`} aria-current={number === step ? "step" : undefined}>
                            <span className="onboard-step-number" aria-hidden="true">{number < step ? <Check size={14} strokeWidth={3.2} /> : number}</span>
                            <span>
                                <b>{item.title}<span className="visually-hidden">{number < step ? ", done" : number === step ? ", current step" : ""}</span></b>
                                <span className="onboard-step-text">{item.text}</span>
                            </span>
                        </li>
                    )
                })}
            </ol>

            <div className="settings-grid onboard-grid">
                <div className="product-form-main">
                    {step === 1 && (
                        <>
                            <section className="product-form-card" aria-labelledby="onboard-heading">
                                <h2 id="onboard-heading" ref={headingRef} tabIndex={-1}>Your shop</h2>
                                <ShopBasicsFields formData={formData} onChange={setFormData} showLink />
                                <p className="product-help">Where you send orders from. Shoppers see it on your shop, and it helps buyers nearby find you.</p>
                                {showErrors && basicsError && <Notice kind="error">{basicsError}</Notice>}
                            </section>
                            <div className="onboard-actions">
                                <button type="button" className="btn btn-primary" onClick={goNext}>Next: logo and look</button>
                            </div>
                        </>
                    )}

                    {step === 2 && (
                        <>
                            <section className="product-form-card" aria-labelledby="onboard-heading">
                                <h2 id="onboard-heading" ref={headingRef} tabIndex={-1}>Your logo</h2>
                                <p className="product-help settings-card-lead">Shoppers see it on your shop, your products and their orders.</p>
                                <ImagePicker label="Logo" currentUrl={logoPreview ?? undefined} maxWidth={600} onChange={(file) => { setLogoFile(file); logoUpload.start(file) }} />
                                <UploadStatus state={logoUpload.state} thing="logo" onRetry={logoUpload.retry} />
                                {showErrors && logoFile === null && (
                                    <Notice kind="error">Choose a logo to carry on. It can be a simple photo of your shop or your products.</Notice>
                                )}
                            </section>
                            <ShopLookFields
                                form={branding}
                                setForm={setBranding}
                                bannerUrl={bannerPreview}
                                onBannerFile={(file) => { setBannerFile(file); bannerUpload.start(file) }}
                                onRemoveBanner={() => { setBannerFile(null); bannerUpload.start(null) }}
                                bannerStatus={<UploadStatus state={bannerUpload.state} thing="banner" onRetry={bannerUpload.retry} />}
                            />
                            <p className="onboard-later"><Info size={18} aria-hidden="true" />Social pages and a WhatsApp button can be added later in Shop details.</p>
                            <div className="onboard-actions">
                                <button type="button" className="btn" onClick={() => goTo(1)}>Back</button>
                                <button type="button" className="btn btn-primary" onClick={goNext}>Next: check and create</button>
                            </div>
                        </>
                    )}

                    {step === 3 && (
                        <>
                            <section className="product-form-card" aria-labelledby="onboard-heading">
                                <h2 id="onboard-heading" ref={headingRef} tabIndex={-1}>Check your shop</h2>
                                <dl className="onboard-summary">
                                    <div>
                                        <dt>Shop name</dt>
                                        <dd>{formData.businessName.trim()} <button type="button" className="btn-text" onClick={() => goTo(1)}>Change<span className="visually-hidden"> the shop name</span></button></dd>
                                    </div>
                                    <div>
                                        <dt>Shop link</dt>
                                        <dd>/shop/{shopSlug(formData.businessName)}</dd>
                                    </div>
                                    <div>
                                        <dt>Where you are</dt>
                                        <dd>{formData.lga}, {formData.state} <button type="button" className="btn-text" onClick={() => goTo(1)}>Change<span className="visually-hidden"> where you are</span></button></dd>
                                    </div>
                                    <div>
                                        <dt>Logo and colour</dt>
                                        <dd>
                                            {logoPreview && <img className="onboard-summary-logo" src={logoPreview} alt="" />}
                                            {color.name} colour
                                            <button type="button" className="btn-text" onClick={() => goTo(2)}>Change<span className="visually-hidden"> the logo and look</span></button>
                                        </dd>
                                    </div>
                                </dl>
                            </section>

                            <section className="product-form-card" aria-labelledby="onboard-next-heading">
                                <h2 id="onboard-next-heading">After you create it</h2>
                                <p className="product-help settings-card-lead">Your shop opens straight away. These steps are on My store to finish when you're ready.</p>
                                <ul className="onboard-next">
                                    <li><span aria-hidden="true"><Truck size={20} /></span><span><b>Set your delivery fees</b>Where you deliver and what each state pays. Until then, delivery is free.</span></li>
                                    <li><span aria-hidden="true"><Package size={20} /></span><span><b>Add your first product</b>Photos, a price and how many you have.</span></li>
                                    <li><span aria-hidden="true"><Landmark size={20} /></span><span><b>Set up payouts <em className="onboard-need">Needed before buyers can pay</em></b>The bank account your sales are paid into.</span></li>
                                </ul>
                            </section>

                            {error && <Notice kind="error">{error}</Notice>}
                            <div className="onboard-actions">
                                <button type="button" className="btn" onClick={() => goTo(2)} disabled={isSubmitting}>Back</button>
                                <button type="button" className="btn btn-primary onboard-create" onClick={createShop} disabled={isSubmitting}>
                                    {isSubmitting ? (
                                        <span role="status">
                                            Creating your shop
                                            <span className="onboard-dots" aria-hidden="true"><i>.</i><i>.</i><i>.</i></span>
                                        </span>
                                    ) : "Create my shop"}
                                </button>
                            </div>
                        </>
                    )}
                </div>

                <ShopPreview
                    label="How shoppers will see it"
                    businessName={formData.businessName}
                    state={formData.state}
                    lga={formData.lga}
                    branding={branding}
                    logoUrl={logoPreview}
                    bannerUrl={bannerPreview}
                >
                    <div className="onboard-tip">
                        <h2>{TIPS[step].title}</h2>
                        <p>{TIPS[step].text}</p>
                    </div>
                </ShopPreview>
            </div>
        </div>
    )
}

export default SellerOnboardingPage
