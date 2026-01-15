import React, { useState, useEffect } from 'react'
import { Snowflake, PawPrint, Check, X } from 'lucide-react'
import { getColdProtection, getAnimalsNeedingBlanket } from '../services/api'

function ColdProtectionWidget() {
  const [plantData, setPlantData] = useState(null)
  const [animals, setAnimals] = useState([])
  const [loading, setLoading] = useState(true)
  // Local dismiss state (resets on page refresh/new day)
  const [plantsDismissed, setPlantsDismissed] = useState(false)
  const [animalsDismissed, setAnimalsDismissed] = useState(false)
  const [plantsAcknowledged, setPlantsAcknowledged] = useState(false)
  const [animalsAcknowledged, setAnimalsAcknowledged] = useState(false)

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

  const hasPlants = plantData?.needs_protection && plantData?.plants?.length > 0 && !plantsDismissed
  const hasAnimals = animals.length > 0 && !animalsDismissed

  if (loading || (!hasPlants && !hasAnimals)) {
    return null
  }

  // Earth-toned colors
  // Cold protection: Steel blue / slate (cold feeling but earthy)
  const coldColors = {
    bg: plantsAcknowledged ? 'bg-[#4A5568]/60' : 'bg-[#4A5568]/80',
    border: 'border-[#718096]',
    icon: '#A0AEC0',
    text: '#E2E8F0',
    chip: 'bg-[#2D3748]/70'
  }

  // Blankets: Warm brown / sienna (cozy feeling)
  const blanketColors = {
    bg: animalsAcknowledged ? 'bg-[#744210]/60' : 'bg-[#744210]/80',
    border: 'border-[#9C6220]',
    icon: '#D69E2E',
    text: '#FEFCBF',
    chip: 'bg-[#5C3310]/70'
  }

  return (
    <div className="space-y-2">
      {/* Plants needing cold protection */}
      {hasPlants && (
        <div className={`${coldColors.bg} ${coldColors.border} border-l-4 rounded-lg px-3 py-2`}>
          <div className="flex items-center gap-2">
            <Snowflake className="w-4 h-4" style={{ color: coldColors.icon }} />
            <span className="text-sm font-medium" style={{ color: coldColors.text }}>
              Cold Protection: {plantData.plants.length} plants
            </span>
            <span className="text-xs" style={{ color: coldColors.text, opacity: 0.7 }}>
              (Low: {plantData.forecast_low}°F)
            </span>
            <div className="flex-1" />
            {!plantsAcknowledged && (
              <button
                onClick={() => setPlantsAcknowledged(true)}
                className="p-1 rounded bg-white/10 hover:bg-white/20 transition-colors"
                title="Got it"
              >
                <Check className="w-3.5 h-3.5" style={{ color: coldColors.text }} />
              </button>
            )}
            <button
              onClick={() => setPlantsDismissed(true)}
              className="p-1 rounded bg-white/10 hover:bg-white/20 transition-colors"
              title="Dismiss"
            >
              <X className="w-3.5 h-3.5" style={{ color: coldColors.text }} />
            </button>
          </div>
          {!plantsAcknowledged && (
            <div className="flex flex-wrap gap-1 mt-2">
              {plantData.plants.map((plant) => (
                <span
                  key={plant.id}
                  className={`text-xs ${coldColors.chip} px-2 py-0.5 rounded`}
                  style={{ color: coldColors.text }}
                >
                  {plant.name} ({plant.min_temp}°)
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Animals needing blankets */}
      {hasAnimals && (
        <div className={`${blanketColors.bg} ${blanketColors.border} border-l-4 rounded-lg px-3 py-2`}>
          <div className="flex items-center gap-2">
            <PawPrint className="w-4 h-4" style={{ color: blanketColors.icon }} />
            <span className="text-sm font-medium" style={{ color: blanketColors.text }}>
              Blanket Needed: {animals.length} animal{animals.length > 1 ? 's' : ''}
            </span>
            {plantData?.forecast_low && (
              <span className="text-xs" style={{ color: blanketColors.text, opacity: 0.7 }}>
                (Low: {plantData.forecast_low}°F)
              </span>
            )}
            <div className="flex-1" />
            {!animalsAcknowledged && (
              <button
                onClick={() => setAnimalsAcknowledged(true)}
                className="p-1 rounded bg-white/10 hover:bg-white/20 transition-colors"
                title="Got it"
              >
                <Check className="w-3.5 h-3.5" style={{ color: blanketColors.text }} />
              </button>
            )}
            <button
              onClick={() => setAnimalsDismissed(true)}
              className="p-1 rounded bg-white/10 hover:bg-white/20 transition-colors"
              title="Dismiss"
            >
              <X className="w-3.5 h-3.5" style={{ color: blanketColors.text }} />
            </button>
          </div>
          {!animalsAcknowledged && (
            <div className="flex flex-wrap gap-1 mt-2">
              {animals.map((animal) => (
                <span
                  key={animal.id}
                  className={`text-xs ${blanketColors.chip} px-2 py-0.5 rounded`}
                  style={{ color: blanketColors.text }}
                >
                  {animal.name} {animal.color ? `(${animal.color})` : ''} - blanket below {animal.needs_blanket_below}°
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default ColdProtectionWidget
