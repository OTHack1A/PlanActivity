import { useState, useMemo, useRef, useEffect, Fragment } from 'react'
import * as XLSX from 'xlsx'
import {
  todayISO, addDays, addMonths, fromISO,
  fmtLong, fmtMonthYear, fmtWeekday, fmtDayNum,
  startOfWeek, weekDays, monthGrid, sameMonth,
  uid, DEPT_COLORS, isSunday, isSaturday,
  getEntries, empDayTotal, empHasDay, dayTotalAll, employeesByDept, fmtHours,
  ABSENCE_TYPES, getAbsence, getEffectiveAbsence, LICENZIATO_COLOR,
} from './store.js'
import * as api from './api.js'
import { useI18n, LANG_OPTIONS } from './i18n.jsx'

const initials = (name) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('')

export { initials }

const STD_HOURS = 8
const empTarget = (emp) => STD_HOURS + (Number(emp && emp.overtime) || 0)
const empDayTarget = (emp, dateISO, satHalfDay) => {
  if (satHalfDay && isSaturday(dateISO)) return 4
  return empTarget(emp)
}

/* ---------------------------------------------------------------- AVATAR */
function AvatarImg({ emp }) {
  const [failed, setFailed] = useState(false)
  if (!emp.hasAvatar || failed) return null
  return (
    <img
      src={`/api/employees/${emp.id}/avatar`}
      alt=""
      style={{
        position: 'absolute', inset: 0,
        width: '100%', height: '100%',
        objectFit: 'cover',
        borderRadius: 'inherit',
      }}
      onError={() => setFailed(true)}
    />
  )
}

/* ---------------------------------------------------------------- TOPBAR */
export function Topbar({ view, setView, date, setDate, onSettings, onLog, onAccount, onCalendar, onToday, page, onLogout, company }) {
  const { t, lang, setLang, locale } = useI18n()
  const today = todayISO()

  const step = (dir) => {
    if (view === 'day') setDate(addDays(date, dir))
    else if (view === 'week') setDate(addDays(date, dir * 7))
    else if (view === 'month') setDate(addMonths(date, dir))
    else setDate(addMonths(date, dir * 12))
  }

  let dateLabel = ''
  if (view === 'day') dateLabel = fmtLong(date, locale)
  else if (view === 'week') {
    const w = weekDays(date)
    const a = fromISO(w[0]), b = fromISO(w[6])
    const fmt = (d, opts) => d.toLocaleDateString(locale, opts)
    dateLabel = `${fmt(a, { day: 'numeric', month: 'short' })} – ${fmt(b, { day: 'numeric', month: 'short', year: 'numeric' })}`
  } else if (view === 'month') dateLabel = fmtMonthYear(date, locale)
  else dateLabel = String(fromISO(date).getFullYear())

  return (
    <div className="topbar">
      <div className="brand"><span className="dot"></span><span>{t('brand.name')}</span></div>
      {page === 'calendar' && (
        <>
          <div className="tabs">
            {[['day', t('view.day')], ['week', t('view.week')], ['month', t('view.month')], ['year', t('view.year')]].map(
              ([v, viewLabel]) => (
                <button key={v} className={view === v ? 'active' : ''} onClick={() => setView(v)}>{viewLabel}</button>
              )
            )}
          </div>
          <div className="nav">
            <button className="arrow" onClick={() => step(-1)} aria-label={t('nav.prev')}>‹</button>
            <button className="btn-today" onClick={onToday}>{t('nav.today')}</button>
            <button className="arrow" onClick={() => step(1)} aria-label={t('nav.next')}>›</button>
          </div>
          <div className="date-label">{dateLabel}</div>
        </>
      )}
      <div className="spacer"></div>
      {company && (
        <div className="company-id">
          <img src="/api/logo" alt="" className="company-logo" onError={(e) => { e.currentTarget.style.display = 'none' }} />
          <span className="company-name">{company}</span>
        </div>
      )}
      {page === 'calendar' ? (
        <>
          <button className="btn-icon" onClick={onSettings}>{t('nav.settings')}</button>
          <button className="btn-icon" onClick={onLog}>{t('nav.log')}</button>
          <button className="btn-icon" onClick={onAccount}>{t('nav.account')}</button>
        </>
      ) : (
        <button className="btn-icon" onClick={onCalendar}>{t('nav.back')}</button>
      )}
      <button className="btn-icon ghost" onClick={onLogout} title={t('nav.logout')}>{t('nav.logout')}</button>
      <div className="lang-switch">
        {LANG_OPTIONS.map(({ code, label: lbl }) => (
          <button
            key={code}
            className={'lang-btn' + (lang === code ? ' active' : '')}
            onClick={() => setLang(code)}
          >
            {lbl}
          </button>
        ))}
      </div>
    </div>
  )
}

/* --------------------------------------------------------- EXPORT HELPERS */

function buildDayRows(employees, departments, fetchedEntries, fetchedAbsences, date, t) {
  const deptMap = new Map(departments.map((d) => [d.id, d]))
  const header = [
    t('export.colEmployee'), t('export.colRole'), t('export.colDept'),
    t('export.colPresence'), t('export.colActivity'), t('export.colHours'), t('export.colNotes'),
  ]
  const rows = [header]
  for (const emp of employees) {
    const dep = deptMap.get(emp.departmentId)
    const absence = fetchedAbsences[date]?.[emp.id] || null
    const acts = fetchedEntries[date]?.[emp.id] || []
    if (absence) {
      rows.push([emp.name, emp.role, dep?.name || '', t(`absence.${absence}.label`), '', '', ''])
    } else if (acts.length > 0) {
      for (let i = 0; i < acts.length; i++) {
        const act = acts[i]
        rows.push([
          i === 0 ? emp.name : '',
          i === 0 ? emp.role : '',
          i === 0 ? (dep?.name || '') : '',
          i === 0 ? t('modal.present') : '',
          act.activity,
          Number(act.hours) || 0,
          act.notes || '',
        ])
      }
    } else {
      rows.push([emp.name, emp.role, dep?.name || '', t('modal.present'), '', 0, ''])
    }
  }
  return rows
}

const COL_WIDTHS = [
  { wch: 22 }, { wch: 15 }, { wch: 15 },
  { wch: 12 }, { wch: 35 }, { wch: 7 }, { wch: 25 },
]

const WEEK_TAB_COLORS = ['FF4472C4', 'FF70AD47', 'FFE18A37', 'FFED7D31', 'FF7030A0']

async function doExportWeek(data, date, t, locale) {
  const days = weekDays(date)
  const today = todayISO()
  const { entries, absences } = await api.getEntries(days[0], days[6])

  const wb = XLSX.utils.book_new()
  if (!wb.Workbook) wb.Workbook = {}
  if (!wb.Workbook.Sheets) wb.Workbook.Sheets = []

  for (let i = 0; i < 7; i++) {
    const d = days[i]
    const dt = fromISO(d)
    const wd = dt.toLocaleDateString(locale, { weekday: 'short' })
    const tabName = `${wd} ${String(dt.getDate()).padStart(2,'0')}.${String(dt.getMonth()+1).padStart(2,'0')}`
      .slice(0, 31)

    const rows = buildDayRows(data.employees, data.departments, entries, absences, d, t)
    const ws = XLSX.utils.aoa_to_sheet(rows)
    ws['!cols'] = COL_WIDTHS
    XLSX.utils.book_append_sheet(wb, ws, tabName)

    while (wb.Workbook.Sheets.length <= i) wb.Workbook.Sheets.push({})
    if (d === today) wb.Workbook.Sheets[i].tabColor = { rgb: 'FFE67E22' }
  }

  const yearMonth = date.slice(0, 7)
  XLSX.writeFile(wb, `Pianifica_settimana_${yearMonth}.xlsx`)
}

async function doExportToday(data, t, locale) {
  const today = todayISO()
  const { entries, absences } = await api.getEntries(today, today)

  const dt = fromISO(today)
  const wd = dt.toLocaleDateString(locale, { weekday: 'short' })
  const tabName = `${wd} ${String(dt.getDate()).padStart(2,'0')}.${String(dt.getMonth()+1).padStart(2,'0')}`
    .slice(0, 31)

  const wb = XLSX.utils.book_new()
  if (!wb.Workbook) wb.Workbook = {}
  if (!wb.Workbook.Sheets) wb.Workbook.Sheets = []

  const rows = buildDayRows(data.employees, data.departments, entries, absences, today, t)
  const ws = XLSX.utils.aoa_to_sheet(rows)
  ws['!cols'] = COL_WIDTHS
  XLSX.utils.book_append_sheet(wb, ws, tabName)
  wb.Workbook.Sheets.push({ tabColor: { rgb: 'FFE67E22' } })

  XLSX.writeFile(wb, `Pianifica_oggi_${today}.xlsx`)
}

async function doExportMonth(data, date, t, locale) {
  const year = parseInt(date.slice(0, 4), 10)
  const month = parseInt(date.slice(5, 7), 10)
  const daysInMonth = new Date(year, month, 0).getDate()
  const monthFrom = `${year}-${String(month).padStart(2,'0')}-01`
  const monthTo   = `${year}-${String(month).padStart(2,'0')}-${String(daysInMonth).padStart(2,'0')}`

  const { entries, absences } = await api.getEntries(monthFrom, monthTo)

  const wb = XLSX.utils.book_new()
  if (!wb.Workbook) wb.Workbook = {}
  if (!wb.Workbook.Sheets) wb.Workbook.Sheets = []

  for (let day = 1; day <= daysInMonth; day++) {
    const d = `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`
    const tabName = `${String(day).padStart(2,'0')}.${String(month).padStart(2,'0')}`

    const rows = buildDayRows(data.employees, data.departments, entries, absences, d, t)
    const ws = XLSX.utils.aoa_to_sheet(rows)
    ws['!cols'] = COL_WIDTHS
    XLSX.utils.book_append_sheet(wb, ws, tabName)

    const weekIdx = Math.floor((day - 1) / 7)
    const tabColor = WEEK_TAB_COLORS[weekIdx % WEEK_TAB_COLORS.length]
    while (wb.Workbook.Sheets.length < day) wb.Workbook.Sheets.push({})
    wb.Workbook.Sheets[day - 1].tabColor = { rgb: tabColor }
  }

  const ym = `${year}-${String(month).padStart(2,'0')}`
  XLSX.writeFile(wb, `Pianifica_mese_${ym}.xlsx`)
}

function generateMailText(data, date, t, locale) {
  const dateStr = fmtLong(date, locale)
  const sep = '─'.repeat(44)
  const lines = [t('export.mailTitle', { date: dateStr }), '='.repeat(60)]

  for (const emp of data.employees) {
    const dep = data.departments.find((d) => d.id === emp.departmentId)
    const absence = getAbsence(data, date, emp.id)
    const acts = getEntries(data, date, emp.id)
    const total = empDayTotal(data, date, emp.id)

    lines.push('')
    lines.push(`${emp.name} (${emp.role} — ${dep?.name || '—'})`)
    lines.push(sep)

    if (absence) {
      lines.push(t('export.mailAbsence', { type: t(`absence.${absence}.label`) }))
    } else if (acts.length > 0) {
      for (const act of acts) {
        const h = Number(act.hours) || 0
        const note = act.notes ? ` (${act.notes})` : ''
        lines.push(`• ${act.activity}: ${fmtHours(h)}h${note}`)
      }
      lines.push(t('export.mailTotal', { h: fmtHours(total) }))
    } else {
      lines.push(t('export.mailNoActivity'))
    }
  }

  return lines.join('\n')
}

/* --------------------------------------------------------- EXPORT MAIL MODAL */
function ExportMailModal({ data, date, onClose }) {
  const { t, locale } = useI18n()
  const [copied, setCopied] = useState(false)
  const text = useMemo(() => generateMailText(data, date, t, locale), [data, date, t, locale])

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // fallback for older browsers
      const ta = document.createElement('textarea')
      ta.value = text
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const downloadTxt = () => {
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `Pianifica_mail_${date}.txt`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal export-modal">
        <div className="modal-head">
          <div>
            <div className="name">{t('export.mailBtn')}</div>
          </div>
          <button className="x" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body export-mail-body">
          <pre className="mail-preview">{text}</pre>
        </div>
        <div className="modal-foot">
          <button className="btn-icon" onClick={onClose}>{t('modal.cancel')}</button>
          <div className="grow"></div>
          <button className="btn-icon" onClick={downloadTxt}>{t('export.mailDownload')}</button>
          <button className="btn-icon primary" onClick={copyToClipboard}>
            {copied ? t('export.mailCopied') : t('export.mailCopy')}
          </button>
        </div>
      </div>
    </div>
  )
}

/* -------------------------------------------------------- EXPORT EXCEL MODAL */
function ExportExcelModal({ data, date, onClose }) {
  const { t, locale } = useI18n()
  const [mode, setMode] = useState('today')
  const [exporting, setExporting] = useState(false)
  const [errMsg, setErrMsg] = useState('')

  const handleExport = async () => {
    setExporting(true)
    setErrMsg('')
    try {
      if (mode === 'today') await doExportToday(data, t, locale)
      else if (mode === 'week') await doExportWeek(data, date, t, locale)
      else await doExportMonth(data, date, t, locale)
      onClose()
    } catch (err) {
      setErrMsg(err.message || 'Errore export')
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal export-modal">
        <div className="modal-head">
          <div><div className="name">{t('export.excelTitle')}</div></div>
          <button className="x" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <label className="export-option">
            <input type="radio" name="xmode" value="today" checked={mode === 'today'} onChange={() => setMode('today')} />
            <span>{t('export.todayOption')}</span>
          </label>
          <label className="export-option">
            <input type="radio" name="xmode" value="week" checked={mode === 'week'} onChange={() => setMode('week')} />
            <span>{t('export.weekOption')}</span>
          </label>
          <label className="export-option">
            <input type="radio" name="xmode" value="month" checked={mode === 'month'} onChange={() => setMode('month')} />
            <span>{t('export.monthOption')}</span>
          </label>
          {errMsg && <div className="fld-note" style={{ marginTop: 12 }}>{errMsg}</div>}
        </div>
        <div className="modal-foot">
          <div className="grow"></div>
          <button className="btn-icon" onClick={onClose} disabled={exporting}>{t('modal.cancel')}</button>
          <button className="btn-icon primary" onClick={handleExport} disabled={exporting}>
            {exporting ? t('export.exporting') : t('export.exportBtn')}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------- DAY VIEW */
export function DayView({ data, date, onOpen, onPrevDay, satHalfDay }) {
  const { t, locale } = useI18n()
  const groups = employeesByDept(data)
  const total = dayTotalAll(data, date)
  const activeCount = data.employees.filter((e) => empHasDay(data, date, e.id)).length
  const isToday = date === todayISO()
  const sunday = isSunday(date)

  const [showMail, setShowMail] = useState(false)
  const [showExcel, setShowExcel] = useState(false)

  return (
    <div>
      <div className="day-head">
        <div className="day-head-left">
          <h1 className={sunday ? 'sun' : ''}>{fmtLong(date, locale)}</h1>
          {onPrevDay && (
            <button className="btn-icon btn-prevday" onClick={onPrevDay} style={{ fontSize: 12 }}>
              {t('day.prevDay')}
            </button>
          )}
        </div>
        <div className="day-head-right">
          <div className="meta">{t('day.planned', { n: activeCount, h: fmtHours(total) })}</div>
          {isToday && (
            <button className="btn-icon" style={{ fontSize: 12 }} onClick={() => setShowMail(true)}>
              {t('export.mailBtn')}
            </button>
          )}
          <button className="btn-icon" style={{ fontSize: 12 }} onClick={() => setShowExcel(true)}>
            {t('export.excelBtn')}
          </button>
        </div>
      </div>
      {groups.map(({ dep, list }) =>
        list.length === 0 ? null : (
          <div className="dept-block" key={dep.id}>
            <div className="dept-title">
              <span className="swatch" style={{ background: dep.color }}></span>
              <h2>{dep.name}</h2>
              <span className="count">· {list.length}</span>
            </div>
            <div className="emp-grid">
              {list.map((emp) => {
                const acts = getEntries(data, date, emp.id)
                const h = empDayTotal(data, date, emp.id)
                const target = empDayTarget(emp, date, satHalfDay)
                const abs = getEffectiveAbsence(data, date, emp.id)
                const isFired = abs === 'licenziato'
                const regularAbs = isFired ? null : abs
                return (
                  <button
                    key={emp.id}
                    className={'emp-card' + (regularAbs ? ' is-absent' : '') + (isFired ? ' is-fired' : '')}
                    style={{ '--dept': dep.color }}
                    onClick={() => onOpen(emp, dep)}
                  >
                    <div className="who">
                      <span className="avatar" style={{ position: 'relative', overflow: 'hidden' }}>
                        {initials(emp.name)}
                        <AvatarImg emp={emp} />
                      </span>
                      <span>
                        <div className="name">{emp.name}</div>
                        <div className="role">{emp.role}</div>
                      </span>
                    </div>
                    <div className="foot">
                      {isFired ? (
                        <>
                          <span className="abs-tag" style={{ '--chip': LICENZIATO_COLOR }}>
                            <span className="sdot" style={{ background: LICENZIATO_COLOR }}></span>
                            {t('absence.licenziato.label')}
                          </span>
                          <span className="hours zero">—</span>
                        </>
                      ) : regularAbs ? (
                        <>
                          <span className="abs-tag" style={{ '--chip': ABSENCE_TYPES[regularAbs].color }}>
                            <span className="sdot" style={{ background: ABSENCE_TYPES[regularAbs].color }}></span>
                            {t(`absence.${regularAbs}.label`)}
                          </span>
                          <span className="hours zero">—</span>
                        </>
                      ) : (
                        <>
                          <span className="acts">
                            {acts.length === 0
                              ? t('day.noActivity')
                              : `${acts.length} ${acts.length === 1 ? t('day.activity1') : t('day.activityN')}`}
                          </span>
                          <span className={'hours' + (h === 0 ? ' zero' : h === target ? ' ok' : ' warn')}>
                            {h === 0 ? '—' : (
                              <>
                                <b>{fmtHours(h)}</b> h{h !== target && <span className="wdot"></span>}
                              </>
                            )}
                          </span>
                        </>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        )
      )}
      {data.employees.length === 0 && (
        <div className="empty-state">
          <div className="ic">👥</div>
          {t('day.noEmployees')}
        </div>
      )}

      {showMail && <ExportMailModal data={data} date={date} onClose={() => setShowMail(false)} />}
      {showExcel && <ExportExcelModal data={data} date={date} onClose={() => setShowExcel(false)} />}
    </div>
  )
}

/* ------------------------------------------------------------ WEEK VIEW */
export function WeekView({ data, date, onOpenDate, satHalfDay }) {
  const { t, locale } = useI18n()
  const days = weekDays(date)
  const today = todayISO()
  const groups = employeesByDept(data)

  return (
    <div className="grid-scroll">
      <table className="week">
        <thead>
          <tr>
            <th className="col-emp">{t('week.employee')}</th>
            {days.map((d) => (
              <th key={d} className={(d === today ? 'today' : '') + (isSunday(d) ? ' sun' : '')}>
                <div>{fmtWeekday(d, locale)}</div>
                <div className="dn">{fmtDayNum(d)}</div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {groups.map(({ dep, list }) =>
            list.length === 0 ? null : (
              <Fragment key={dep.id}>
                <tr className="dept-row">
                  <td colSpan={8}>
                    <span className="swatch" style={{ background: dep.color }}></span>
                    {dep.name}
                  </td>
                </tr>
                {list.map((emp) => (
                  <tr key={emp.id}>
                    <td className="col-emp">
                      <div className="emp-cell">
                        <span className="ava" style={{ '--dept': dep.color, position: 'relative', overflow: 'hidden' }}>
                          {initials(emp.name)}
                          <AvatarImg emp={emp} />
                        </span>
                        <span>
                          <div className="nm">{emp.name}</div>
                          <div className="rl">{emp.role}</div>
                        </span>
                      </div>
                    </td>
                    {days.map((d) => {
                      const h = empDayTotal(data, d, emp.id)
                      const has = h > 0
                      const abs = getEffectiveAbsence(data, d, emp.id)
                      const isFired = abs === 'licenziato'
                      const regularAbs = isFired ? null : abs
                      const target = empDayTarget(emp, d, satHalfDay)
                      const full = h === target
                      return (
                        <td key={d} className={'hour-cell ' + (isFired || regularAbs ? 'absent' : has ? 'has' : 'empty') + (d === today ? ' today-col' : '') + (isSunday(d) ? ' sun-col' : '')}>
                          <button onClick={() => onOpenDate(emp, dep, d)}>
                            {isFired ? (
                              <span
                                className="cell-abs"
                                style={{ '--chip': LICENZIATO_COLOR }}
                                title={t('absence.licenziato.label')}
                              >
                                {t('absence.licenziato.short')}
                              </span>
                            ) : regularAbs ? (
                              <span
                                className="cell-abs"
                                style={{ '--chip': ABSENCE_TYPES[regularAbs].color }}
                                title={t(`absence.${regularAbs}.label`)}
                              >
                                {t(`absence.${regularAbs}.short`)}
                              </span>
                            ) : has ? (
                              <span
                                className={'hwrap ' + (full ? 'ok' : 'warn')}
                                title={full
                                  ? t('week.full', { h: fmtHours(target) })
                                  : t('week.diff', { h: fmtHours(target) })}
                              >
                                {fmtHours(h)}<span className="hu">h</span>
                                {!full && <span className="wdot"></span>}
                              </span>
                            ) : '+'}
                          </button>
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </Fragment>
            )
          )}
        </tbody>
      </table>
    </div>
  )
}

/* ----------------------------------------------------------- MONTH VIEW */
export function MonthView({ data, date, onPickDay, onChangeMonth }) {
  const { t, locale, dow } = useI18n()
  const cells = monthGrid(date)
  const today = todayISO()
  const max = Math.max(1, ...cells.map((d) => dayTotalAll(data, d)))

  const wrapRef = useRef(null)
  const lock = useRef(false)
  const [dir, setDir] = useState(0)

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const handler = (e) => {
      e.preventDefault()
      if (lock.current) return
      if (Math.abs(e.deltaY) < 6) return
      lock.current = true
      const d = e.deltaY > 0 ? 1 : -1
      setDir(d)
      onChangeMonth(d)
      setTimeout(() => { lock.current = false }, 430)
    }
    el.addEventListener('wheel', handler, { passive: false })
    return () => el.removeEventListener('wheel', handler)
  }, [onChangeMonth])

  const monthKey = fromISO(date).getFullYear() + '-' + fromISO(date).getMonth()

  return (
    <div className="month-scroll" ref={wrapRef}>
      <div className="cal-hint">
        <span className="chev">⌃</span> {t('month.scroll')} <span className="chev">⌄</span>
      </div>
      <div className={'cal ' + (dir > 0 ? 'slide-up' : dir < 0 ? 'slide-down' : '')} key={monthKey}>
        {dow.map((d, i) => <div className={'dow' + (i === 6 ? ' sun' : '')} key={d}>{d}</div>)}
        {cells.map((d) => {
          const tot = dayTotalAll(data, d)
          const dim = !sameMonth(d, date)
          const count = data.employees.filter((e) => empHasDay(data, d, e.id)).length
          return (
            <button
              key={d}
              className={'cell' + (dim ? ' dim' : '') + (d === today ? ' today' : '') + (isSunday(d) ? ' sun-cell' : '')}
              onClick={() => onPickDay(d)}
            >
              <div className={'dn' + (isSunday(d) ? ' sun' : '')}>{fmtDayNum(d)}</div>
              {tot > 0 && (
                <>
                  <div className="tot">{fmtHours(tot)} <span>h</span></div>
                  <div className="sub">{count} {count === 1 ? t('month.person1') : t('month.personN')}</div>
                </>
              )}
              <div className="bar" style={{ '--intensity': tot > 0 ? 0.25 + 0.75 * (tot / max) : 0 }}></div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------ YEAR VIEW */
export function YearView({ data, date, onPickDay }) {
  const { t, locale, dow } = useI18n()
  const year = fromISO(date).getFullYear()
  const today = todayISO()
  const months = Array.from({ length: 12 }, (_, m) => `${year}-${String(m + 1).padStart(2, '0')}-01`)
  let max = 1
  for (const k of Object.keys(data.entries)) {
    if (fromISO(k).getFullYear() === year) max = Math.max(max, dayTotalAll(data, k))
  }

  return (
    <div className="year">
      {months.map((m0) => {
        const cells = monthGrid(m0)
        return (
          <div className="mini" key={m0}>
            <h3>{fromISO(m0).toLocaleDateString(locale, { month: 'long' })}</h3>
            <div className="mg">
              {dow.map((d, i) => (
                <div className={'md blank' + (i === 6 ? ' sun' : '')} key={'h' + d} style={{ fontSize: 9, color: i === 6 ? 'var(--sun-color)' : 'var(--faint)' }}>{d[0]}</div>
              ))}
              {cells.map((d) => {
                const inMonth = sameMonth(d, m0)
                if (!inMonth) return <div className="md blank" key={d}></div>
                const tot = dayTotalAll(data, d)
                const has = tot > 0
                const sun = isSunday(d)
                const style = has
                  ? { background: `oklch(0.55 0.13 255 / ${0.3 + 0.7 * (tot / max)})` }
                  : {}
                return (
                  <div
                    key={d}
                    className={'md in' + (has ? ' has' : '') + (d === today ? ' today' : '') + (sun ? ' sun' : '')}
                    style={style}
                    title={has ? t('year.hours', { h: fmtHours(tot) }) : ''}
                    onClick={() => onPickDay(d)}
                  >
                    {fmtDayNum(d)}
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}

/* --------------------------------------------------------- ACTIVITY MODAL */
const emptyRow = () => ({ id: uid(), activity: '', hours: '', notes: '' })
const isBlank = (r) => !(r.activity || '').trim() && !(r.notes || '').trim() && !String(r.hours).trim()
const withTrailing = (list) => {
  const filled = list.filter((r) => !isBlank(r))
  return [...filled, emptyRow()]
}

export function ActivityModal({ data, ctx, onSave, onClose, satHalfDay }) {
  const { t, locale } = useI18n()
  const { emp, dep, date } = ctx

  // Date navigation — only available when modal opened for today
  const [modalDate, setModalDate] = useState(date)
  const [navLoading, setNavLoading] = useState(false)
  const today = todayISO()
  const yesterday = addDays(today, -1)
  const isReadOnly = modalDate !== date        // navigated dates are read-only
  const canNavPrev = date === today && modalDate === today      // today → yesterday
  const canNavNext = date === today && modalDate === yesterday  // yesterday → today

  const [localAbsence, setLocalAbsence] = useState(() => getAbsence(data, date, emp.id))
  const [rows, setRows] = useState(() => withTrailing(getEntries(data, date, emp.id)))
  const [localTerminated, setLocalTerminated] = useState(emp.terminated_from || null)
  const [saving, setSaving] = useState(false)

  // Is the employee terminated on the currently viewed date?
  const isLicenziato = !!(localTerminated && modalDate >= localTerminated)

  // Target hours for the current modal date
  const target = empDayTarget(emp, modalDate, satHalfDay)

  const navigateTo = async (newDate) => {
    setNavLoading(true)
    try {
      const { entries, absences } = await api.getEntries(newDate, newDate)
      setLocalAbsence((absences[newDate] && absences[newDate][emp.id]) || null)
      setRows(withTrailing((entries[newDate] && entries[newDate][emp.id]) || []))
      setModalDate(newDate)
    } catch {
      // silently keep current date
    } finally {
      setNavLoading(false)
    }
  }

  const apply = (list) => setRows(withTrailing(list))
  const editRow = (id, field, val) => apply(rows.map((r) => (r.id === id ? { ...r, [field]: val } : r)))
  const delRow = (id) => apply(rows.filter((r) => r.id !== id))
  const onHours = (id, raw) => {
    let v = raw.replace(',', '.').replace(/[^\d.]/g, '')
    const parts = v.split('.')
    if (parts.length > 2) v = parts[0] + '.' + parts[1]
    if (v.includes('.')) v = v.split('.')[0] + '.' + (v.split('.')[1] || '').slice(0, 1)
    editRow(id, 'hours', v)
  }

  const handleDone = async () => {
    setSaving(true)
    const activities = rows.filter((r) => !isBlank(r)).map((r) => ({
      id: r.id, activity: r.activity, hours: Number(r.hours) || 0, notes: r.notes || '',
    }))
    const terminatedChanged = localTerminated !== (emp.terminated_from || null)
    await onSave(emp.id, date, activities, localAbsence, terminatedChanged ? localTerminated : undefined)
  }

  const total = rows.reduce((s, r) => s + (Number(r.hours) || 0), 0)
  const visibleRows = (localAbsence || isLicenziato) ? rows.filter((r) => !isBlank(r)) : rows
  const totalClass = total === 0 ? '' : total === target ? 'total-ok' : total > target ? 'total-over' : 'total-under'

  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ '--dept': dep.color }}>
        <div className="modal-head">
          <span className="avatar" style={{ position: 'relative', overflow: 'hidden' }}>
            {initials(emp.name)}
            <AvatarImg emp={emp} />
          </span>
          <div style={{ flex: 1 }}>
            <div className="name">{emp.name}</div>
            <div className="sub">{emp.role} · {dep.name} · {fmtLong(modalDate, locale)}</div>
          </div>
          {(canNavPrev || canNavNext || isReadOnly) && (
            <div className="modal-nav">
              <button
                className="modal-nav-btn"
                onClick={() => navigateTo(yesterday)}
                disabled={!canNavPrev || navLoading}
                style={{ visibility: canNavPrev ? 'visible' : 'hidden' }}
                title={t('modal.prevDay')}
              >◀</button>
              {isReadOnly && <span className="modal-readonly-badge">{t('modal.readOnly')}</span>}
              <button
                className="modal-nav-btn"
                onClick={() => navigateTo(today)}
                disabled={!canNavNext || navLoading}
                style={{ visibility: canNavNext ? 'visible' : 'hidden' }}
                title={t('nav.today')}
              >▶</button>
            </div>
          )}
          <button className="x" onClick={onClose}>✕</button>
        </div>

        <div className="status-bar">
          <button
            className={'status-chip' + (!localAbsence && !isLicenziato ? ' active' : '')}
            onClick={() => !isReadOnly && setLocalAbsence(null)}
            disabled={isReadOnly}
          >
            <span className="sdot" style={{ background: 'var(--accent)' }}></span>{t('modal.present')}
          </button>
          {Object.entries(ABSENCE_TYPES).map(([key, at]) => (
            <button
              key={key}
              className={'status-chip' + (localAbsence === key && !isLicenziato ? ' active' : '')}
              style={{ '--chip': at.color }}
              onClick={() => !isReadOnly && setLocalAbsence(localAbsence === key ? null : key)}
              disabled={isReadOnly}
            >
              <span className="sdot" style={{ background: at.color }}></span>{t(`absence.${key}.label`)}
            </button>
          ))}
          {!isReadOnly && (
            <button
              className={'status-chip' + (isLicenziato ? ' active' : '')}
              style={{ '--chip': LICENZIATO_COLOR }}
              onClick={() => {
                if (isLicenziato) {
                  setLocalTerminated(null)
                } else {
                  setLocalTerminated(date)
                  setLocalAbsence(null)
                }
              }}
            >
              <span className="sdot" style={{ background: LICENZIATO_COLOR }}></span>{t('modal.dismissed')}
            </button>
          )}
          {isReadOnly && isLicenziato && (
            <span className="status-chip active" style={{ '--chip': LICENZIATO_COLOR }}>
              <span className="sdot" style={{ background: LICENZIATO_COLOR }}></span>{t('modal.dismissed')}
            </span>
          )}
        </div>

        <div className="modal-body">
          {isLicenziato ? (
            <div className="absence-note" style={{ '--chip': LICENZIATO_COLOR }}>
              <span className="big">{t('modal.dismissed')}</span>
              {localTerminated && (
                <span style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>
                  {t('modal.dismissedFrom', { date: fmtLong(localTerminated, locale) })}
                </span>
              )}
            </div>
          ) : localAbsence ? (
            <div className="absence-note" style={{ '--chip': ABSENCE_TYPES[localAbsence].color }}>
              <span className="big">{t(`absence.${localAbsence}.label`)}</span>
            </div>
          ) : (
            <>
              <div className="act-head">
                <div>{t('modal.activityLabel')}</div>
                <div style={{ textAlign: 'right' }}>{t('modal.hoursLabel')}</div>
                <div>{t('modal.notesLabel')}</div>
                <div></div>
              </div>
              <div className="act-table">
                {visibleRows.map((r, i) => {
                  const trailing = i === visibleRows.length - 1 && isBlank(r)
                  return (
                    <div className={'act-row' + (trailing ? ' ghost' : '')} key={r.id}>
                      <textarea
                        rows={1}
                        placeholder={trailing ? t('modal.newActivity') : t('modal.activityDesc')}
                        value={r.activity}
                        onChange={(e) => !isReadOnly && editRow(r.id, 'activity', e.target.value)}
                        readOnly={isReadOnly}
                      />
                      <input
                        inputMode="decimal"
                        placeholder="0.0"
                        value={r.hours}
                        onChange={(e) => !isReadOnly && onHours(r.id, e.target.value)}
                        readOnly={isReadOnly}
                      />
                      <textarea
                        rows={1}
                        placeholder={t('modal.notesOpt')}
                        value={r.notes}
                        onChange={(e) => !isReadOnly && editRow(r.id, 'notes', e.target.value)}
                        readOnly={isReadOnly}
                      />
                      {trailing || isReadOnly ? (
                        <span className="del-spacer"></span>
                      ) : (
                        <button className="del" onClick={() => delRow(r.id)} title={t('modal.deleteRow')}>✕</button>
                      )}
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </div>

        <div className="modal-foot">
          <div className={'total' + (totalClass ? ' ' + totalClass : '')}>
            {t('modal.totalHours')} <b>{fmtHours(total)}</b>
          </div>
          <div className="grow"></div>
          <button className="btn-icon" onClick={onClose} disabled={saving}>{t('modal.cancel')}</button>
          {!isReadOnly && (
            <button className="btn-icon primary" onClick={handleDone} disabled={saving}>
              {saving ? t('modal.saving') : t('modal.done')}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
