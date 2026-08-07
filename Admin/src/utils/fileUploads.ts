export function fileToBase64Content(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = () => {
      if (typeof reader.result !== 'string') {
        reject(new Error('Failed to read the selected file.'))
        return
      }

      const [, base64Content = ''] = reader.result.split(',')

      if (!base64Content) {
        reject(new Error('Failed to encode the selected file.'))
        return
      }

      resolve(base64Content)
    }

    reader.onerror = () => {
      reject(new Error('Failed to read the selected file.'))
    }

    reader.readAsDataURL(file)
  })
}

export function getFileNameFromPath(filePath: string) {
  try {
    const normalizedPath = filePath.split('?')[0] ?? filePath
    const pathSegments = normalizedPath.split('/').filter(Boolean)
    const lastSegment = pathSegments[pathSegments.length - 1]

    return lastSegment ? decodeURIComponent(lastSegment) : filePath
  } catch {
    return filePath
  }
}
