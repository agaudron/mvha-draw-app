const fs = require('fs');
const data = JSON.parse(fs.readFileSync('../../hockey-draw/matches.json', 'utf8'));

console.log("Total matches:", data.matches.length);
console.log("Total byes in matches.json:", data.matches.filter(m => m.isBye).length);

const showPastGames = false;
const showByes = true;

const monthMap = { March: '03', April: '04', May: '05', June: '06', July: '07', August: '08', September: '09', October: '10' };

function parseMatchDate(match) {
  if (!match || !match.date) return null
  const dateParts = match.date.split(' ')
  const month = monthMap[dateParts[0]] || '01'
  const dayMatch = (dateParts[1] || '').match(/\d+/)
  const day = dayMatch ? dayMatch[0].padStart(2, '0') : '01'

  let hours = 12, mins = '00'
  if (match.time) {
    const timeRegex = /(\d+)(?:\.(\d+))?\s*(am|pm)?/i
    const tm = match.time.match(timeRegex)
    if (tm) {
      let h = parseInt(tm[1], 10)
      if (h === 12 && tm[3] && tm[3].toLowerCase() === 'am') h = 0
      else if (h < 12 && tm[3] && tm[3].toLowerCase() === 'pm') h += 12
      hours = h
      mins = tm[2] || '00'
    }
  }
  
  return new Date(`2026-${month}-${day}T${hours}:${mins}:00`) 
}

const now = new Date("2026-03-19T21:40:55+11:00");
const filtered = data.matches.filter(m => {
  if (!showByes && m.isBye) return false;

  if (!showPastGames) {
    const matchDate = parseMatchDate(m);
    if (matchDate) {
      const matchEnd = new Date(matchDate.getTime() + 120 * 60000);
      if (matchEnd < now) return false;
    }
  }
  return true;
});

console.log("Byes after filtering:", filtered.filter(m => m.isBye).length);
