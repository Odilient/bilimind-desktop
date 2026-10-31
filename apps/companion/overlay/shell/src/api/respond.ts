export const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } })
export const ok = (data: unknown, status = 200) => json({ data }, status)
export const empty = () => new Response(null, { status: 204 })
export const message = (text: string, status: number) => json({ message: text }, status)
export const notFound = (text = 'Not found.') => message(text, 404)
