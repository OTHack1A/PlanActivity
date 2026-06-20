import { useState, useMemo, useRef, useEffect, Fragment } from 'react'
import {
  todayISO, addDays, addMonths, fromISO,
  fmtLong, fmtMonthYear, fmtWeekday, fmtDayNum,
  startOfWeek, weekDays, monthGrid, sameMonth,
  uid, DEPT_COLORS,
  getEntries, empDayTotal, empHasDay, dayTotalAll, employeesByDept, fmtHours,
  ABSENCE_TYPES, getAbsence,
} from './store.js'

const initials = (name) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('')

export { initials }

const DOW = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom']
const STD_HOURS = 8
const empTarget = (emp) => STD_HOURS + (Number(emp && emp.overtime) || 0)

/* ---------------------------------------------------------------- AVATAR */
// Mostra la foto profilo se disponibile, altrimenti le iniziali.
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
  const today = todayISO()
  const step = (dir) => {
    if (view === 'day') setDate(addDays(date, dir))
    else if (view === 'week') setDate(addDays(date, dir * 7))
    else if (view === 'month') setDate(addMonths(date, dir))
    else setDate(addMonths(date, dir * 12))
  }
  let label = ''
  if (view === 'day') label = fmtLong(date)
  else if (view === 'week') {
    const w = weekDays(date)
    const a = fromISO(w[0]), b = fromISO(w[6])
    const fmt = (d, opts) => d.toLocaleDateString('it-IT', opts)
    label = `${fmt(a, { day: 'numeric', month: 'short' })} – ${fmt(b, { day: 'numeric', month: 'short', year: 'numeric' })}`
  } else if (view === 'month') label = fmtMonthYear(date)
  else label = String(fromISO(date).getFullYear())

  return (
    <div className="topbar">
      <div className="brand"><span className="dot"></span><span>Pianifica</span></div>
      {page === 'calendar' && (
        <>
          <div className="tabs">
            {[['day', 'Giorno'], ['week', 'Settimana'], ['month', 'Mese'], ['year', 'Anno']].map(
              ([v, t]) => (
                <button key={v} className={view === v ? 'active' : ''} onClick={() => setView(v)}>{t}</button>
              )
            )}
          </div>
          <div className="nav">
            <button className="arrow" onClick={() => step(-1)} aria-label="Precedente">‹</button>
            <button className="btn-today" onClick={onToday}>Oggi</button>
            <button className="arrow" onClick={() => step(1)} aria-label="Successivo">›</button>
          </div>
          <div className="date-label">{label}</div>
        </>
      )}
      <div className="spacer"></div>
      {company && (
        <div className="company-id">
          <img src="/logo.jpg" alt="" className="company-logo" />
          <span className="company-name">{company}</span>
        </div>
      )}
      {page === 'calendar' ? (
        <>
          <button className="btn-icon" onClick={onSettings}>⚙ Impostazioni</button>
          <button className="btn-icon" onClick={onLog}>≡ Log</button>
          <button className="btn-icon" onClick={onAccount}>◉ Account</button>
        </>
      ) : (
        <button className="btn-icon" onClick={onCalendar}>‹ Torna al calendario</button>
      )}
      <button className="btn-icon ghost" onClick={onLogout} title="Esci dal sistema">⎋ Esci</button>
    </div>
  )
}

/* ------------------------------------------------------------- DAY VIEW */
export function DayView({ data, date, onOpen }) {
  const groups = employeesByDept(data)
  const total = dayTotalAll(data, date)
  const activeCount = data.employees.filter((e) => empHasDay(data, date, e.id)).length

  return (
    <div>
      <div className="day-head">
        <h1>{fmtLong(date)}</h1>
        <div className="meta">
          <b>{activeCount}</b> dipendenti pianificati · totale <b>{fmtHours(total)} h</b>
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
                const target = empTarget(emp)
                const abs = getAbsence(data, date, emp.id)
                return (
                  <button
                    key={emp.id}
                    className={'emp-card' + (abs ? ' is-absent' : '')}
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
                      {abs ? (
                        <>
                          <span className="abs-tag" style={{ '--chip': ABSENCE_TYPES[abs].color }}>
                            <span className="sdot" style={{ background: ABSENCE_TYPES[abs].color }}></span>
                            {ABSENCE_TYPES[abs].label}
                          </span>
                          <span className="hours zero">—</span>
                        </>
                      ) : (
                        <>
                          <span className="acts">
                            {acts.length === 0 ? 'Nessuna attività' : `${acts.length} attività`}
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
          Nessun dipendente. Aggiungili dalle Impostazioni.
        </div>
      )}
    </div>
  )
}

/* ------------------------------------------------------------ WEEK VIEW */
export function WeekView({ data, date, onOpenDate }) {
  const days = weekDays(date)
  const today = todayISO()
  const groups = employeesByDept(data)

  return (
    <div className="grid-scroll">
      <table className="week">
        <thead>
          <tr>
            <th className="col-emp">Dipendente</th>
            {days.map((d) => (
              <th key={d} className={d === today ? 'today' : ''}>
                <div>{fmtWeekday(d)}</div>
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
                      const abs = getAbsence(data, d, emp.id)
                      const target = empTarget(emp)
                      const full = h === target
                      return (
                        <td key={d} className={'hour-cell ' + (abs ? 'absent' : has ? 'has' : 'empty') + (d === today ? ' today-col' : '')}>
                          <button onClick={() => onOpenDate(emp, dep, d)}>
                            {abs ? (
                              <span className="cell-abs" style={{ '--chip': ABSENCE_TYPES[abs].color }} title={ABSENCE_TYPES[abs].label}>
                                {ABSENCE_TYPES[abs].short}
                              </span>
                            ) : has ? (
                              <span className={'hwrap ' + (full ? 'ok' : 'warn')} title={full ? `Giornata completa (${fmtHours(target)} h)` : `Diverso da ${fmtHours(target)} h previste`}>
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
        <span className="chev">⌃</span> Scorri per cambiare mese <span className="chev">⌄</span>
      </div>
      <div className={'cal ' + (dir > 0 ? 'slide-up' : dir < 0 ? 'slide-down' : '')} key={monthKey}>
        {DOW.map((d) => <div className="dow" key={d}>{d}</div>)}
        {cells.map((d) => {
          const tot = dayTotalAll(data, d)
          const dim = !sameMonth(d, date)
          const count = data.employees.filter((e) => empHasDay(data, d, e.id)).length
          return (
            <button
              key={d}
              className={'cell' + (dim ? ' dim' : '') + (d === today ? ' today' : '')}
              onClick={() => onPickDay(d)}
            >
              <div className="dn">{fmtDayNum(d)}</div>
              {tot > 0 && (
                <>
                  <div className="tot">{fmtHours(tot)} <span>h</span></div>
                  <div className="sub">{count} {count === 1 ? 'persona' : 'persone'}</div>
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
            <h3>{fromISO(m0).toLocaleDateString('it-IT', { month: 'long' })}</h3>
            <div className="mg">
              {DOW.map((d) => (
                <div className="md blank" key={'h' + d} style={{ fontSize: 9, color: 'var(--faint)' }}>{d[0]}</div>
              ))}
              {cells.map((d) => {
                const inMonth = sameMonth(d, m0)
                if (!inMonth) return <div className="md blank" key={d}></div>
                const tot = dayTotalAll(data, d)
                const has = tot > 0
                const style = has
                  ? { background: `oklch(0.55 0.13 255 / ${0.3 + 0.7 * (tot / max)})` }
                  : {}
                return (
                  <div
                    key={d}
                    className={'md in' + (has ? ' has' : '') + (d === today ? ' today' : '')}
                    style={style}
                    title={has ? `${fmtHours(tot)} h pianificate` : ''}
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

// Props: data, ctx { emp, dep, date }, onSave(empId, date, activities, absenceType), onClose
export function ActivityModal({ data, ctx, onSave, onClose }) {
  const { emp, dep, date } = ctx
  const [localAbsence, setLocalAbsence] = useState(() => getAbsence(data, date, emp.id))
  const [rows, setRows] = useState(() => withTrailing(getEntries(data, date, emp.id)))
  const [saving, setSaving] = useState(false)

  const apply = (list) => setRows(withTrailing(list))

  const editRow = (id, field, val) =>
    apply(rows.map((r) => (r.id === id ? { ...r, [field]: val } : r)))
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
      id: r.id,
      activity: r.activity,
      hours: Number(r.hours) || 0,
      notes: r.notes || '',
    }))
    await onSave(emp.id, date, activities, localAbsence)
  }

  const total = rows.reduce((s, r) => s + (Number(r.hours) || 0), 0)
  const visibleRows = localAbsence ? rows.filter((r) => !isBlank(r)) : rows

  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ '--dept': dep.color }}>
        <div className="modal-head">
          <span className="avatar" style={{ position: 'relative', overflow: 'hidden' }}>
            {initials(emp.name)}
            <AvatarImg emp={emp} />
          </span>
          <div>
            <div className="name">{emp.name}</div>
            <div className="sub">{emp.role} · {dep.name} · {fmtLong(date)}</div>
          </div>
          <button className="x" onClick={onClose}>✕</button>
        </div>

        <div className="status-bar">
          <button
            className={'status-chip' + (!localAbsence ? ' active' : '')}
            onClick={() => setLocalAbsence(null)}
          >
            <span className="sdot" style={{ background: 'var(--accent)' }}></span>Presente
          </button>
          {Object.entries(ABSENCE_TYPES).map(([key, t]) => (
            <button
              key={key}
              className={'status-chip' + (localAbsence === key ? ' active' : '')}
              style={{ '--chip': t.color }}
              onClick={() => setLocalAbsence(localAbsence === key ? null : key)}
            >
              <span className="sdot" style={{ background: t.color }}></span>{t.label}
            </button>
          ))}
        </div>

        <div className="modal-body">
          {localAbsence ? (
            <div className="absence-note" style={{ '--chip': ABSENCE_TYPES[localAbsence].color }}>
              <span className="big">{ABSENCE_TYPES[localAbsence].label}</span>
            </div>
          ) : (
            <>
              <div className="act-head">
                <div>Attività</div>
                <div style={{ textAlign: 'right' }}>Ore previste</div>
                <div>Note</div>
                <div></div>
              </div>
              <div className="act-table">
                {visibleRows.map((r, i) => {
                  const trailing = i === visibleRows.length - 1 && isBlank(r)
                  return (
                    <div className={'act-row' + (trailing ? ' ghost' : '')} key={r.id}>
                      <textarea
                        rows={1}
                        placeholder={trailing ? 'Nuova attività…' : 'Descrizione attività…'}
                        value={r.activity}
                        onChange={(e) => editRow(r.id, 'activity', e.target.value)}
                      />
                      <input
                        inputMode="decimal"
                        placeholder="0.0"
                        value={r.hours}
                        onChange={(e) => onHours(r.id, e.target.value)}
                      />
                      <textarea
                        rows={1}
                        placeholder="Note (facoltativo)"
                        value={r.notes}
                        onChange={(e) => editRow(r.id, 'notes', e.target.value)}
                      />
                      {trailing ? (
                        <span className="del-spacer"></span>
                      ) : (
                        <button className="del" onClick={() => delRow(r.id)} title="Elimina riga">✕</button>
                      )}
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </div>

        <div className="modal-foot">
          <div className="total">
            Totale ore previste: <b>{fmtHours(total)}</b>
          </div>
          <div className="grow"></div>
          <button className="btn-icon" onClick={onClose} disabled={saving}>Annulla</button>
          <button className="btn-icon primary" onClick={handleDone} disabled={saving}>
            {saving ? 'Salvo…' : 'Fatto'}
          </button>
        </div>
      </div>
    </div>
  )
}
