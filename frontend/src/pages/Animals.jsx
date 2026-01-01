import React, { useState, useEffect } from 'react'
import {
  Plus, Search, PawPrint, Calendar, AlertCircle, ChevronDown, ChevronUp,
  MapPin, DollarSign, Scale, Clock, Check, X, Syringe, Scissors,
  Heart, Beef, Dog, Cat, Pencil
} from 'lucide-react'
import {
  getAnimals, createAnimal, updateAnimal, addAnimalCareLog,
  addAnimalExpense, getAnimalExpenses
} from '../services/api'
import { format, differenceInDays } from 'date-fns'

function Animals() {
  const [animals, setAnimals] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingAnimal, setEditingAnimal] = useState(null)
  const [expandedAnimal, setExpandedAnimal] = useState(null)
  const [search, setSearch] = useState('')
  const [activeTab, setActiveTab] = useState('all') // all, pet, livestock
  const [showExpenseForm, setShowExpenseForm] = useState(null) // animal_id or null
  const [editDateModal, setEditDateModal] = useState(null) // { animalId, field, label, currentDate }

  const fetchAnimals = async () => {
    try {
      const response = await getAnimals()
      setAnimals(response.data)
    } catch (error) {
      console.error('Failed to fetch animals:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAnimals()
  }, [])

  const filteredAnimals = animals.filter((animal) => {
    const matchesSearch = animal.name.toLowerCase().includes(search.toLowerCase()) ||
      (animal.breed && animal.breed.toLowerCase().includes(search.toLowerCase()))

    if (activeTab === 'all') return matchesSearch
    return matchesSearch && animal.category === activeTab
  })

  const pets = animals.filter(a => a.category === 'pet')
  const livestock = animals.filter(a => a.category === 'livestock')

  const getAnimalIcon = (type) => {
    const icons = {
      horse: '🐴',
      cattle: '🐄',
      goat: '🐐',
      sheep: '🐑',
      pig: '🐷',
      chicken: '🐔',
      duck: '🦆',
      turkey: '🦃',
      rabbit: '🐰',
      dog: '🐕',
      cat: '🐈',
      donkey: '🫏',
      llama: '🦙',
      alpaca: '🦙',
    }
    return icons[type] || '🐾'
  }

  const getDaysUntil = (dateStr) => {
    if (!dateStr) return null
    const days = differenceInDays(new Date(dateStr), new Date())
    return days
  }

  const getUrgencyClass = (days) => {
    if (days === null) return 'bg-gray-700 text-gray-300'
    if (days <= 0) return 'bg-red-900/50 text-red-300 border border-red-700'
    if (days <= 7) return 'bg-red-900/30 text-red-300'
    if (days <= 14) return 'bg-yellow-900/30 text-yellow-300'
    return 'bg-gray-700 text-gray-300'
  }

  const logCare = async (animalId, careType, extraData = {}) => {
    try {
      await addAnimalCareLog(animalId, { care_type: careType, ...extraData })
      fetchAnimals() // Refresh to show updated dates
    } catch (error) {
      console.error('Failed to log care:', error)
      alert('Failed to log care action')
    }
  }

  const addExpense = async (animalId, expenseData) => {
    try {
      await addAnimalExpense(animalId, expenseData)
      setShowExpenseForm(null)
      fetchAnimals()
    } catch (error) {
      console.error('Failed to add expense:', error)
      alert('Failed to add expense')
    }
  }

  const updateCareDate = async (animalId, field, dateValue) => {
    try {
      await updateAnimal(animalId, { [field]: dateValue })
      setEditDateModal(null)
      fetchAnimals()
    } catch (error) {
      console.error('Failed to update date:', error)
      alert('Failed to update date')
    }
  }

  // Stats
  const stats = {
    totalPets: pets.length,
    totalLivestock: livestock.length,
    needsAttention: animals.filter(a => {
      if (a.category === 'pet') {
        return a.worming_overdue || a.vaccination_overdue || a.hoof_trim_overdue || a.dental_overdue
      }
      return a.days_until_slaughter !== null && a.days_until_slaughter <= 14
    }).length,
    totalExpenses: animals.reduce((sum, a) => sum + (a.total_expenses || 0), 0),
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-farm-green"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <PawPrint className="w-7 h-7 text-blue-500" />
          Animals
        </h1>
        <button
          onClick={() => { setEditingAnimal(null); setShowForm(true) }}
          className="flex items-center gap-2 px-4 py-2 bg-farm-green hover:bg-farm-green-light rounded-lg transition-colors"
        >
          <Plus className="w-5 h-5" />
          Add Animal
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-gray-800 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <Heart className="w-5 h-5 text-pink-400" />
            <span className="text-2xl font-bold text-pink-400">{stats.totalPets}</span>
          </div>
          <div className="text-sm text-gray-400">Pets</div>
        </div>
        <div className="bg-gray-800 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <Beef className="w-5 h-5 text-amber-400" />
            <span className="text-2xl font-bold text-amber-400">{stats.totalLivestock}</span>
          </div>
          <div className="text-sm text-gray-400">Livestock</div>
        </div>
        <div className="bg-gray-800 rounded-xl p-4">
          <div className="text-2xl font-bold text-red-400">{stats.needsAttention}</div>
          <div className="text-sm text-gray-400">Need Attention</div>
        </div>
        <div className="bg-gray-800 rounded-xl p-4">
          <div className="flex items-center gap-1">
            <DollarSign className="w-5 h-5 text-green-400" />
            <span className="text-2xl font-bold text-green-400">
              {stats.totalExpenses.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </span>
          </div>
          <div className="text-sm text-gray-400">Total Expenses</div>
        </div>
      </div>

      {/* Tabs and Filters */}
      <div className="flex flex-wrap gap-4">
        {/* Category Tabs */}
        <div className="flex bg-gray-800 rounded-lg p-1">
          <button
            onClick={() => setActiveTab('all')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'all' ? 'bg-farm-green text-white' : 'text-gray-400 hover:text-white'
            }`}
          >
            All ({animals.length})
          </button>
          <button
            onClick={() => setActiveTab('pet')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-1 ${
              activeTab === 'pet' ? 'bg-pink-600 text-white' : 'text-gray-400 hover:text-white'
            }`}
          >
            <Heart className="w-4 h-4" /> Pets ({pets.length})
          </button>
          <button
            onClick={() => setActiveTab('livestock')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-1 ${
              activeTab === 'livestock' ? 'bg-amber-600 text-white' : 'text-gray-400 hover:text-white'
            }`}
          >
            <Beef className="w-4 h-4" /> Livestock ({livestock.length})
          </button>
        </div>

        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search animals..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
          />
        </div>
      </div>

      {/* Animal List */}
      {filteredAnimals.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <PawPrint className="w-16 h-16 mx-auto mb-4 opacity-50" />
          <p>No animals found. Add your first animal!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredAnimals.map((animal) => (
            <AnimalCard
              key={animal.id}
              animal={animal}
              expanded={expandedAnimal === animal.id}
              onToggle={() => setExpandedAnimal(expandedAnimal === animal.id ? null : animal.id)}
              onLogCare={logCare}
              onEdit={() => { setEditingAnimal(animal); setShowForm(true) }}
              onAddExpense={() => setShowExpenseForm(animal.id)}
              onEditDate={setEditDateModal}
              getAnimalIcon={getAnimalIcon}
              getDaysUntil={getDaysUntil}
              getUrgencyClass={getUrgencyClass}
            />
          ))}
        </div>
      )}

      {/* Add/Edit Animal Modal */}
      {showForm && (
        <AnimalFormModal
          animal={editingAnimal}
          onClose={() => { setShowForm(false); setEditingAnimal(null) }}
          onSave={() => { setShowForm(false); setEditingAnimal(null); fetchAnimals() }}
        />
      )}

      {/* Add Expense Modal */}
      {showExpenseForm && (
        <ExpenseFormModal
          animalId={showExpenseForm}
          animalName={animals.find(a => a.id === showExpenseForm)?.name}
          onClose={() => setShowExpenseForm(null)}
          onSave={(data) => addExpense(showExpenseForm, data)}
        />
      )}

      {/* Edit Date Modal */}
      {editDateModal && (
        <EditDateModal
          label={editDateModal.label}
          currentDate={editDateModal.currentDate}
          onClose={() => setEditDateModal(null)}
          onSave={(date) => updateCareDate(editDateModal.animalId, editDateModal.field, date)}
        />
      )}
    </div>
  )
}


// Animal Card Component
function AnimalCard({
  animal, expanded, onToggle, onLogCare, onEdit, onAddExpense, onEditDate,
  getAnimalIcon, getDaysUntil, getUrgencyClass
}) {
  const isPet = animal.category === 'pet'
  const isLivestock = animal.category === 'livestock'
  const slaughterDays = getDaysUntil(animal.slaughter_date)

  // Check for overdue care items (pets)
  const overdueItems = []
  if (isPet) {
    if (animal.worming_overdue) overdueItems.push('Worming')
    if (animal.vaccination_overdue) overdueItems.push('Vaccination')
    if (animal.hoof_trim_overdue) overdueItems.push('Hoof Trim')
    if (animal.dental_overdue) overdueItems.push('Dental')
  }

  return (
    <div className={`bg-gray-800 rounded-xl overflow-hidden ${
      isPet ? 'border-l-4 border-pink-500' : isLivestock ? 'border-l-4 border-amber-500' : ''
    }`}>
      {/* Card Header */}
      <div
        className="p-4 flex items-center justify-between cursor-pointer hover:bg-gray-750"
        onClick={onToggle}
      >
        <div className="flex items-center gap-4">
          <span className="text-3xl">{getAnimalIcon(animal.animal_type)}</span>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-lg">{animal.name}</h3>
              <span className={`text-xs px-2 py-0.5 rounded ${
                isPet ? 'bg-pink-900/30 text-pink-300' : 'bg-amber-900/30 text-amber-300'
              }`}>
                {isPet ? 'Pet' : 'Livestock'}
              </span>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-400">
              {animal.breed && <span>{animal.breed}</span>}
              {animal.age_display && <span className="text-gray-500">• {animal.age_display}</span>}
              {animal.current_weight && <span className="text-gray-500">• {animal.current_weight} lbs</span>}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Quick status indicators */}
          <div className="flex items-center gap-2">
            {/* Overdue care for pets */}
            {overdueItems.length > 0 && (
              <span className="text-xs px-2 py-1 rounded bg-red-900/50 text-red-300 border border-red-700">
                {overdueItems.length} overdue
              </span>
            )}

            {/* Slaughter date for livestock */}
            {isLivestock && slaughterDays !== null && (
              <span className={`text-xs px-2 py-1 rounded ${getUrgencyClass(slaughterDays)}`}>
                {slaughterDays <= 0 ? 'Ready' : `${slaughterDays}d`}
              </span>
            )}

            {/* Total expenses */}
            {animal.total_expenses > 0 && (
              <span className="text-xs px-2 py-1 rounded bg-gray-700 text-gray-300">
                ${animal.total_expenses.toFixed(0)}
              </span>
            )}

            {/* Status badge */}
            <span className={`text-xs px-2 py-1 rounded ${
              animal.status === 'healthy' ? 'bg-green-900/30 text-green-300' :
              animal.status === 'sick' || animal.status === 'injured' ? 'bg-red-900/30 text-red-300' :
              'bg-gray-700 text-gray-300'
            }`}>
              {animal.status || 'Unknown'}
            </span>
          </div>

          {expanded ? (
            <ChevronUp className="w-5 h-5 text-gray-400" />
          ) : (
            <ChevronDown className="w-5 h-5 text-gray-400" />
          )}
        </div>
      </div>

      {/* Expanded Details */}
      {expanded && (
        <div className="px-4 pb-4 border-t border-gray-700 pt-4 space-y-4">

          {/* Basic Info Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            {animal.birth_date && (
              <div>
                <span className="text-gray-500">Birth Date</span>
                <p className="text-gray-300">{format(new Date(animal.birth_date), 'MMM d, yyyy')}</p>
              </div>
            )}
            {animal.acquisition_date && (
              <div>
                <span className="text-gray-500">Acquired</span>
                <p className="text-gray-300">{format(new Date(animal.acquisition_date), 'MMM d, yyyy')}</p>
              </div>
            )}
            {animal.current_weight && (
              <div>
                <span className="text-gray-500">Weight</span>
                <p className="text-gray-300">{animal.current_weight} lbs</p>
              </div>
            )}
            {(animal.pasture || animal.barn) && (
              <div className="flex items-start gap-1">
                <MapPin className="w-4 h-4 text-gray-400 mt-0.5" />
                <div>
                  <span className="text-gray-500">Location</span>
                  <p className="text-gray-300">{animal.pasture || animal.barn}</p>
                </div>
              </div>
            )}
          </div>

          {/* Feeding Info */}
          {(animal.feed_amount || animal.feed_frequency) && (
            <div className="bg-gray-900/50 rounded-lg p-3">
              <h4 className="text-sm font-medium text-gray-400 mb-2">Feeding</h4>
              <div className="grid grid-cols-2 gap-3 text-sm">
                {animal.feed_amount && (
                  <div>
                    <span className="text-gray-500">Amount</span>
                    <p className="text-gray-300">{animal.feed_amount}</p>
                  </div>
                )}
                {animal.feed_frequency && (
                  <div>
                    <span className="text-gray-500">Frequency</span>
                    <p className="text-gray-300">{animal.feed_frequency}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* PET: Care Schedule Cards */}
          {isPet && (
            <div className="bg-gray-900/50 rounded-lg p-3">
              <h4 className="text-sm font-medium text-gray-400 mb-3">Care Schedule</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {/* Worming */}
                <CareCard
                  title="Worming"
                  icon="💊"
                  lastDate={animal.last_wormed}
                  nextDate={animal.next_worming}
                  isOverdue={animal.worming_overdue}
                  frequencyDays={animal.worming_frequency_days}
                  onConfirm={() => onLogCare(animal.id, 'wormed')}
                  onEditDate={() => onEditDate({ animalId: animal.id, field: 'last_wormed', label: 'Last Wormed', currentDate: animal.last_wormed })}
                />
                {/* Vaccination */}
                <CareCard
                  title="Vaccination"
                  icon="💉"
                  lastDate={animal.last_vaccinated}
                  nextDate={animal.next_vaccination}
                  isOverdue={animal.vaccination_overdue}
                  frequencyDays={animal.vaccination_frequency_days}
                  onConfirm={() => onLogCare(animal.id, 'vaccinated')}
                  onEditDate={() => onEditDate({ animalId: animal.id, field: 'last_vaccinated', label: 'Last Vaccinated', currentDate: animal.last_vaccinated })}
                />
                {/* Hoof Trim */}
                <CareCard
                  title="Hoof Trim"
                  icon="🔧"
                  lastDate={animal.last_hoof_trim}
                  nextDate={animal.next_hoof_trim}
                  isOverdue={animal.hoof_trim_overdue}
                  frequencyDays={animal.hoof_trim_frequency_days}
                  onConfirm={() => onLogCare(animal.id, 'hoof_trim')}
                  onEditDate={() => onEditDate({ animalId: animal.id, field: 'last_hoof_trim', label: 'Last Hoof Trim', currentDate: animal.last_hoof_trim })}
                />
                {/* Dental */}
                <CareCard
                  title="Dental"
                  icon="🦷"
                  lastDate={animal.last_dental}
                  nextDate={animal.next_dental}
                  isOverdue={animal.dental_overdue}
                  frequencyDays={animal.dental_frequency_days}
                  onConfirm={() => onLogCare(animal.id, 'dental')}
                  onEditDate={() => onEditDate({ animalId: animal.id, field: 'last_dental', label: 'Last Dental', currentDate: animal.last_dental })}
                />
              </div>
            </div>
          )}

          {/* LIVESTOCK: Slaughter & Expenses */}
          {isLivestock && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Slaughter Info */}
              {animal.slaughter_date && (
                <div className={`p-3 rounded-lg ${getUrgencyClass(slaughterDays)}`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium flex items-center gap-2">
                      <Calendar className="w-4 h-4" /> Slaughter Date
                    </span>
                    <span className="font-bold">
                      {slaughterDays <= 0 ? 'Ready!' : `${slaughterDays} days`}
                    </span>
                  </div>
                  <p className="text-sm">{format(new Date(animal.slaughter_date), 'MMMM d, yyyy')}</p>
                  {animal.target_weight && (
                    <p className="text-xs mt-1 opacity-75">Target: {animal.target_weight} lbs</p>
                  )}
                  {animal.processor && (
                    <p className="text-xs mt-1 opacity-75">Processor: {animal.processor}</p>
                  )}
                </div>
              )}

              {/* Expense Summary */}
              <div className="bg-gray-700 p-3 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium flex items-center gap-2">
                    <DollarSign className="w-4 h-4" /> Total Investment
                  </span>
                  <span className="font-bold text-green-400">
                    ${(animal.total_expenses || 0).toFixed(2)}
                  </span>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); onAddExpense() }}
                  className="w-full mt-2 px-3 py-1.5 bg-green-900/50 hover:bg-green-800/50 rounded text-sm text-green-300 transition-colors"
                >
                  + Add Expense
                </button>
              </div>
            </div>
          )}

          {/* Notes */}
          {animal.notes && (
            <div className="text-sm">
              <span className="text-gray-500">Notes</span>
              <p className="text-gray-300 mt-1">{animal.notes}</p>
            </div>
          )}

          {/* Care Actions */}
          <div className="flex flex-wrap gap-2 pt-4 border-t border-gray-700">
            <button
              onClick={(e) => {
                e.stopPropagation()
                const weight = prompt('Enter current weight (lbs):')
                if (weight) onLogCare(animal.id, 'weighed', { weight: parseFloat(weight) })
              }}
              className="flex items-center gap-1 px-3 py-2 bg-blue-900/50 hover:bg-blue-800/50 rounded-lg text-sm transition-colors"
            >
              <Scale className="w-4 h-4" /> Log Weight
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation()
                const notes = prompt('Vet visit notes:')
                if (notes) onLogCare(animal.id, 'vet_visit', { notes })
              }}
              className="flex items-center gap-1 px-3 py-2 bg-red-900/50 hover:bg-red-800/50 rounded-lg text-sm transition-colors"
            >
              🏥 Vet Visit
            </button>
            {isPet && (
              <button
                onClick={(e) => { e.stopPropagation(); onAddExpense() }}
                className="flex items-center gap-1 px-3 py-2 bg-green-900/50 hover:bg-green-800/50 rounded-lg text-sm transition-colors"
              >
                <DollarSign className="w-4 h-4" /> Add Expense
              </button>
            )}
            <div className="flex-1" />
            <button
              onClick={(e) => { e.stopPropagation(); onEdit() }}
              className="px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm transition-colors"
            >
              Edit
            </button>
          </div>
        </div>
      )}
    </div>
  )
}


// Care Card Component for recurring care schedules
function CareCard({ title, icon, lastDate, nextDate, isOverdue, frequencyDays, onConfirm, onEditDate }) {
  if (!frequencyDays) {
    return (
      <div className="bg-gray-800 p-2 rounded-lg text-center opacity-50">
        <div className="text-lg">{icon}</div>
        <div className="text-xs text-gray-500">{title}</div>
        <div className="text-xs text-gray-600">Not scheduled</div>
      </div>
    )
  }

  const getDaysUntil = (dateStr) => {
    if (!dateStr) return null
    return differenceInDays(new Date(dateStr), new Date())
  }

  const daysUntil = getDaysUntil(nextDate)

  return (
    <div className={`p-2 rounded-lg ${
      isOverdue ? 'bg-red-900/50 border border-red-700' :
      daysUntil !== null && daysUntil <= 7 ? 'bg-yellow-900/30' :
      'bg-gray-800'
    }`}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-lg">{icon}</span>
        {isOverdue && (
          <span className="text-xs bg-red-700 text-white px-1.5 py-0.5 rounded">OVERDUE</span>
        )}
      </div>
      <div className="text-xs font-medium">{title}</div>
      <div className="flex items-center gap-1 text-xs text-gray-500">
        <span>Last: {lastDate ? format(new Date(lastDate), 'MMM d') : 'Never'}</span>
        {onEditDate && (
          <button
            onClick={(e) => { e.stopPropagation(); onEditDate() }}
            className="p-0.5 hover:bg-gray-700 rounded"
            title="Edit date"
          >
            <Pencil className="w-3 h-3 text-gray-500 hover:text-white" />
          </button>
        )}
      </div>
      {nextDate && (
        <div className={`text-xs ${isOverdue ? 'text-red-300' : 'text-gray-400'}`}>
          {isOverdue ? 'Was due: ' : 'Due: '}
          {format(new Date(nextDate), 'MMM d')}
        </div>
      )}
      <button
        onClick={(e) => { e.stopPropagation(); onConfirm() }}
        className={`w-full mt-2 px-2 py-1 rounded text-xs flex items-center justify-center gap-1 transition-colors ${
          isOverdue
            ? 'bg-red-700 hover:bg-red-600 text-white'
            : 'bg-farm-green/50 hover:bg-farm-green text-white'
        }`}
      >
        <Check className="w-3 h-3" /> Done
      </button>
    </div>
  )
}


// Animal Form Modal
function AnimalFormModal({ animal, onClose, onSave }) {
  const [formData, setFormData] = useState({
    name: animal?.name || '',
    animal_type: animal?.animal_type || 'dog',
    category: animal?.category || 'pet',
    breed: animal?.breed || '',
    tag_number: animal?.tag_number || '',
    sex: animal?.sex || '',
    birth_date: animal?.birth_date || '',
    acquisition_date: animal?.acquisition_date || '',
    current_weight: animal?.current_weight || '',
    feed_amount: animal?.feed_amount || '',
    feed_frequency: animal?.feed_frequency || '',
    pasture: animal?.pasture || '',
    notes: animal?.notes || '',
    // Livestock
    target_weight: animal?.target_weight || '',
    slaughter_date: animal?.slaughter_date || '',
    processor: animal?.processor || '',
    // Pet care frequencies (in days)
    worming_frequency_days: animal?.worming_frequency_days || '',
    vaccination_frequency_days: animal?.vaccination_frequency_days || '',
    hoof_trim_frequency_days: animal?.hoof_trim_frequency_days || '',
    dental_frequency_days: animal?.dental_frequency_days || '',
    // Cold tolerance
    cold_sensitive: animal?.cold_sensitive || false,
    min_temp: animal?.min_temp || '',
    needs_blanket_below: animal?.needs_blanket_below || '',
  })
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      const data = {
        ...formData,
        current_weight: formData.current_weight ? parseFloat(formData.current_weight) : null,
        target_weight: formData.target_weight ? parseFloat(formData.target_weight) : null,
        worming_frequency_days: formData.worming_frequency_days ? parseInt(formData.worming_frequency_days) : null,
        vaccination_frequency_days: formData.vaccination_frequency_days ? parseInt(formData.vaccination_frequency_days) : null,
        hoof_trim_frequency_days: formData.hoof_trim_frequency_days ? parseInt(formData.hoof_trim_frequency_days) : null,
        dental_frequency_days: formData.dental_frequency_days ? parseInt(formData.dental_frequency_days) : null,
        min_temp: formData.min_temp ? parseFloat(formData.min_temp) : null,
        needs_blanket_below: formData.needs_blanket_below ? parseFloat(formData.needs_blanket_below) : null,
        birth_date: formData.birth_date || null,
        acquisition_date: formData.acquisition_date || null,
        slaughter_date: formData.slaughter_date || null,
      }

      if (animal) {
        await updateAnimal(animal.id, data)
      } else {
        await createAnimal(data)
      }
      onSave()
    } catch (error) {
      console.error('Failed to save animal:', error)
      alert('Failed to save animal')
    } finally {
      setSaving(false)
    }
  }

  const isPet = formData.category === 'pet'
  const isLivestock = formData.category === 'livestock'

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-gray-800 p-4 border-b border-gray-700 flex items-center justify-between">
          <h2 className="text-xl font-semibold">{animal ? 'Edit Animal' : 'Add New Animal'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Category Selection */}
          <div>
            <label className="block text-sm text-gray-400 mb-2">Category *</label>
            <div className="flex gap-4">
              <label className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-lg border cursor-pointer transition-colors ${
                isPet ? 'bg-pink-900/30 border-pink-500' : 'bg-gray-700 border-gray-600 hover:border-gray-500'
              }`}>
                <input
                  type="radio"
                  name="category"
                  value="pet"
                  checked={isPet}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="sr-only"
                />
                <Heart className="w-5 h-5" />
                <span>Pet</span>
              </label>
              <label className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-lg border cursor-pointer transition-colors ${
                isLivestock ? 'bg-amber-900/30 border-amber-500' : 'bg-gray-700 border-gray-600 hover:border-gray-500'
              }`}>
                <input
                  type="radio"
                  name="category"
                  value="livestock"
                  checked={isLivestock}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="sr-only"
                />
                <Beef className="w-5 h-5" />
                <span>Livestock</span>
              </label>
            </div>
          </div>

          {/* Basic Info */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Name *</label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Type *</label>
              <select
                value={formData.animal_type}
                onChange={(e) => setFormData({ ...formData, animal_type: e.target.value })}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
              >
                <optgroup label="Common Pets">
                  <option value="dog">Dog</option>
                  <option value="cat">Cat</option>
                  <option value="horse">Horse</option>
                  <option value="donkey">Donkey</option>
                  <option value="llama">Llama</option>
                  <option value="alpaca">Alpaca</option>
                </optgroup>
                <optgroup label="Livestock">
                  <option value="cattle">Cattle</option>
                  <option value="goat">Goat</option>
                  <option value="sheep">Sheep</option>
                  <option value="pig">Pig</option>
                  <option value="chicken">Chicken</option>
                  <option value="duck">Duck</option>
                  <option value="turkey">Turkey</option>
                  <option value="rabbit">Rabbit</option>
                </optgroup>
                <option value="other">Other</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Breed</label>
              <input
                type="text"
                value={formData.breed}
                onChange={(e) => setFormData({ ...formData, breed: e.target.value })}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Sex</label>
              <select
                value={formData.sex}
                onChange={(e) => setFormData({ ...formData, sex: e.target.value })}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
              >
                <option value="">-</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="gelding">Gelding</option>
                <option value="steer">Steer</option>
                <option value="wether">Wether</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Birth Date</label>
              <input
                type="date"
                value={formData.birth_date}
                onChange={(e) => setFormData({ ...formData, birth_date: e.target.value })}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Current Weight (lbs)</label>
              <input
                type="number"
                step="0.1"
                value={formData.current_weight}
                onChange={(e) => setFormData({ ...formData, current_weight: e.target.value })}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Feed Amount</label>
              <input
                type="text"
                value={formData.feed_amount}
                onChange={(e) => setFormData({ ...formData, feed_amount: e.target.value })}
                placeholder="e.g., 2 cups, 5 lbs"
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Feed Frequency</label>
              <input
                type="text"
                value={formData.feed_frequency}
                onChange={(e) => setFormData({ ...formData, feed_frequency: e.target.value })}
                placeholder="e.g., twice daily"
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
              />
            </div>
          </div>

          {/* Livestock-specific fields */}
          {isLivestock && (
            <div className="border-t border-gray-700 pt-4">
              <h3 className="text-sm font-medium text-amber-400 mb-3">Livestock Details</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Slaughter Date</label>
                  <input
                    type="date"
                    value={formData.slaughter_date}
                    onChange={(e) => setFormData({ ...formData, slaughter_date: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Target Weight (lbs)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={formData.target_weight}
                    onChange={(e) => setFormData({ ...formData, target_weight: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm text-gray-400 mb-1">Processor</label>
                  <input
                    type="text"
                    value={formData.processor}
                    onChange={(e) => setFormData({ ...formData, processor: e.target.value })}
                    placeholder="Slaughterhouse or processor name"
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Pet-specific fields */}
          {isPet && (
            <div className="border-t border-gray-700 pt-4">
              <h3 className="text-sm font-medium text-pink-400 mb-3">Care Schedule (frequency in days)</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Worming</label>
                  <input
                    type="number"
                    value={formData.worming_frequency_days}
                    onChange={(e) => setFormData({ ...formData, worming_frequency_days: e.target.value })}
                    placeholder="e.g., 60"
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Vaccination</label>
                  <input
                    type="number"
                    value={formData.vaccination_frequency_days}
                    onChange={(e) => setFormData({ ...formData, vaccination_frequency_days: e.target.value })}
                    placeholder="e.g., 365"
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Hoof Trim</label>
                  <input
                    type="number"
                    value={formData.hoof_trim_frequency_days}
                    onChange={(e) => setFormData({ ...formData, hoof_trim_frequency_days: e.target.value })}
                    placeholder="e.g., 42"
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Dental</label>
                  <input
                    type="number"
                    value={formData.dental_frequency_days}
                    onChange={(e) => setFormData({ ...formData, dental_frequency_days: e.target.value })}
                    placeholder="e.g., 365"
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="block text-sm text-gray-400 mb-1">Notes</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
            />
          </div>

          {/* Cold Tolerance */}
          <div className="border-t border-gray-700 pt-4">
            <h3 className="text-sm font-medium text-cyan-400 mb-3 flex items-center gap-2">
              ❄️ Cold Tolerance
            </h3>
            <div className="space-y-4">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.cold_sensitive}
                  onChange={(e) => setFormData({ ...formData, cold_sensitive: e.target.checked })}
                  className="w-5 h-5 rounded border-gray-600 bg-gray-700 text-farm-green focus:ring-farm-green"
                />
                <span className="text-gray-300">Cold sensitive animal (needs protection in cold weather)</span>
              </label>

              {formData.cold_sensitive && (
                <div className="grid grid-cols-2 gap-4 ml-8">
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Min Comfortable Temp (°F)</label>
                    <input
                      type="number"
                      step="1"
                      value={formData.min_temp}
                      onChange={(e) => setFormData({ ...formData, min_temp: e.target.value })}
                      placeholder="e.g., 40"
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
                    />
                    <p className="text-xs text-gray-500 mt-1">Below this temp, provide shelter</p>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Needs Blanket Below (°F)</label>
                    <input
                      type="number"
                      step="1"
                      value={formData.needs_blanket_below}
                      onChange={(e) => setFormData({ ...formData, needs_blanket_below: e.target.value })}
                      placeholder="e.g., 35"
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
                    />
                    <p className="text-xs text-gray-500 mt-1">For horses and animals that need blankets</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t border-gray-700">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 px-4 py-2 bg-farm-green hover:bg-farm-green-light rounded-lg transition-colors disabled:opacity-50"
            >
              {saving ? 'Saving...' : (animal ? 'Update Animal' : 'Add Animal')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}


// Expense Form Modal
function ExpenseFormModal({ animalId, animalName, onClose, onSave }) {
  const [formData, setFormData] = useState({
    expense_type: 'purchase',
    description: '',
    amount: '',
    expense_date: new Date().toISOString().split('T')[0],
    vendor: '',
    notes: '',
  })
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      await onSave({
        ...formData,
        amount: parseFloat(formData.amount),
      })
    } catch (error) {
      console.error('Failed to save expense:', error)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-xl w-full max-w-md">
        <div className="p-4 border-b border-gray-700 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Add Expense for {animalName}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Type *</label>
            <select
              value={formData.expense_type}
              onChange={(e) => setFormData({ ...formData, expense_type: e.target.value })}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
            >
              <option value="purchase">Purchase Price</option>
              <option value="feed">Feed</option>
              <option value="medicine">Medicine</option>
              <option value="vet">Vet Visit</option>
              <option value="equipment">Equipment</option>
              <option value="farrier">Farrier</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Amount ($) *</label>
              <input
                type="number"
                step="0.01"
                required
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Date</label>
              <input
                type="date"
                value={formData.expense_date}
                onChange={(e) => setFormData({ ...formData, expense_date: e.target.value })}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Description</label>
            <input
              type="text"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="e.g., 50lb bag of feed"
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Vendor</label>
            <input
              type="text"
              value={formData.vendor}
              onChange={(e) => setFormData({ ...formData, vendor: e.target.value })}
              placeholder="e.g., Tractor Supply"
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-500 rounded-lg transition-colors disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Add Expense'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}


// Edit Date Modal Component
function EditDateModal({ label, currentDate, onClose, onSave }) {
  const [dateValue, setDateValue] = useState(() => {
    if (currentDate) {
      const d = new Date(currentDate)
      return d.toISOString().split('T')[0]
    }
    return new Date().toISOString().split('T')[0]
  })
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      // Convert to ISO datetime string
      const datetime = new Date(dateValue + 'T12:00:00').toISOString()
      await onSave(datetime)
    } finally {
      setSaving(false)
    }
  }

  const setToToday = () => {
    setDateValue(new Date().toISOString().split('T')[0])
  }

  const clearDate = async () => {
    setSaving(true)
    try {
      await onSave(null)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-gray-800 rounded-xl w-full max-w-sm" onClick={e => e.stopPropagation()}>
        <div className="p-4 border-b border-gray-700 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Edit {label}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-2">Date</label>
            <input
              type="date"
              value={dateValue}
              onChange={(e) => setDateValue(e.target.value)}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green"
            />
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={setToToday}
              className="px-3 py-1.5 bg-cyan-900/50 hover:bg-cyan-800/50 rounded text-sm text-cyan-300 transition-colors"
            >
              Today
            </button>
            <button
              type="button"
              onClick={clearDate}
              disabled={saving}
              className="px-3 py-1.5 bg-red-900/50 hover:bg-red-800/50 rounded text-sm text-red-300 transition-colors disabled:opacity-50"
            >
              Clear
            </button>
          </div>

          <div className="flex gap-3 pt-4 border-t border-gray-700">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 px-4 py-2 bg-farm-green hover:bg-farm-green-light rounded-lg transition-colors disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default Animals
