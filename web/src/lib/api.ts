const TOKEN_KEY = 'agrinest.token'

export function getToken(): string | null {
  try { return localStorage.getItem(TOKEN_KEY) } catch { return null }
}

export function setToken(token: string | null) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token)
    else localStorage.removeItem(TOKEN_KEY)
  } catch { /* private mode: session lasts until reload */ }
}

export class ApiError extends Error {
  constructor(message: string, public status: number) { super(message) }
}

export async function api<T = any>(path: string, opts: { method?: string; body?: unknown; form?: FormData } = {}): Promise<T> {
  const token = getToken()
  const headers: Record<string, string> = { Accept: 'application/json' }
  if (token) headers.Authorization = `Bearer ${token}`
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json'

  let res: Response
  try {
    res = await fetch(`/api${path}`, {
      method: opts.method ?? (opts.body !== undefined || opts.form ? 'POST' : 'GET'),
      headers,
      body: opts.form ?? (opts.body !== undefined ? JSON.stringify(opts.body) : undefined),
    })
  } catch {
    throw new ApiError('ইন্টারনেট সংযোগ পরীক্ষা করুন / Check your connection', 0)
  }

  const data = await res.json().catch(() => null)
  if (res.status === 401 && token) {
    setToken(null)
    window.location.href = '/login'
  }
  if (!res.ok) {
    const first = data?.errors ? (Object.values(data.errors)[0] as string[])[0] : null
    throw new ApiError(first || data?.message || 'Something went wrong', res.status)
  }
  return data as T
}
