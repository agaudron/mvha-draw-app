import { useMemo } from 'react'

const SENIOR_GRADE_ORDER = ['B-Grade M', 'C-Grade M', 'MNCHL M', 'MNCHL W', 'Div 1 W', 'Div 2 W', 'Div 3 W', 'Div 3 M']
const JUNIOR_GRADE_ORDER = ['Div 1', 'Div 2', 'U12s', 'U10s', 'U8s']

export default function FilterBar({ data, filters, onFilterChange, onClear, theme, setTheme, mode, onModeChange }) {
  const { gradeKeys = [], team, genderKey, monthKey, fieldKey } = filters
  const isJunior = mode === 'junior'

  const allTeams = useMemo(() => {
    const set = new Set()
    data.matches.forEach(m => {
      if (m.teamA && m.teamA !== 'BYE' && m.teamA !== 'TBA') set.add(m.teamA)
      if (m.teamB && m.teamB !== 'BYE' && m.teamB !== 'TBA') set.add(m.teamB)
    })
    return [...set].sort()
  }, [data])

  const allMonths = useMemo(() => {
    if (!data) return []
    const months = ['March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
    return months.filter(mon => data.matches.some(m => m.date && m.date.startsWith(mon)))
  }, [data])

  const allFields = useMemo(() => {
    if (!data) return []
    const set = new Set()
    data.matches.forEach(m => {
      if (m.field) set.add(m.field)
    })
    return [...set].sort()
  }, [data])

  // Build the grade chips list depending on mode
  const gradeChips = useMemo(() => {
    if (isJunior) {
      return JUNIOR_GRADE_ORDER
        .map(gk => data.grades.find(g => g.key === gk))
        .filter(Boolean)
    }
    return SENIOR_GRADE_ORDER
      .filter(gk => {
        if (!genderKey) return true
        const info = data.grades.find(g => g.key === gk)
        return info && info.gender === genderKey
      })
      .map(gk => data.grades.find(g => g.key === gk))
      .filter(Boolean)
  }, [data, isJunior, genderKey])

  const hasActiveFilter = Object.values(filters).some(v => v !== '')

  return (
    <div className="filter-bar">

      {/* Senior / Junior mode toggle */}
      <div className="mode-tabs">
        <button
          className={`mode-tab ${!isJunior ? 'mode-tab--active' : ''}`}
          onClick={() => onModeChange('senior')}
        >
          🏑 Seniors
        </button>
        <button
          className={`mode-tab ${isJunior ? 'mode-tab--active' : ''}`}
          onClick={() => onModeChange('junior')}
        >
          ⭐ Juniors
        </button>
      </div>

      {/* Team filter */}
      <div className="filter-row" style={{ width: '100%' }}>
        <span className="filter-label">Club</span>
        <select
          id="team-select"
          className="filter-select"
          value={team}
          onChange={e => onFilterChange('team', e.target.value)}
        >
          <option value="">All Clubs</option>
          {allTeams.map(t => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      </div>

      {/* Gender filter — seniors only */}
      {!isJunior && (
        <div className="filter-row">
          <span className="filter-label">Gender</span>
          <div className="filter-chips">
            {[['Men', 'Mens'], ['Women', 'Womens']].map(([val, label]) => (
              <button
                key={val}
                id={`gender-${val.toLowerCase()}`}
                className={`chip ${genderKey === val ? 'active' : ''}`}
                data-gender={val}
                onClick={() => onFilterChange('genderKey', genderKey === val ? '' : val)}
              >
                <span className="chip-dot" />
                {label}
                {val === 'Men'
                  ? <span className="gender-icon" style={{ marginLeft: '2px', marginRight: '-2px' }}>♂</span>
                  : <span className="gender-icon" style={{ marginLeft: '2px', marginRight: '-2px' }}>♀</span>}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Grade filter */}
      <div className="filter-row">
        <span className="filter-label">{isJunior ? 'Division / Age Group' : 'Grade'}</span>
        <div className="filter-chips">
          <button
            className={`chip ${gradeKeys.length === 0 ? 'active-grade' : ''}`}
            onClick={() => onFilterChange('gradeKeys', [])}
          >
            All
          </button>
          {isJunior
            ? gradeChips.map(info => {
                const gk = info.key
                const isActive = gradeKeys.includes(gk)
                return (
                  <button
                    key={gk}
                    id={`grade-${gk.replace(/\s+/g, '-').toLowerCase()}`}
                    className={`chip ${isActive ? 'active-grade' : ''}`}
                    data-grade={gk}
                    onClick={() => {
                      const isSelected = gradeKeys.includes(gk)
                      const nextKeys = isSelected ? gradeKeys.filter(k => k !== gk) : [...gradeKeys, gk]
                      onFilterChange('gradeKeys', nextKeys)
                    }}
                  >
                    {info.label}
                  </button>
                )
              })
            : (() => {
                const mens = gradeChips.filter(i => i.gender === 'Men')
                const womens = gradeChips.filter(i => i.gender === 'Women')
                const renderChip = info => {
                  const gk = info.key
                  const isActive = gradeKeys.includes(gk)
                  return (
                    <button
                      key={gk}
                      id={`grade-${gk.replace(/\s+/g, '-').toLowerCase()}`}
                      className={`chip ${isActive ? 'active-grade' : ''}`}
                      data-grade={gk}
                      onClick={() => {
                        const isSelected = gradeKeys.includes(gk)
                        const nextKeys = isSelected ? gradeKeys.filter(k => k !== gk) : [...gradeKeys, gk]
                        onFilterChange('gradeKeys', nextKeys)
                      }}
                    >
                      {info.label}
                      {info.gender === 'Men' && <span className="gender-icon" style={{ marginLeft: '2px' }}>♂</span>}
                      {info.gender === 'Women' && <span className="gender-icon" style={{ marginLeft: '2px' }}>♀</span>}
                    </button>
                  )
                }
                return (
                  <>
                    {mens.map(renderChip)}
                    {/* Force Women's grades onto a new line */}
                    <span style={{ width: '100%', height: 0 }} />
                    {womens.map(renderChip)}
                  </>
                )
              })()
          }
        </div>
      </div>

      {/* Month filter */}
      <div className="filter-row" style={{ width: '100%' }}>
        <span className="filter-label">Month</span>
        <select
          className="filter-select"
          value={monthKey}
          onChange={e => onFilterChange('monthKey', e.target.value)}
        >
          <option value="">All Months</option>
          {allMonths.map(mon => (
            <option key={mon} value={mon}>{mon}</option>
          ))}
        </select>
      </div>

      {/* Field filter */}
      <div className="filter-row">
        <span className="filter-label">Field</span>
        <div className="filter-chips">
          {allFields.map(f => (
            <button
              key={f}
              className={`chip ${fieldKey === f ? 'active-field' : ''}`}
              data-field={f.replace(/\s+/g, '-').toLowerCase()}
              onClick={() => onFilterChange('fieldKey', fieldKey === f ? '' : f)}
            >
              <span className="chip-dot" />
              {f}
            </button>
          ))}
        </div>
      </div>



    </div>
  )
}
