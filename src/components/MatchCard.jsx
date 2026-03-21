import teamsData from '../teams.json'
import { parseMatchDate } from '../utils/dateUtils'

// DMS → decimal conversion (S and W are negative)
const FIELD_COORDS = {
  atf:       { lat: -31.89569,  lng: 152.48853 }, // 31°53'44.5"S 152°29'18.7"E
  tlf:       { lat: -31.89589,  lng: 152.48953 }, // 31°53'45.2"S 152°29'22.3"E
  'field 3': { lat: -31.896917, lng: 152.48969 }, // 31°53'48.9"S 152°29'22.9"E
  port:      { lat: -31.452306, lng: 152.899639 }, // 31°27'08.3"S 152°53'58.7"E
  'atf-1':   { lat: -31.89569,  lng: 152.48853 }, // same as ATF
  'atf-2':   { lat: -31.89569,  lng: 152.48853 }, // same as ATF
}

const getFieldMapUrl = (field) => {
  if (!field) return null
  const key = field.toLowerCase().replace(/\s+/g, ' ')
  const coords = FIELD_COORDS[key] || FIELD_COORDS[key.replace(/\s+/g, '-')]
  if (!coords) return null
  return `https://www.google.com/maps/search/?api=1&query=${coords.lat},${coords.lng}`
}

export default function MatchCard({ match, index, selectedTeam, onFilterChange, layout = 'grid' }) {
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
    const upper = name.toUpperCase()
    if (upper === 'BYE' || upper === 'TBA' || upper === 'TBD') return null
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
    const imgContent = logoName ? (
      <img
        key={name}
        src={`${import.meta.env.BASE_URL}logos/${logoName}`}
        alt={name}
        className="team-logo"
        style={{ borderRadius: '50%' }}
        onError={(e) => { e.target.style.display = 'none'; }}
      />
    ) : null

    return (
      <div className="team-display">
        <div className="team-logo-wrapper" data-initial={name.charAt(0)}>
          {url ? <a href={url} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', width: '100%', height: '100%' }} title={`Visit ${name} website`}>{imgContent}</a> : imgContent}
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

  // ── List (horizontal) layout ──────────────────────────────────────────────
  if (layout === 'list') {
    const isSelectedTeamB = selectedTeam && match.teamB &&
      match.teamB.toLowerCase().trim() === selectedTeam.toLowerCase().trim()
    const leftName = isSelectedTeamB ? match.teamB : match.teamA
    const rightName = isSelectedTeamB ? match.teamA : match.teamB

    const miniLogo = (name) => {
      const logo = getLogoName(name)
      return logo ? (
        <img
          src={`${import.meta.env.BASE_URL}logos/${logo}`}
          alt={name}
          style={{ width: '32px', height: '32px', objectFit: 'contain', borderRadius: '50%', background: 'white', padding: '2px', flexShrink: 0 }}
          onError={e => { e.currentTarget.style.display = 'none' }}
        />
      ) : null
    }

    const formatDate = () => {
      if (!match.date) return ''
      const parts = match.date.trim().split(' ')
      if (parts.length === 2) {
        const n = parseInt(parts[1], 10)
        const suffix = n % 100 >= 11 && n % 100 <= 13 ? 'th'
          : n % 10 === 1 ? 'st' : n % 10 === 2 ? 'nd' : n % 10 === 3 ? 'rd' : 'th'
        return `${n}${suffix} ${parts[0]}`
      }
      return match.date
    }

    return (
      <article
        className="match-card match-card--list"
        data-grade={match.grade}
        style={{ animationDelay: animDelay }}
      >
        {/* Grade badge */}
        <span
          className="grade-badge"
          style={{ cursor: onFilterChange ? 'pointer' : 'default', flexShrink: 0 }}
          onClick={e => { if (onFilterChange && match.grade) { e.stopPropagation(); onFilterChange('gradeKeys', [match.grade]) } }}
          title={onFilterChange ? `Filter by ${match.grade}` : undefined}
        >
          {match.gradeLabel || match.grade}
          {match.gender === 'Men' && <span className="gender-icon" style={{ marginLeft: '2px' }}>♂</span>}
          {match.gender === 'Women' && <span className="gender-icon" style={{ marginLeft: '2px' }}>♀</span>}
        </span>

        {/* Teams */}
        <div className="list-teams">
          <span className="list-team">
            {miniLogo(leftName)}
            <span className="list-team-name">{leftName || '—'}</span>
          </span>
          <span className="list-vs">vs</span>
          <span className="list-team">
            {miniLogo(rightName)}
            <span className="list-team-name">{rightName || '—'}</span>
          </span>
        </div>

        {/* Time + field + cal */}
        <div className="list-meta">
          {match.time && <span className="list-meta-item">🕐 {match.time}</span>}
          {match.field && (() => {
            const mapUrl = getFieldMapUrl(match.field)
            const tag = (
              <span
                className="field-tag list-meta-item"
                data-field={match.field.replace(/\s+/g, '-').toLowerCase()}
                style={{ cursor: onFilterChange ? 'pointer' : 'default', padding: '3px 6px', fontSize: '0.75rem', textAlign: 'center' }}
                onClick={e => { if (onFilterChange) { e.stopPropagation(); onFilterChange('fieldKey', match.field) } }}
              >
                {match.field}
              </span>
            )
            return mapUrl
              ? <a href={mapUrl} target="_blank" rel="noopener noreferrer" title={`Open ${match.field} in Google Maps`} onClick={e => e.stopPropagation()} style={{ textDecoration: 'none', display: 'inline-flex', flexShrink: 0 }}>{tag}</a>
              : tag
          })()}
          {(!match.isBye && match.date && match.time) && (
            <a
              href={generateICSLink()}
              download={`${match.teamA}-vs-${match.teamB}.ics`}
              className="calendar-add-btn"
              title="Download Calendar Event"
              style={{ marginLeft: 'auto' }}
            >
              <span>+ Cal</span>
            </a>
          )}
        </div>
      </article>
    )
  }

  // ── Grid (card) layout ────────────────────────────────────────────────────
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
              onFilterChange('gradeKeys', [match.grade])
            }
          }}
          onMouseOver={e => onFilterChange && (e.currentTarget.style.transform = 'scale(1.05)')}
          onMouseOut={e => onFilterChange && (e.currentTarget.style.transform = 'scale(1)')}
          title={onFilterChange ? `Filter by ${match.grade}` : undefined}
        >
          {match.gradeLabel || match.grade || '—'}
          {match.gender === 'Men' ? <span className="gender-icon">♂</span> : match.gender === 'Women' ? <span className="gender-icon">♀</span> : ''}
        </span>
        {match.field && (() => {
          const mapUrl = getFieldMapUrl(match.field)
          const tag = (
            <span
              className="field-tag"
              style={{ cursor: onFilterChange ? 'pointer' : 'default', transition: 'transform 0.1s' }}
              title={onFilterChange ? `Filter by ${match.field} field` : match.field}
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
          )
          return mapUrl
            ? <a href={mapUrl} target="_blank" rel="noopener noreferrer" title={`Open ${match.field} in Google Maps`} onClick={e => e.stopPropagation()} style={{ textDecoration: 'none' }}>{tag}</a>
            : tag
        })()}
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
