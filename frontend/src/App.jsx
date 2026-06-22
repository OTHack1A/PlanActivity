import { useState, useEffect, useCallback, useRef } from 'react'
import {
  todayISO, addMonths, DEPT_COLORS,
  viewRange, startOfWeek, addDays,
} from './store.js'
import * as api from './api.js'
import { Topbar, DayView, WeekView, MonthView, YearView, ActivityModal } from './components.jsx'
import { useI18n } from './i18n.jsx'

// ---------------------------------------------------------------------------
// Campo password "stile Linux": nessun carattere visibile mentre si digita
// ---------------------------------------------------------------------------
function PwInput({ value, onChange, onBlur, className, autoFocus }) {
  const onKey = (e) => {
    if (e.key === 'Enter' || e.key === 'Tab' || e.key === 'Escape') return
    if (e.metaKey || e.ctrlKey || e.altKey) return
    if (e.key === 'Backspace') { e.preventDefault(); onChange(value.slice(0, -1)) }
    else if (e.key.length === 1) { e.preventDefault(); onChange(value + e.key) }
  }
  const onPaste = (e) => {
    e.preventDefault()
    const txt = (e.clipboardData || window.clipboardData).getData('text') || ''
    if (txt) onChange(value + txt)
  }
  return (
    <input
      type="text"
      value=""
      onChange={() => {}}
      onKeyDown={onKey}
      onPaste={onPaste}
      onBlur={onBlur}
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
// LogoArea — impostabile una sola volta cliccando sulla pagina di login
// ---------------------------------------------------------------------------
function LogoArea() {
  const { t } = useI18n()
  const [customized, setCustomized] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const inputRef = useRef(null)
  const imgRef = useRef(null)

  useEffect(() => {
    api.getLogoStatus()
      .then(({ customized: c }) => setCustomized(c))
      .catch(() => setCustomized(true))
  }, [])

  const handleClick = () => {
    if (customized !== false || uploading) return
    inputRef.current?.click()
  }

  const handleFile = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!file.type.startsWith('image/') || file.size > 2 * 1024 * 1024) {
      setError(t('logo.invalid'))
      return
    }
    setUploading(true)
    setError('')
    try {
      await api.uploadLogo(file)
      setCustomized(true)
      if (imgRef.current) imgRef.current.src = `/api/logo?v=${Date.now()}`
    } catch (err) {
      if (err.status === 409) {
        setCustomized(true)
      } else {
        setError(t('logo.error'))
      }
    } finally {
      setUploading(false)
    }
  }

  const clickable = customized === false && !uploading

  return (
    <div className="logo-area">
      <img
        ref={imgRef}
        src="/api/logo"
        alt="Logo"
        className={'login-logo' + (clickable ? ' logo-clickable' : '')}
        onClick={handleClick}
        title={clickable ? t('logo.hint') : ''}
        onError={(e) => { e.currentTarget.style.display = 'none' }}
      />
      {clickable && <div className="logo-hint-text">{t('logo.hint')}</div>}
      {uploading && <div className="logo-hint-text">{t('logo.uploading')}</div>}
      {error && <div className="fld-note">{error}</div>}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleFile}
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Register
// ---------------------------------------------------------------------------
function Register({ onRegister }) {
  const { t } = useI18n()
  const [company, setCompany] = useState('')
  const [user, setUser] = useState('')
  const [pass, setPass] = useState('')
  const [pass2, setPass2] = useState('')
  const [pass2Dirty, setPass2Dirty] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const mismatch = pass2Dirty && pass2.length > 0 && pass !== pass2
  const valid = company.trim().length > 0 && user.trim().length > 0 && pass.length > 0 && pass === pass2 && !loading

  const onPassChange = (v) => { setPass(v); setPass2Dirty(false); setPass2('') }

  const submit = async (e) => {
    e.preventDefault()
    if (!valid) return
    setLoading(true)
    setError('')
    api.logPublicEvent(t('log.reg.submit', { user: user.trim(), company: company.trim() }))
    try {
      const { access_token } = await api.register(user.trim(), pass, company.trim())
      api.setToken(access_token)
      onRegister()
    } catch (err) {
      const msg = err.message === 'Failed to fetch'
        ? t('reg.errServerDown')
        : err.message || 'Errore sconosciuto'
      api.logPublicEvent(t('log.reg.failed', { msg }))
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-screen">
      <div className="login-grid"></div>
      <form className="login-card" onSubmit={submit}>
        <LogoArea />
        <div className="login-brand"><span className="dot"></span><span>PIANIFICA</span></div>
        <h1>{t('reg.title')}</h1>
        <p className="login-lead">{t('reg.lead')}</p>
        <label className="fld">
          <span>{t('reg.company')}</span>
          <input
            autoFocus
            value={company}
            onChange={(e) => { setCompany(e.target.value); setError('') }}
            onBlur={() => company.trim() && api.logPublicEvent(t('log.reg.company', { value: company.trim() }))}
            placeholder={t('reg.companyPlaceholder')}
            autoComplete="organization"
          />
        </label>
        <label className="fld">
          <span>{t('reg.user')}</span>
          <input
            value={user}
            onChange={(e) => { setUser(e.target.value); setError('') }}
            onBlur={() => user.trim() && api.logPublicEvent(t('log.reg.user', { value: user.trim() }))}
            autoComplete="username"
          />
        </label>
        <label className="fld">
          <span>{t('reg.password')}</span>
          {/* Il valore della password non viene mai loggato */}
          <PwInput
            value={pass}
            onChange={onPassChange}
            onBlur={() => pass.length > 0 && api.logPublicEvent(t('log.reg.pass'))}
          />
        </label>
        <label className="fld">
          <span>{t('reg.passwordRepeat')}</span>
          <PwInput
            value={pass2}
            onChange={(v) => { setPass2(v); setError('') }}
            onBlur={() => {
              setPass2Dirty(true)
              if (pass2.length > 0) {
                const match = pass === pass2 ? t('log.reg.match') : t('log.reg.noMatch')
                api.logPublicEvent(t('log.reg.pass2', { match }))
              }
            }}
            className={mismatch ? 'bad' : ''}
          />
        </label>
        {mismatch && <div className="fld-note">{t('reg.passwordMismatch')}</div>}
        {error && <div className="fld-note">{error}</div>}
        <button type="submit" className="login-btn" disabled={!valid}>
          {loading ? t('reg.submitting') : t('reg.submit')}
        </button>
      </form>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Login
// ---------------------------------------------------------------------------
function Login({ onLogin }) {
  const { t } = useI18n()
  const [user, setUser] = useState('')
  const [pass, setPass] = useState('')
  const [shake, setShake] = useState(false)
  const [lockedFor, setLockedFor] = useState(0)
  const [error, setError] = useState('')

  useEffect(() => {
    if (lockedFor <= 0) return
    const id = setInterval(() => {
      setLockedFor((s) => {
        if (s <= 1) { clearInterval(id); return 0 }
        return s - 1
      })
    }, 1000)
    return () => clearInterval(id)
  }, [lockedFor])

  const fmtLock = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

  const submit = async (e) => {
    e.preventDefault()
    if (lockedFor > 0) return
    api.logPublicEvent(t('log.login.submit', { user: user.trim() }))
    try {
      const { access_token } = await api.login(user.trim(), pass)
      api.setToken(access_token)
      onLogin()
    } catch (err) {
      api.logPublicEvent(t('log.login.failed', { user: user.trim() }))
      setPass('')
      if (err.status === 429) {
        setLockedFor(err.retryAfter || 180)
        setError('')
      } else {
        const msg = err.message === 'Failed to fetch'
          ? t('login.errServerDown')
          : err.message || t('login.submit')
        setError(msg)
        setShake(true)
        setTimeout(() => setShake(false), 600)
      }
    }
  }

  return (
    <div className="login-screen">
      <div className="login-grid"></div>
      <form className={'login-card' + (shake ? ' shake' : '')} onSubmit={submit}>
        <LogoArea />
        <div className="login-brand"><span className="dot"></span><span>PIANIFICA</span></div>
        <h1>{t('login.title')}</h1>
        <p className="login-lead">{t('login.lead')}</p>
        <label className="fld">
          <span>{t('login.user')}</span>
          <input
            autoFocus
            value={user}
            onChange={(e) => { setUser(e.target.value); setError('') }}
            onBlur={() => user.trim() && api.logPublicEvent(t('log.login.user', { user: user.trim() }))}
            autoComplete="username"
            disabled={lockedFor > 0}
          />
        </label>
        <label className="fld">
          <span>{t('login.password')}</span>
          {/* Il valore della password non viene mai loggato */}
          <PwInput
            value={pass}
            onChange={(v) => { setPass(v); setError('') }}
            onBlur={() => pass.length > 0 && api.logPublicEvent(t('log.login.pass'))}
          />
        </label>
        {error && !lockedFor && <div className="fld-note">{error}</div>}
        {lockedFor > 0 && (
          <div className="fld-note lock-note">
            {t('login.retryAfter', { s: fmtLock(lockedFor) })}
          </div>
        )}
        <button type="submit" className="login-btn" disabled={lockedFor > 0}>
          {lockedFor > 0 ? t('login.locked', { s: fmtLock(lockedFor) }) : t('login.submit')}
        </button>
      </form>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Account (cambio password)
// ---------------------------------------------------------------------------
function Account({ onBack }) {
  const { t } = useI18n()
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
      setMsg({ ok: true, text: t('account.passwordUpdated') })
    } catch (err) {
      setMsg({ ok: false, text: err.message })
    }
  }

  return (
    <div className="wrap settings">
      <h1>{t('account.title')}</h1>
      <form className="panel account-panel" onSubmit={submit}>
        <h2>{t('account.changePassword')}</h2>
        <label className="fld">
          <span>{t('account.currentPass')}</span>
          <PwInput value={oldP} onChange={(v) => { setOldP(v); setMsg(null) }} />
        </label>
        <label className="fld">
          <span>{t('account.newPass')}</span>
          <PwInput value={np} onChange={(v) => { setNp(v); setMsg(null) }} />
        </label>
        <label className="fld">
          <span>{t('account.newPassRepeat')}</span>
          <PwInput value={np2} onChange={(v) => { setNp2(v); setMsg(null) }} className={mismatch ? 'bad' : ''} />
        </label>
        {mismatch && <div className="fld-note">{t('account.passwordMismatch')}</div>}
        {msg && <div className={'acc-msg ' + (msg.ok ? 'ok' : 'err')}>{msg.text}</div>}
        <button type="submit" className="login-btn" disabled={!valid} style={{ marginTop: 8 }}>
          {t('account.submit')}
        </button>
      </form>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Log viewer (sola lettura)
// ---------------------------------------------------------------------------
function LogViewer() {
  const { t } = useI18n()
  const [lines, setLines] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async () => {
    try {
      const { lines: l } = await api.getLog(500)
      setLines([...l].reverse())
      setError(null)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    load()
    const id = setInterval(load, 5000)
    return () => clearInterval(id)
  }, [load])

  const levelClass = (line) => {
    if (line.includes('[ERROR]')) return 'log-err'
    if (line.includes('[WARNING]')) return 'log-warn'
    return 'log-info'
  }

  return (
    <div className="wrap">
      <div className="log-header">
        <h1>{t('log.title')}</h1>
        <button
          className="btn-icon"
          onClick={() => { setRefreshing(true); load() }}
          disabled={refreshing}
        >
          {t('log.refresh')}
        </button>
      </div>
      <p className="log-meta">{t('log.meta')}</p>
      {loading ? (
        <div className="log-loading">{t('log.loading')}</div>
      ) : error ? (
        <div className="log-loading log-err">{error}</div>
      ) : (
        <div className="log-viewer">
          {lines.length === 0 ? (
            <div className="log-empty">{t('log.empty')}</div>
          ) : (
            lines.map((line, i) => (
              <div key={i} className={'log-line ' + levelClass(line)}>{line}</div>
            ))
          )}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------
function Settings({ data, onReload, settings, onSettingsChange }) {
  const { t } = useI18n()
  const [depName, setDepName] = useState('')
  const [depColor, setDepColor] = useState(
    DEPT_COLORS[data.departments.length % DEPT_COLORS.length]
  )
  const [empName, setEmpName] = useState('')
  const [empRole, setEmpRole] = useState('')
  const [empDep, setEmpDep] = useState(data.departments[0]?.id || '')

  const [empEdits, setEmpEdits] = useState({})
  const getEmpVal = (emp, field) => empEdits[emp.id]?.[field] ?? emp[field]
  const onEmpChange = (id, field, val) =>
    setEmpEdits((prev) => ({ ...prev, [id]: { ...prev[id], [field]: val } }))

  const onEmpBlur = async (id, field) => {
    const val = empEdits[id]?.[field]
    if (val === undefined) return
    const emp = data.employees.find((e) => e.id === id)
    const oldVal = emp?.[field] ?? ''
    if (String(val) !== String(oldVal)) {
      api.logEvent(t('log.empEdited', {
        name: emp?.name ?? id,
        field,
        from: String(oldVal),
        to: String(val),
      }))
    }
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
    api.logEvent(t('log.deptAdded', { name }))
    await api.createDepartment(name, depColor)
    setDepName('')
    setDepColor(DEPT_COLORS[(data.departments.length + 1) % DEPT_COLORS.length])
    await onReload('departments')
  }

  const removeDep = async (id) => {
    const count = data.employees.filter((e) => e.departmentId === id).length
    if (count > 0 && !confirm(t('settings.deleteDeptConfirm', { n: count }))) return
    const dep = data.departments.find((d) => d.id === id)
    api.logEvent(t('log.deptDeleted', { name: dep?.name ?? id }))
    await api.deleteDepartment(id)
    await onReload('all')
  }

  const addEmp = async () => {
    const name = empName.trim()
    if (!name || !empDep) return
    api.logEvent(t('log.empAdded', { name }))
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
    const emp = data.employees.find((e) => e.id === id)
    api.logEvent(t('log.empDeleted', { name: emp?.name ?? id }))
    await api.deleteEmployee(id)
    await onReload('employees')
  }

  const handleAvatarUpload = async (empId, file) => {
    if (!file) return
    const emp = data.employees.find((e) => e.id === empId)
    api.logEvent(t('log.avatarUploaded', { name: emp?.name ?? empId }))
    await api.uploadAvatar(empId, file)
    await onReload('employees')
  }

  const depById = (id) => data.departments.find((x) => x.id === id)

  useEffect(() => {
    if (!empDep && data.departments[0]) setEmpDep(data.departments[0].id)
  }, [data.departments])

  const toggleSatHalfDay = async () => {
    const next = !settings.saturday_half_day
    await api.patchSettings({ saturday_half_day: next })
    onSettingsChange({ ...settings, saturday_half_day: next })
  }

  return (
    <div className="wrap settings">
      <h1>{t('settings.title')}</h1>

      <div className="panel settings-general" style={{ marginBottom: 20 }}>
        <label className="sat-toggle">
          <input
            type="checkbox"
            checked={settings.saturday_half_day}
            onChange={toggleSatHalfDay}
          />
          <span>{t('settings.satHalfDay')}</span>
        </label>
      </div>

      <div className="set-cols">
        {/* REPARTI */}
        <div className="panel">
          <h2>{t('settings.depts')}</h2>
          {data.departments.map((dep) => {
            const count = data.employees.filter((e) => e.departmentId === dep.id).length
            return (
              <div className="dep-item" key={dep.id}>
                <span className="swatch" style={{ background: dep.color }}></span>
                <span className="nm">{dep.name}</span>
                <span className="cnt">{count}</span>
                <button className="rm" onClick={() => removeDep(dep.id)} title="✕">✕</button>
              </div>
            )
          })}
          {data.departments.length === 0 && (
            <div style={{ color: 'var(--faint)', fontSize: 13 }}>{t('settings.noDepts')}</div>
          )}
          <div className="row-add">
            <input
              placeholder={t('settings.newDept')}
              value={depName}
              onChange={(e) => setDepName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addDep()}
            />
            <button onClick={addDep} disabled={!depName.trim()}>{t('settings.add')}</button>
          </div>
          <div className="color-pick">
            <span className="color-pick-lbl">{t('settings.color')}</span>
            <div className="swatches">
              {DEPT_COLORS.map((c) => (
                <button
                  key={c} type="button"
                  className={'sw' + (depColor === c ? ' sel' : '')}
                  style={{ background: c }}
                  onClick={() => setDepColor(c)}
                  title={t('settings.color')}
                ></button>
              ))}
            </div>
          </div>
        </div>

        {/* DIPENDENTI */}
        <div className="panel">
          <h2>{t('settings.employees')}</h2>
          {data.employees.length > 0 && (
            <div className="emp-list-head">
              <span>{t('settings.deptEmpHead')}</span>
              <span className="ot-head">{t('settings.overtimeH')}</span>
            </div>
          )}
          <div className="emp-list">
            {data.employees.map((emp) => {
              const dep = depById(emp.departmentId)
              return (
                <div className="emp-row" key={emp.id}>
                  <label
                    className="ava avatar-upload"
                    style={{ background: dep ? dep.color : 'var(--faint)', position: 'relative', overflow: 'hidden', cursor: 'pointer' }}
                    title={t('settings.avatarTitle')}
                  >
                    {emp.name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('')}
                    {emp.hasAvatar && (
                      <img
                        src={`/api/employees/${emp.id}/avatar`}
                        alt=""
                        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', borderRadius: 'inherit' }}
                        onError={(e) => { e.currentTarget.style.display = 'none' }}
                      />
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      style={{ display: 'none' }}
                      onChange={(e) => handleAvatarUpload(emp.id, e.target.files?.[0])}
                    />
                  </label>
                  <span className="emp-id">
                    <input
                      className="emp-edit nm"
                      value={getEmpVal(emp, 'name')}
                      placeholder={t('settings.empName')}
                      onChange={(e) => onEmpChange(emp.id, 'name', e.target.value)}
                      onBlur={() => onEmpBlur(emp.id, 'name')}
                    />
                    <input
                      className="emp-edit rl"
                      value={getEmpVal(emp, 'role')}
                      placeholder={t('settings.empRole')}
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
                    title={t('settings.overtimeH')}
                  />
                  <button className="rm" onClick={() => removeEmp(emp.id)} title="✕">✕</button>
                </div>
              )
            })}
            {data.employees.length === 0 && (
              <div style={{ color: 'var(--faint)', fontSize: 13 }}>{t('settings.noEmployees')}</div>
            )}
          </div>

          <div className="emp-add">
            <input placeholder={t('settings.empName')} value={empName} onChange={(e) => setEmpName(e.target.value)} />
            <input placeholder={t('settings.empRole')} value={empRole} onChange={(e) => setEmpRole(e.target.value)} />
            <select value={empDep} onChange={(e) => setEmpDep(e.target.value)}>
              {data.departments.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
            <button onClick={addEmp} disabled={!empName.trim() || !empDep}>{t('settings.add')}</button>
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
  const { t } = useI18n()
  const [screen, setScreen] = useState('loading')
  const [data, setData] = useState({ departments: [], employees: [], entries: {}, absences: {} })
  const [company, setCompany] = useState('')
  const [settings, setSettings] = useState({ saturday_half_day: false })
  const [page, setPage] = useState('calendar')
  const [view, setView] = useState('day')
  const [date, setDate] = useState(todayISO)
  const [modal, setModal] = useState(null)

  const loadEntries = useCallback(async (v, d) => {
    const { from, to } = viewRange(v, d)
    try {
      const { entries, absences } = await api.getEntries(from, to)
      setData((prev) => ({ ...prev, entries, absences }))
    } catch (err) {
      if (err.status === 401) { api.setToken(''); setScreen('login') }
    }
  }, [])

  const loadDeptEmps = useCallback(async () => {
    const [depts, emps] = await Promise.all([api.getDepartments(), api.getEmployees()])
    setData((prev) => ({ ...prev, departments: depts, employees: emps }))
  }, [])

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

  useEffect(() => {
    if (screen !== 'app') return
    Promise.all([api.getDepartments(), api.getEmployees(), api.getAccount(), api.getSettings()])
      .then(([depts, emps, acc, sett]) => {
        setData((prev) => ({ ...prev, departments: depts, employees: emps }))
        setCompany(acc?.company || '')
        if (sett) setSettings(sett)
        return loadEntries(view, date)
      })
      .catch((err) => {
        if (err.status === 401) { api.setToken(''); setScreen('login') }
      })
  }, [screen]) // eslint-disable-line react-hooks/exhaustive-deps

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

  const changeView = (newView) => {
    if (newView !== view) api.logEvent(t('log.viewChanged', { from: view, to: newView }))
    setView(newView)
  }

  const handleModalSave = async (empId, dateStr, activities, absenceType) => {
    await api.putEntries(empId, dateStr, activities)
    await api.putAbsence(empId, dateStr, absenceType)
    await loadEntries(view, date)
    setModal(null)
  }

  const openModal = (emp, dep, d) => {
    api.logEvent(t('log.modalOpened', { emp: emp.name, date: d || date }))
    setModal({ emp, dep, date: d || date })
  }
  const pickDay = (d) => { setDate(d); setView('day') }
  const goToday = () => { setView('day'); setDate(todayISO()); setPage('calendar') }

  if (screen === 'loading') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: 'var(--muted)' }}>
        {t('app.loading')}
      </div>
    )
  }
  if (screen === 'register') return <Register onRegister={handleLogin} />
  if (screen === 'login') return <Login onLogin={handleLogin} />

  return (
    <div className="app">
      <Topbar
        view={view} setView={changeView}
        date={date} setDate={setDate}
        page={page}
        company={company}
        onSettings={() => { api.logEvent(t('log.pageOpened', { page: t('nav.settings') })); setPage('settings') }}
        onLog={() => { api.logEvent(t('log.pageOpened', { page: t('nav.log') })); setPage('log') }}
        onAccount={() => { api.logEvent(t('log.pageOpened', { page: t('nav.account') })); setPage('account') }}
        onCalendar={() => setPage('calendar')}
        onToday={goToday}
        onLogout={handleLogout}
      />

      {page === 'settings' ? (
        <div className="body"><Settings data={data} onReload={onReload} settings={settings} onSettingsChange={setSettings} /></div>
      ) : page === 'account' ? (
        <div className="body"><Account onBack={() => setPage('calendar')} /></div>
      ) : page === 'log' ? (
        <div className="body"><LogViewer /></div>
      ) : (
        <div className="body">
          <div className="wrap">
            {view === 'day' && <DayView data={data} date={date} onOpen={(emp, dep) => openModal(emp, dep, date)} onPrevDay={() => setDate(addDays(date, -1))} satHalfDay={settings.saturday_half_day} />}
            {view === 'week' && <WeekView data={data} date={date} onOpenDate={(emp, dep, d) => openModal(emp, dep, d)} satHalfDay={settings.saturday_half_day} />}
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
