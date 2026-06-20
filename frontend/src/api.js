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
    const err = new Error(json?.detail || 'Errore server')
    err.status = res.status
    throw err
  }
  return json
}

// --- Auth ---
export const authStatus = () => req('/auth/status')
export const register = (user, password) =>
  req('/auth/register', { method: 'POST', body: JSON.stringify({ user, password }) })
export const login = (user, password) =>
  req('/auth/login', { method: 'POST', body: JSON.stringify({ user, password }) })
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

// --- Entries ---
export const getEntries = (from, to) => req(`/entries?from=${from}&to=${to}`)
export const putEntries = (empId, date, activities) =>
  req(`/entries/${empId}/${date}`, { method: 'PUT', body: JSON.stringify({ activities }) })
export const putAbsence = (empId, date, type) =>
  req(`/absences/${empId}/${date}`, { method: 'PUT', body: JSON.stringify({ type: type || null }) })
