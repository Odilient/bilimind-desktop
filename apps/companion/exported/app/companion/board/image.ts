/**
 * Images on a board.
 *
 * The file goes up through `repo.upload` like any other (it becomes an Item,
 * so it shows in the course's files too). What the board draws is chosen
 * here: the server's URL when the upload answers with one, otherwise a copy
 * of the image shrunk to 1600 px and kept in the board's own document, so it
 * draws offline and survives a reload. A blob URL, which is all the demo has,
 * dies with the tab and is never stored.
 */
import type { Item } from '../types'

const MAX = 1600

export async function shrinkToDataUrl(file: File): Promise<string> {
  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image()
      i.onload = () => resolve(i)
      i.onerror = () => reject(new Error('That image could not be read.'))
      i.src = url
    })
    const k = Math.min(1, MAX / Math.max(img.naturalWidth, img.naturalHeight))
    const c = document.createElement('canvas')
    c.width = Math.max(1, Math.round(img.naturalWidth * k))
    c.height = Math.max(1, Math.round(img.naturalHeight * k))
    c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height)
    // PNG keeps transparency for diagrams and screenshots; photos go smaller as JPEG.
    return file.type === 'image/png' || file.type === 'image/gif' ? c.toDataURL('image/png') : c.toDataURL('image/jpeg', 0.86)
  } finally {
    URL.revokeObjectURL(url)
  }
}

export async function imageSource(file: File, item: Item | null): Promise<string> {
  const remote = item?.meta.url ?? item?.meta.path
  if (remote && /^https?:\/\//.test(remote)) return remote
  return shrinkToDataUrl(file)
}
