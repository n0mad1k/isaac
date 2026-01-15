import React, { useState, useEffect } from 'react'
import { Snowflake, PawPrint, Check, X } from 'lucide-react'
import { getColdProtection, getAnimalsNeedingBlanket } from '../services/api'

function ColdProtectionWidget({ onAcknowledge }) {
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

  // Notify parent when acknowledged items exist
  useEffect(() => {
    if (onAcknowledge) {
      const acknowledgedItems = []
      if (plantsAcknowledged && plantData?.plants?.length > 0 && !plantsDismissed) {
        acknowledgedItems.push({
          id: 'cold-protection',
          type: 'cold',
          title: `Cold Protection: ${plantData.plants.length} plants`,
          message: `Low: ${plantData.forecast_low}°F`,
          plants: plantData.plants
        })
      }
      if (animalsAcknowledged && animals.length > 0 && !animalsDismissed) {
        acknowledgedItems.push({
          id: 'blanket-needed',
          type: 'blanket',
          title: `Blanket Needed: ${animals.length} animal${animals.length > 1 ? 's' : ''}`,
          message: plantData?.forecast_low ? `Low: ${plantData.forecast_low}°F` : '',
          animals: animals
        })
      }
      onAcknowledge(acknowledgedItems)
    }
  }, [plantsAcknowledged, animalsAcknowledged, plantsDismissed, animalsDismissed, plantData, animals, onAcknowledge])

  // Only show unacknowledged items here
  const showPlants = plantData?.needs_protection && plantData?.plants?.length > 0 && !plantsDismissed && !plantsAcknowledged
  const showAnimals = animals.length > 0 && !animalsDismissed && !animalsAcknowledged

  if (loading || (!showPlants && !showAnimals)) {
    return null
  }

  // Custom colors - Lighter teal/blue for cold
  const coldColors = {
    bg: 'bg-[#3F8993]/90',
    border: 'border-[#5AABB6]',
    icon: '#A8E0E8',
    text: '#E0F7FA',
    chip: 'bg-[#2D6A73]/70'
  }

  // Purple for blankets
  const blanketColors = {
    bg: 'bg-[#7C4F9B]/90',
    border: 'border-[#9B6BC0]',
    icon: '#D4B8E8',
    text: '#F3E8FA',
    chip: 'bg-[#5C3A75]/70'
  }

  return (
    <div className="space-y-2">
      {/* Plants needing cold protection */}
      {showPlants && (
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
            <button
              onClick={() => setPlantsAcknowledged(true)}
              className="p-1 rounded bg-white/10 hover:bg-white/20 transition-colors"
              title="Got it"
            >
              <Check className="w-3.5 h-3.5" style={{ color: coldColors.text }} />
            </button>
            <button
              onClick={() => setPlantsDismissed(true)}
              className="p-1 rounded bg-white/10 hover:bg-white/20 transition-colors"
              title="Dismiss"
            >
              <X className="w-3.5 h-3.5" style={{ color: coldColors.text }} />
            </button>
          </div>
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
        </div>
      )}

      {/* Animals needing blankets */}
      {showAnimals && (
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
            <button
              onClick={() => setAnimalsAcknowledged(true)}
              className="p-1 rounded bg-white/10 hover:bg-white/20 transition-colors"
              title="Got it"
            >
              <Check className="w-3.5 h-3.5" style={{ color: blanketColors.text }} />
            </button>
            <button
              onClick={() => setAnimalsDismissed(true)}
              className="p-1 rounded bg-white/10 hover:bg-white/20 transition-colors"
              title="Dismiss"
            >
              <X className="w-3.5 h-3.5" style={{ color: blanketColors.text }} />
            </button>
          </div>
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
        </div>
      )}
    </div>
  )
}

export default ColdProtectionWidget
