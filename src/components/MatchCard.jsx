import teamsData from '../teams.json'
import { parseMatchDate } from '../utils/dateUtils'

export default function MatchCard({ match, index, selectedTeam, onFilterChange }) {
  const animDelay = `${(index % 12) * 0.04}s`

  const getLogoName = (name) => {
    if (!name) return null
    // Map team names that might have extra text/umpire info from the PDF or variations
    // to their actual logo filename.
    const lower = name.toLowerCase()
    if (lower.includes('chatham')) return 'Chatham.jpg'
    if (lower.includes('cougars')) return 'Cougars.jpg'
    if (lower.includes('gloucester')) return 'Gloucester.jpg'
    if (lower.includes('great lakes') || lower.includes('strikers')) return 'Great Lakes Strikers.jpg'
    if (lower.includes('sharks')) return 'Sharks.jpg'
    if (lower.includes('taree west')) return 'Taree West.jpg'
    if (lower.includes('tacking point thunder')) return 'Tacking Point Thunder.jpg'
    if (lower.includes('tigers')) return 'Tigers.jpg'
    if (lower.includes('wingham')) return 'Wingham.png'
    return `${name}.jpg`
  }

  const renderTeam = (name) => {
    if (!name || name === '—') {
      return (
        <div className="team-display">
          <span className="team-name">—</span>
        </div>
      )
    }
    const logoName = getLogoName(name)
    let url = null
    const teamObj = teamsData.find(t => t.logo === logoName)
    if (teamObj) {
      if (teamObj.alt_urls && teamObj.alt_urls.length > 0) {
        const allUrls = [teamObj.url, ...teamObj.alt_urls].filter(Boolean)
        url = allUrls[Math.floor(Math.random() * allUrls.length)]
      } else {
        url = teamObj.url
      }
    }
    const imgContent = (
      <img 
        key={name}
        src={`/logos/${logoName}`} 
        alt={name} 
        className="team-logo"
        style={{ borderRadius: '50%' }}
        onError={(e) => { e.target.style.display = 'none'; }}
      />
    )

    return (
      <div className="team-display">
        <div className="team-logo-wrapper" data-initial={name.charAt(0)}>
          {url ? <a href={url} target="_blank" rel="noopener noreferrer" style={{display: 'flex', width: '100%', height: '100%'}} title={`Visit ${name} website`}>{imgContent}</a> : imgContent}
        </div>
        <span className="team-name">{name}</span>
      </div>
    )
  }

  const generateICSLink = () => {
    const startObj = parseMatchDate(match)
    if (!startObj) return '#'

    const endObj = new Date(startObj.getTime() + 90 * 60000) // 1.5 hours match duration
    const formatDt = (d) => {
      const pad = (n) => n.toString().padStart(2, '0')
      return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`
    }
    
    const title = `${match.teamA} vs ${match.teamB} (${match.gradeLabel || match.grade})`
    const location = match.field ? `${match.field}, Manning Valley Hockey` : 'Manning Valley Hockey'
    
    const content = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Manning Valley Hockey//Draw App//EN',
      'BEGIN:VEVENT',
      `DTSTART;TZID=Australia/Sydney:${formatDt(startObj)}`,
      `DTEND;TZID=Australia/Sydney:${formatDt(endObj)}`,
      `SUMMARY:${title}`,
      `LOCATION:${location}`,
      'END:VEVENT',
      'END:VCALENDAR'
    ].join('\r\n')
    
    return `data:text/calendar;charset=utf-8,${encodeURIComponent(content)}`
  }

  return (
    <article
      className="match-card"
      data-grade={match.grade}
      style={{ animationDelay: animDelay }}
    >
      <div className="card-header">
        <span 
          className="grade-badge"
          style={{ cursor: onFilterChange ? 'pointer' : 'default', transition: 'transform 0.1s' }}
          onClick={(e) => {
            if (onFilterChange && match.grade) {
              e.stopPropagation()
              onFilterChange('gradeKey', match.grade)
            }
          }}
          onMouseOver={e => onFilterChange && (e.currentTarget.style.transform = 'scale(1.05)')}
          onMouseOut={e => onFilterChange && (e.currentTarget.style.transform = 'scale(1)')}
          title={onFilterChange ? `Filter by ${match.grade}` : undefined}
        >
          {match.gradeLabel || match.grade || '—'}
          {match.gender === 'Men' ? <span className="gender-icon">♂</span> : match.gender === 'Women' ? <span className="gender-icon">♀</span> : ''}
        </span>
        {match.field && (
          <span 
            className="field-tag" 
            style={{ cursor: onFilterChange ? 'pointer' : 'default', transition: 'transform 0.1s' }}
            title={onFilterChange ? `Filter by ${match.field} field` : 'Field'}
            data-field={match.field.replace(/\s+/g, '-').toLowerCase()}
            onClick={(e) => {
              if (onFilterChange) {
                e.stopPropagation()
                onFilterChange('fieldKey', match.field)
              }
            }}
            onMouseOver={e => onFilterChange && (e.currentTarget.style.transform = 'scale(1.05)')}
            onMouseOut={e => onFilterChange && (e.currentTarget.style.transform = 'scale(1)')}
          >
            {match.field}
          </span>
        )}
      </div>

      {(() => {
        const isSelectedTeamB = selectedTeam && match.teamB && match.teamB.toLowerCase().trim() === selectedTeam.toLowerCase().trim()
        const leftTeamName = isSelectedTeamB ? match.teamB : match.teamA
        const rightTeamName = isSelectedTeamB ? match.teamA : match.teamB

        return (
          <div className="teams-vs">
            {renderTeam(leftTeamName)}
            <div className="vs-divider">
              <div className="vs-line" />
              <span className="vs-text">VS</span>
              <div className="vs-line" />
            </div>
            {renderTeam(rightTeamName)}
          </div>
        )
      })()}

      <div className="card-footer">
        <div className="card-footer-left">
          {(!match.isBye && (match.day || match.date)) && (
            <span className="time-display">
              <span className="day-icon">🗓️</span>
              {match.day}{match.day && match.date ? ', ' : ''}{(() => {
                if (!match.date) return ''
                const parts = match.date.trim().split(' ')
                if (parts.length === 2) {
                  const n = parseInt(parts[1], 10)
                  const suffix = n % 100 >= 11 && n % 100 <= 13 ? 'th'
                    : n % 10 === 1 ? 'st'
                    : n % 10 === 2 ? 'nd'
                    : n % 10 === 3 ? 'rd' : 'th'
                  return `${n}${suffix} ${parts[0]}`
                }
                return match.date
              })()}
            </span>
          )}
          {match.time && (
            <span className="time-display">
              <span className="time-icon">🕐</span>
              {match.time}
            </span>
          )}
        </div>
        {(!match.isBye && match.date && match.time) && (
          <a
            href={generateICSLink()}
            download={`${match.teamA}-vs-${match.teamB}.ics`}
            className="calendar-add-btn"
            title="Download Calendar Event"
          >
            <span>+ Cal</span>
          </a>
        )}
      </div>
    </article>
  )
}
