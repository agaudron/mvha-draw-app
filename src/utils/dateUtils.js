export function parseMatchDate(match) {
  if (!match || !match.date) return null
  const monthMap = { March: '03', April: '04', May: '05', June: '06', July: '07', August: '08', September: '09', October: '10' }
  const dateParts = match.date.split(' ')
  const month = monthMap[dateParts[0]] || '01'
  const dayMatch = (dateParts[1] || '').match(/\d+/)
  const day = dayMatch ? dayMatch[0].padStart(2, '0') : '01'
  
  let hours = 12, mins = '00'
  if (match.time) {
    const timeStr = match.time.toLowerCase()
    const isPM = timeStr.includes('pm')
    const timeParts = timeStr.replace(/[a-z]/g, '').split('.')
    let h = parseInt(timeParts[0], 10) || 12
    if (isPM && h !== 12) h += 12
    if (!isPM && h === 12) h = 0
    hours = h.toString().padStart(2, '0')
    if (timeParts[1]) mins = timeParts[1].padStart(2, '0')
  }
  
  return new Date(`2026-${month}-${day}T${hours}:${mins}:00`)
}

export function getTodayDateString() {
  const now = new Date()
  const months = ['January','February','March','April','May','June','July','August','September','October','November','December']
  const month = months[now.getMonth()]
  const d = now.getDate()
  const suffix = d === 1 || d === 21 || d === 31 ? 'st'
    : d === 2 || d === 22 ? 'nd'
    : d === 3 || d === 23 ? 'rd'
    : 'th'
  return `${month} ${d}${suffix}`
}
