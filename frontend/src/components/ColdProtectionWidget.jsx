import React, { useState, useEffect } from 'react'
import { Snowflake, PawPrint } from 'lucide-react'
import { getColdProtection, getAnimalsNeedingBlanket } from '../services/api'

function ColdProtectionWidget() {
  const [plantData, setPlantData] = useState(null)
  const [animals, setAnimals] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const plantResponse = await getColdProtection()
        setPlantData(plantResponse.data)

        // If we have a forecast low, check for animals needing blankets
        if (plantResponse.data?.forecast_low) {
          try {
            const animalResponse = await getAnimalsNeedingBlanket(plantResponse.data.forecast_low)
            setAnimals(animalResponse.data || [])
          } catch (error) {
            console.error('Failed to fetch animal blanket data:', error)
          }
        }
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

  const hasPlants = plantData?.needs_protection && plantData?.plants?.length > 0
  const hasAnimals = animals.length > 0

  if (loading || (!hasPlants && !hasAnimals)) {
    return null
  }

  return (
    <div className="space-y-2">
      {/* Plants needing cold protection */}
      {hasPlants && (
        <div className="bg-cyan-900/30 border border-cyan-800 rounded-lg px-3 py-2">
          <div className="flex items-center gap-2 mb-2">
            <Snowflake className="w-4 h-4 text-cyan-400" />
            <span className="text-sm font-medium text-cyan-300">
              Cold Protection: {plantData.plants.length} plants
            </span>
            <span className="text-xs text-cyan-400/70">
              (Low: {plantData.forecast_low}°F)
            </span>
          </div>
          <div className="flex flex-wrap gap-1">
            {plantData.plants.map((plant) => (
              <span
                key={plant.id}
                className="text-xs bg-cyan-900/50 text-cyan-200 px-2 py-0.5 rounded"
              >
                {plant.name} ({plant.min_temp}°)
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Animals needing blankets */}
      {hasAnimals && (
        <div className="bg-purple-900/30 border border-purple-800 rounded-lg px-3 py-2">
          <div className="flex items-center gap-2 mb-2">
            <PawPrint className="w-4 h-4 text-purple-400" />
            <span className="text-sm font-medium text-purple-300">
              Blanket Needed: {animals.length} animal{animals.length > 1 ? 's' : ''}
            </span>
            {plantData?.forecast_low && (
              <span className="text-xs text-purple-400/70">
                (Low: {plantData.forecast_low}°F)
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-1">
            {animals.map((animal) => (
              <span
                key={animal.id}
                className="text-xs bg-purple-900/50 text-purple-200 px-2 py-0.5 rounded"
              >
                {animal.name} {animal.color ? `(${animal.color})` : ''} - blanket below {animal.needs_blanket_below}°
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default ColdProtectionWidget
