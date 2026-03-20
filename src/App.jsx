import { useState, useEffect, useMemo, useCallback } from 'react'

import FilterBar from './components/FilterBar'
import MatchCard from './components/MatchCard'
import TeamsModal from './components/TeamsModal'
import { exportMatchesToPdf } from './utils/exportPdf'
import { parseMatchDate, getTodayDateString } from './utils/dateUtils'
import links from './links.json'
// Month sort order
const MONTH_ORDER = { March: 3, April: 4, May: 5, June: 6, July: 7 }
const TODAY_DATE_STRING = getTodayDateString()

function getMonthDay(dateStr) {
  if (!dateStr) return [99, 99]
  const parts = dateStr.split(' ')
  const month = MONTH_ORDER[parts[0]] ?? 9
  const day = parseInt((parts[1] || '0').replace(/\D/g, '')) || 0
  return [month, day]
}

export default function App() {
  // ── URL helpers ────────────────────────────────────────────────────────────
  const getUrlParams = () => new URLSearchParams(window.location.search)

  const readModeFromUrl = () => {
    const p = getUrlParams()
    return p.get('mode') || localStorage.getItem('drawMode') || 'senior'
  }

  const readFiltersFromUrl = () => {
    const p = getUrlParams()
    return {
      gradeKey: p.get('grade') || '',
      team: p.get('team') || '',
      genderKey: p.get('gender') || '',
      monthKey: p.get('month') || '',
      fieldKey: p.get('field') || '',
    }
  }

  const [mode, setMode] = useState(() => readModeFromUrl())
  const [data, setData] = useState(null)
  const [seniorData, setSeniorData] = useState(null)
  const [juniorData, setJuniorData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState(() => readFiltersFromUrl())
  const [showTeamsModal, setShowTeamsModal] = useState(false)

  useEffect(() => {
    setData(null)
    setLoading(true)
    const url = mode === 'junior' ? `${import.meta.env.BASE_URL}juniors.json` : `${import.meta.env.BASE_URL}matches.json`
    fetch(url)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [mode])

  // Pre-fetch both datasets once so TeamsModal can show all divisions
  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}matches.json`).then(r => r.json()).then(setSeniorData).catch(() => { })
    fetch(`${import.meta.env.BASE_URL}juniors.json`).then(r => r.json()).then(setJuniorData).catch(() => { })
  }, [])

  const handleModeChange = (newMode) => {
    if (newMode === mode) return
    localStorage.setItem('drawMode', newMode)
    setMode(newMode)
    handleClear()
  }

  const handleFilterChange = useCallback((key, value) => {
    setFilters(prev => {
      const next = { ...prev, [key]: value }
      if (key === 'genderKey' && prev.gradeKey && data) {
        const currentGradeInfo = data.grades.find(g => g.key === prev.gradeKey)
        if (currentGradeInfo && value && currentGradeInfo.gender !== value) {
          next.gradeKey = ''
        }
      }
      return next
    })
  }, [data])

  const handleClear = useCallback(() => {
    setFilters({ gradeKey: '', team: '', genderKey: '', monthKey: '', fieldKey: '' })
  }, [])

  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'dark')

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('theme', theme)
  }, [theme])

  const [showPastGames, setShowPastGames] = useState(() => getUrlParams().get('past') === '1')
  const [showByes, setShowByes] = useState(false)
  const [viewLayout, setViewLayout] = useState(() => localStorage.getItem('viewLayout') || 'grid')

  // ── Sync all filter state → URL ────────────────────────────────────────────
  useEffect(() => {
    const p = new URLSearchParams()
    if (mode !== 'senior') p.set('mode', mode)
    if (filters.gradeKey) p.set('grade', filters.gradeKey)
    if (filters.team) p.set('team', filters.team)
    if (filters.genderKey) p.set('gender', filters.genderKey)
    if (filters.monthKey) p.set('month', filters.monthKey)
    if (filters.fieldKey) p.set('field', filters.fieldKey)
    if (showPastGames) p.set('past', '1')
    const qs = p.toString()
    const newUrl = qs ? `${window.location.pathname}?${qs}` : window.location.pathname
    history.replaceState(null, '', newUrl)
  }, [mode, filters, showPastGames])

  // EASTER EGG STATE
  const [seasonClicks, setSeasonClicks] = useState(0)
  const [showDoom, setShowDoom] = useState(false)

  const handleSeasonClick = () => {
    if (seasonClicks + 1 >= 7) {
      setShowDoom(true)
      setSeasonClicks(0)
    } else {
      setSeasonClicks(seasonClicks + 1)
    }
  }

  const baseFilteredMatches = useMemo(() => {
    if (!data) return []
    const { gradeKey, team, genderKey, monthKey, fieldKey } = filters
    const teamLower = team.toLowerCase().trim()
    const now = new Date()

    return data.matches.filter(m => {
      if (m.teamA === 'TBA' || m.teamB === 'TBA') return false

      if (!showPastGames) {
        const matchDate = parseMatchDate(m)
        if (matchDate) {
          // Keep showing the match until roughly 2 hours after it starts
          const matchEnd = new Date(matchDate.getTime() + 120 * 60000)
          if (matchEnd < now) return false
        }
      }

      if (gradeKey && m.grade !== gradeKey) return false
      if (genderKey && m.gender !== genderKey) return false
      if (monthKey && m.date && !m.date.startsWith(monthKey)) return false
      if (fieldKey && (m.isBye || m.field !== fieldKey)) return false
      if (teamLower) {
        const a = (m.teamA || '').toLowerCase()
        const b = (m.teamB || '').toLowerCase()
        if (!a.includes(teamLower) && !b.includes(teamLower)) return false
      }
      return true
    })
  }, [data, filters, showPastGames])

  const filteredMatches = useMemo(() => {
    if (showByes) return baseFilteredMatches.filter(m => m.isBye)
    return baseFilteredMatches  // show both matches and byes
  }, [baseFilteredMatches, showByes])

  // Group matches by date
  const groupedMatches = useMemo(() => {
    // Parse "6.30pm" / "8.00am" → minutes since midnight for sorting
    const parseTime = (t) => {
      if (!t) return Infinity
      const m = t.match(/(\d+)[.:](\d+)\s*(am|pm)/i)
      if (!m) return Infinity
      let h = parseInt(m[1], 10)
      const min = parseInt(m[2], 10)
      const ampm = m[3].toLowerCase()
      if (ampm === 'pm' && h !== 12) h += 12
      if (ampm === 'am' && h === 12) h = 0
      return h * 60 + min
    }

    const FIELD_ORDER = ['ATF', 'TLF', 'Field 3', 'Port', 'TLF_East', 'ATF-1', 'ATF-2']
    const fieldRank = (f) => {
      if (!f) return 999
      const idx = FIELD_ORDER.findIndex(n => n.toLowerCase() === f.toLowerCase())
      return idx === -1 ? 998 : idx
    }

    const groups = {}
    filteredMatches.forEach(m => {
      const key = m.date || 'Unknown'
      if (!groups[key]) groups[key] = []
      groups[key].push(m)
    })

    // Sort each date's matches: by time first, then by field
    Object.values(groups).forEach(arr => {
      arr.sort((a, b) => parseTime(a.time) - parseTime(b.time) || fieldRank(a.field) - fieldRank(b.field))
    })

    return Object.entries(groups).sort((a, b) => {
      const [am, ad] = getMonthDay(a[0])
      const [bm, bd] = getMonthDay(b[0])
      return am - bm || ad - bd
    })
  }, [filteredMatches])

  const hasActiveFilter = Object.values(filters).some(v => v !== '')

  // Stats
  const totalMatches = data ? data.matches.filter(m => !m.isBye).length : 0
  const totalTeams = data ? new Set(data.matches.flatMap(m => [m.teamA, m.teamB])
    .filter(t => t && t.toUpperCase() !== 'BYE' && t.toUpperCase() !== 'TBA')
  ).size : 0
  const totalDates = data ? new Set(data.matches.map(m => m.date)).size : 0

  return (
    <div className="app">
      {showTeamsModal && (
        <TeamsModal
          onClose={() => setShowTeamsModal(false)}
          seniorData={seniorData}
          juniorData={juniorData}
          onSelectGrade={(gradeKey, isJunior) => {
            // Switch mode if necessary, then apply grade filter
            const targetMode = isJunior ? 'junior' : 'senior'
            if (targetMode !== mode) {
              localStorage.setItem('drawMode', targetMode)
              setMode(targetMode)
            }
            setFilters({ gradeKey, team: '', genderKey: '', monthKey: '', fieldKey: '' })
            setShowTeamsModal(false)
          }}
        />
      )}
      {showDoom && (
        <div className="doom-overlay" style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'black', zIndex: 99999, display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '16px', display: 'flex', justifyContent: 'flex-end', background: '#111' }}>
            <button onClick={() => setShowDoom(false)} style={{ background: 'var(--color-accent-1)', color: 'white', border: 'none', padding: '8px 24px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px' }}>
              Close Emulator
            </button>
          </div>
          <iframe src="/secret.html" style={{ border: 'none', flex: 1, width: '100%' }} title="Freedoom" />
        </div>
      )}
      {/* Ambient background orbs */}
      <div className="bg-orbs">
        <div className="bg-orb bg-orb-1" />
        <div className="bg-orb bg-orb-2" />
        <div className="bg-orb bg-orb-3" />
      </div>

      <div className="container">
        {/* Top Horizontal Header */}
        <header className="top-header" style={{ alignItems: 'flex-end' }}>
          <div className="header-left">
            <a href="https://www.revolutionise.com.au/mvha" target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex' }} title="Visit Manning Valley Hockey Association Website">
              <img
                src="/logos/manninghockey.jpg"
                alt="Manning Valley Hockey Association Logo"
                className="header-logo"
              />
            </a>
            <div className="header-titles">
              <div className="header-title-row">
                <h1>Manning Valley Hockey Association Matches</h1>
              </div>
              <div className="header-subtitle-row" style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '10px', flexWrap: 'wrap' }}>
                <button
                  className="hero-badge"
                  onClick={handleSeasonClick}
                  style={{ cursor: 'pointer', border: 'none', outline: 'none', userSelect: 'none' }}
                  title="2026 Season"
                >
                  <span className="hero-badge-dot" />
                  2026 Season
                </button>

                {/* Teams modal trigger */}
                <button
                  className="hero-badge"
                  onClick={() => setShowTeamsModal(true)}
                  style={{ cursor: 'pointer', border: 'none', outline: 'none', userSelect: 'none' }}
                  title="View clubs and their divisions"
                >
                  <span className="hero-badge-dot" />
                  Teams
                </button>

                {links['Match Card'] && (
                  <a
                    href={links['Match Card']}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hero-badge"
                    style={{ cursor: 'pointer', userSelect: 'none', textDecoration: 'none' }}
                    title="Match Card"
                  >
                    <span className="hero-badge-dot" />
                    Match Card
                  </a>
                )}

                {data && (<>
                  <span style={{ width: '1px', height: '16px', background: 'var(--color-border)', margin: '0 4px' }} />
                  <div className="header-stats" style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                    <div className="stat-item">
                      <span className="stat-value">{totalMatches}</span>
                      <span className="stat-label">Matches</span>
                    </div>
                    <div className="stat-item">
                      <span className="stat-value">{totalTeams}</span>
                      <span className="stat-label">Teams</span>
                    </div>
                    <div className="stat-item">
                      <span className="stat-value">{totalDates}</span>
                      <span className="stat-label">Match Days</span>
                    </div>
                  </div>
                </>)}

                <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span
                    title="This is a work in progress based on incomplete draws, there may be bugs and inconsistant data"
                    style={{ background: 'rgba(211, 47, 47, 0.1)', color: 'var(--color-accent-1)', padding: '4px 10px', borderRadius: '12px', fontSize: '0.7rem', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px', border: '1px solid rgba(211, 47, 47, 0.25)', display: 'inline-flex', alignItems: 'center', gap: '6px', cursor: 'help' }}
                  >
                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--color-accent-1)' }}></span>
                    Beta Release
                  </span>
                  <a
                    href="https://buymeacoffee.com/aidangaudrz"
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ background: 'rgba(211, 47, 47, 0.1)', color: 'var(--color-accent-1)', padding: '4px 10px', borderRadius: '12px', fontSize: '0.7rem', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px', border: '1px solid rgba(211, 47, 47, 0.25)', display: 'inline-flex', alignItems: 'center', gap: '6px', textDecoration: 'none', transition: 'all 0.2s' }}
                    onMouseOver={e => { e.currentTarget.style.transform = 'scale(1.05)'; e.currentTarget.style.background = 'rgba(211, 47, 47, 0.2)'; }}
                    onMouseOut={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.background = 'rgba(211, 47, 47, 0.1)'; }}
                  >
                    <span style={{ fontSize: '0.9rem' }}>🍺</span>
                    Buy me a beer
                  </a>
                  <a
                    href="https://github.com/agaudron/mvha-draw-app"
                    target="_blank"
                    rel="noopener noreferrer"
                    title="View on GitHub"
                    style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '8px', width: '30px', height: '28px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none', transition: 'all 0.2s', flexShrink: 0 }}
                    onMouseOver={e => { e.currentTarget.style.background = 'var(--color-surface-hover)'; }}
                    onMouseOut={e => { e.currentTarget.style.background = 'var(--color-surface)'; }}
                  >
                    <svg height="16" width="16" viewBox="0 0 16 16" fill="currentColor" style={{ color: 'var(--color-text-muted)' }} aria-hidden="true">
                      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
                    </svg>
                  </a>
                  <button
                    onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                    title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
                    style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '8px', width: '30px', height: '28px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: '0.95rem', transition: 'all 0.2s', flexShrink: 0 }}
                    onMouseOver={e => { e.currentTarget.style.background = 'var(--color-surface-hover)'; }}
                    onMouseOut={e => { e.currentTarget.style.background = 'var(--color-surface)'; }}
                  >
                    {theme === 'dark' ? '☀️' : '🌙'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </header>

        <div className="layout-content">
          {/* Sidebar Filters */}
          <aside className="layout-sidebar">
            {data && (
              <FilterBar
                data={data}
                filters={filters}
                onFilterChange={handleFilterChange}
                onClear={handleClear}
                theme={theme}
                setTheme={setTheme}
                mode={mode}
                onModeChange={handleModeChange}
              />
            )}
          </aside>

          {/* Main Results */}
          <main className="layout-main">
            {/* Loading */}
            {loading && (
              <div className="loading">
                <div className="spinner" />
                <span>Loading draw…</span>
              </div>
            )}

            {/* Results */}
            {!loading && data && (
              <>
                <div className="results-meta">
                  <p className="results-count">
                    Showing <strong>{filteredMatches.length}</strong> of {data.matches.length} entries
                    {hasActiveFilter && ' (filtered)'}
                    {hasActiveFilter && (
                      <button
                        onClick={handleClear}
                        style={{ marginLeft: '10px', background: 'none', border: 'none', color: 'var(--color-accent-1)', cursor: 'pointer', fontSize: '0.8rem', fontWeight: '600', padding: '2px 6px', borderRadius: '6px', verticalAlign: 'middle' }}
                      >
                        ✕ Clear
                      </button>
                    )}
                  </p>
                  <div className="results-actions" style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <label className="custom-toggle" style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '0.85rem', color: 'var(--color-text-muted)', userSelect: 'none', fontWeight: '500' }}>
                      <div className="toggle-track">
                        <input
                          type="checkbox"
                          className="toggle-checkbox"
                          checked={showByes}
                          onChange={e => setShowByes(e.target.checked)}
                        />
                        <span className="toggle-slider"></span>
                      </div>
                      Byes only
                    </label>

                    <label className="custom-toggle" style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '0.85rem', color: 'var(--color-text-muted)', userSelect: 'none', fontWeight: '500' }}>
                      <div className="toggle-track">
                        <input
                          type="checkbox"
                          className="toggle-checkbox"
                          checked={showPastGames}
                          onChange={e => setShowPastGames(e.target.checked)}
                        />
                        <span className="toggle-slider"></span>
                      </div>
                      Show past games
                    </label>
                    <button
                      className="export-btn"
                      onClick={() => exportMatchesToPdf(baseFilteredMatches, filters)}
                      style={{
                        padding: '6px 14px',
                        background: 'rgba(211,47,47,0.1)',
                        border: '1px solid rgba(211,47,47,0.4)',
                        color: 'var(--color-accent-1)',
                        borderRadius: 'var(--radius-sm)',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        transition: 'var(--transition)'
                      }}
                      onMouseOver={(e) => {
                        e.currentTarget.style.background = 'rgba(225,61,61,0.2)';
                        e.currentTarget.style.borderColor = 'rgba(225,61,61,0.6)';
                      }}
                      onMouseOut={(e) => {
                        e.currentTarget.style.background = 'rgba(225,61,61,0.1)';
                        e.currentTarget.style.borderColor = 'rgba(225,61,61,0.4)';
                      }}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                        <polyline points="7 10 12 15 17 10"></polyline>
                        <line x1="12" y1="15" x2="12" y2="3"></line>
                      </svg>
                      Export PDF
                    </button>

                    {/* Layout toggle — segmented icon pill */}
                    <div style={{
                      display: 'inline-flex',
                      border: '1px solid var(--color-border)',
                      borderRadius: '8px',
                      overflow: 'hidden',
                      flexShrink: 0,
                    }}>
                      {[
                        { value: 'grid', title: 'Grid view',
                          icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg> },
                        { value: 'list', title: 'List view',
                          icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg> },
                      ].map(({ value, title, icon }) => (
                        <button
                          key={value}
                          title={title}
                          onClick={() => { setViewLayout(value); localStorage.setItem('viewLayout', value) }}
                          style={{
                            width: '30px', height: '28px',
                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                            border: 'none',
                            borderRight: value === 'grid' ? '1px solid var(--color-border)' : 'none',
                            background: viewLayout === value ? 'color-mix(in srgb, var(--color-accent-1) 15%, transparent)' : 'var(--color-surface)',
                            color: viewLayout === value ? 'var(--color-accent-1)' : 'var(--color-text-muted)',
                            cursor: 'pointer',
                            transition: 'all 0.15s',
                          }}
                          onMouseOver={e => { if (viewLayout !== value) e.currentTarget.style.background = 'var(--color-surface-hover)' }}
                          onMouseOut={e => { if (viewLayout !== value) e.currentTarget.style.background = 'var(--color-surface)' }}
                        >
                          {icon}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {groupedMatches.length === 0 ? (
                  <div className="empty-state">
                    <div className="empty-icon">🏑</div>
                    <p className="empty-title">No matches found</p>
                    <p className="empty-desc">Try adjusting your filters to see more results.</p>
                  </div>
                ) : (
                  groupedMatches.map(([date, matches]) => {
                    const sampleDay = matches.find(m => m.day)?.day
                    const isToday = date === TODAY_DATE_STRING
                    const dayLabel = isToday ? 'Today' : sampleDay
                    let cardIndex = 0
                    return (
                      <section key={date} className={`date-group${isToday ? ' date-group--today' : ''}`}>
                        <div className="date-group-header">
                          {dayLabel && <span className={`date-group-day${isToday ? ' date-group-day--today' : ''}`}>{dayLabel}</span>}
                          <h2 className="date-group-title">{(() => {
                            const parts = date.trim().split(' ')
                            if (parts.length === 2) {
                              const n = parseInt(parts[1], 10)
                              const suffix = n % 100 >= 11 && n % 100 <= 13 ? 'th'
                                : n % 10 === 1 ? 'st'
                                  : n % 10 === 2 ? 'nd'
                                    : n % 10 === 3 ? 'rd' : 'th'
                              return `${n}${suffix} ${parts[0]}`
                            }
                            return date
                          })()}</h2>
                          <div className="date-group-line" />
                        </div>
                        <div className={viewLayout === 'list' ? 'match-list' : 'match-grid'}>
                          {matches.map((match, i) => (
                            <MatchCard
                              key={`${date}-${i}`}
                              match={match}
                              index={cardIndex++}
                              selectedTeam={filters.team}
                              onFilterChange={handleFilterChange}
                              layout={viewLayout}
                            />
                          ))}
                        </div>
                      </section>
                    )
                  })
                )}
              </>
            )}
          </main>
        </div>
      </div >

      <footer className="app-footer">
        Manning Valley Hockey Association &nbsp;·&nbsp; 2026 Senior and Junior Competitions
      </footer>
    </div >
  )
}
