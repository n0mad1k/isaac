import React, { useState } from 'react'
import { X, ClipboardCheck, Heart, Activity, Brain, ChevronDown, ChevronUp } from 'lucide-react'
import { submitDailyCheckin } from '../../services/api'

const CONTEXT_FACTORS = [
  { value: 'alcohol', label: 'Alcohol (last 24h)' },
  { value: 'poor_sleep', label: 'Poor sleep' },
  { value: 'high_caffeine', label: 'High caffeine' },
  { value: 'travel', label: 'Travel/timezone change' },
  { value: 'high_stress', label: 'High stress' },
  { value: 'dehydration', label: 'Dehydration' },
  { value: 'illness_symptoms', label: 'Illness symptoms' },
  { value: 'heat_exposure', label: 'Heat exposure' },
  { value: 'altitude', label: 'Altitude' },
  { value: 'menstrual_cycle', label: 'Menstrual cycle' }
]

function DailyCheckinModal({ members, onClose, onSuccess }) {
  const [selectedMemberId, setSelectedMemberId] = useState('')
  const [inputDate, setInputDate] = useState(new Date().toISOString().split('T')[0])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  // Expanded sections
  const [vitalsExpanded, setVitalsExpanded] = useState(true)
  const [bodyExpanded, setBodyExpanded] = useState(false)
  const [subjectiveExpanded, setSubjectiveExpanded] = useState(true)
  const [contextExpanded, setContextExpanded] = useState(false)

  // Vitals
  const [restingHr, setRestingHr] = useState('')
  const [hrv, setHrv] = useState('')
  const [bpSystolic, setBpSystolic] = useState('')
  const [bpDiastolic, setBpDiastolic] = useState('')
  const [spo2, setSpo2] = useState('')
  const [temperature, setTemperature] = useState('')
  const [respRate, setRespRate] = useState('')

  // Body measurements
  const [weight, setWeight] = useState('')
  const [waist, setWaist] = useState('')
  const [neck, setNeck] = useState('')
  const [hip, setHip] = useState('')

  // Subjective
  const [energyLevel, setEnergyLevel] = useState(5)
  const [sleepQuality, setSleepQuality] = useState(3)
  const [sleepHours, setSleepHours] = useState('')
  const [soreness, setSoreness] = useState(0)
  const [painSeverity, setPainSeverity] = useState(0)
  const [painLocation, setPainLocation] = useState('')
  const [stressLevel, setStressLevel] = useState(5)

  // Context
  const [contextFactors, setContextFactors] = useState([])
  const [notes, setNotes] = useState('')

  const handleContextToggle = (value) => {
    setContextFactors(prev =>
      prev.includes(value)
        ? prev.filter(v => v !== value)
        : [...prev, value]
    )
  }

  const handleSubmit = async () => {
    if (!selectedMemberId) {
      setError('Please select a team member')
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      const data = {
        input_date: inputDate,
        // Vitals (only include if set)
        ...(restingHr && { resting_heart_rate: parseInt(restingHr) }),
        ...(hrv && { hrv: parseInt(hrv) }),
        ...(bpSystolic && bpDiastolic && {
          blood_pressure_systolic: parseInt(bpSystolic),
          blood_pressure_diastolic: parseInt(bpDiastolic)
        }),
        ...(spo2 && { blood_oxygen: parseFloat(spo2) }),
        ...(temperature && { temperature: parseFloat(temperature) }),
        ...(respRate && { respiratory_rate: parseInt(respRate) }),
        // Body measurements
        ...(weight && { weight: parseFloat(weight) }),
        ...(waist && { waist: parseFloat(waist) }),
        ...(neck && { neck: parseFloat(neck) }),
        ...(hip && { hip: parseFloat(hip) }),
        // Subjective (include if slider was touched)
        energy_level: energyLevel,
        sleep_quality: sleepQuality,
        ...(sleepHours && { sleep_hours: parseFloat(sleepHours) }),
        soreness: soreness,
        ...(painSeverity > 0 && {
          pain_severity: painSeverity,
          ...(painLocation && { pain_location: painLocation })
        }),
        stress_level: stressLevel,
        // Context
        ...(contextFactors.length > 0 && { context_factors: contextFactors }),
        ...(notes && { notes })
      }

      await submitDailyCheckin(selectedMemberId, data)
      onSuccess?.()
      onClose()
    } catch (err) {
      console.error('Failed to submit daily check-in:', err)
      setError(err.userMessage || 'Failed to submit check-in')
    } finally {
      setSubmitting(false)
    }
  }

  const SliderInput = ({ label, value, onChange, min, max, leftLabel, rightLabel, color = 'bg-blue-500' }) => (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span className="text-gray-400">{label}</span>
        <span className="text-white font-medium">{value}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value))}
        className={`w-full h-2 ${color} rounded-lg appearance-none cursor-pointer`}
      />
      <div className="flex justify-between text-xs text-gray-500">
        <span>{leftLabel}</span>
        <span>{rightLabel}</span>
      </div>
    </div>
  )

  const SectionHeader = ({ title, icon: Icon, expanded, onToggle }) => (
    <button
      type="button"
      onClick={onToggle}
      className="w-full flex items-center justify-between py-2 text-left"
    >
      <div className="flex items-center gap-2">
        <Icon className="w-5 h-5 text-gray-400" />
        <span className="font-medium text-white">{title}</span>
      </div>
      {expanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
    </button>
  )

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg w-full max-w-sm sm:max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-gray-800 px-6 py-4 border-b border-gray-700 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ClipboardCheck className="w-5 h-5 text-blue-400" />
            <h2 className="text-lg font-semibold text-white">Daily Check-in</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {error && (
            <div className="bg-red-900/30 border border-red-700 rounded-lg p-3 text-red-200 text-sm">
              {error}
            </div>
          )}

          {/* Member Selection */}
          <div>
            <label className="block text-sm text-gray-400 mb-1">Team Member *</label>
            <select
              value={selectedMemberId}
              onChange={(e) => setSelectedMemberId(e.target.value)}
              className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white"
            >
              <option value="">Select member...</option>
              {members.filter(m => m.is_active !== false).map(m => (
                <option key={m.id} value={m.id}>
                  {m.nickname || m.name}
                </option>
              ))}
            </select>
          </div>

          {/* Date */}
          <div>
            <label className="block text-sm text-gray-400 mb-1">Date</label>
            <input
              type="date"
              value={inputDate}
              onChange={(e) => setInputDate(e.target.value)}
              className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white"
            />
          </div>

          {/* Vitals Section */}
          <div className="border border-gray-700 rounded-lg overflow-hidden">
            <SectionHeader
              title="Vitals"
              icon={Heart}
              expanded={vitalsExpanded}
              onToggle={() => setVitalsExpanded(!vitalsExpanded)}
            />
            {vitalsExpanded && (
              <div className="p-4 pt-0 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Resting HR (bpm)</label>
                    <input
                      type="number"
                      value={restingHr}
                      onChange={(e) => setRestingHr(e.target.value)}
                      placeholder="65"
                      className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-white text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">HRV (ms)</label>
                    <input
                      type="number"
                      value={hrv}
                      onChange={(e) => setHrv(e.target.value)}
                      placeholder="45"
                      className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-white text-sm"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Blood Pressure (mmHg)</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={bpSystolic}
                      onChange={(e) => setBpSystolic(e.target.value)}
                      placeholder="120"
                      className="flex-1 bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-white text-sm"
                    />
                    <span className="text-gray-500">/</span>
                    <input
                      type="number"
                      value={bpDiastolic}
                      onChange={(e) => setBpDiastolic(e.target.value)}
                      placeholder="80"
                      className="flex-1 bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-white text-sm"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">SpO2 (%)</label>
                    <input
                      type="number"
                      value={spo2}
                      onChange={(e) => setSpo2(e.target.value)}
                      placeholder="98"
                      className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-white text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Temp (°F)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={temperature}
                      onChange={(e) => setTemperature(e.target.value)}
                      placeholder="98.6"
                      className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-white text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Resp Rate</label>
                    <input
                      type="number"
                      value={respRate}
                      onChange={(e) => setRespRate(e.target.value)}
                      placeholder="14"
                      className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-white text-sm"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Body Measurements Section */}
          <div className="border border-gray-700 rounded-lg overflow-hidden">
            <SectionHeader
              title="Body Measurements"
              icon={Activity}
              expanded={bodyExpanded}
              onToggle={() => setBodyExpanded(!bodyExpanded)}
            />
            {bodyExpanded && (
              <div className="p-4 pt-0 space-y-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Weight (lbs)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={weight}
                    onChange={(e) => setWeight(e.target.value)}
                    placeholder="170"
                    className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-white text-sm"
                  />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Waist (in)</label>
                    <input
                      type="number"
                      step="0.25"
                      value={waist}
                      onChange={(e) => setWaist(e.target.value)}
                      placeholder="32"
                      className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-white text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Neck (in)</label>
                    <input
                      type="number"
                      step="0.25"
                      value={neck}
                      onChange={(e) => setNeck(e.target.value)}
                      placeholder="15"
                      className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-white text-sm"
                    />
                  </div>
                  {/* Hip - only show for females (required for female body fat calculation) */}
                  {members.find(m => m.id == selectedMemberId)?.gender === 'female' && (
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Hip (in)</label>
                      <input
                        type="number"
                        step="0.25"
                        value={hip}
                        onChange={(e) => setHip(e.target.value)}
                        placeholder="38"
                        className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-white text-sm"
                      />
                    </div>
                  )}
                </div>
                <p className="text-xs text-gray-500">
                  Body fat is auto-calculated from waist/neck{members.find(m => m.id == selectedMemberId)?.gender === 'female' ? '/hip' : ''} measurements
                </p>
              </div>
            )}
          </div>

          {/* Subjective Section */}
          <div className="border border-gray-700 rounded-lg overflow-hidden">
            <SectionHeader
              title="How Do You Feel?"
              icon={Brain}
              expanded={subjectiveExpanded}
              onToggle={() => setSubjectiveExpanded(!subjectiveExpanded)}
            />
            {subjectiveExpanded && (
              <div className="p-4 pt-0 space-y-4">
                <SliderInput
                  label="Energy Level"
                  value={energyLevel}
                  onChange={setEnergyLevel}
                  min={0}
                  max={10}
                  leftLabel="Exhausted"
                  rightLabel="Fresh"
                  color="bg-green-500"
                />

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Sleep Hours</label>
                    <input
                      type="number"
                      step="0.5"
                      value={sleepHours}
                      onChange={(e) => setSleepHours(e.target.value)}
                      placeholder="7.5"
                      className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-white text-sm"
                    />
                  </div>
                  <SliderInput
                    label="Sleep Quality"
                    value={sleepQuality}
                    onChange={setSleepQuality}
                    min={1}
                    max={5}
                    leftLabel="Poor"
                    rightLabel="Excellent"
                    color="bg-blue-500"
                  />
                </div>

                <SliderInput
                  label="Soreness"
                  value={soreness}
                  onChange={setSoreness}
                  min={0}
                  max={10}
                  leftLabel="None"
                  rightLabel="Severe"
                  color="bg-orange-500"
                />

                <div className="space-y-2">
                  <SliderInput
                    label="Pain Severity"
                    value={painSeverity}
                    onChange={setPainSeverity}
                    min={0}
                    max={10}
                    leftLabel="None"
                    rightLabel="Severe"
                    color="bg-red-500"
                  />
                  {painSeverity > 0 && (
                    <input
                      type="text"
                      value={painLocation}
                      onChange={(e) => setPainLocation(e.target.value)}
                      placeholder="Pain location (e.g., left knee, lower back)"
                      className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-white text-sm"
                    />
                  )}
                </div>

                <SliderInput
                  label="Stress Level"
                  value={stressLevel}
                  onChange={setStressLevel}
                  min={0}
                  max={10}
                  leftLabel="Low"
                  rightLabel="High"
                  color="bg-purple-500"
                />
              </div>
            )}
          </div>

          {/* Context Factors Section */}
          <div className="border border-gray-700 rounded-lg overflow-hidden">
            <SectionHeader
              title="Context Factors"
              icon={ClipboardCheck}
              expanded={contextExpanded}
              onToggle={() => setContextExpanded(!contextExpanded)}
            />
            {contextExpanded && (
              <div className="p-4 pt-0 space-y-3">
                <div className="flex flex-wrap gap-2">
                  {CONTEXT_FACTORS.map(factor => (
                    <button
                      key={factor.value}
                      type="button"
                      onClick={() => handleContextToggle(factor.value)}
                      className={`px-3 py-1.5 text-xs rounded-full transition-colors ${
                        contextFactors.includes(factor.value)
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                      }`}
                    >
                      {factor.label}
                    </button>
                  ))}
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Notes (optional)</label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Any additional notes..."
                    rows={2}
                    className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-white text-sm"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-gray-800 px-6 py-4 border-t border-gray-700 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-400 hover:text-white"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || !selectedMemberId}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-500 disabled:opacity-50"
          >
            {submitting ? 'Saving...' : 'Save Check-in'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default DailyCheckinModal
