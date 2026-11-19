const PROVIDER_ID = /^[a-z][a-z0-9_-]{1,47}$/
const MODEL_ID = /^[A-Za-z0-9_.:/@+-]{1,128}$/
const PROTOCOLS = new Set(['openai-completions', 'anthropic-messages'])

export function validateZCodeProvider(form) {
  const providerId = String(form?.route ?? '').trim().toLowerCase()
  if (!PROVIDER_ID.test(providerId)) throw new Error('Provider ids use 2–48 lowercase letters, digits, dashes or underscores.')
  const api = String(form?.api ?? '')
  if (!PROTOCOLS.has(api)) throw new Error('Choose OpenAI Chat Completions or Anthropic Messages.')
  const baseURL = String(form?.baseURL ?? '').trim().replace(/\/+$/, '')
  let url
  try { url = new URL(baseURL) } catch { throw new Error('Enter an HTTPS endpoint, or HTTP on loopback for a local provider.') }
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname))) throw new Error('Use HTTPS, or HTTP on loopback for a local provider.')
  if (url.username || url.password || url.search || url.hash) throw new Error('The provider URL cannot contain credentials, query parameters or a fragment.')
  const models = [...new Set(String(form?.models ?? '').split(/[\s,]+/).map((id) => id.trim()).filter(Boolean))]
  if (!models.length || models.length > 100 || models.some((id) => !MODEL_ID.test(id))) throw new Error('Enter 1–100 valid model ids, one per line.')
  const displayName = String(form?.displayName ?? providerId).trim()
  if (!displayName || displayName.length > 80) throw new Error('Use a display name of 1–80 characters.')
  return { route: providerId, displayName, api, baseURL, models }
}

export function zCodeProviderApiType(api) {
  return api === 'anthropic-messages' ? 'anthropic-messages' : 'openai-chat-completions'
}
