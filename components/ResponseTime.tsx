'use client'

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'

interface DataPoint {
  month: string
  youToThem: number | null
  themToYou: number | null
}

interface ResponseTimeProps {
  data: DataPoint[]
}

// Custom dot component that shows grey at 0 when there's no data
const CustomDot = ({ cx, cy, payload, dataKey, activeColor }: any) => {
  const value = payload[dataKey]
  const hasData = value !== null && value !== undefined
  
  return (
    <circle
      cx={cx}
      cy={hasData ? cy : undefined}
      r={4}
      fill={hasData ? activeColor : '#9ca3af'}
      style={{ 
        transform: hasData ? undefined : `translateY(${cy}px)`,
      }}
    />
  )
}

export function ResponseTime({ data }: ResponseTimeProps) {
  // Transform data to show 0 for null values (for display purposes)
  const transformedData = data.map(d => ({
    ...d,
    youToThemDisplay: d.youToThem ?? 0,
    themToYouDisplay: d.themToYou ?? 0,
    youToThemHasData: d.youToThem !== null,
    themToYouHasData: d.themToYou !== null,
  }))

  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={transformedData}>
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
          formatter={(value: number, name: string, props: any) => {
            const dataKey = name === 'You → them' ? 'youToThem' : 'themToYou'
            const originalValue = props.payload[dataKey]
            if (originalValue === null || originalValue === undefined) {
              return ['No data', name]
            }
            return [`${originalValue.toFixed(1)} hours`, name]
          }}
        />
        <Legend />
        <Line 
          type="monotone" 
          dataKey="youToThemDisplay" 
          stroke="#10b981" 
          strokeWidth={2}
          dot={(props: any) => {
            const hasData = props.payload.youToThemHasData
            return (
              <circle
                key={props.key}
                cx={props.cx}
                cy={props.cy}
                r={4}
                fill={hasData ? '#10b981' : '#9ca3af'}
              />
            )
          }}
          activeDot={{ r: 6 }}
          name="You → them"
          connectNulls={false}
        />
        <Line 
          type="monotone" 
          dataKey="themToYouDisplay" 
          stroke="#a855f7" 
          strokeWidth={2}
          dot={(props: any) => {
            const hasData = props.payload.themToYouHasData
            return (
              <circle
                key={props.key}
                cx={props.cx}
                cy={props.cy}
                r={4}
                fill={hasData ? '#a855f7' : '#9ca3af'}
              />
            )
          }}
          activeDot={{ r: 6 }}
          name="them → You"
          connectNulls={false}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}

