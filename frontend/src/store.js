// Helper date (locale italiano) e selettori puri — nessuna persistenza locale

const pad = (n) => String(n).padStart(2, '0')

export const toISO = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

export const fromISO = (iso) => {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

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

export const ABSENCE_TYPES = {
  ferie:    { label: 'Ferie',    short: 'F', color: 'oklch(0.78 0.13 200)' },
  malattia: { label: 'Malattia', short: 'M', color: 'oklch(0.70 0.17 25)'  },
  permesso: { label: 'Permesso', short: 'P', color: 'oklch(0.80 0.15 75)'  },
}

// --- Selettori puri (leggono data da data) ---

export const getEntries = (data, date, empId) =>
  (data.entries[date] && data.entries[date][empId]) || []

export const empDayTotal = (data, date, empId) =>
  getEntries(data, date, empId).reduce((s, a) => s + (Number(a.hours) || 0), 0)

export const empHasDay = (data, date, empId) => getEntries(data, date, empId).length > 0

export const dayTotalAll = (data, date) => {
  const day = data.entries[date]
  if (!day) return 0
  let s = 0
  for (const k of Object.keys(day))
    for (const a of day[k]) s += Number(a.hours) || 0
  return s
}

export const employeesByDept = (data) =>
  data.departments.map((dep) => ({
    dep,
    list: data.employees.filter((e) => e.departmentId === dep.id),
  }))

export const fmtHours = (h) => {
  if (!h && h !== 0) return ''
  const n = Number(h)
  return Number.isInteger(n) ? String(n) : n.toFixed(1)
}

export const getAbsence = (data, date, empId) =>
  (data.absences && data.absences[date] && data.absences[date][empId]) || null

export const LICENZIATO_COLOR = 'oklch(0.50 0.22 25)'

export const isTerminated = (emp, date) =>
  !!(emp && emp.terminated_from && date >= emp.terminated_from)

export const getEffectiveAbsence = (data, date, empId) => {
  const emp = data.employees.find((e) => e.id === empId)
  if (isTerminated(emp, date)) return 'licenziato'
  return getAbsence(data, date, empId)
}

// Calcola il range di date necessario per una vista
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
