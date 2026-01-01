import React, { useState, useEffect } from 'react'
import { Snowflake } from 'lucide-react'
import { getColdProtection } from '../services/api'

function ColdProtectionWidget() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await getColdProtection()
        setData(response.data)
      } catch (error) {
        console.error('Failed to fetch cold protection data:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
    // Refresh every 5 minutes to match weather data updates
    const interval = setInterval(fetchData, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [])

  if (loading || !data || !data.needs_protection) {
    return null
  }

  return (
    <div className="bg-cyan-900/30 border border-cyan-800 rounded-lg px-3 py-2">
      <div className="flex items-center gap-2 mb-2">
        <Snowflake className="w-4 h-4 text-cyan-400" />
        <span className="text-sm font-medium text-cyan-300">
          Cold Protection: {data.plants.length} plants
        </span>
        <span className="text-xs text-cyan-400/70">
          (Low: {data.forecast_low}°F)
        </span>
      </div>
      <div className="flex flex-wrap gap-1">
        {data.plants.map((plant) => (
          <span
            key={plant.id}
            className="text-xs bg-cyan-900/50 text-cyan-200 px-2 py-0.5 rounded"
          >
            {plant.name} ({plant.min_temp}°)
          </span>
        ))}
      </div>
    </div>
  )
}

export default ColdProtectionWidget
