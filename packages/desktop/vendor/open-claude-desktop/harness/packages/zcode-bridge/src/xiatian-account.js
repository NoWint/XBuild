import { randomUUID } from 'node:crypto'

const DEFAULT_ORIGIN = 'https://nowint.qzz.io'

function refreshTokenFromSetCookie(response) {
  const values = typeof response?.headers?.getSetCookie === 'function' ? response.headers.getSetCookie() : []
  const joined = Array.isArray(values) ? values.join('; ') : String(response?.headers?.get('set-cookie') ?? '')
  const match = /(?:^|;\s*)new_api_refresh=([^;]+)/.exec(joined)
  return match ? decodeURIComponent(match[1]) : null
}

export function xiatianOrigin(env = process.env) {
  const value = env.CODE_DESKTOP_XIATIAN_ORIGIN?.trim() || DEFAULT_ORIGIN
  try {
    const url = new URL(value)
    if (url.protocol === 'https:' && !url.username && !url.password) return url.origin
    if (url.protocol === 'http:' && ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) && !url.username && !url.password) return url.origin
  } catch {}
  return DEFAULT_ORIGIN
}

async function requestJSON(url, { method = 'GET', token = '', body, signal, fetchImpl = fetch } = {}) {
  const response = await fetchImpl(url, {
    method, signal,
    headers: { accept: 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}), ...(body !== undefined ? { 'content-type': 'application/json' } : {}) },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  })
  const data = await response.json().catch(() => null)
  if (!response.ok || data?.success === false) {
    const error = new Error(data?.message || `Xiatian AI request failed (${response.status}).`)
    error.code = data?.code || `http_${response.status}`
    throw error
  }
  return data?.data ?? data
}

export function createXiatianAccount({ env = process.env, notify, log = () => {}, fetchImpl = fetch }) {
  let session = null
  let login = null
  const origin = xiatianOrigin(env)
  const request = (path, options) => requestJSON(new URL(path, `${origin}/`), { ...options, fetchImpl })

  async function api(path, { token, ...options } = {}) {
    return request(path, { ...options, token, signal: AbortSignal.timeout(15000) })
  }

  async function start() {
    if (login) throw new Error('Finish or cancel the current Xiatian AI sign-in first.')
    const data = await api('/api/xbuild/device/start', { method: 'POST', body: { client_id: 'xbuild-desktop' } })
    const id = randomUUID()
    const current = { id, code: data.device_code, cancelled: false }
    login = current
    void (async () => {
      const deadline = Date.now() + data.expires_in * 1000
      try {
        while (!current.cancelled && Date.now() < deadline) {
          await new Promise((resolve) => setTimeout(resolve, Math.max(1000, data.interval * 1000)))
          try {
            const bundle = await api('/api/xbuild/device/token', { method: 'POST', body: { client_id: 'xbuild-desktop', device_code: current.code } })
            session = { ...bundle, refreshToken: bundle.refresh_token }
            login = null
            notify('account/login/completed', { loginId: id, success: true, error: null })
            notify('account/updated', { authMode: 'xiatian' })
            return
          } catch (error) {
            if (error.code === 'authorization_pending') continue
            throw error
          }
        }
        throw new Error('Xiatian AI sign-in expired or was cancelled.')
      } catch (error) {
        if (login !== current) return
        login = null
        notify('account/login/completed', { loginId: id, success: false, error: error.message })
      }
    })()
    return { type: 'chatgpt', loginId: id, authUrl: new URL(data.verification_uri, `${origin}/`).href }
  }

  async function cancel(loginId) {
    if (!login || login.id !== loginId) return { status: 'notFound' }
    login.cancelled = true
    login = null
    return { status: 'canceled' }
  }

  async function refresh() {
    if (!session?.refreshToken) return null
    const result = await fetchImpl(`${origin}/api/user/auth/refresh`, {
      method: 'POST', headers: { cookie: `new_api_refresh=${encodeURIComponent(session.refreshToken)}`, 'x-auth-session': session.session?.sid ?? '', accept: 'application/json' },
      signal: AbortSignal.timeout(15000),
    })
    if (result.status === 401 || result.status === 403) {
      session = null
      return null
    }
    const payload = await result.json().catch(() => null)
    if (!result.ok || payload?.success === false) throw new Error(payload?.message || 'Could not refresh the Xiatian AI session.')
    const rotatedRefreshToken = refreshTokenFromSetCookie(result)
    session = { ...payload.data, refreshToken: rotatedRefreshToken || session.refreshToken }
    return session
  }

  async function read() {
    if (!session) return { account: null, requiresOpenaiAuth: true, xiatian: null }
    if (session.access_expires_at * 1000 < Date.now() + 30000) await refresh()
    if (!session) return { account: null, requiresOpenaiAuth: true, xiatian: null }
    const [user, models, notices, keys] = await Promise.all([
      api('/api/user/self', { token: session.access_token }),
      api('/api/user/self/models', { token: session.access_token }),
      api('/api/notice'),
      api('/api/token/?p=1&size=50', { token: session.access_token }),
    ])
    return {
      account: { type: 'xiatian', email: user.email || user.display_name || user.username, planType: 'Xiatian AI' },
      requiresOpenaiAuth: false,
      xiatian: { user, models: Array.isArray(models) ? models : [], keys: Array.isArray(keys?.items) ? keys.items.map((key) => ({ id: key.id, name: key.name, maskedKey: key.key, usedQuota: key.used_quota, remainQuota: key.remain_quota, expiredTime: key.expired_time })) : [], notice: notices || '', links: { apiKeys: `${origin}/console/token`, usageUrl: `${origin}/console/log` } },
    }
  }

  async function logout() {
    if (session) {
      // Revoke the desktop relay key first: it is the credential the agent
      // calls the relay with, and the access token is still valid right now.
      await request('/api/xbuild/session-key', { method: 'DELETE', token: session.access_token, signal: AbortSignal.timeout(8000) }).catch(() => {})
      await fetchImpl(`${origin}/api/user/auth/logout`, { method: 'POST', headers: { authorization: `Bearer ${session.access_token}`, 'x-auth-session': session.session?.sid ?? '', cookie: `new_api_refresh=${encodeURIComponent(session.refreshToken)}` }, signal: AbortSignal.timeout(8000) }).catch(() => {})
    }
    session = null
    if (login) login.cancelled = true
    login = null
  }

  // A short-lived relay key owned by the signed-in user (own group, own
  // balance). The dashboard JWT must never be used as a relay credential: it
  // would bypass the relay's per-key quota and audit semantics.
  async function sessionKey() {
    if (!session) return null
    if (session.access_expires_at * 1000 < Date.now() + 30000) await refresh()
    if (!session) return null
    const data = await request('/api/xbuild/session-key', { method: 'POST', token: session.access_token, signal: AbortSignal.timeout(15000) })
    return { apiKey: data.api_key, expiresAt: data.expires_at * 1000, group: data.group, models: Array.isArray(data.models) ? data.models : [], baseUrl: data.base_url ?? '/v1', anthropicBaseUrl: data.anthropic_base_url ?? '/' }
  }

  return {
    start, cancel, read, logout, refresh,
    sessionKey,
    get session() { return session ? { ...session, refreshToken: undefined } : null },
    get accessToken() { return session?.access_token ?? null },
  }
}
