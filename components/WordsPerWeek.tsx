'use client'

import { useState } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

interface DataPoint {
  week: string
  words: number
  weekKey?: string // Internal key to match with messages
}

interface Message {
  text: string
  date: Date
  isFromMe: boolean
  weekKey: string
}

interface WordsPerWeekProps {
  data: DataPoint[]
  messages?: Message[]
}

export function WordsPerWeek({ data, messages = [] }: WordsPerWeekProps) {
  const [selectedWeek, setSelectedWeek] = useState<string | null>(null)

  const handleDotClick = (data: any) => {
    if (!data || !data.activePayload || !data.activePayload[0]) return
    
    const clickedData = data.activePayload[0].payload
    if (clickedData?.weekKey) {
      setSelectedWeek(selectedWeek === clickedData.weekKey ? null : clickedData.weekKey)
    } else {
      // Fallback: try to match by week string
      const weekStr = clickedData?.week
      if (weekStr) {
        // Find matching weekKey from messages
        const matchingMessage = messages.find(m => {
          const weekStart = new Date(m.date)
          weekStart.setDate(weekStart.getDate() - weekStart.getDay())
          const formatted = weekStart.toLocaleDateString([], { month: 'short', day: 'numeric' })
          return formatted === weekStr
        })
        if (matchingMessage) {
          setSelectedWeek(selectedWeek === matchingMessage.weekKey ? null : matchingMessage.weekKey)
        }
      }
    }
  }
  
  const CustomDot = (props: any) => {
    const { cx, cy, payload } = props
    return (
      <circle
        cx={cx}
        cy={cy}
        r={4}
        fill="#6366f1"
        style={{ cursor: 'pointer' }}
        onClick={() => {
          if (payload?.weekKey) {
            setSelectedWeek(selectedWeek === payload.weekKey ? null : payload.weekKey)
          } else {
            // Fallback matching
            const weekStr = payload?.week
            if (weekStr) {
              const matchingMessage = messages.find((m: Message) => {
                const weekStart = new Date(m.date)
                weekStart.setDate(weekStart.getDate() - weekStart.getDay())
                const formatted = weekStart.toLocaleDateString([], { month: 'short', day: 'numeric' })
                return formatted === weekStr
              })
              if (matchingMessage) {
                setSelectedWeek(selectedWeek === matchingMessage.weekKey ? null : matchingMessage.weekKey)
              }
            }
          }
        }}
      />
    )
  }

  const selectedMessages = selectedWeek
    ? messages
        .filter(m => m.weekKey === selectedWeek)
        .sort((a, b) => a.date.getTime() - b.date.getTime())
        .slice(0, 10) // Limit to first 10 messages
    : []

  // Add weekKey to data points for matching
  const dataWithKeys = data.map((point, index) => {
    // Try to find matching weekKey from messages
    const weekStr = point.week
    const matchingMessage = messages.find(m => {
      const weekStart = new Date(m.date)
      weekStart.setDate(weekStart.getDate() - weekStart.getDay())
      const formatted = weekStart.toLocaleDateString([], { month: 'short', day: 'numeric' })
      return formatted === weekStr
    })
    return {
      ...point,
      weekKey: matchingMessage?.weekKey || `week-${index}`
    }
  })

  return (
    <div>
      <div className="mb-2 text-xs text-gray-500 italic">
        💡 Click on any data point to view messages from that week
      </div>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={dataWithKeys} onClick={handleDotClick}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
          <XAxis 
            dataKey="week" 
            stroke="#666"
            tick={{ fontSize: 12 }}
            angle={-45}
            textAnchor="end"
            height={80}
          />
          <YAxis 
            stroke="#666"
            tick={{ fontSize: 12 }}
            label={{ value: 'Total Words', angle: -90, position: 'insideLeft' }}
          />
          <Tooltip 
            contentStyle={{ backgroundColor: '#fff', border: '1px solid #ccc', borderRadius: '4px' }}
            formatter={(value: number) => [value.toLocaleString(), 'Words']}
          />
          <Line 
            type="monotone" 
            dataKey="words" 
            stroke="#6366f1" 
            strokeWidth={2}
            dot={<CustomDot />}
            activeDot={{ r: 6, cursor: 'pointer' }}
          />
        </LineChart>
      </ResponsiveContainer>
      
      {selectedWeek && selectedMessages.length > 0 && (
        <div className="mt-4 bg-gray-50 rounded-lg border border-gray-200 p-4 max-h-96 overflow-y-auto">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-700">
              Messages from {selectedMessages[0]?.date.toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' })} week
            </h3>
            <button
              onClick={() => setSelectedWeek(null)}
              className="text-xs text-gray-500 hover:text-gray-700"
            >
              Close
            </button>
          </div>
          <div className="mb-3 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-800">
            ⚠️ <strong>Experimental:</strong> Not all messages may be decoded fully. Some newer messages stored in attributedBody format may be missing or incomplete.
          </div>
          <div className="space-y-2">
            {selectedMessages.map((msg, idx) => (
              <div
                key={idx}
                className={`flex ${msg.isFromMe ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] rounded-lg px-3 py-2 ${
                    msg.isFromMe
                      ? 'bg-indigo-500 text-white'
                      : 'bg-white text-gray-800 border border-gray-200'
                  }`}
                >
                  <div className="text-xs opacity-75 mb-1">
                    {msg.date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                  <div className="text-sm whitespace-pre-wrap break-words">{msg.text}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

