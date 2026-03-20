import { useEffect, useMemo } from 'react'
import teamsData from '../teams.json'

/**
 * Derive a map of { teamName -> Set<gradeLabel> } from match data.
 * Works for both senior and junior data objects.
 */
function buildTeamGrades(seniorData, juniorData) {
  const map = {}
  const addMatches = (matches, isJunior) => {
    if (!matches) return
    matches.forEach(m => {
      ;['teamA', 'teamB'].forEach(k => {
        const t = m[k]
        if (!t || t === 'BYE' || t === 'TBA') return
        if (!map[t]) map[t] = []
        const genderPart = !isJunior && m.gender ? ` ${m.gender}` : ''
        const label = `${m.gradeLabel || m.grade}${genderPart}${isJunior ? ' (Jnr)' : ''}`
        const gradeKey = m.grade
        if (!map[t].find(e => e.gradeKey === gradeKey)) {
          map[t].push({ label, gradeKey, isJunior: !!isJunior })
        }
      })
    })
  }
  addMatches(seniorData?.matches, false)
  addMatches(juniorData?.matches, true)
  return map
}

export default function TeamsModal({ onClose, seniorData, juniorData, onSelectGrade }) {
  // Close on Escape
  useEffect(() => {
    const handler = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const teamGrades = useMemo(
    () => buildTeamGrades(seniorData, juniorData),
    [seniorData, juniorData]
  )

  return (
    <div
      className="modal-backdrop"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
      style={{
        position: 'fixed', inset: 0, zIndex: 9000,
        background: 'rgba(0,0,0,0.6)',
        backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '16px',
      }}
    >
      <div
        className="modal-sheet"
        style={{
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: '16px',
          maxWidth: '780px',
          width: '100%',
          maxHeight: '85vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: '0 24px 60px rgba(0,0,0,0.4)',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '20px 24px 16px',
          borderBottom: '1px solid var(--color-border)',
          flexShrink: 0,
        }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, color: 'var(--color-text)' }}>
              🏑 Clubs &amp; Divisions
            </h2>
            <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
              {teamsData.length} clubs competing in the 2026 MVHA competition
            </p>
          </div>
          <button
            onClick={onClose}
            title="Close"
            style={{
              background: 'var(--color-surface-hover)',
              border: '1px solid var(--color-border)',
              borderRadius: '8px',
              width: '32px', height: '32px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer',
              fontSize: '1rem',
              color: 'var(--color-text-muted)',
              flexShrink: 0,
            }}
          >
            ✕
          </button>
        </div>

        {/* Scrollable content */}
        <div style={{ overflowY: 'auto', padding: '16px 24px 24px', flex: 1 }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
            gap: '12px',
          }}>
            {teamsData.map(team => {
              const grades = teamGrades[team.name] || []
              const alts = team.alt_urls
              const effectiveUrl = alts?.length && Math.random() < 0.1
                ? alts[Math.floor(Math.random() * alts.length)]
                : team.url
              return (
                <a
                  key={team.name}
                  href={effectiveUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '14px',
                    padding: '14px 16px',
                    background: 'var(--color-bg)',
                    border: '1px solid var(--color-border)',
                    borderRadius: '12px',
                    textDecoration: 'none',
                    transition: 'all 0.18s',
                    cursor: 'pointer',
                  }}
                  onMouseOver={e => {
                    e.currentTarget.style.background = 'var(--color-surface-hover)'
                    e.currentTarget.style.borderColor = 'var(--color-accent-1)'
                    e.currentTarget.style.transform = 'translateY(-1px)'
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)'
                  }}
                  onMouseOut={e => {
                    e.currentTarget.style.background = 'var(--color-bg)'
                    e.currentTarget.style.borderColor = 'var(--color-border)'
                    e.currentTarget.style.transform = 'translateY(0)'
                    e.currentTarget.style.boxShadow = 'none'
                  }}
                >
                  {/* Logo */}
                  <img
                    src={`/logos/${team.logo}`}
                    alt={`${team.name} logo`}
                    style={{
                      width: '46px',
                      height: '46px',
                      objectFit: 'contain',
                      borderRadius: '8px',
                      flexShrink: 0,
                      background: 'white',
                      padding: '3px',
                    }}
                    onError={e => { e.currentTarget.style.display = 'none' }}
                  />

                  {/* Text */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: '6px',
                      marginBottom: '6px',
                    }}>
                      <span style={{
                        fontWeight: 700,
                        fontSize: '0.95rem',
                        color: 'var(--color-accent-1)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}>
                        {team.name}
                      </span>
                      {/* External link icon */}
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
                        stroke="var(--color-text-muted)" strokeWidth="2.5"
                        strokeLinecap="round" strokeLinejoin="round"
                        style={{ flexShrink: 0 }}>
                        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                        <polyline points="15 3 21 3 21 9"/>
                        <line x1="10" y1="14" x2="21" y2="3"/>
                      </svg>
                    </div>

                    {/* Division pills */}
                    {grades.length > 0 ? (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                        {grades.sort((a, b) => {
                          const order = g => g.isJunior ? 2 : g.label.includes('Women') ? 1 : 0
                          return order(a) - order(b) || a.label.localeCompare(b.label)
                        }).map(g => (
                          <button
                            key={g.gradeKey}
                            onClick={e => {
                              e.preventDefault()
                              e.stopPropagation()
                              onSelectGrade(g.gradeKey, g.isJunior)
                              onClose()
                            }}
                            title={`Filter by ${g.label}`}
                            style={{
                              fontSize: '0.7rem',
                              fontWeight: 600,
                              padding: '2px 8px',
                              borderRadius: '20px',
                              background: g.isJunior
                                ? 'rgba(56,142,60,0.12)'
                                : 'rgba(211,47,47,0.10)',
                              color: g.isJunior
                                ? 'var(--color-success, #4caf50)'
                                : 'var(--color-accent-1)',
                              border: g.isJunior
                                ? '1px solid rgba(56,142,60,0.25)'
                                : '1px solid rgba(211,47,47,0.25)',
                              letterSpacing: '0.3px',
                              cursor: 'pointer',
                              transition: 'all 0.15s',
                            }}
                            onMouseOver={e => {
                              e.currentTarget.style.transform = 'scale(1.06)'
                              e.currentTarget.style.background = g.isJunior
                                ? 'rgba(56,142,60,0.22)' : 'rgba(211,47,47,0.22)'
                            }}
                            onMouseOut={e => {
                              e.currentTarget.style.transform = 'scale(1)'
                              e.currentTarget.style.background = g.isJunior
                                ? 'rgba(56,142,60,0.12)' : 'rgba(211,47,47,0.10)'
                            }}
                          >
                            {g.label}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                        No divisions found
                      </span>
                    )}
                  </div>
                </a>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
