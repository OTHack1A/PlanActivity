const TOKEN_KEY = 'pianifica_token'

let _token = localStorage.getItem(TOKEN_KEY) || ''

export function setToken(t) {
  _token = t || ''
  if (_token) localStorage.setItem(TOKEN_KEY, _token)
  else localStorage.removeItem(TOKEN_KEY)
}

export function getToken() {
  return _token
}

async function req(path, opts = {}) {
  const headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) }
  if (_token) headers['Authorization'] = `Bearer ${_token}`
  const res = await fetch('/api' + path, { ...opts, headers })
  if (res.status === 204) return null
  const json = await res.json().catch(() => ({ detail: res.statusText }))
  if (!res.ok) {
    const detail = json?.detail
    // detail can be: a string, an object {message,...}, or a list of
    // Pydantic validation errors [{type, loc, msg, ...}]. Surface a useful
    // message in every case so the UI never shows a raw object.
    let msg
    if (typeof detail === 'string') msg = detail
    else if (detail && typeof detail.message === 'string') msg = detail.message
    else if (Array.isArray(detail) && detail.length) msg = detail[0]?.msg || 'Errore di validazione'
    else msg = 'Errore server'
    const err = new Error(msg)
    err.status = res.status
    // Carry validation metadata so callers can map errors to localized text.
    if (Array.isArray(detail)) err.validation = detail
    if (res.status === 429) err.retryAfter = detail?.retry_after || 180
    throw err
  }
  return json
}

// --- Auth ---
export const authStatus = () => req('/auth/status')
export const register = (user, password, company = '') =>
  req('/auth/register', { method: 'POST', body: JSON.stringify({ user, password, company }) })
export const login = (user, password) =>
  req('/auth/login', { method: 'POST', body: JSON.stringify({ user, password }) })
export const getAccount = () => req('/account')
export const logout = () => req('/auth/logout', { method: 'POST' })
export const changePassword = (current, next) =>
  req('/account/password', { method: 'POST', body: JSON.stringify({ current, next }) })

// --- Departments ---
export const getDepartments = () => req('/departments')
export const createDepartment = (name, color) =>
  req('/departments', { method: 'POST', body: JSON.stringify({ name, color }) })
export const deleteDepartment = (id) => req(`/departments/${id}`, { method: 'DELETE' })

// --- Employees ---
export const getEmployees = () => req('/employees')
export const createEmployee = (emp) =>
  req('/employees', { method: 'POST', body: JSON.stringify(emp) })
export const patchEmployee = (id, patch) =>
  req(`/employees/${id}`, { method: 'PATCH', body: JSON.stringify(patch) })
export const deleteEmployee = (id) => req(`/employees/${id}`, { method: 'DELETE' })

// --- Avatar ---
export const uploadAvatar = (empId, file) => {
  const form = new FormData()
  form.append('file', file)
  const headers = {}
  if (_token) headers['Authorization'] = `Bearer ${_token}`
  return fetch(`/api/employees/${empId}/avatar`, { method: 'POST', headers, body: form })
    .then((r) => (r.status === 204 ? null : r.json()))
}
export const deleteAvatar = (empId) => req(`/employees/${empId}/avatar`, { method: 'DELETE' })

// --- Entries ---
export const getEntries = (from, to) => req(`/entries?from=${from}&to=${to}`)
export const putEntries = (empId, date, activities) =>
  req(`/entries/${empId}/${date}`, { method: 'PUT', body: JSON.stringify({ activities }) })
export const putAbsence = (empId, date, type) =>
  req(`/absences/${empId}/${date}`, { method: 'PUT', body: JSON.stringify({ type: type || null }) })

// --- Log ---
export const getLog = (lines = 500) => req(`/log?lines=${lines}`)

/** Evento UI autenticato — accetta una stringa pre-formattata (tradotta lato frontend). */
export const logEvent = (message) => {
  if (!_token || !message) return Promise.resolve()
  return req('/log/event', { method: 'POST', body: JSON.stringify({ message }) }).catch(() => {})
}

/** Evento pre-login (senza JWT). NON passare mai campi password. */
export const logPublicEvent = (action) => {
  if (!action) return Promise.resolve()
  return fetch('/api/log/public-event', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: String(action) }),
  }).catch(() => {})
}

// --- Settings ---
export const getSettings = () => req('/settings')
export const patchSettings = (patch) =>
  req('/settings', { method: 'PATCH', body: JSON.stringify(patch) })

// --- Logo ---
export const getLogoStatus = () => req('/logo/status')

export const uploadLogo = (file) => {
  const form = new FormData()
  form.append('file', file)
  return fetch('/api/logo', { method: 'POST', body: form }).then(async (r) => {
    if (r.status === 204) return null
    const json = await r.json().catch(() => ({ detail: r.statusText }))
    if (!r.ok) {
      const err = new Error(json?.detail || 'Errore upload logo')
      err.status = r.status
      throw err
    }
    return json
  })
}
