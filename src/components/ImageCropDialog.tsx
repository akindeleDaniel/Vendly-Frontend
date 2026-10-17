import { useEffect, useId, useRef, useState } from "react"
import { RotateIcon } from "./Icons"
import Notice from "./Notice"

// A square crop screen with no extra package. The photo sits under a fixed square frame: drag to
// move it, use the slider or pinch to zoom, and turn it with the rotate button. "Done" saves a
// smaller square copy, which is also what shoppers see on the product cards and shop logos.

const MAX_OUTPUT_SIZE = 1000// pixels on each side of the saved image
const MIN_OUTPUT_SIZE = 200
const MAX_ZOOM = 4
const KEY_STEP = 12// pixels the arrow keys move the photo

type Point = { x: number, y: number }

type ImageCropDialogProps = {
    file: File
    onCancel: () => void
    onDone: (croppedFile: File) => void
}

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max)

// Keeps the photo covering the whole frame, so there is never an empty gap inside it.
function clampOffset(offset: Point, displayWidth: number, displayHeight: number, frame: number): Point {
    const maxX = Math.max((displayWidth - frame) / 2, 0)
    const maxY = Math.max((displayHeight - frame) / 2, 0)
    return { x: clamp(offset.x, -maxX, maxX), y: clamp(offset.y, -maxY, maxY) }
}

function ImageCropDialog({ file, onCancel, onDone }: ImageCropDialogProps) {
    const titleId = useId()
    const dialogRef = useRef<HTMLDialogElement>(null)
    const frameRef = useRef<HTMLDivElement>(null)
    const pointers = useRef(new Map<number, Point>())
    const pinchStart = useRef<{ distance: number, zoom: number } | null>(null)

    const [image, setImage] = useState<HTMLImageElement | null>(null)
    const [loadFailed, setLoadFailed] = useState(false)
    const [frameSize, setFrameSize] = useState(300)
    const [zoom, setZoom] = useState(1)
    const [rotation, setRotation] = useState(0)
    const [offset, setOffset] = useState<Point>({ x: 0, y: 0 })
    const [isSaving, setIsSaving] = useState(false)
    const [saveError, setSaveError] = useState("")

    // Opens as a real modal dialog: the page behind is inert, focus stays inside, Esc cancels.
    useEffect(() => {
        const dialog = dialogRef.current
        if (dialog && !dialog.open) {
            dialog.showModal()
        }

        return () => {
            if (dialog?.open) {
                dialog.close()
            }
        }
    }, [])

    useEffect(() => {
        // React can start this effect, cancel it and start it again. Revoking the address of a
        // cancelled attempt makes its image report an error, so a cancelled attempt must be ignored.
        let isCurrent = true
        const url = URL.createObjectURL(file)
        const loadedImage = new Image()
        loadedImage.onload = () => {
            if (isCurrent) {
                setImage(loadedImage)
                setLoadFailed(false)
            }
        }
        loadedImage.onerror = () => {
            if (isCurrent) {
                setLoadFailed(true)
            }
        }
        loadedImage.src = url// the loaded image keeps this address, which the crop screen shows

        return () => {
            isCurrent = false
            URL.revokeObjectURL(url)
        }
    }, [file])

    // The frame is a CSS square; its measured width is the frame size in pixels.
    useEffect(() => {
        const frame = frameRef.current
        if (!frame) {
            return
        }

        const observer = new ResizeObserver((entries) => {
            const width = Math.round(entries[0].contentRect.width)
            if (width > 0) {
                setFrameSize(width)
            }
        })
        observer.observe(frame)

        return () => observer.disconnect()
    }, [loadFailed])

    // Size of the photo as shown: it always covers the frame, then zoom scales it up.
    const turnedSideways = rotation % 180 !== 0
    const shownWidth = image ? (turnedSideways ? image.naturalHeight : image.naturalWidth) : 0
    const shownHeight = image ? (turnedSideways ? image.naturalWidth : image.naturalHeight) : 0
    const coverScale = image ? Math.max(frameSize / shownWidth, frameSize / shownHeight) : 1
    const scale = coverScale * zoom
    const displayWidth = shownWidth * scale
    const displayHeight = shownHeight * scale
    const position = clampOffset(offset, displayWidth, displayHeight, frameSize)

    function moveBy(dx: number, dy: number) {
        setOffset((previous) => clampOffset(
            { x: previous.x + dx, y: previous.y + dy },
            displayWidth,
            displayHeight,
            frameSize
        ))
    }

    function handlePointerDown(event: React.PointerEvent<HTMLDivElement>) {
        event.currentTarget.setPointerCapture(event.pointerId)
        pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY })

        if (pointers.current.size === 2) {
            const [first, second] = [...pointers.current.values()]
            pinchStart.current = { distance: Math.hypot(first.x - second.x, first.y - second.y), zoom }
        }
    }

    function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
        const previous = pointers.current.get(event.pointerId)
        if (!previous) {
            return
        }

        const next = { x: event.clientX, y: event.clientY }
        pointers.current.set(event.pointerId, next)

        if (pointers.current.size === 2 && pinchStart.current) {
            const [first, second] = [...pointers.current.values()]
            const distance = Math.hypot(first.x - second.x, first.y - second.y)
            if (pinchStart.current.distance > 0) {
                setZoom(clamp(pinchStart.current.zoom * (distance / pinchStart.current.distance), 1, MAX_ZOOM))
            }
            return
        }

        if (pointers.current.size === 1) {
            moveBy(next.x - previous.x, next.y - previous.y)
        }
    }

    function handlePointerEnd(event: React.PointerEvent<HTMLDivElement>) {
        pointers.current.delete(event.pointerId)
        if (pointers.current.size < 2) {
            pinchStart.current = null
        }
    }

    // Keyboard: arrow keys move the photo, plus and minus zoom.
    function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
        const moves: Record<string, Point> = {
            ArrowLeft: { x: -KEY_STEP, y: 0 },
            ArrowRight: { x: KEY_STEP, y: 0 },
            ArrowUp: { x: 0, y: -KEY_STEP },
            ArrowDown: { x: 0, y: KEY_STEP }
        }

        if (moves[event.key]) {
            event.preventDefault()
            moveBy(moves[event.key].x, moves[event.key].y)
        } else if (event.key === "+" || event.key === "=") {
            event.preventDefault()
            setZoom((current) => clamp(current + 0.1, 1, MAX_ZOOM))
        } else if (event.key === "-") {
            event.preventDefault()
            setZoom((current) => clamp(current - 0.1, 1, MAX_ZOOM))
        }
    }

    function handleRotate() {
        setRotation((current) => (current + 90) % 360)
        setOffset({ x: 0, y: 0 })
    }

    // Draws exactly what the frame shows into a square canvas and turns it into a file.
    async function createCroppedFile(): Promise<File> {
        if (!image) {
            throw new Error("The photo has not loaded.")
        }

        const keepsTransparency = file.type === "image/png" || file.type === "image/gif"
        const outputType = keepsTransparency ? "image/png" : "image/jpeg"
        const sourcePixelsAcrossFrame = frameSize / scale
        const size = Math.round(clamp(sourcePixelsAcrossFrame, MIN_OUTPUT_SIZE, MAX_OUTPUT_SIZE))
        const outputScale = size / frameSize

        const canvas = document.createElement("canvas")
        canvas.width = size
        canvas.height = size
        const context = canvas.getContext("2d")
        if (!context) {
            throw new Error("This browser cannot crop images.")
        }

        if (!keepsTransparency) {
            context.fillStyle = "#ffffff"
            context.fillRect(0, 0, size, size)
        }
        context.imageSmoothingQuality = "high"
        context.translate(size / 2 + position.x * outputScale, size / 2 + position.y * outputScale)
        context.rotate((rotation * Math.PI) / 180)
        context.scale(scale * outputScale, scale * outputScale)
        context.drawImage(image, -image.naturalWidth / 2, -image.naturalHeight / 2)

        const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, outputType, 0.9))
        if (!blob) {
            throw new Error("The image could not be saved.")
        }

        const baseName = file.name.replace(/\.[^.]+$/, "") || "photo"
        return new File([blob], `${baseName}.${keepsTransparency ? "png" : "jpg"}`, { type: outputType })
    }

    async function handleDone() {
        if (isSaving) {
            return
        }

        setIsSaving(true)
        setSaveError("")

        try {
            onDone(await createCroppedFile())
        } catch {
            setSaveError("We could not crop that image. Please try again or choose another one.")
            setIsSaving(false)
        }
    }

    return (
        <dialog
            ref={dialogRef}
            className="crop-dialog"
            aria-labelledby={titleId}
            onCancel={(event) => {
                event.preventDefault()// Esc: close through our own handler
                onCancel()
            }}
        >
            <div className="crop-dialog-body">
                <h2 id={titleId} className="crop-title">Crop photo</h2>
                <p className="crop-help">Drag the photo to position it and zoom to fit. Shoppers will see this square.</p>

                {loadFailed ? (
                    <Notice kind="error">We could not open that image. Please cancel and choose another one.</Notice>
                ) : (
                    <>
                        <div className="crop-stage">
                            <div
                                ref={frameRef}
                                className="crop-frame"
                                tabIndex={0}
                                role="group"
                                aria-label="Crop area. Use the arrow keys to move the photo, and plus or minus to zoom."
                                onPointerDown={handlePointerDown}
                                onPointerMove={handlePointerMove}
                                onPointerUp={handlePointerEnd}
                                onPointerCancel={handlePointerEnd}
                                onKeyDown={handleKeyDown}
                            >
                                {image
                                    ? (
                                        <img
                                            className="crop-image"
                                            src={image.src}
                                            alt=""
                                            draggable={false}
                                            style={{
                                                width: image.naturalWidth * scale,
                                                height: image.naturalHeight * scale,
                                                transform: `translate(-50%, -50%) translate(${position.x}px, ${position.y}px) rotate(${rotation}deg)`
                                            }}
                                        />
                                    )
                                    : <p role="status" className="crop-loading">Loading photo...</p>}
                                <div className="crop-grid" aria-hidden="true" />
                            </div>
                        </div>

                        <label className="crop-zoom">
                            Zoom
                            <input
                                type="range"
                                min={1}
                                max={MAX_ZOOM}
                                step={0.01}
                                value={zoom}
                                onChange={(event) => setZoom(Number(event.currentTarget.value))}
                            />
                        </label>
                    </>
                )}

                {saveError && <Notice kind="error">{saveError}</Notice>}

                <div className="crop-actions">
                    <button type="button" onClick={onCancel} disabled={isSaving}>Cancel</button>
                    <button
                        type="button"
                        className="icon-text-button"
                        onClick={handleRotate}
                        disabled={!image || isSaving}
                        title="Rotate the photo 90 degrees"
                    >
                        <RotateIcon size={20} />
                        Rotate
                    </button>
                    <button type="button" className="btn btn-primary" onClick={handleDone} disabled={!image || isSaving}>
                        {isSaving ? "Saving..." : "Done"}
                    </button>
                </div>
            </div>
        </dialog>
    )
}

export default ImageCropDialog
