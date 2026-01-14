import React from 'react'
import { PawPrint, MapPin } from 'lucide-react'

// Predefined tags with colors (same as Animals.jsx)
const ANIMAL_TAGS = {
  sick: { label: 'Sick', color: 'bg-red-600 text-white' },
  injured: { label: 'Injured', color: 'bg-orange-600 text-white' },
  pregnant: { label: 'Pregnant', color: 'bg-pink-600 text-white' },
  nursing: { label: 'Nursing', color: 'bg-purple-600 text-white' },
  quarantine: { label: 'Quarantine', color: 'bg-yellow-600 text-black' },
  for_sale: { label: 'For Sale', color: 'bg-green-600 text-white' },
  new: { label: 'New', color: 'bg-blue-600 text-white' },
  special_diet: { label: 'Special Diet', color: 'bg-cyan-600 text-white' },
  senior: { label: 'Senior', color: 'bg-gray-500 text-white' },
  breeding: { label: 'Breeding', color: 'bg-rose-600 text-white' },
}

// Capitalize animal type for display
const formatAnimalType = (type) => {
  if (!type) return ''
  return type.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
}

function AnimalFeedWidget({ animals, className = '' }) {
  // Filter to animals with feeding info
  const animalsWithFeeding = animals.filter(animal => {
    if (animal.feeds && animal.feeds.length > 0) return true
    if (animal.feed_type || animal.feed_amount || animal.feed_frequency) return true
    return false
  })

  if (animalsWithFeeding.length === 0) {
    return null
  }

  // Sort function to match Animals.jsx (by type, then by name)
  const sortAnimals = (a, b) => {
    if (a.animal_type !== b.animal_type) {
      return a.animal_type.localeCompare(b.animal_type)
    }
    return a.name.localeCompare(b.name)
  }

  // Separate pets and livestock, sorted to match Animals.jsx
  const pets = animalsWithFeeding
    .filter(a => a.category === 'pet')
    .sort(sortAnimals)
  const livestock = animalsWithFeeding
    .filter(a => a.category === 'livestock')
    .sort(sortAnimals)

  // Group livestock by type AND feed (so same type with same feeds are grouped)
  const groupedLivestock = livestock.reduce((acc, animal) => {
    // Build feed key from all feeds
    const feedKey = (animal.feeds || [])
      .map(f => `${f.feed_type}|${f.amount}|${f.frequency}`)
      .sort()
      .join('::') || `${animal.feed_type}|${animal.feed_amount}|${animal.feed_frequency}`

    const groupKey = `${animal.animal_type}|${feedKey}`

    if (!acc[groupKey]) {
      acc[groupKey] = {
        animal_type: animal.animal_type,
        feeds: animal.feeds || [{ feed_type: animal.feed_type, amount: animal.feed_amount, frequency: animal.feed_frequency }],
        animals: []
      }
    }
    acc[groupKey].animals.push(animal)
    return acc
  }, {})

  // Convert to array and sort by animal type then by first animal name (to match Animals.jsx order)
  const livestockGroups = Object.values(groupedLivestock).sort((a, b) => {
    if (a.animal_type !== b.animal_type) {
      return a.animal_type.localeCompare(b.animal_type)
    }
    // Within same type, sort by first animal's name
    return a.animals[0].name.localeCompare(b.animals[0].name)
  })

  // Render a single feed row
  // Order: Name → Color+Type → Location → Food info → Tags → Special Instructions
  const renderFeedRow = (key, name, feeds, color, animalType, tags = [], location = null, specialInstructions = null) => {
    const importantTags = tags.filter(tag =>
      ['sick', 'injured', 'special_diet', 'pregnant'].includes(tag)
    )

    // Combine color and type like "Black Dog"
    const colorType = [color, formatAnimalType(animalType)].filter(Boolean).join(' ')

    return (
      <div
        key={key}
        className="rounded px-3 py-2"
        style={{ backgroundColor: '#c4b199' }}
      >
        {/* Single row that can wrap */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          {/* 1. Name */}
          <span className="font-semibold text-base" style={{ color: '#2d2316' }}>
            {name}
          </span>

          {/* 2. Color + Type (e.g., "Black Dog") */}
          {colorType && (
            <>
              <span style={{ color: '#887f67' }}>·</span>
              <span className="text-sm" style={{ color: '#887f67' }}>
                {colorType}
              </span>
            </>
          )}

          {/* 3. Location if present */}
          {location && (
            <>
              <span style={{ color: '#887f67' }}>·</span>
              <span className="text-sm flex items-center gap-1 flex-shrink-0" style={{ color: '#887f67' }}>
                <MapPin className="w-4 h-4" />
                {location}
              </span>
            </>
          )}

          {/* 4. Feeds: amount, type, frequency */}
          <span style={{ color: '#887f67' }}>·</span>
          <span className="text-base" style={{ color: '#4b3b2f' }}>
            {feeds.map((feed, idx) => (
              <span key={idx}>
                {[feed.amount, feed.feed_type, feed.frequency].filter(Boolean).join(' ')}
                {idx < feeds.length - 1 && ' | '}
              </span>
            ))}
          </span>

          {/* 5. Tags */}
          {importantTags.slice(0, 1).map(tag => {
            const tagInfo = ANIMAL_TAGS[tag]
            if (!tagInfo) return null
            return (
              <span
                key={tag}
                className={`text-sm px-1.5 py-0.5 rounded flex-shrink-0 ${tagInfo.color}`}
              >
                {tagInfo.label}
              </span>
            )
          })}

          {/* 6. Special instructions inline */}
          {specialInstructions && (
            <>
              <span style={{ color: '#887f67' }}>·</span>
              <span className="text-sm" style={{ color: '#6f4b2a' }}>
                {specialInstructions}
              </span>
            </>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className={`rounded-xl p-4 flex flex-col min-h-0 ${className}`}
         style={{
           backgroundColor: '#d4b483',
           border: '1px solid #8a6f3b'
         }}>
      <div className="flex items-center gap-2 mb-3 flex-shrink-0">
        <PawPrint className="w-5 h-5" style={{ color: '#6f4b2a' }} />
        <h2 className="text-base font-semibold" style={{ color: '#2d2316' }}>Feeding Guide</h2>
      </div>

      <div className="space-y-2 flex-1 min-h-0 overflow-y-auto">
        {/* Pets - one line per animal, never grouped */}
        {pets.map(animal => {
          const feeds = animal.feeds && animal.feeds.length > 0
            ? animal.feeds
            : [{ feed_type: animal.feed_type, amount: animal.feed_amount, frequency: animal.feed_frequency }]

          // Get location from pasture, barn, or farm_area
          const location = animal.pasture || animal.barn || animal.farm_area?.name || null

          return renderFeedRow(
            `pet-${animal.id}`,
            animal.name,
            feeds,
            animal.color,
            animal.animal_type,
            animal.tags || [],
            location,
            animal.special_instructions
          )
        })}

        {/* Livestock - grouped by type and feed */}
        {livestockGroups.map((group, idx) => {
          const isGrouped = group.animals.length > 1
          const groupTags = [...new Set(
            group.animals.flatMap(a => a.tags || [])
          )]

          const displayName = isGrouped
            ? group.animals.length > 3
              ? `${formatAnimalType(group.animal_type)} (${group.animals.length})`
              : group.animals.map(a => a.name).join(', ')
            : group.animals[0].name

          const color = isGrouped ? null : group.animals[0].color

          // For grouped animals, combine unique locations
          const locations = [...new Set(
            group.animals
              .map(a => a.pasture || a.barn || a.farm_area?.name)
              .filter(Boolean)
          )]
          const location = isGrouped
            ? (locations.length === 1 ? locations[0] : null)
            : (group.animals[0].pasture || group.animals[0].barn || group.animals[0].farm_area?.name || null)

          // For grouped animals, combine unique special instructions
          const instructions = [...new Set(
            group.animals
              .map(a => a.special_instructions)
              .filter(Boolean)
          )]
          const specialInstructions = instructions.length > 0 ? instructions.join('; ') : null

          return renderFeedRow(
            `livestock-${idx}`,
            displayName,
            group.feeds,
            color,
            group.animal_type,
            groupTags,
            location,
            specialInstructions
          )
        })}
      </div>
    </div>
  )
}

export default AnimalFeedWidget
