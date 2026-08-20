export const autoUrlHttp = (url: string) => {
  if (url.startsWith('//')) {
    return url.replace(/^\/\//, 'https://')
  } else if (url.startsWith('http://')) {
    return url.replace(/^http\:\/\//, 'https://')
  }
  return url
}

export const loadImage = async (url: string | Blob): Promise<ImageBitmap | HTMLImageElement | null> => {
  if (!url) return null
  try {
    if ('createImageBitmap' in self) {
      let imageData: Blob
      if (typeof url === 'string') {
        imageData = await fetch(url).then(response => response.blob())
      } else {
        imageData = url
      }
      return await createImageBitmap(imageData)
    }

    return new Promise<HTMLImageElement>(async (resolve, reject) => {
      if (typeof url !== 'string') {
        url = await new Promise<string>(r => {
          const reader = new FileReader()
          reader.readAsDataURL(url as Blob)
          reader.onloadend = () => {
            r(reader.result as string)
          }
        })
      }
      const image = new Image()
      image.crossOrigin = 'anonymous'
      image.onload = () => {
        resolve(image)
      }
      image.onerror = (event: Event | string, source?: string, lineno?: number, colno?: number, error?: Error) => {
        reject({event, source, lineno, colno, error})
      }
      image.src = url
    })
  } catch (err) {
    console.error(err)
  }

  return null
}
