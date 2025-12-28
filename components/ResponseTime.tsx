'use client'

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'

interface DataPoint {
  month: string
  all: number | null
  you: number | null
}

interface ResponseTimeProps {
  data: DataPoint[]
}

export function ResponseTime({ data }: ResponseTimeProps) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
        <XAxis 
          dataKey="month" 
          stroke="#666"
          tick={{ fontSize: 12 }}
          angle={-45}
          textAnchor="end"
          height={80}
        />
        <YAxis 
          stroke="#666"
          tick={{ fontSize: 12 }}
          label={{ value: 'Response Time (hours)', angle: -90, position: 'insideLeft' }}
        />
        <Tooltip 
          contentStyle={{ backgroundColor: '#fff', border: '1px solid #ccc', borderRadius: '4px' }}
          formatter={(value: number) => value !== null ? [`${value.toFixed(1)} hours`, ''] : ['N/A', '']}
        />
        <Legend />
        <Line 
          type="monotone" 
          dataKey="all" 
          stroke="#a855f7" 
          strokeWidth={2}
          dot={{ fill: '#a855f7', r: 4 }}
          activeDot={{ r: 6 }}
          name="All Response Times"
          connectNulls
        />
        <Line 
          type="monotone" 
          dataKey="you" 
          stroke="#10b981" 
          strokeWidth={2}
          dot={{ fill: '#10b981', r: 4 }}
          activeDot={{ r: 6 }}
          name="You → Them"
          connectNulls
        />
      </LineChart>
    </ResponsiveContainer>
  )
}

