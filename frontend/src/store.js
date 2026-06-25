// ---------------------------------------------------------------------------
// Date helpers and pure selectors. No local persistence: every function is a
// pure transformation of its arguments, which keeps the React tree predictable.
// Dates are passed around as ISO strings ("YYYY-MM-DD") to dodge timezone bugs.
// ---------------------------------------------------------------------------

// Zero-pad a number to 2 digits (e.g. 3 -> "03").
const pad = (n) => String(n).padStart(2, '0')

// Format a Date into a local ISO date string (no time component).
export const toISO = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

// Parse an ISO date string back into a local Date (month is 0-based in JS).
export const fromISO = (iso) => {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

// Today's date as an ISO string.
export const todayISO = () => toISO(new Date())

export const addDays = (iso, n) => {
  const d = fromISO(iso)
  d.setDate(d.getDate() + n)
  return toISO(d)
}

export const addMonths = (iso, n) => {
  const d = fromISO(iso)
  d.setMonth(d.getMonth() + n)
  return toISO(d)
}

export const fmtLong = (iso, locale = 'it-IT') =>
  fromISO(iso).toLocaleDateString(locale, {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })

export const fmtMonthYear = (iso, locale = 'it-IT') =>
  fromISO(iso).toLocaleDateString(locale, { month: 'long', year: 'numeric' })

export const fmtWeekday = (iso, locale = 'it-IT') =>
  fromISO(iso).toLocaleDateString(locale, { weekday: 'short' })

export const fmtDayNum = (iso) => fromISO(iso).getDate()

export const startOfWeek = (iso) => {
  const d = fromISO(iso)
  const day = (d.getDay() + 6) % 7
  d.setDate(d.getDate() - day)
  return toISO(d)
}

export const weekDays = (iso) => {
  const s = startOfWeek(iso)
  return Array.from({ length: 7 }, (_, i) => addDays(s, i))
}

export const monthGrid = (iso) => {
  const d = fromISO(iso)
  const first = new Date(d.getFullYear(), d.getMonth(), 1)
  const startISO = startOfWeek(toISO(first))
  return Array.from({ length: 42 }, (_, i) => addDays(startISO, i))
}

export const sameMonth = (iso, refIso) => {
  const a = fromISO(iso), b = fromISO(refIso)
  return a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear()
}

export const uid = () => Math.random().toString(36).slice(2, 9)

export const isSunday = (iso) => fromISO(iso).getDay() === 0
export const isSaturday = (iso) => fromISO(iso).getDay() === 6

export const DEPT_COLORS = [
  'oklch(0.72 0.15 250)',
  'oklch(0.75 0.15 165)',
  'oklch(0.80 0.15 75)',
  'oklch(0.70 0.17 25)',
  'oklch(0.72 0.16 300)',
  'oklch(0.78 0.13 200)',
  'oklch(0.76 0.15 135)',
  'oklch(0.72 0.17 350)',
]

// The three real absence types (stored in the DB). Each carries a label, a
// single-letter short tag for compact calendar cells, and a display colour.
// "licenziato" is intentionally NOT here — it is derived, not stored.
export const ABSENCE_TYPES = {
  ferie:    { label: 'Ferie',    short: 'F', color: 'oklch(0.78 0.13 200)' },
  malattia: { label: 'Malattia', short: 'M', color: 'oklch(0.70 0.17 25)'  },
  permesso: { label: 'Permesso', short: 'P', color: 'oklch(0.80 0.15 75)'  },
}

// --- Pure selectors: read a value out of the in-memory `data` snapshot ---

// Activity rows for one employee on one day (empty array if none).
export const getEntries = (data, date, empId) =>
  (data.entries[date] && data.entries[date][empId]) || []

// Sum of planned hours for one employee on one day.
export const empDayTotal = (data, date, empId) =>
  getEntries(data, date, empId).reduce((s, a) => s + (Number(a.hours) || 0), 0)

// True if the employee has at least one activity that day.
export const empHasDay = (data, date, empId) => getEntries(data, date, empId).length > 0

// Total planned hours across all employees on a given day.
export const dayTotalAll = (data, date) => {
  const day = data.entries[date]
  if (!day) return 0
  let s = 0
  for (const k of Object.keys(day))
    for (const a of day[k]) s += Number(a.hours) || 0
  return s
}

// Group employees under their department for sectioned rendering.
export const employeesByDept = (data) =>
  data.departments.map((dep) => ({
    dep,
    list: data.employees.filter((e) => e.departmentId === dep.id),
  }))

// Format hours for display: integers without decimals, otherwise one decimal.
export const fmtHours = (h) => {
  if (!h && h !== 0) return ''        // empty/undefined -> blank
  const n = Number(h)
  return Number.isInteger(n) ? String(n) : n.toFixed(1)
}

// The stored absence type for an employee/day, or null.
export const getAbsence = (data, date, empId) =>
  (data.absences && data.absences[date] && data.absences[date][empId]) || null

// Display colour for the derived "licenziato" (dismissed) state.
export const LICENZIATO_COLOR = 'oklch(0.50 0.22 25)'

// An employee is terminated on `date` if a termination date is set and `date`
// is on/after it. String comparison works because dates are ISO ("YYYY-MM-DD").
export const isTerminated = (emp, date) =>
  !!(emp && emp.terminated_from && date >= emp.terminated_from)

// The effective state for an employee/day: a termination always wins over (and
// hides) any stored absence; otherwise fall back to the stored absence type.
export const getEffectiveAbsence = (data, date, empId) => {
  const emp = data.employees.find((e) => e.id === empId)
  if (isTerminated(emp, date)) return 'licenziato'
  return getAbsence(data, date, empId)
}

// Compute the inclusive date range a view needs to fetch from the API, so each
// view (day/week/month/year) loads exactly the entries it will render.
export function viewRange(view, date) {
  if (view === 'day') return { from: date, to: date }
  if (view === 'week') {
    const s = startOfWeek(date)
    return { from: s, to: addDays(s, 6) }
  }
  if (view === 'month') {
    const grid = monthGrid(date)
    return { from: grid[0], to: grid[41] }
  }
  // year
  const year = date.slice(0, 4)
  return { from: `${year}-01-01`, to: `${year}-12-31` }
}
