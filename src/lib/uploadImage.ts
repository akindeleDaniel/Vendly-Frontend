export async function uploadImage(file: File): Promise<string | null> {
    const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME
    const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET

    if (!cloudName || !uploadPreset) {
        return null
    }

    const imageData = new FormData()
    imageData.append("file", file)
    imageData.append("upload_preset", uploadPreset)

    try {
        const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
            method: "POST",
            body: imageData
        })
        const data = await response.json()

        if (!response.ok || !data.secure_url) {
            return null
        }

        return data.secure_url
    } catch (error) {
        return null
    }
}