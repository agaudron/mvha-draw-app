import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

export function exportMatchesToPdf(matches, filters) {
  const doc = new jsPDF()

  // Title
  doc.setFontSize(18)
  doc.setTextColor(225, 61, 61) // Red theme color
  doc.text('Manning Valley Senior Hockey Draw', 14, 22)

  // Document active filters
  const activeFilters = []
  if (filters?.genderKey) activeFilters.push(filters.genderKey)
  if (filters?.gradeKey) activeFilters.push(filters.gradeKey)
  if (filters?.team) activeFilters.push(`Team: ${filters.team}`)
  if (filters?.monthKey) activeFilters.push(`Month: ${filters.monthKey}`)
  if (filters?.fieldKey) activeFilters.push(`Field: ${filters.fieldKey}`)
  
  const filterText = activeFilters.length > 0 
    ? `Draw: ${activeFilters.join(' - ')}`
    : 'Full Season Draw'

  doc.setFontSize(12)
  doc.setTextColor(50, 50, 50)
  doc.text(filterText, 14, 30)

  // Subtitle / Disclaimer
  const now = new Date()
  const dateString = now.toLocaleDateString() + ' ' + now.toLocaleTimeString()
  doc.setFontSize(10)
  doc.setTextColor(100, 100, 100)
  doc.text(`Generated on: ${dateString}`, 14, 38)
  doc.text('Note: This data is subject to change. Please confirm officially.', 14, 43)

  // Table Data
  const tableColumn = ["Date", "Time", "Grade", "Field", "Team A", "Team B"]
  const tableRows = []

  matches.forEach(match => {
    // Determine the teams
    let teamA = match.teamA || ''
    let teamB = match.isBye ? 'BYE' : (match.teamB || '')
    
    // Swap teams if the user filtered by a specific team and it's currently Team B
    if (filters?.team && teamA.toLowerCase().trim() !== filters.team.toLowerCase().trim() && teamB.toLowerCase().trim() === filters.team.toLowerCase().trim()) {
      teamA = match.teamB || ''
      teamB = match.teamA || ''
    }

    // Determine grade with gender if provided
    const genderStr = match.gender === 'Men' ? ' (M)' : match.gender === 'Women' ? ' (W)' : ''
    const grade = (match.gradeLabel || match.grade || '') + genderStr

    const dateStr = match.day && match.date ? `${match.day}, ${match.date}` : match.day || match.date || ''

    const rowData = [
      dateStr,
      match.time || '',
      grade,
      match.field || '',
      teamA,
      teamB
    ]
    tableRows.push(rowData)
  })

  // Start table at Y=50
  autoTable(doc, {
    head: [tableColumn],
    body: tableRows,
    startY: 50,
    theme: 'striped',
    headStyles: { fillColor: [225, 61, 61] },
    styles: { fontSize: 9 }
  })

  // Save the PDF
  const filenameDate = now.toISOString().split('T')[0]
  const filenamePrefix = activeFilters.length > 0 ? activeFilters.join('_').replace(/[^a-zA-Z0-9]/g, '_') : 'Full_Draw'
  doc.save(`MVHA_${filenamePrefix}_${filenameDate}.pdf`)
}
