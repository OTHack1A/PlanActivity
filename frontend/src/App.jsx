import { useState, useEffect, useCallback } from 'react'
import {
  todayISO, addMonths, DEPT_COLORS, ABSENCE_TYPES,
  viewRange, startOfWeek, addDays,
} from './store.js'
import * as api from './api.js'
import { Topbar, DayView, WeekView, MonthView, YearView, ActivityModal } from './components.jsx'

// ---------------------------------------------------------------------------
// Campo password "stile Linux": nessun carattere visibile mentre si digita
// ---------------------------------------------------------------------------
function PwInput({ value, onChange, className, autoFocus }) {
  const onKey = (e) => {
    if (e.key === 'Enter' || e.key === 'Tab' || e.key === 'Escape') return
    if (e.metaKey || e.ctrlKey || e.altKey) return
    if (e.key === 'Backspace') { e.preventDefault(); onChange(value.slice(0, -1)) }
    else if (e.key.length === 1) { e.preventDefault(); onChange(value + e.key) }
  }
  const onPaste = (e) => {
    e.preventDefault()
    const t = (e.clipboardData || window.clipboardData).getData('text') || ''
    if (t) onChange(value + t)
  }
  return (
    <input
      type="text"
      value=""
      onChange={() => {}}
      onKeyDown={onKey}
      onPaste={onPaste}
      className={className}
      autoFocus={autoFocus}
      autoComplete="off"
      autoCapitalize="off"
      autoCorrect="off"
      spellCheck={false}
    />
  )
}

// ---------------------------------------------------------------------------
// Register
// ---------------------------------------------------------------------------
function Register({ onRegister }) {
  const [user, setUser] = useState('')
  const [pass, setPass] = useState('')
  const [pass2, setPass2] = useState('')
  const [error, setError] = useState('')

  const mismatch = pass2.length > 0 && pass !== pass2
  const valid = user.trim().length > 0 && pass.length > 0 && pass === pass2

  const submit = async (e) => {
    e.preventDefault()
    if (!valid) return
    try {
      const { access_token } = await api.register(user.trim(), pass)
      api.setToken(access_token)
      onRegister()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div className="login-screen">
      <div className="login-grid"></div>
      <form className="login-card" onSubmit={submit}>
        <div className="login-brand"><span className="dot"></span><span>PIANIFICA</span></div>
        <h1>Crea il tuo account</h1>
        <p className="login-lead">Imposta le credenziali per accedere al sistema.</p>
        <label className="fld">
          <span>Utente</span>
          <input autoFocus value={user} onChange={(e) => setUser(e.target.value)} autoComplete="username" />
        </label>
        <label className="fld">
          <span>Password</span>
          <PwInput value={pass} onChange={setPass} />
        </label>
        <label className="fld">
          <span>Ripeti password</span>
          <PwInput value={pass2} onChange={setPass2} className={mismatch ? 'bad' : ''} />
        </label>
        {mismatch && <div className="fld-note">Le password non coincidono.</div>}
        {error && <div className="fld-note">{error}</div>}
        <button type="submit" className="login-btn" disabled={!valid}>Registra →</button>
      </form>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Login
// ---------------------------------------------------------------------------
function Login({ onLogin }) {
  const [user, setUser] = useState('')
  const [pass, setPass] = useState('')
  const [shake, setShake] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    try {
      const { access_token } = await api.login(user.trim(), pass)
      api.setToken(access_token)
      onLogin()
    } catch {
      setUser('')
      setPass('')
      setShake(true)
      setTimeout(() => setShake(false), 600)
    }
  }

  return (
    <div className="login-screen">
      <div className="login-grid"></div>
      <form className={'login-card' + (shake ? ' shake' : '')} onSubmit={submit}>
        <div className="login-brand"><span className="dot"></span><span>PIANIFICA</span></div>
        <h1>Accesso al sistema</h1>
        <p className="login-lead">Inserisci le credenziali per continuare.</p>
        <label className="fld">
          <span>Utente</span>
          <input autoFocus value={user} onChange={(e) => setUser(e.target.value)} autoComplete="username" />
        </label>
        <label className="fld">
          <span>Password</span>
          <PwInput value={pass} onChange={setPass} />
        </label>
        <button type="submit" className="login-btn">Entra nel sistema →</button>
      </form>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Account (cambio password)
// ---------------------------------------------------------------------------
function Account({ onBack }) {
  const [oldP, setOldP] = useState('')
  const [np, setNp] = useState('')
  const [np2, setNp2] = useState('')
  const [msg, setMsg] = useState(null)

  const mismatch = np2.length > 0 && np !== np2
  const valid = oldP.length > 0 && np.length > 0 && np === np2

  const submit = async (e) => {
    e.preventDefault()
    try {
      await api.changePassword(oldP, np)
      setOldP(''); setNp(''); setNp2('')
      setMsg({ ok: true, text: 'Password aggiornata correttamente.' })
    } catch (err) {
      setMsg({ ok: false, text: err.message })
    }
  }

  return (
    <div className="wrap settings">
      <h1>Account</h1>
      <form className="panel account-panel" onSubmit={submit}>
        <h2>Cambia password</h2>
        <label className="fld">
          <span>Password attuale</span>
          <PwInput value={oldP} onChange={(v) => { setOldP(v); setMsg(null) }} />
        </label>
        <label className="fld">
          <span>Nuova password</span>
          <PwInput value={np} onChange={(v) => { setNp(v); setMsg(null) }} />
        </label>
        <label className="fld">
          <span>Ripeti nuova password</span>
          <PwInput value={np2} onChange={(v) => { setNp2(v); setMsg(null) }} className={mismatch ? 'bad' : ''} />
        </label>
        {mismatch && <div className="fld-note">Le password non coincidono.</div>}
        {msg && <div className={'acc-msg ' + (msg.ok ? 'ok' : 'err')}>{msg.text}</div>}
        <button type="submit" className="login-btn" disabled={!valid} style={{ marginTop: 8 }}>
          Aggiorna password
        </button>
      </form>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------
function Settings({ data, onReload }) {
  const [depName, setDepName] = useState('')
  const [depColor, setDepColor] = useState(
    DEPT_COLORS[data.departments.length % DEPT_COLORS.length]
  )
  const [empName, setEmpName] = useState('')
  const [empRole, setEmpRole] = useState('')
  const [empDep, setEmpDep] = useState(data.departments[0]?.id || '')

  // Stato locale per editing inline dipendenti (flush su onBlur)
  const [empEdits, setEmpEdits] = useState({})
  const getEmpVal = (emp, field) => empEdits[emp.id]?.[field] ?? emp[field]
  const onEmpChange = (id, field, val) =>
    setEmpEdits((prev) => ({ ...prev, [id]: { ...prev[id], [field]: val } }))
  const onEmpBlur = async (id, field) => {
    const val = empEdits[id]?.[field]
    if (val === undefined) return
    await api.patchEmployee(id, { [field]: val })
    await onReload('employees')
    setEmpEdits((prev) => {
      const next = { ...prev }
      if (next[id]) { delete next[id][field]; if (!Object.keys(next[id]).length) delete next[id] }
      return next
    })
  }

  const addDep = async () => {
    const name = depName.trim()
    if (!name) return
    await api.createDepartment(name, depColor)
    setDepName('')
    setDepColor(DEPT_COLORS[(data.departments.length + 1) % DEPT_COLORS.length])
    await onReload('departments')
  }

  const removeDep = async (id) => {
    const count = data.employees.filter((e) => e.departmentId === id).length
    if (count > 0 && !confirm(`Eliminando questo reparto verranno eliminati anche ${count} dipendenti e le relative attività. Procedere?`))
      return
    await api.deleteDepartment(id)
    await onReload('all')
  }

  const addEmp = async () => {
    const name = empName.trim()
    if (!name || !empDep) return
    await api.createEmployee({ name, role: empRole.trim() || '—', departmentId: empDep, overtime: '' })
    setEmpName(''); setEmpRole('')
    await onReload('employees')
  }

  const onOvertime = (id, raw) => {
    let v = String(raw).replace(',', '.').replace(/[^\d.]/g, '')
    const parts = v.split('.')
    if (parts.length > 2) v = parts[0] + '.' + parts[1]
    if (v.includes('.')) v = v.split('.')[0] + '.' + (v.split('.')[1] || '').slice(0, 1)
    onEmpChange(id, 'overtime', v)
  }

  const removeEmp = async (id) => {
    await api.deleteEmployee(id)
    await onReload('employees')
  }

  const depById = (id) => data.departments.find((x) => x.id === id)

  // Sincronizza empDep se la lista reparti cambia
  useEffect(() => {
    if (!empDep && data.departments[0]) setEmpDep(data.departments[0].id)
  }, [data.departments])

  return (
    <div className="wrap settings">
      <h1>Impostazioni</h1>
      <div className="set-cols">
        {/* REPARTI */}
        <div className="panel">
          <h2>Reparti</h2>
          {data.departments.map((dep) => {
            const count = data.employees.filter((e) => e.departmentId === dep.id).length
            return (
              <div className="dep-item" key={dep.id}>
                <span className="swatch" style={{ background: dep.color }}></span>
                <span className="nm">{dep.name}</span>
                <span className="cnt">{count}</span>
                <button className="rm" onClick={() => removeDep(dep.id)} title="Elimina reparto">✕</button>
              </div>
            )
          })}
          {data.departments.length === 0 && (
            <div style={{ color: 'var(--faint)', fontSize: 13 }}>Nessun reparto.</div>
          )}
          <div className="row-add">
            <input
              placeholder="Nuovo reparto…"
              value={depName}
              onChange={(e) => setDepName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addDep()}
            />
            <button onClick={addDep} disabled={!depName.trim()}>Aggiungi</button>
          </div>
          <div className="color-pick">
            <span className="color-pick-lbl">Colore</span>
            <div className="swatches">
              {DEPT_COLORS.map((c) => (
                <button
                  key={c} type="button"
                  className={'sw' + (depColor === c ? ' sel' : '')}
                  style={{ background: c }}
                  onClick={() => setDepColor(c)}
                  title="Scegli colore"
                ></button>
              ))}
            </div>
          </div>
        </div>

        {/* DIPENDENTI */}
        <div className="panel">
          <h2>Dipendenti</h2>
          {data.employees.length > 0 && (
            <div className="emp-list-head">
              <span>Dipendente · reparto</span>
              <span className="ot-head">Straordinario (h)</span>
            </div>
          )}
          <div className="emp-list">
            {data.employees.map((emp) => {
              const dep = depById(emp.departmentId)
              return (
                <div className="emp-row" key={emp.id}>
                  <span className="ava" style={{ background: dep ? dep.color : 'var(--faint)' }}>
                    {emp.name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('')}
                  </span>
                  <span className="emp-id">
                    <input
                      className="emp-edit nm"
                      value={getEmpVal(emp, 'name')}
                      placeholder="Nome e cognome"
                      onChange={(e) => onEmpChange(emp.id, 'name', e.target.value)}
                      onBlur={() => onEmpBlur(emp.id, 'name')}
                    />
                    <input
                      className="emp-edit rl"
                      value={getEmpVal(emp, 'role')}
                      placeholder="Mansione"
                      onChange={(e) => onEmpChange(emp.id, 'role', e.target.value)}
                      onBlur={() => onEmpBlur(emp.id, 'role')}
                    />
                  </span>
                  <span className="tag">{dep ? dep.name : '—'}</span>
                  <input
                    className="ot-input"
                    inputMode="decimal"
                    placeholder="0.0"
                    value={getEmpVal(emp, 'overtime') || ''}
                    onChange={(e) => onOvertime(emp.id, e.target.value)}
                    onBlur={() => onEmpBlur(emp.id, 'overtime')}
                    title="Ore di straordinario"
                  />
                  <button className="rm" onClick={() => removeEmp(emp.id)} title="Elimina dipendente">✕</button>
                </div>
              )
            })}
            {data.employees.length === 0 && (
              <div style={{ color: 'var(--faint)', fontSize: 13 }}>Nessun dipendente.</div>
            )}
          </div>

          <div className="emp-add">
            <input placeholder="Nome e cognome" value={empName} onChange={(e) => setEmpName(e.target.value)} />
            <input placeholder="Mansione" value={empRole} onChange={(e) => setEmpRole(e.target.value)} />
            <select value={empDep} onChange={(e) => setEmpDep(e.target.value)}>
              {data.departments.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
            <button onClick={addEmp} disabled={!empName.trim() || !empDep}>Aggiungi</button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// App principale
// ---------------------------------------------------------------------------
export default function App() {
  // 'loading' | 'register' | 'login' | 'app'
  const [screen, setScreen] = useState('loading')
  const [data, setData] = useState({ departments: [], employees: [], entries: {}, absences: {} })
  const [page, setPage] = useState('calendar')
  const [view, setView] = useState('day')
  const [date, setDate] = useState(todayISO)
  const [modal, setModal] = useState(null)

  // Carica entries + absences per il range visibile
  const loadEntries = useCallback(async (v, d) => {
    const { from, to } = viewRange(v, d)
    try {
      const { entries, absences } = await api.getEntries(from, to)
      setData((prev) => ({ ...prev, entries, absences }))
    } catch (err) {
      if (err.status === 401) { api.setToken(''); setScreen('login') }
    }
  }, [])

  // Carica reparti + dipendenti
  const loadDeptEmps = useCallback(async () => {
    const [depts, emps] = await Promise.all([api.getDepartments(), api.getEmployees()])
    setData((prev) => ({ ...prev, departments: depts, employees: emps }))
  }, [])

  // Ricarica selettiva dopo una mutazione
  const onReload = useCallback(async (what) => {
    if (what === 'all' || what === 'departments') {
      const depts = await api.getDepartments()
      setData((prev) => ({ ...prev, departments: depts }))
    }
    if (what === 'all' || what === 'employees') {
      const emps = await api.getEmployees()
      setData((prev) => ({ ...prev, employees: emps }))
    }
    if (what === 'all' || what === 'entries') {
      await loadEntries(view, date)
    }
  }, [view, date, loadEntries])

  // Boot: controlla se c'è già un account registrato
  useEffect(() => {
    api.authStatus()
      .then(({ registered }) => {
        if (!api.getToken()) {
          setScreen(registered ? 'login' : 'register')
        } else {
          setScreen('app')
        }
      })
      .catch(() => setScreen('register'))
  }, [])

  // Carica i dati al login
  useEffect(() => {
    if (screen !== 'app') return
    Promise.all([api.getDepartments(), api.getEmployees()])
      .then(([depts, emps]) => {
        setData((prev) => ({ ...prev, departments: depts, employees: emps }))
        return loadEntries(view, date)
      })
      .catch((err) => {
        if (err.status === 401) { api.setToken(''); setScreen('login') }
      })
  }, [screen]) // eslint-disable-line react-hooks/exhaustive-deps

  // Ricarica entries al cambio vista/data
  useEffect(() => {
    if (screen !== 'app') return
    loadEntries(view, date)
  }, [view, date, screen, loadEntries])

  const handleLogin = () => setScreen('app')

  const handleLogout = async () => {
    await api.logout().catch(() => {})
    api.setToken('')
    setScreen('login')
  }

  // Salvataggio dalla modale attività
  const handleModalSave = async (empId, dateStr, activities, absenceType) => {
    await api.putEntries(empId, dateStr, activities)
    await api.putAbsence(empId, dateStr, absenceType)
    await loadEntries(view, date)
    setModal(null)
  }

  const openModal = (emp, dep, d) => setModal({ emp, dep, date: d || date })
  const pickDay = (d) => { setDate(d); setView('day') }
  const goToday = () => { setView('day'); setDate(todayISO()); setPage('calendar') }

  if (screen === 'loading') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: 'var(--muted)' }}>
        Caricamento…
      </div>
    )
  }
  if (screen === 'register') return <Register onRegister={handleLogin} />
  if (screen === 'login') return <Login onLogin={handleLogin} />

  return (
    <div className="app">
      <Topbar
        view={view} setView={setView}
        date={date} setDate={setDate}
        page={page}
        onSettings={() => setPage('settings')}
        onAccount={() => setPage('account')}
        onCalendar={() => setPage('calendar')}
        onToday={goToday}
        onLogout={handleLogout}
      />

      {page === 'settings' ? (
        <div className="body"><Settings data={data} onReload={onReload} /></div>
      ) : page === 'account' ? (
        <div className="body"><Account onBack={() => setPage('calendar')} /></div>
      ) : (
        <div className="body">
          <div className="wrap">
            {view === 'day' && <DayView data={data} date={date} onOpen={(emp, dep) => openModal(emp, dep, date)} />}
            {view === 'week' && <WeekView data={data} date={date} onOpenDate={(emp, dep, d) => openModal(emp, dep, d)} />}
            {view === 'month' && <MonthView data={data} date={date} onPickDay={pickDay} onChangeMonth={(dir) => setDate(addMonths(date, dir))} />}
            {view === 'year' && <YearView data={data} date={date} onPickDay={pickDay} />}
          </div>
        </div>
      )}

      {modal && (
        <ActivityModal
          data={data}
          ctx={modal}
          onSave={handleModalSave}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  )
}
