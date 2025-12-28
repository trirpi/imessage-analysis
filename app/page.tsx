'use client'

import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import Sentiment from 'sentiment'
import { Heatmap } from '@/components/Heatmap'
import { WordsPerWeek } from '@/components/WordsPerWeek'
import { ConversationRatio } from '@/components/ConversationRatio'
import { ResponseTime } from '@/components/ResponseTime'
import { ReplyLadder } from '@/components/ReplyLadder'
import { SentimentTrend } from '@/components/SentimentTrend'

// Component for message with hover tooltip
function MessagePreview({ text, className }: { text: string; className?: string }) {
  const [showTooltip, setShowTooltip] = useState(false)
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 })
  const [mounted, setMounted] = useState(false)
  const elementRef = useRef<HTMLDivElement>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)
  
  useEffect(() => {
    setMounted(true)
  }, [])
  
  const updateTooltipPosition = (e: React.MouseEvent) => {
    const x = e.clientX
    const y = e.clientY
    
    // Adjust position to keep tooltip on screen
    let left = x + 15
    let top = y + 15
    
    if (tooltipRef.current) {
      const tooltipWidth = tooltipRef.current.offsetWidth
      const tooltipHeight = tooltipRef.current.offsetHeight
      
      // If tooltip would go off right edge, position to the left of cursor
      if (left + tooltipWidth > window.innerWidth) {
        left = x - tooltipWidth - 15
      }
      
      // If tooltip would go off bottom edge, position above cursor
      if (top + tooltipHeight > window.innerHeight) {
        top = y - tooltipHeight - 15
      }
      
      // Keep tooltip on screen
      if (left < 10) left = 10
      if (top < 10) top = 10
    }
    
    setTooltipPosition({ x: left, y: top })
  }
  
  const handleMouseEnter = (e: React.MouseEvent) => {
    setShowTooltip(true)
    updateTooltipPosition(e)
  }
  
  const handleMouseMove = (e: React.MouseEvent) => {
    updateTooltipPosition(e)
  }
  
  const handleMouseLeave = () => {
    setShowTooltip(false)
  }
  
  const tooltipContent = showTooltip && mounted ? (
    <div
      ref={tooltipRef}
      className="fixed bg-gray-900 text-white text-xs rounded-lg p-3 max-w-md shadow-2xl pointer-events-none border border-gray-700"
      style={{
        left: `${tooltipPosition.x}px`,
        top: `${tooltipPosition.y}px`,
        zIndex: 99999, // Very high z-index, rendered via portal so it's above everything
      }}
    >
      <div className="whitespace-pre-wrap break-words">{text}</div>
    </div>
  ) : null
  
  return (
    <>
      <div
        ref={elementRef}
        className={className}
        onMouseEnter={handleMouseEnter}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        "{text.substring(0, 80)}{text.length > 80 ? '...' : ''}"
      </div>
      {mounted && createPortal(tooltipContent, document.body)}
    </>
  )
}

// Component for longest messages dropdown
function LongestMessagesDropdown({ messages }: { messages: { text: string; length: number; isFromMe: boolean; date: Date }[] }) {
  const [isOpen, setIsOpen] = useState(false)
  
  return (
    <div className="mt-3">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full text-xs opacity-75 hover:opacity-100 underline text-left flex items-center justify-between"
      >
        <span>View top {messages.length} longest messages</span>
        <svg
          className={`w-4 h-4 transition-transform ${isOpen ? 'transform rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {isOpen && (
        <div className="mt-3 space-y-2 max-h-64 overflow-y-auto">
          {messages.map((msg, idx) => (
            <div key={idx} className="bg-white/5 rounded p-2 border border-white/10">
              <div className="flex items-center justify-between mb-1">
                <div className="text-xs opacity-75">
                  #{idx + 1} • {msg.isFromMe ? 'You' : 'Them'} • {msg.date.toLocaleDateString()}
                </div>
                <div className="text-xs font-semibold">{msg.length.toLocaleString()} chars</div>
              </div>
              <MessagePreview 
                text={msg.text} 
                className="text-xs opacity-90 line-clamp-2 italic"
              />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// Dynamic import for sql.js to handle WASM properly
let initSqlJs: any = null
let SQL: any = null

interface Contact {
  rowid: number
  id: string
  name?: string
  messageCount: number
  lastMessage?: string
  lastMessageDate?: number
}

type Screen = 'upload' | 'dashboard'

export default function Home() {
  const [screen, setScreen] = useState<Screen>('upload')
  const [db, setDb] = useState<any>(null)
  const [contacts, setContacts] = useState<Contact[]>([])
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null)
  const [heatmapData, setHeatmapData] = useState<{ day: string; hour: number; value: number }[]>([])
  const [wordsPerWeekData, setWordsPerWeekData] = useState<{ week: string; words: number }[]>([])
  const [wordsPerWeekMessages, setWordsPerWeekMessages] = useState<{ text: string; date: Date; isFromMe: boolean; weekKey: string }[]>([])
  const [conversationRatioData, setConversationRatioData] = useState<{ week: string; you: number; them: number }[]>([])
  const [responseTimeData, setResponseTimeData] = useState<{ month: string; all: number | null; you: number | null }[]>([])
  const [replyLadderData, setReplyLadderData] = useState<{ doubleTextsYou: number; doubleTextsThem: number; endersYou: number; endersThem: number } | null>(null)
  const [sentimentData, setSentimentData] = useState<{ week: string; you: number | null; them: number | null; all: number | null }[]>([])
  const [loading, setLoading] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sqlLoaded, setSqlLoaded] = useState(false)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [filterReactions, setFilterReactions] = useState(true)
  const [reactionCount, setReactionCount] = useState(0)
  const [attributedBodyCount, setAttributedBodyCount] = useState(0)
  const [wrappedStats, setWrappedStats] = useState<{
    mostActiveDay: { date: Date; count: number } | null
    longestText: { text: string; length: number; isFromMe: boolean; date: Date } | null
    longestTextYou: { text: string; length: number; date: Date } | null
    longestTextThem: { text: string; length: number; date: Date } | null
    longestTexts: { text: string; length: number; isFromMe: boolean; date: Date }[]
    topEmojis: { emoji: string; count: number; isFromMe: boolean }[]
    totalMessagesYou: number
    totalMessagesThem: number
    totalWordsYou: number
    totalWordsThem: number
  } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Load sql.js on component mount
  useEffect(() => {
    const loadSql = async () => {
      try {
        const sqlJsModule = await import('sql.js')
        initSqlJs = sqlJsModule.default
        SQL = await initSqlJs({
          locateFile: (file: string) => `https://sql.js.org/dist/${file}`
        })
        setSqlLoaded(true)
      } catch (err) {
        console.error('Failed to load sql.js:', err)
        setError('Failed to load SQL.js library. Please refresh the page.')
      }
    }
    loadSql()
  }, [])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false)
      }
    }

    if (dropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [dropdownOpen])

  // Function to decode attributedBody BLOB
  // Returns object with decoded text (or null) and debug info
  const decodeAttributedBody = async (attributedBodyBlob: Uint8Array | null): Promise<{ text: string | null; debugInfo?: any }> => {
    if (!attributedBodyBlob || attributedBodyBlob.length === 0) {
      return { text: null }
    }

    try {
      // Import Buffer polyfill if needed
      let BufferClass: any
      if (typeof Buffer !== 'undefined') {
        BufferClass = Buffer
      } else {
        const bufferModule = await import('buffer')
        BufferClass = bufferModule.Buffer
      }
      
      // Convert Uint8Array to Buffer
      const buffer = BufferClass.from(attributedBodyBlob)
      
      // Check the first few bytes to determine format
      const firstBytes = buffer.slice(0, Math.min(20, buffer.length))
      const hexHeader = Array.from(firstBytes as Uint8Array).map((b: number) => b.toString(16).padStart(2, '0')).join(' ')
      const asciiHeader = firstBytes.toString('ascii', 0, Math.min(20, buffer.length)).replace(/[^\x20-\x7E]/g, '.')
      
      // Check if it's a binary plist (starts with "bplist")
      if (asciiHeader.startsWith('bplist')) {
        // It's a binary plist, parse it
        const bplistModule = await import('bplist-parser')
        const bplist = bplistModule.default || bplistModule
        
        try {
          // Note: bplist-parser doesn't support maxObjectCount option
          // If parsing fails with "maxObjectCount exceeded", we'll fall back to string extraction
          const parsed = bplist.parseBuffer(buffer)
          
          if (!parsed || parsed.length === 0) {
            // Fall through to string extraction
          } else {

        // Navigate the plist structure to find the text
        // attributedBody contains an NSAttributedString (NSKeyedArchiver format)
        const plistData = parsed[0]
      
      // NSKeyedArchiver format has $objects array and $top/$archiver keys
      // The text is usually in the $objects array
      if (plistData.$objects && Array.isArray(plistData.$objects)) {
        console.log(`[decodeAttributedBody] Found $objects array with ${plistData.$objects.length} items`)
        // Look through all objects for strings
        const allStrings: string[] = []
        
        for (let i = 0; i < plistData.$objects.length; i++) {
          const obj = plistData.$objects[i]
          
          // Direct string
          if (typeof obj === 'string' && obj.length > 0) {
            allStrings.push(obj)
          }
          // Object that might contain the string
          else if (obj && typeof obj === 'object') {
            // Check for NS.string property
            if (obj.NS?.string && typeof obj.NS.string === 'string') {
              allStrings.push(obj.NS.string)
            }
            if (obj.NSString && typeof obj.NSString === 'string') {
              allStrings.push(obj.NSString)
            }
            if (obj.string && typeof obj.string === 'string') {
              allStrings.push(obj.string)
            }
            
            // Check for NSAttributedString structure
            // The string might be referenced by index in $objects
            if (obj.NSAttributedString) {
              const attrStr = obj.NSAttributedString
              if (attrStr.string && typeof attrStr.string === 'string') {
                allStrings.push(attrStr.string)
              }
              // Sometimes it's a reference (CF$UID) pointing to another object
              if (attrStr.string && typeof attrStr.string === 'object' && attrStr.string.CF$UID !== undefined) {
                const refIndex = attrStr.string.CF$UID
                if (plistData.$objects[refIndex] && typeof plistData.$objects[refIndex] === 'string') {
                  allStrings.push(plistData.$objects[refIndex])
                }
              }
            }
            
            // Recursively search this object
            const searchObject = (o: any): void => {
              if (typeof o === 'string' && o.length > 0) {
                allStrings.push(o)
              } else if (o && typeof o === 'object') {
                if (Array.isArray(o)) {
                  o.forEach(item => searchObject(item))
                } else {
                  Object.keys(o).forEach(key => {
                    if (key !== '$class' && key !== '$classes') {
                      searchObject(o[key])
                    }
                  })
                }
              }
            }
            searchObject(obj)
          }
        }
        
        // Filter and return the most likely message text
        console.log(`[decodeAttributedBody] Found ${allStrings.length} total strings`)
        if (allStrings.length > 0) {
          // Remove duplicates
          const uniqueStrings = Array.from(new Set(allStrings))
          console.log(`[decodeAttributedBody] ${uniqueStrings.length} unique strings`)
          
          // Filter out very short strings and metadata
          const meaningfulStrings = uniqueStrings.filter(s => 
            s.length > 3 && 
            !s.match(/^[A-Z][a-z]+$/) && // Not just a single capitalized word (likely class name)
            !s.startsWith('NS') && // Not NS class names
            !s.match(/^\d+$/) // Not just numbers
          )
          console.log(`[decodeAttributedBody] ${meaningfulStrings.length} meaningful strings`)
          
          if (meaningfulStrings.length > 0) {
            // Prefer strings that look like actual text
            const textLikeStrings = meaningfulStrings.filter(s => 
              s.includes(' ') || s.match(/[.,!?;:]/) || s.length > 20
            )
            console.log(`[decodeAttributedBody] ${textLikeStrings.length} text-like strings`)
            
            if (textLikeStrings.length > 0) {
              // Return the longest text-like string
              const result = textLikeStrings.sort((a, b) => b.length - a.length)[0]
              console.log(`[decodeAttributedBody] Success! Decoded text (${result.length} chars):`, result.substring(0, 50) + '...')
              return { text: result }
            }
            
            // Fallback to longest meaningful string
            const result = meaningfulStrings.sort((a, b) => b.length - a.length)[0]
            console.log(`[decodeAttributedBody] Success (fallback)! Decoded text (${result.length} chars):`, result.substring(0, 50) + '...')
            return { text: result }
          } else {
            console.log('[decodeAttributedBody] No meaningful strings found. Sample strings:', uniqueStrings.slice(0, 5))
          }
        } else {
          console.log('[decodeAttributedBody] No strings found in $objects')
        }
      } else {
        console.log('[decodeAttributedBody] No $objects array found')
      }
      
      // Fallback: try to find any string in the entire structure
      const findAllStrings = (obj: any, strings: string[] = []): string[] => {
        if (typeof obj === 'string' && obj.length > 0) {
          strings.push(obj)
        } else if (obj && typeof obj === 'object') {
          if (Array.isArray(obj)) {
            obj.forEach(item => findAllStrings(item, strings))
          } else {
            Object.keys(obj).forEach(key => {
              if (!key.startsWith('$') || key === '$objects') {
                findAllStrings(obj[key], strings)
              }
            })
          }
        }
        return strings
      }

      const allStrings = findAllStrings(plistData)
      console.log(`[decodeAttributedBody] Fallback search found ${allStrings.length} strings`)
      const meaningfulStrings = allStrings.filter(s => s.length > 3)
      
      if (meaningfulStrings.length > 0) {
        const result = meaningfulStrings.sort((a, b) => b.length - a.length)[0]
        console.log(`[decodeAttributedBody] Success (fallback search)! Decoded text:`, result.substring(0, 50) + '...')
        return { text: result }
      }

        console.log('[decodeAttributedBody] No strings found in fallback search')
          }
        } catch (parseError: any) {
          // If bplist parsing fails (e.g., maxObjectCount exceeded), fall through to string extraction
          // Don't return here - continue to string extraction strategies below
        }
      }
      
      // If we get here, either it wasn't a bplist, or bplist parsing failed
      // Always try string extraction strategies as fallback
      // Extract text directly from the buffer
      
      // Strategy 1: Extract all null-terminated strings (most reliable for typedstream)
        const strings: string[] = []
        let currentString = ''
        let inString = false
        
        for (let i = 0; i < buffer.length; i++) {
          const byte = buffer[i]
          if (byte >= 32 && byte <= 126) {
            // Printable ASCII character
            currentString += String.fromCharCode(byte)
            inString = true
          } else if (byte === 0 && inString) {
            // Null terminator - end of string
            if (currentString.length >= 2) {
              strings.push(currentString)
            }
            currentString = ''
            inString = false
          } else if (byte < 32 || byte > 126) {
            // Non-printable character
            if (inString && currentString.length >= 2) {
              strings.push(currentString)
            }
            currentString = ''
            inString = false
          }
        }
        // Check last string if buffer doesn't end with null
        if (inString && currentString.length >= 2) {
          strings.push(currentString)
        }
        
        // Filter and find the best string
        let debugInfo: any = null
        
        if (strings.length > 0) {
          // Remove duplicates
          const uniqueStrings = Array.from(new Set(strings))
          
          // Filter out only obvious metadata - be very lenient to decode as many messages as possible
          const metadataPatterns = [
            'streamtyped',
            '__kIMMessagePartAttributeName'
          ]
          
          const meaningful = uniqueStrings.filter((s: string) => {
            const trimmed = s.trim()
            // Only exclude obvious metadata
            if (metadataPatterns.some(pattern => trimmed === pattern || trimmed.includes(pattern))) {
              return false
            }
            // Exclude strings that are ONLY metadata indicators
            if ((trimmed.startsWith('NS') || trimmed.startsWith('__') || trimmed.startsWith('CF')) && trimmed.length < 10) {
              return false
            }
            // Accept almost anything that has some content
            return trimmed.length >= 2
          })
          
          // Store debug info for failed decodes
          debugInfo = {
            totalStrings: strings.length,
            uniqueStrings: uniqueStrings.length,
            meaningfulStrings: meaningful.length,
            allStrings: uniqueStrings.slice(0, 10),
            meaningful: meaningful.slice(0, 10)
          }
          
          if (meaningful.length > 0) {
            // Try to reconstruct split strings
            const reconstructed: string[] = []
            for (let i = 0; i < meaningful.length; i++) {
              for (let j = i + 1; j < meaningful.length; j++) {
                const s1 = meaningful[i]
                const s2 = meaningful[j]
                // Check if they might be parts of the same message
                if (s1.endsWith("'") || s1.endsWith("n") || s1.endsWith("t") || s1.endsWith(" ")) {
                  if (s2.startsWith("t ") || s2.startsWith("'") || s2.match(/^[a-z]/)) {
                    const combined = (s1 + s2).trim()
                    if (combined.length > Math.max(s1.length, s2.length)) {
                      reconstructed.push(combined)
                    }
                  }
                }
                // Also try reverse order
                if (s2.endsWith("'") || s2.endsWith("n") || s2.endsWith("t") || s2.endsWith(" ")) {
                  if (s1.startsWith("t ") || s1.startsWith("'") || s1.match(/^[a-z]/)) {
                    const combined = (s2 + s1).trim()
                    if (combined.length > Math.max(s1.length, s2.length)) {
                      reconstructed.push(combined)
                    }
                  }
                }
              }
            }
            
            // Add reconstructed strings to the list
            const allCandidates = [...meaningful, ...reconstructed]
            
            // Prefer longer strings with spaces
            const withSpaces = allCandidates.filter((s: string) => s.includes(' '))
            if (withSpaces.length > 0) {
              const result = withSpaces.sort((a: string, b: string) => b.length - a.length)[0].trim()
              if (result.length >= 2) {
                return { text: result }
              }
            }
            // Fallback to longest string
            const result = allCandidates.sort((a: string, b: string) => b.length - a.length)[0].trim()
            if (result.length >= 2) {
              return { text: result }
            }
          }
        } else {
          debugInfo = {
            totalStrings: 0,
            uniqueStrings: 0,
            meaningfulStrings: 0,
            allStrings: [],
            meaningful: []
          }
        }
        
        // Strategy 2: Try UTF-8 decoding with different offsets
        for (let offset = 15; offset < Math.min(100, buffer.length); offset += 1) {
          try {
            const testBuffer = buffer.slice(offset)
            const testText = testBuffer.toString('utf8', 0, Math.min(testBuffer.length, 500))
            
            // Look for text patterns
            const matches = testText.match(/[a-zA-Z0-9][a-zA-Z0-9\s.,!?;:'"()-]{8,}/g)
            if (matches) {
              const good = matches.filter((m: string) => {
                const trimmed = m.trim()
                return trimmed.length >= 8 &&
                  trimmed.includes(' ') &&
                  !trimmed.startsWith('NS') &&
                  trimmed.match(/[a-z]/) &&
                  trimmed.match(/[a-zA-Z]/) // Has letters
              })
              
              if (good.length > 0) {
                const result = good.sort((a: string, b: string) => b.length - a.length)[0].trim()
                if (result.length >= 8) {
                  return { text: result }
                }
              }
            }
          } catch (e) {
            // Continue
          }
        }
        
        // Strategy 3: Look for UTF-16 strings (some messages might be UTF-16 encoded)
        try {
          for (let offset = 20; offset < Math.min(100, buffer.length - 2); offset += 2) {
            // Try reading as UTF-16LE (little-endian)
            const utf16Buffer = buffer.slice(offset)
            if (utf16Buffer.length >= 20) {
              let utf16String = ''
              for (let i = 0; i < Math.min(utf16Buffer.length - 1, 200); i += 2) {
                const byte1 = utf16Buffer[i]
                const byte2 = utf16Buffer[i + 1]
                if (byte1 === 0 && byte2 === 0) break // Null terminator
                const charCode = byte1 | (byte2 << 8)
                if (charCode >= 32 && charCode <= 126) {
                  utf16String += String.fromCharCode(charCode)
                } else if (charCode === 0) {
                  break
                } else {
                  break // Non-ASCII, probably not text
                }
              }
              
              if (utf16String.length >= 10 && utf16String.includes(' ') && utf16String.match(/[a-z]/)) {
                return { text: utf16String.trim() }
              }
            }
          }
        } catch (e) {
          // Continue
        }
        
        // No text found - return with debug info
        return { text: null, debugInfo }
    } catch (error) {
      // Return error info
      return { text: null, debugInfo: { error: error instanceof Error ? error.message : String(error) } }
    }
  }

  const processAllVisualizations = async (database: any, contactId: number | null = null) => {
    try {
      // Initialize sentiment analyzer
      const sentimentAnalyzer = new Sentiment()
      
      // Reset reaction count and attributedBody count
      setReactionCount(0)
      setAttributedBodyCount(0)
      
      // Query messages - include both text field and attributedBody for newer macOS versions
      // For iOS 16/macOS 13+, some messages have text in attributedBody instead of text field
      let query = `
        SELECT 
          date, 
          text,
          is_from_me,
          attributedBody
        FROM message 
        WHERE (text IS NOT NULL OR attributedBody IS NOT NULL)
      `
      
      if (contactId !== null) {
        query += ` AND handle_id = ${contactId}`
      }
      
      query += ` ORDER BY date`

      const messagesResult = database.exec(query)

      if (messagesResult.length === 0) {
        setHeatmapData([])
        setWordsPerWeekData([])
        setWordsPerWeekMessages([])
        setConversationRatioData([])
        setResponseTimeData([])
        setReplyLadderData(null)
        setSentimentData([])
        return
      }

      const messages = messagesResult[0].values
      let reactionsFiltered = 0
      const processedMessages: Array<{
        date: Date
        text: string
        isFromMe: boolean
        wordCount: number
        hour: number
        dayOfWeek: number
        dayName: string
        weekKey: string
        monthKey: string
        sentiment: number
      }> = []

      // Process all messages
      let messagesWithAttributedBody = 0
      let decodedCount = 0
      
      // Process messages - decode attributedBody where needed
      for (const row of messages) {
        const timestampNs = row[0]
        let text = row[1] || ''
        const isFromMe = Boolean(row[2])
        const attributedBodyBlob = row[3] // This is a Uint8Array or null
        
        // If text is empty/null but attributedBody exists, try to decode it
        if ((!text || text.trim() === '') && attributedBodyBlob) {
          messagesWithAttributedBody++
          
          try {
            const decodeResult = await decodeAttributedBody(attributedBodyBlob)
            if (decodeResult.text && decodeResult.text.trim().length > 0) {
              text = decodeResult.text
              decodedCount++
            } else {
              // Couldn't decode - log detailed info
              const firstBytes = Array.from(attributedBodyBlob.slice(0, 20) as Uint8Array)
                .map((b: number) => b.toString(16).padStart(2, '0')).join(' ')
              const asciiPreview = String.fromCharCode(...Array.from(attributedBodyBlob.slice(0, 20) as Uint8Array))
                .replace(/[^\x20-\x7E]/g, '.')
              
              const debugInfo = decodeResult.debugInfo
              
              console.log(`[processMessages] Failed decode #${messagesWithAttributedBody}, size: ${attributedBodyBlob.length}`)
              console.log(`  Header: ${firstBytes.substring(0, 40)} (${asciiPreview.substring(0, 10)})`)
              if (debugInfo) {
                if (debugInfo.reason) {
                  console.log(`  Reason: ${debugInfo.reason}`)
                }
                if (debugInfo.error) {
                  console.log(`  Error: ${debugInfo.error}`)
                }
                console.log(`  Extracted ${debugInfo.totalStrings || 0} strings, ${debugInfo.uniqueStrings || 0} unique, ${debugInfo.meaningfulStrings || 0} meaningful`)
                if (debugInfo.allStrings && debugInfo.allStrings.length > 0) {
                  console.log(`  All strings (first 10):`, debugInfo.allStrings)
                }
                if (debugInfo.meaningful && debugInfo.meaningful.length > 0) {
                  console.log(`  Meaningful strings (first 10):`, debugInfo.meaningful)
                }
                if ((debugInfo.totalStrings || 0) === 0) {
                  console.log(`  No strings extracted from buffer`)
                }
              } else {
                console.log(`  No debug info available`)
              }
              continue
            }
          } catch (error) {
            const firstBytes = Array.from(attributedBodyBlob.slice(0, 20) as Uint8Array)
              .map((b: number) => b.toString(16).padStart(2, '0')).join(' ')
            const asciiPreview = String.fromCharCode(...Array.from(attributedBodyBlob.slice(0, 20) as Uint8Array))
              .replace(/[^\x20-\x7E]/g, '.')
            console.error(`[processMessages] Exception decoding #${messagesWithAttributedBody}, size: ${attributedBodyBlob.length}, header: ${firstBytes.substring(0, 40)} (${asciiPreview.substring(0, 10)}):`, error)
            continue
          }
        }
        
        // If still no text, skip this message
        if (!text || text.trim() === '') {
          continue
        }
        
        // Skip reaction messages if filtering is enabled
        // iMessage reactions contain quoted text in single quotes
        // Pattern: text within single quotes, e.g., 'i love you so much'
        // Works across languages: "Gaf een hartje aan 'i love you so much'" (Dutch)
        // or "Liked 'message text'" (English), etc.
        if (filterReactions) {
          const reactionPattern = /'.+?'/
          if (reactionPattern.test(text)) {
            reactionsFiltered++
            continue
          }
        }

        const epoch2001 = new Date('2001-01-01T00:00:00Z').getTime()
        const timestampMs = epoch2001 + (timestampNs / 1_000_000)
        const date = new Date(timestampMs)

        const hour = date.getHours()
        const dayOfWeek = date.getDay()
        const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
        const dayName = dayNames[dayOfWeek]
        
        const wordCount = text.match(/\b\w+\b/g)?.length || 0
        
        // Simple week key (YYYY-WW)
        const year = date.getFullYear()
        const startOfYear = new Date(year, 0, 1)
        const days = Math.floor((date.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000))
        const week = Math.floor(days / 7)
        const weekKey = `${year}-W${String(week).padStart(2, '0')}`
        
        const monthKey = `${year}-${String(date.getMonth() + 1).padStart(2, '0')}`
        
        // Advanced sentiment analysis using sentiment library
        // The library returns a score from -5 to 5, normalize to -1 to 1
        const sentimentResult = sentimentAnalyzer.analyze(text)
        const normalizedSentiment = sentimentResult.score !== 0 
          ? Math.max(-1, Math.min(1, sentimentResult.score / 5))
          : 0

        processedMessages.push({
          date,
          text,
          isFromMe,
          wordCount,
          hour,
          dayOfWeek,
          dayName,
          weekKey,
          monthKey,
          sentiment: normalizedSentiment
        })
      }
      
      // Update reaction count and attributedBody count
      setReactionCount(reactionsFiltered)
      setAttributedBodyCount(messagesWithAttributedBody - decodedCount) // Only count messages we couldn't decode

      // 1. Heatmap
      const heatmapMap = new Map<string, number>()
      processedMessages.forEach(msg => {
        const key = `${msg.dayName}-${msg.hour}`
        heatmapMap.set(key, (heatmapMap.get(key) || 0) + 1)
      })
      const dayOrder = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
      const heatmapData: { day: string; hour: number; value: number }[] = []
      dayOrder.forEach(day => {
        for (let hour = 0; hour < 24; hour++) {
          const key = `${day}-${hour}`
          heatmapData.push({
            day,
            hour,
            value: heatmapMap.get(key) || 0
          })
        }
      })
      setHeatmapData(heatmapData)

      // 2. Words per Week (past 6 months)
      const sixMonthsAgo = new Date()
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)
      const recentMessages = processedMessages.filter(m => m.date >= sixMonthsAgo)
      const weeklyWords = new Map<string, { words: number; date: Date }>()
      recentMessages.forEach(msg => {
        const existing = weeklyWords.get(msg.weekKey)
        if (!existing || msg.date < existing.date) {
          weeklyWords.set(msg.weekKey, { words: (existing?.words || 0) + msg.wordCount, date: msg.date })
        } else {
          existing.words += msg.wordCount
        }
      })
      const wordsPerWeek = Array.from(weeklyWords.entries())
        .map(([week, data]) => {
          const weekStart = new Date(data.date)
          weekStart.setDate(weekStart.getDate() - weekStart.getDay())
          return { 
            week: weekStart.toLocaleDateString([], { month: 'short', day: 'numeric' }), 
            words: data.words 
          }
        })
        .sort((a, b) => {
          const aDate = new Date(a.week)
          const bDate = new Date(b.week)
          return aDate.getTime() - bDate.getTime()
        })
      setWordsPerWeekData(wordsPerWeek)
      // Store only first 10 messages per week for the WordsPerWeek component (to speed up loading)
      const messagesByWeek = new Map<string, Array<{ text: string; date: Date; isFromMe: boolean; weekKey: string }>>()
      recentMessages.forEach(msg => {
        const weekMsgs = messagesByWeek.get(msg.weekKey) || []
        if (weekMsgs.length < 10) {
          weekMsgs.push({
            text: msg.text,
            date: msg.date,
            isFromMe: msg.isFromMe,
            weekKey: msg.weekKey
          })
          messagesByWeek.set(msg.weekKey, weekMsgs)
        }
      })
      // Flatten to array
      const limitedMessages = Array.from(messagesByWeek.values()).flat()
      setWordsPerWeekMessages(limitedMessages)

      // 3. Conversation Ratio - Count words per week for you vs them
      // Group messages by week and sender, sum word counts
      const weeklyRatio = new Map<string, { you: number; them: number; weekStart: Date }>()
      
      recentMessages.forEach(msg => {
        // Calculate week start (Monday of that week)
        const weekStart = new Date(msg.date)
        weekStart.setDate(weekStart.getDate() - weekStart.getDay() + (weekStart.getDay() === 0 ? -6 : 1)) // Monday
        weekStart.setHours(0, 0, 0, 0)
        const weekKey = weekStart.toISOString().split('T')[0] // Use date as key for consistent grouping
        
        const existing = weeklyRatio.get(weekKey)
        if (!existing) {
          weeklyRatio.set(weekKey, {
            you: msg.isFromMe ? msg.wordCount : 0,
            them: msg.isFromMe ? 0 : msg.wordCount,
            weekStart: weekStart
          })
        } else {
          if (msg.isFromMe) {
            existing.you += msg.wordCount
          } else {
            existing.them += msg.wordCount
          }
        }
      })
      
      const conversationRatio = Array.from(weeklyRatio.entries())
        .map(([weekKey, counts]) => {
          const total = counts.you + counts.them
          return {
            week: counts.weekStart.toLocaleDateString([], { month: 'short', day: 'numeric' }),
            you: total > 0 ? counts.you / total : 0,
            them: total > 0 ? counts.them / total : 0
          }
        })
        .sort((a, b) => {
          // Sort by week date
          const aDate = new Date(a.week)
          const bDate = new Date(b.week)
          return aDate.getTime() - bDate.getTime()
        })
      setConversationRatioData(conversationRatio)

      // 4. Response Time
      const sortedMessages = [...processedMessages].sort((a, b) => a.date.getTime() - b.date.getTime())
      const monthlyResponseTimes: Map<string, number[]> = new Map()
      const monthlyYouResponseTimes: Map<string, number[]> = new Map()
      
      for (let i = 1; i < sortedMessages.length; i++) {
        const prev = sortedMessages[i - 1]
        const curr = sortedMessages[i]
        
        if (prev.isFromMe !== curr.isFromMe) {
          const timeDiffHours = (curr.date.getTime() - prev.date.getTime()) / (1000 * 60 * 60)
          if (timeDiffHours > 0 && timeDiffHours < 168) { // Within a week
            const times = monthlyResponseTimes.get(curr.monthKey) || []
            times.push(timeDiffHours)
            monthlyResponseTimes.set(curr.monthKey, times)
            
            if (!prev.isFromMe && curr.isFromMe) {
              const youTimes = monthlyYouResponseTimes.get(curr.monthKey) || []
              youTimes.push(timeDiffHours)
              monthlyYouResponseTimes.set(curr.monthKey, youTimes)
            }
          }
        }
      }
      
      const allMonthsArray = Array.from(new Set([...Array.from(monthlyResponseTimes.keys()), ...Array.from(monthlyYouResponseTimes.keys())]))
      const responseTime = allMonthsArray
        .sort()
        .map(month => {
          const allTimes = monthlyResponseTimes.get(month) || []
          const youTimes = monthlyYouResponseTimes.get(month) || []
          
          const median = (arr: number[]) => {
            if (arr.length === 0) return null
            const sorted = [...arr].sort((a, b) => a - b)
            const mid = Math.floor(sorted.length / 2)
            return sorted.length % 2 === 0 
              ? (sorted[mid - 1] + sorted[mid]) / 2 
              : sorted[mid]
          }
          
          return {
            month,
            all: median(allTimes),
            you: median(youTimes)
          }
        })
      setResponseTimeData(responseTime)

      // 5. Reply Ladder
      let doubleTextsYou = 0
      let doubleTextsThem = 0
      const conversationEnders = { you: 0, them: 0 }
      
      // Count double texts (same sender, messages within 5 minutes)
      for (let i = 0; i < sortedMessages.length - 1; i++) {
        const curr = sortedMessages[i]
        const next = sortedMessages[i + 1]
        const timeDiffMinutes = (next.date.getTime() - curr.date.getTime()) / (1000 * 60)
        
        if (timeDiffMinutes < 5 && curr.isFromMe === next.isFromMe) {
          if (curr.isFromMe) doubleTextsYou++
          else doubleTextsThem++
        }
      }
      
      // Find conversation enders - group messages into conversations
      // A new conversation starts if there's a gap of 24+ hours between messages
      if (sortedMessages.length > 0) {
        const CONVERSATION_GAP_HOURS = 24
        const conversations: Array<Array<typeof sortedMessages[0]>> = []
        let currentConversation: Array<typeof sortedMessages[0]> = [sortedMessages[0]]
        
        for (let i = 1; i < sortedMessages.length; i++) {
          const prev = sortedMessages[i - 1]
          const curr = sortedMessages[i]
          const timeDiffHours = (curr.date.getTime() - prev.date.getTime()) / (1000 * 60 * 60)
          
          // If gap is 24+ hours, start a new conversation
          if (timeDiffHours >= CONVERSATION_GAP_HOURS) {
            // Save the previous conversation
            conversations.push(currentConversation)
            // Start a new conversation
            currentConversation = [curr]
          } else {
            // Same conversation, add message
            currentConversation.push(curr)
          }
        }
        
        // Don't forget the last conversation
        if (currentConversation.length > 0) {
          conversations.push(currentConversation)
        }
        
        // Count conversation enders - the last message in each conversation
        conversations.forEach(conversation => {
          if (conversation.length > 0) {
            const lastMessage = conversation[conversation.length - 1]
            if (lastMessage.isFromMe) {
              conversationEnders.you++
            } else {
              conversationEnders.them++
            }
          }
        })
      }
      
      setReplyLadderData({
        doubleTextsYou,
        doubleTextsThem,
        endersYou: conversationEnders.you,
        endersThem: conversationEnders.them
      })

      // 6. Sentiment Trends
      const weeklySentimentData: Map<string, { you: number[]; them: number[]; all: number[] }> = new Map()
      processedMessages.forEach(msg => {
        const existing = weeklySentimentData.get(msg.weekKey) || { you: [], them: [], all: [] }
        existing.all.push(msg.sentiment)
        if (msg.isFromMe) {
          existing.you.push(msg.sentiment)
        } else {
          existing.them.push(msg.sentiment)
        }
        weeklySentimentData.set(msg.weekKey, existing)
      })
      
      const avg = (arr: number[]) => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : null
      const sentimentTrends = Array.from(weeklySentimentData.entries())
        .map(([week, sentiments]) => {
          // Get a representative date for this week
          const weekMessages = processedMessages.filter(m => m.weekKey === week)
          const weekDate = weekMessages.length > 0 ? weekMessages[0].date : new Date()
          const weekStart = new Date(weekDate)
          weekStart.setDate(weekStart.getDate() - weekStart.getDay())
          return {
            week: weekStart.toLocaleDateString([], { month: 'short', day: 'numeric' }),
            you: avg(sentiments.you),
            them: avg(sentiments.them),
            all: avg(sentiments.all)
          }
        })
        .sort((a, b) => {
          const aDate = new Date(a.week)
          const bDate = new Date(b.week)
          return aDate.getTime() - bDate.getTime()
        })
      setSentimentData(sentimentTrends)

      // 7. Wrapped Stats
      // Total messages count and word count
      let totalMessagesYou = 0
      let totalMessagesThem = 0
      let totalWordsYou = 0
      let totalWordsThem = 0
      
      processedMessages.forEach(msg => {
        if (msg.isFromMe) {
          totalMessagesYou++
          totalWordsYou += msg.wordCount
        } else {
          totalMessagesThem++
          totalWordsThem += msg.wordCount
        }
      })
      
      // Most active single day (specific date)
      const dateCounts = new Map<string, { date: Date; count: number }>()
      processedMessages.forEach(msg => {
        // Use date string as key (YYYY-MM-DD)
        const dateKey = msg.date.toISOString().split('T')[0]
        const existing = dateCounts.get(dateKey)
        if (existing) {
          existing.count++
        } else {
          dateCounts.set(dateKey, { date: new Date(msg.date), count: 1 })
        }
      })
      const mostActiveDay = Array.from(dateCounts.values())
        .sort((a, b) => b.count - a.count)[0] || null

      // Longest texts
      let longestText: { text: string; length: number; isFromMe: boolean; date: Date } | null = null
      let longestTextYou: { text: string; length: number; date: Date } | null = null
      let longestTextThem: { text: string; length: number; date: Date } | null = null
      const allLongestTexts: { text: string; length: number; isFromMe: boolean; date: Date }[] = []
      
      processedMessages.forEach(msg => {
        const textLength = msg.text.length
        allLongestTexts.push({
          text: msg.text,
          length: textLength,
          isFromMe: msg.isFromMe,
          date: msg.date
        })
        
        // Overall longest
        if (!longestText || textLength > longestText.length) {
          longestText = {
            text: msg.text,
            length: textLength,
            isFromMe: msg.isFromMe,
            date: msg.date
          }
        }
        
        // Longest from you
        if (msg.isFromMe && (!longestTextYou || textLength > longestTextYou.length)) {
          longestTextYou = {
            text: msg.text,
            length: textLength,
            date: msg.date
          }
        }
        
        // Longest from them
        if (!msg.isFromMe && (!longestTextThem || textLength > longestTextThem.length)) {
          longestTextThem = {
            text: msg.text,
            length: textLength,
            date: msg.date
          }
        }
      })
      
      // Get top 10 longest messages (runner-ups)
      const longestTexts = allLongestTexts
        .sort((a, b) => b.length - a.length)
        .slice(0, 10)

      // Most used emojis - extract complete emoji sequences
      const emojiCountsYou = new Map<string, number>()
      const emojiCountsThem = new Map<string, number>()
      
      // Helper to check if a code point is a base emoji
      const isBaseEmojiCode = (code: number): boolean => {
        return (
          (code >= 0x1F300 && code <= 0x1F9FF) || // Misc Symbols and Pictographs
          (code >= 0x2600 && code <= 0x26FF) ||    // Misc symbols
          (code >= 0x2700 && code <= 0x27BF) ||    // Dingbats
          (code >= 0x1F600 && code <= 0x1F64F) ||  // Emoticons
          (code >= 0x1F680 && code <= 0x1F6FF) ||  // Transport and Map
          (code >= 0x1F1E0 && code <= 0x1F1FF)      // Flags
        )
      }
      
      // Helper to check if a string contains at least one base emoji
      const hasBaseEmoji = (str: string): boolean => {
        for (let i = 0; i < str.length; i++) {
          const code = str.codePointAt(i) || 0
          if (isBaseEmojiCode(code)) {
            return true
          }
        }
        return false
      }
      
      processedMessages.forEach(msg => {
        // Extract complete emoji sequences (base emoji + modifiers)
        const emojis: string[] = []
        let currentSequence = ''
        let hasBase = false
        
        for (let i = 0; i < msg.text.length; i++) {
          const char = msg.text[i]
          const code = char.codePointAt(0) || 0
          
          // Check if it's a base emoji character
          const isBase = isBaseEmojiCode(code)
          
          // Check if it's a modifier/joiner
          const isModifier = (
            (code >= 0x1F3FB && code <= 0x1F3FF) ||  // Skin tone modifiers
            (code >= 0xFE00 && code <= 0xFE0F) ||    // Variation selectors
            code === 0x200D ||                        // Zero-width joiner
            code === 0x2640 ||                        // Female sign
            code === 0x2642                           // Male sign
          )
          
          if (isBase) {
            // If we have a previous sequence, save it
            if (currentSequence && hasBase) {
              emojis.push(currentSequence)
            }
            // Start new sequence with this base emoji
            currentSequence = char
            hasBase = true
          } else if (isModifier && hasBase) {
            // Add modifier to current sequence if we have a base emoji
            currentSequence += char
          } else {
            // Non-emoji character - save current sequence if valid
            if (currentSequence && hasBase) {
              emojis.push(currentSequence)
            }
            currentSequence = ''
            hasBase = false
          }
        }
        
        // Handle emoji at end of string
        if (currentSequence && hasBase) {
          emojis.push(currentSequence)
        }
        
        // Also count standalone modifiers (like yellow square) - but only skin tone modifiers
        for (let i = 0; i < msg.text.length; i++) {
          const char = msg.text[i]
          const code = char.codePointAt(0) || 0
          
          // Only count standalone skin tone modifiers (not gender signs)
          if (code >= 0x1F3FB && code <= 0x1F3FF) {
            // Check if it's not part of an emoji sequence
            const prevChar = i > 0 ? msg.text[i - 1] : ''
            const prevCode = prevChar ? prevChar.codePointAt(0) || 0 : 0
            const prevIsBase = isBaseEmojiCode(prevCode)
            const prevIsJoiner = prevCode === 0x200D
            
            // Only count as standalone if it's not adjacent to a base emoji or joiner
            if (!prevIsBase && !prevIsJoiner) {
              emojis.push(char)
            }
          }
          // Explicitly skip gender signs (0x2640, 0x2642) - don't count them at all
        }
        
        const emojiMap = msg.isFromMe ? emojiCountsYou : emojiCountsThem
        emojis.forEach(emoji => {
          if (!emoji || emoji.length === 0) return
          
          // Skip gender signs completely - check all characters in the emoji
          let hasGenderSign = false
          for (let i = 0; i < emoji.length; i++) {
            const code = emoji.codePointAt(i) || 0
            if (code === 0x2640 || code === 0x2642) {
              hasGenderSign = true
              break
            }
          }
          if (hasGenderSign) {
            return // Skip any emoji containing gender signs
          }
          
          // Only count if it has at least one base emoji (filters out pure modifier sequences)
          if (hasBaseEmoji(emoji)) {
            emojiMap.set(emoji, (emojiMap.get(emoji) || 0) + 1)
          } else {
            // For standalone modifiers, only count skin tone modifiers (they render as colored squares)
            const code = emoji.codePointAt(0) || 0
            if (code >= 0x1F3FB && code <= 0x1F3FF) {
              emojiMap.set(emoji, (emojiMap.get(emoji) || 0) + 1)
            }
            // Don't count variation selectors, gender signs, etc. as standalone - they don't render
          }
        })
      })
      
      // Filter out emojis that don't display (empty strings, whitespace, etc.) and gender signs
      const filterValidEmojis = (map: Map<string, number>): Map<string, number> => {
        const filtered = new Map<string, number>()
        map.forEach((count, emoji) => {
          // Skip gender signs - check all characters in the emoji
          let hasGenderSign = false
          for (let i = 0; i < emoji.length; i++) {
            const code = emoji.codePointAt(i) || 0
            if (code === 0x2640 || code === 0x2642) {
              hasGenderSign = true
              break
            }
          }
          if (hasGenderSign) {
            return // Skip any emoji containing gender signs
          }
          
          // Only keep if emoji is not empty and has visible content
          if (emoji && emoji.trim().length > 0 && emoji.length > 0) {
            // Check if it has at least one character that's not a control character
            let hasVisible = false
            for (let i = 0; i < emoji.length; i++) {
              const code = emoji.codePointAt(i) || 0
              // Check if it's a visible emoji or modifier (but not gender signs)
              if (
                isBaseEmojiCode(code) ||
                (code >= 0x1F3FB && code <= 0x1F3FF)  // Skin tone modifiers
              ) {
                hasVisible = true
                break
              }
            }
            if (hasVisible) {
              filtered.set(emoji, count)
            }
          }
        })
        return filtered
      }
      
      const filteredEmojisYou = filterValidEmojis(emojiCountsYou)
      const filteredEmojisThem = filterValidEmojis(emojiCountsThem)

      const topEmojisYou = Array.from(filteredEmojisYou.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([emoji, count]) => ({ emoji, count, isFromMe: true }))
      
      const topEmojisThem = Array.from(filteredEmojisThem.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([emoji, count]) => ({ emoji, count, isFromMe: false }))

      setWrappedStats({
        mostActiveDay,
        longestText,
        longestTextYou,
        longestTextThem,
        longestTexts,
        topEmojis: [...topEmojisYou, ...topEmojisThem].sort((a, b) => b.count - a.count).slice(0, 10),
        totalMessagesYou,
        totalMessagesThem,
        totalWordsYou,
        totalWordsThem
      })

    } catch (err: any) {
      setError(`Error processing messages: ${err.message}`)
      console.error(err)
    }
  }

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    if (!sqlLoaded || !SQL) {
      setError('SQL.js is still loading. Please wait a moment and try again.')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const arrayBuffer = await file.arrayBuffer()
      const uint8Array = new Uint8Array(arrayBuffer)
      const database = new SQL.Database(uint8Array)

      // Get all contacts (handles) with message counts and last message, sorted by message count
      const contactsResult = database.exec(`
        SELECT 
          h.ROWID,
          h.id,
          COUNT(m.ROWID) as message_count,
          (SELECT display_name FROM chat WHERE chat_identifier = h.id LIMIT 1) as display_name,
          (SELECT COALESCE(text, '') FROM message WHERE handle_id = h.ROWID AND (text IS NOT NULL OR attributedBody IS NOT NULL) ORDER BY date DESC LIMIT 1) as last_message,
          (SELECT date FROM message WHERE handle_id = h.ROWID AND (text IS NOT NULL OR attributedBody IS NOT NULL) ORDER BY date DESC LIMIT 1) as last_message_date
        FROM handle h
        LEFT JOIN message m ON m.handle_id = h.ROWID AND (m.text IS NOT NULL OR m.attributedBody IS NOT NULL)
        GROUP BY h.ROWID, h.id
        HAVING message_count > 0
        ORDER BY message_count DESC, h.id
      `)

      if (contactsResult.length > 0) {
        const contactsData = contactsResult[0].values.map((row: any[]) => ({
          rowid: row[0],
          id: row[1],
          messageCount: row[2] || 0,
          name: row[3] || null,
          lastMessage: row[4] || null,
          lastMessageDate: row[5] || null
        }))
        setContacts(contactsData)
        setDb(database)
        
        // Generate all visualizations for all chats
        setProcessing(true)
        await processAllVisualizations(database, null)
        setProcessing(false)
        
        // Move to dashboard screen
        setScreen('dashboard')
      } else {
        setError('No contacts found in database')
      }
    } catch (err: any) {
      setError(`Error loading database: ${err.message}`)
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleContactSelect = async (contact: Contact | null) => {
    setSelectedContact(contact)
    setDropdownOpen(false)
    if (!db) return

    setProcessing(true)
    await processAllVisualizations(db, contact ? contact.rowid : null)
    setProcessing(false)
  }

  const formatDate = (timestampNs: number | null | undefined) => {
    if (!timestampNs) return ''
    const epoch2001 = new Date('2001-01-01T00:00:00Z').getTime()
    const timestampMs = epoch2001 + (timestampNs / 1_000_000)
    const date = new Date(timestampMs)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
    
    if (diffDays === 0) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    } else if (diffDays === 1) {
      return 'Yesterday'
    } else if (diffDays < 7) {
      return date.toLocaleDateString([], { weekday: 'short' })
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' })
    }
  }

  const truncateMessage = (text: string | null, maxLength: number = 60) => {
    if (!text) return ''
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text
  }

  // Upload Screen
  if (screen === 'upload') {
    return (
      <main className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-8">
        <div className="max-w-2xl w-full">
          <div className="bg-white rounded-lg shadow-lg p-8">
            <h1 className="text-4xl font-bold text-gray-900 mb-2">iMessage Analysis</h1>
            <p className="text-gray-600 mb-8">Upload your chat.db file to explore conversation visualizations</p>

            <div className="mb-4">
              <p className="text-sm text-gray-600 mb-2">Default location on macOS:</p>
              <div className="bg-gray-100 px-3 py-2 rounded text-sm font-mono text-gray-800 mb-2 flex items-center justify-between">
                <code>~/Library/Messages/chat.db</code>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText('~/Library/Messages/chat.db')
                      .then(() => alert('Path copied to clipboard! You can paste it in Finder (Cmd+Shift+G)'))
                      .catch(() => {})
                  }}
                  className="ml-2 text-xs text-indigo-600 hover:text-indigo-800 underline"
                >
                  Copy path
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                💡 Tip: In Finder, press <kbd className="px-1 py-0.5 bg-gray-200 rounded text-xs">Cmd+Shift+G</kbd> and paste the path to navigate there quickly. Make sure to close the Messages app first!
              </p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".db"
              onChange={handleFileUpload}
              className="hidden"
              id="db-upload"
            />
            <label
              htmlFor="db-upload"
              className={`inline-block px-6 py-3 rounded-lg transition-colors shadow-md ${
                !sqlLoaded || loading
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-indigo-600 hover:bg-indigo-700 cursor-pointer'
              } text-white`}
            >
              {!sqlLoaded ? 'Loading SQL.js...' : loading ? 'Loading database...' : 'Open chat.db file'}
            </label>
            {!sqlLoaded && (
              <p className="mt-2 text-sm text-gray-500">Initializing SQL.js library...</p>
            )}
            {error && (
              <div className="mt-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                {error}
              </div>
            )}
          </div>
        </div>
      </main>
    )
  }

  // Dashboard Screen
  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-4xl font-bold text-gray-900 mb-2">iMessage Analysis</h1>
            <p className="text-gray-600">Explore your conversation visualizations</p>
          </div>
          <button
            onClick={() => {
              setScreen('upload')
              setDb(null)
              setContacts([])
              setSelectedContact(null)
              setHeatmapData([])
              setWordsPerWeekData([])
              setWordsPerWeekMessages([])
              setConversationRatioData([])
              setResponseTimeData([])
              setReplyLadderData(null)
              setSentimentData([])
              if (fileInputRef.current) {
                fileInputRef.current.value = ''
              }
            }}
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Load Different Database
          </button>
        </div>

        {/* Contact Dropdown */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-semibold text-gray-800">Select Contact</h2>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={filterReactions}
                onChange={(e) => {
                  setFilterReactions(e.target.checked)
                  if (db) {
                    setProcessing(true)
                    processAllVisualizations(db, selectedContact?.rowid || null)
                    setProcessing(false)
                  }
                }}
                className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
              />
              <span className="text-sm text-gray-700">
                Filter reaction messages
                <span className="ml-2 px-1.5 py-0.5 text-xs bg-yellow-100 text-yellow-800 rounded border border-yellow-300">Experimental</span>
              </span>
            </label>
          </div>
          {reactionCount > 0 && filterReactions && (
            <p className="text-sm text-gray-500 mb-2">
              Filtered out {reactionCount.toLocaleString()} reaction message{reactionCount !== 1 ? 's' : ''}
            </p>
          )}
          {attributedBodyCount > 0 && (
            <p className="text-xs text-amber-600 mb-4 bg-amber-50 px-3 py-2 rounded border border-amber-200">
              ⚠️ {attributedBodyCount.toLocaleString()} message{attributedBodyCount !== 1 ? 's' : ''} with text stored in attributedBody could not be decoded and were skipped. These are typically newer messages from iOS 16/macOS 13+.
            </p>
          )}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="w-full p-4 rounded-lg border-2 border-gray-200 hover:border-indigo-300 text-left bg-white text-gray-800 flex items-center justify-between"
            >
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">
                  {selectedContact 
                    ? (selectedContact.name || selectedContact.id || 'Unknown')
                    : 'All Chats'}
                </div>
                {selectedContact && selectedContact.name && (
                  <div className="text-xs text-gray-500 truncate mt-1">{selectedContact.id}</div>
                )}
                {selectedContact && (
                  <div className="text-xs text-gray-400 mt-1">
                    {selectedContact.messageCount.toLocaleString()} message{selectedContact.messageCount !== 1 ? 's' : ''}
                  </div>
                )}
              </div>
              <svg
                className={`w-5 h-5 text-gray-400 transition-transform ${dropdownOpen ? 'transform rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {dropdownOpen && (
              <div className="absolute z-50 w-full mt-2 bg-white border-2 border-gray-200 rounded-lg shadow-lg max-h-96 overflow-y-auto">
                <button
                  onClick={() => handleContactSelect(null)}
                  className={`w-full p-4 text-left border-b border-gray-100 hover:bg-gray-50 ${
                    selectedContact === null ? 'bg-indigo-50 text-indigo-900' : 'text-gray-800'
                  }`}
                >
                  <div className="font-medium">All Chats</div>
                  <div className="text-xs text-gray-400 mt-1">View aggregated data across all conversations</div>
                </button>
                {contacts.map((contact) => (
                  <button
                    key={contact.rowid}
                    onClick={() => handleContactSelect(contact)}
                    className={`w-full p-4 text-left border-b border-gray-100 hover:bg-gray-50 flex items-center justify-between ${
                      selectedContact?.rowid === contact.rowid ? 'bg-indigo-50 text-indigo-900' : 'text-gray-800'
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">
                        {contact.name || contact.id || 'Unknown'}
                      </div>
                      {contact.name && (
                        <div className="text-xs text-gray-500 truncate mt-1">{contact.id}</div>
                      )}
                      <div className="text-xs text-gray-400 mt-1">
                        {contact.messageCount.toLocaleString()} message{contact.messageCount !== 1 ? 's' : ''}
                      </div>
                    </div>
                    {contact.lastMessage && (
                      <div className="flex-1 text-right min-w-0 ml-4">
                        <div className="text-xs text-gray-500 mb-1">
                          {formatDate(contact.lastMessageDate)}
                        </div>
                        <div className="text-sm text-gray-600 truncate">
                          {truncateMessage(contact.lastMessage)}
                        </div>
                      </div>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {processing && (
          <div className="bg-white rounded-lg shadow-lg p-6">
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
              <span className="ml-4 text-gray-600">Processing messages...</span>
            </div>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        {!processing && (
          <div className="space-y-6">
            {/* Wrapped Stats */}
            {wrappedStats && (
              <div className="bg-gradient-to-br from-purple-500 via-pink-500 to-red-500 rounded-lg shadow-xl p-8 text-white">
                <h2 className="text-3xl font-bold mb-6 text-center">Your Conversation Wrapped</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  {/* Total Messages */}
                  <div className="bg-white/10 backdrop-blur-sm rounded-lg p-6 border border-white/20">
                    <div className="text-sm opacity-90 mb-3">Total Messages</div>
                    <div className="space-y-2">
                      <div>
                        <div className="text-xs opacity-75 mb-1">You</div>
                        <div className="text-2xl font-bold">{wrappedStats.totalMessagesYou.toLocaleString()}</div>
                        <div className="text-xs opacity-75 mt-1">{wrappedStats.totalWordsYou.toLocaleString()} words</div>
                      </div>
                      <div className="border-t border-white/20 pt-2">
                        <div className="text-xs opacity-75 mb-1">Them</div>
                        <div className="text-2xl font-bold">{wrappedStats.totalMessagesThem.toLocaleString()}</div>
                        <div className="text-xs opacity-75 mt-1">{wrappedStats.totalWordsThem.toLocaleString()} words</div>
                      </div>
                    </div>
                  </div>

                  {/* Most Active Day */}
                  {wrappedStats.mostActiveDay && (
                    <div className="bg-white/10 backdrop-blur-sm rounded-lg p-6 border border-white/20">
                      <div className="text-sm opacity-90 mb-2">Most Active Day</div>
                      <div className="text-2xl font-bold mb-2">
                        {wrappedStats.mostActiveDay.date.toLocaleDateString([], { 
                          month: 'long', 
                          day: 'numeric', 
                          year: 'numeric' 
                        })}
                      </div>
                      <div className="text-sm opacity-75">{wrappedStats.mostActiveDay.count.toLocaleString()} messages</div>
                    </div>
                  )}

                  {/* Longest Messages */}
                  <div className="bg-white/10 backdrop-blur-sm rounded-lg p-6 border border-white/20">
                    <div className="text-sm opacity-90 mb-3">Longest Messages</div>
                    <div className="space-y-3">
                      {wrappedStats.longestTextYou && (
                        <div>
                          <div className="text-xs opacity-75 mb-1">You</div>
                          <div className="text-xl font-bold mb-1">{wrappedStats.longestTextYou.length.toLocaleString()} characters</div>
                          <div className="text-xs opacity-75 mb-2">{wrappedStats.longestTextYou.date.toLocaleDateString()}</div>
                          <MessagePreview 
                            text={wrappedStats.longestTextYou.text}
                            className="text-sm opacity-90 line-clamp-2 italic cursor-help"
                          />
                        </div>
                      )}
                      {wrappedStats.longestTextThem && (
                        <div className="border-t border-white/20 pt-3">
                          <div className="text-xs opacity-75 mb-1">Them</div>
                          <div className="text-xl font-bold mb-1">{wrappedStats.longestTextThem.length.toLocaleString()} characters</div>
                          <div className="text-xs opacity-75 mb-2">{wrappedStats.longestTextThem.date.toLocaleDateString()}</div>
                          <MessagePreview 
                            text={wrappedStats.longestTextThem.text}
                            className="text-sm opacity-90 line-clamp-2 italic cursor-help"
                          />
                        </div>
                      )}
                      {wrappedStats.longestTexts && wrappedStats.longestTexts.length > 2 && (
                        <LongestMessagesDropdown messages={wrappedStats.longestTexts} />
                      )}
                    </div>
                  </div>

                  {/* Top Emojis */}
                  {wrappedStats.topEmojis.length > 0 && (
                    <div className="bg-white/10 backdrop-blur-sm rounded-lg p-6 border border-white/20">
                      <div className="text-sm opacity-90 mb-3">Most Used Emojis</div>
                      <div className="space-y-2">
                        {wrappedStats.topEmojis.slice(0, 5).map((item, idx) => (
                          <div key={idx} className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="text-2xl">{item.emoji}</span>
                              <span className="text-xs opacity-75">{item.isFromMe ? 'You' : 'Them'}</span>
                            </div>
                            <span className="text-sm font-semibold">{item.count}x</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {heatmapData.length > 0 && (
              <div className="bg-white rounded-lg shadow-lg p-6">
                <h2 className="text-2xl font-semibold text-gray-800 mb-4">Activity Heatmap</h2>
                <p className="text-gray-600 mb-6">
                  Message activity by hour of day and day of week
                  {selectedContact 
                    ? ` for ${selectedContact.name || selectedContact.id || 'selected contact'}`
                    : ' across all chats'}
                </p>
                <Heatmap data={heatmapData} />
              </div>
            )}

            {wordsPerWeekData.length > 0 && (
              <div className="bg-white rounded-lg shadow-lg p-6">
                <h2 className="text-2xl font-semibold text-gray-800 mb-4">Words per Week</h2>
                <p className="text-gray-600 mb-6">
                  Conversation volume over the past 6 months
                  {selectedContact 
                    ? ` for ${selectedContact.name || selectedContact.id || 'selected contact'}`
                    : ' across all chats'}
                </p>
                <WordsPerWeek data={wordsPerWeekData} messages={wordsPerWeekMessages} />
              </div>
            )}

            {conversationRatioData.length > 0 && (
              <div className="bg-white rounded-lg shadow-lg p-6">
                <h2 className="text-2xl font-semibold text-gray-800 mb-4">Conversation Ratio</h2>
                <p className="text-gray-600 mb-6">
                  Word count ratio per week - shows who contributes more words each week
                  {selectedContact 
                    ? ` with ${selectedContact.name || selectedContact.id || 'selected contact'}`
                    : ' across all chats'}
                </p>
                <ConversationRatio data={conversationRatioData} />
              </div>
            )}

            {responseTimeData.length > 0 && (
              <div className="bg-white rounded-lg shadow-lg p-6">
                <h2 className="text-2xl font-semibold text-gray-800 mb-4">Response Time</h2>
                <p className="text-gray-600 mb-6">
                  Median response time per month
                  {selectedContact 
                    ? ` with ${selectedContact.name || selectedContact.id || 'selected contact'}`
                    : ' across all chats'}
                </p>
                <ResponseTime data={responseTimeData} />
              </div>
            )}

            {replyLadderData && (
              <div className="bg-white rounded-lg shadow-lg p-6">
                <h2 className="text-2xl font-semibold text-gray-800 mb-4">Reply Ladder</h2>
                <p className="text-gray-600 mb-6">
                  Double texts and conversation enders
                  {selectedContact 
                    ? ` with ${selectedContact.name || selectedContact.id || 'selected contact'}`
                    : ' across all chats'}
                </p>
                <ReplyLadder data={replyLadderData} />
              </div>
            )}

            {sentimentData.length > 0 && (
              <div className="bg-white rounded-lg shadow-lg p-6">
                <h2 className="text-2xl font-semibold text-gray-800 mb-4">Sentiment Trends</h2>
                <p className="text-gray-600 mb-6">
                  Sentiment analysis over time
                  {selectedContact 
                    ? ` with ${selectedContact.name || selectedContact.id || 'selected contact'}`
                    : ' across all chats'}
                </p>
                {selectedContact ? (
                  <SentimentTrend data={sentimentData} showComparison={true} />
                ) : (
                  <SentimentTrend data={sentimentData} showComparison={false} />
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  )
}
