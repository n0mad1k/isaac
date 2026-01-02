import React from 'react'
import { PawPrint } from 'lucide-react'

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

function AnimalFeedWidget({ animals }) {
  // Filter to animals with feeding info
  const animalsWithFeeding = animals.filter(animal => {
    if (animal.feeds && animal.feeds.length > 0) return true
    if (animal.feed_type || animal.feed_amount || animal.feed_frequency) return true
    return false
  })

  if (animalsWithFeeding.length === 0) {
    return null
  }

  // Separate pets and livestock
  const pets = animalsWithFeeding.filter(a => a.category === 'pet')
  const livestock = animalsWithFeeding.filter(a => a.category === 'livestock')

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

  // Convert to array and sort by group size (larger groups first)
  const livestockGroups = Object.values(groupedLivestock).sort(
    (a, b) => b.animals.length - a.animals.length
  )

  // Render a single feed row
  // Order: Name → Tags → Food info → "Color Type" (grey, together)
  const renderFeedRow = (key, name, feeds, color, animalType, tags = []) => {
    const importantTags = tags.filter(tag =>
      ['sick', 'injured', 'special_diet', 'pregnant'].includes(tag)
    )

    // Combine color and type like "Black Dog"
    const colorType = [color, formatAnimalType(animalType)].filter(Boolean).join(' ')

    return (
      <div
        key={key}
        className="flex items-center gap-2 text-sm bg-gray-700/30 rounded px-2 py-1"
      >
        {/* Name */}
        <span className="font-medium text-white truncate">
          {name}
        </span>

        {/* Tags - after name */}
        {importantTags.slice(0, 1).map(tag => {
          const tagInfo = ANIMAL_TAGS[tag]
          if (!tagInfo) return null
          return (
            <span
              key={tag}
              className={`text-xs px-1 rounded flex-shrink-0 ${tagInfo.color}`}
            >
              {tagInfo.label}
            </span>
          )
        })}

        {/* Separator */}
        <span className="text-gray-600">·</span>

        {/* Feeds: amount, type, frequency */}
        <span className="text-cyan-400 truncate">
          {feeds.map((feed, idx) => (
            <span key={idx}>
              {[feed.amount, feed.feed_type, feed.frequency].filter(Boolean).join(' ')}
              {idx < feeds.length - 1 && ' | '}
            </span>
          ))}
        </span>

        {/* Separator */}
        <span className="text-gray-600">·</span>

        {/* Color + Type together (grey) like "Black Dog" */}
        <span className="text-xs text-gray-500 truncate">
          {colorType}
        </span>
      </div>
    )
  }

  return (
    <div className="bg-gray-800 rounded-xl p-3">
      <div className="flex items-center gap-2 mb-2">
        <PawPrint className="w-4 h-4 text-cyan-400" />
        <h2 className="text-sm font-semibold text-gray-300">Feeding Guide</h2>
      </div>

      <div className="space-y-1">
        {/* Pets - one line per animal, never grouped */}
        {pets.map(animal => {
          const feeds = animal.feeds && animal.feeds.length > 0
            ? animal.feeds
            : [{ feed_type: animal.feed_type, amount: animal.feed_amount, frequency: animal.feed_frequency }]

          return renderFeedRow(
            `pet-${animal.id}`,
            animal.name,
            feeds,
            animal.color,
            animal.animal_type,
            animal.tags || []
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

          return renderFeedRow(
            `livestock-${idx}`,
            displayName,
            group.feeds,
            color,
            group.animal_type,
            groupTags
          )
        })}
      </div>
    </div>
  )
}

export default AnimalFeedWidget
