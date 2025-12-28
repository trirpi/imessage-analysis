// Helper functions for processing iMessage data

export interface Message {
  date: Date
  text: string
  isFromMe: boolean
  wordCount: number
}

export function countWords(text: string): number {
  if (!text || typeof text !== 'string') return 0
  const words = text.match(/\b\w+\b/g)
  return words ? words.length : 0
}

export function timestampToDate(timestampNs: number): Date {
  const epoch2001 = new Date('2001-01-01T00:00:00Z').getTime()
  const timestampMs = epoch2001 + (timestampNs / 1_000_000)
  return new Date(timestampMs)
}

export function getWeekKey(date: Date): string {
  const year = date.getFullYear()
  const startOfYear = new Date(year, 0, 1)
  const days = Math.floor((date.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000))
  const week = Math.floor(days / 7)
  return `${year}-W${String(week).padStart(2, '0')}`
}

export function getMonthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

export function getSimpleSentiment(text: string): number {
  if (!text || typeof text !== 'string') return 0
  const textLower = text.toLowerCase()
  const positiveWords = ['love', 'happy', 'great', 'amazing', 'wonderful', 'beautiful', 'perfect', 'excited', 'good', 'best', 'awesome', 'fantastic', 'sweet', 'cute', 'adorable', 'miss', '❤️', '😍', '😊', '🥰']
  const negativeWords = ['sad', 'angry', 'mad', 'bad', 'hate', 'worst', 'terrible', 'awful', 'sorry', 'upset', 'frustrated', 'annoyed', '😢', '😠', '😞']
  
  let posCount = 0
  let negCount = 0
  
  positiveWords.forEach(word => {
    if (textLower.includes(word)) posCount++
  })
  
  negativeWords.forEach(word => {
    if (textLower.includes(word)) negCount++
  })
  
  if (posCount + negCount === 0) return 0
  return (posCount - negCount) / (posCount + negCount + 1)
}

export function isReactionMessage(text: string): boolean {
  if (!text || typeof text !== 'string') return false
  const pattern = /'.+?'/
  return pattern.test(text)
}

