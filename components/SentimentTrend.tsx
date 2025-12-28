'use client'

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'

interface DataPoint {
  week: string
  you: number | null
  them: number | null
  all: number | null
}

interface SentimentTrendProps {
  data: DataPoint[]
  showComparison?: boolean
}

export function SentimentTrend({ data, showComparison = false }: SentimentTrendProps) {
  // Transform data for chart
  const transformedData = data.map((point) => {
    const result: any = { week: point.week }
    
    if (showComparison) {
      result.you = point.you
      result.them = point.them
    } else {
      result.all = point.all
    }
    
    return result
  })

  return (
    <div>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={transformedData}>
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
            domain={[-1, 1]}
            label={{ value: 'Sentiment Score', angle: -90, position: 'insideLeft' }}
          />
          <Tooltip 
            contentStyle={{ backgroundColor: '#fff', border: '1px solid #ccc', borderRadius: '4px' }}
            formatter={(value: number, name: string) => {
              if (value === null || value === undefined) {
                return ['No data', '']
              }
              return [value.toFixed(3), name]
            }}
          />
          <Legend />
          {showComparison ? (
            <>
              <Line 
                type="monotone" 
                dataKey="you" 
                stroke="#10b981" 
                strokeWidth={2}
                dot={{ fill: '#10b981', r: 3 }}
                name="You"
                connectNulls={false}
              />
              <Line 
                type="monotone" 
                dataKey="them" 
                stroke="#ef4444" 
                strokeWidth={2}
                dot={{ fill: '#ef4444', r: 3 }}
                name="Them"
                connectNulls={false}
              />
            </>
          ) : (
            <Line 
              type="monotone" 
              dataKey="all" 
              stroke="#a855f7" 
              strokeWidth={2}
              dot={{ fill: '#a855f7', r: 3 }}
              name="Overall Sentiment"
              connectNulls={false}
            />
          )}
        </LineChart>
      </ResponsiveContainer>
      <p className="text-xs text-gray-500 mt-2 text-center">
        Gaps in the line indicate weeks with no data
      </p>
    </div>
  )
}

