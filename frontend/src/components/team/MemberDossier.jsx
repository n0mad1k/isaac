import React, { useState, useEffect } from 'react'
import {
  User, Heart, Brain, MessageSquare, Activity,
  Edit, Trash2, Phone, Mail, Calendar, AlertCircle, AlertTriangle,
  Shield, Eye, Stethoscope, ChevronDown, ChevronUp, Plus, Target, Check, X,
  ListTodo, Package, RefreshCw, TrendingUp, TrendingDown, Minus, Info, Dumbbell,
  Clock, Flame, Mountain, Timer
} from 'lucide-react'
import {
  getWeightHistory, logWeight, getMedicalHistory, updateMedicalStatus,
  getMentoringSessions, createMentoringSession,
  getMemberObservations, createObservation, uploadMemberPhoto, deleteMemberPhoto,
  getMemberAppointments, createMemberAppointment, updateMemberAppointment,
  deleteMemberAppointment, completeMemberAppointment,
  getVitalsHistory, getVitalsAverages, logVital, deleteVital, updateVital, getVitalTypes,
  getReadinessAnalysis, calculateBodyFat,
  getWorkoutTypes, getWorkouts, getWorkoutStats, logWorkout, updateWorkout, deleteWorkout,
  getFitnessProfile
} from '../../services/api'
import MemberMentoringTab from './MemberMentoringTab'
import MemberObservationsTab from './MemberObservationsTab'
import MemberGearTab from './MemberGearTab'
import MemberTrainingTab from './MemberTrainingTab'
import MemberTasksTab from './MemberTasksTab'
import MemberSupplyRequestsTab from './MemberSupplyRequestsTab'

function MemberDossier({ member, settings, onEdit, onDelete, onUpdate }) {
  const [activeTab, setActiveTab] = useState('profile')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  // Data states
  const [weightHistory, setWeightHistory] = useState([])
  const [vitalsHistory, setVitalsHistory] = useState([])
  const [vitalsAverages, setVitalsAverages] = useState({})
  const [vitalTypes, setVitalTypes] = useState([])
  const [medicalHistory, setMedicalHistory] = useState([])
  const [sessions, setSessions] = useState([])
  const [observations, setObservations] = useState([])
  const [appointments, setAppointments] = useState([])
  const [workouts, setWorkouts] = useState([])
  const [workoutStats, setWorkoutStats] = useState(null)
  const [workoutTypes, setWorkoutTypes] = useState([])

  // Readiness analysis (lifted from HealthDataTab so header badges can access it)
  const [readinessAnalysis, setReadinessAnalysis] = useState(null)
  const [analysisLoading, setAnalysisLoading] = useState(false)
  const [analysisError, setAnalysisError] = useState(null)

  const fetchReadinessAnalysis = async (force = false) => {
    setAnalysisLoading(true)
    setAnalysisError(null)
    try {
      const res = await getReadinessAnalysis(member.id, 30, force)
      setReadinessAnalysis(res.data)
    } catch (err) {
      setAnalysisError(err.userMessage || 'Failed to load readiness analysis')
    } finally {
      setAnalysisLoading(false)
    }
  }

  // Fetch readiness analysis on mount (returns cache if data unchanged)
  useEffect(() => {
    fetchReadinessAnalysis()
  }, [member.id])

  // Load tab-specific data
  useEffect(() => {
    const loadTabData = async () => {
      // These tabs load their own data
      if (['gear', 'training', 'tasks', 'supplies', 'fitness'].includes(activeTab)) {
        setLoading(false)
        return
      }
      setLoading(true)
      try {
        switch (activeTab) {
          case 'health':
            const [weightRes, vitalsRes, avgRes, typesRes] = await Promise.all([
              getWeightHistory(member.id),
              getVitalsHistory(member.id),
              getVitalsAverages(member.id),
              getVitalTypes()
            ])
            setWeightHistory(weightRes.data)
            setVitalsHistory(vitalsRes.data)
            setVitalsAverages(avgRes.data)
            setVitalTypes(typesRes.data)
            break
          case 'medical':
            const [medRes, apptRes] = await Promise.all([
              getMedicalHistory(member.id),
              getMemberAppointments(member.id)
            ])
            setMedicalHistory(medRes.data)
            setAppointments(apptRes.data)
            break
          case 'mentoring':
            const sessRes = await getMentoringSessions(member.id)
            setSessions(sessRes.data)
            break
          case 'observations':
            const obsRes = await getMemberObservations(member.id)
            setObservations(obsRes.data)
            break
        }
      } catch (err) {
        console.error('Failed to load tab data:', err)
        setError(err.userMessage || 'Failed to load data')
      } finally {
        setLoading(false)
      }
    }
    loadTabData()
  }, [activeTab, member.id])

  // Readiness indicator
  const ReadinessIndicator = ({ status, label }) => {
    const colors = {
      GREEN: 'bg-green-500 text-green-100',
      AMBER: 'bg-yellow-500 text-yellow-100',
      RED: 'bg-red-500 text-red-100'
    }
    return (
      <span className={`px-2 py-1 rounded text-xs font-medium ${colors[status] || 'bg-gray-500 text-gray-100'}`}>
        {label || status}
      </span>
    )
  }

  // Format date (mm/dd/yyyy)
  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A'
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: '2-digit',
      day: '2-digit',
      year: 'numeric'
    })
  }

  // Calculate age
  const calculateAge = (birthDate) => {
    if (!birthDate) return null
    const birth = new Date(birthDate)
    const today = new Date()
    let age = today.getFullYear() - birth.getFullYear()
    const monthDiff = today.getMonth() - birth.getMonth()
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--
    }
    return age
  }

  // Convert height
  const formatHeight = (inches) => {
    if (!inches) return 'N/A'
    if (settings?.team_units === 'metric') {
      return `${Math.round(inches * 2.54)} cm`
    }
    const feet = Math.floor(inches / 12)
    const remainingInches = Math.round(inches % 12)
    return `${feet}'${remainingInches}"`
  }

  // Convert weight
  const formatWeight = (lbs) => {
    if (!lbs) return 'N/A'
    if (settings?.team_units === 'metric') {
      return `${Math.round(lbs * 0.453592)} kg`
    }
    return `${Math.round(lbs)} lbs`
  }

  // Handle photo upload
  const handlePhotoUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return

    const formData = new FormData()
    formData.append('file', file)

    try {
      await uploadMemberPhoto(member.id, formData)
      onUpdate()
    } catch (err) {
      console.error('Failed to upload photo:', err)
    }
  }

  // Tab definitions
  const tabs = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'tasks', label: 'Tasks', icon: ListTodo },
    { id: 'gear', label: 'Gear', icon: Shield },
    { id: 'supplies', label: 'Supplies', icon: Package },
    { id: 'training', label: 'Training', icon: Target },
    { id: 'medical', label: 'Medical', icon: Heart },
    { id: 'mentoring', label: 'Mentoring', icon: Brain },
    { id: 'observations', label: 'Observations', icon: MessageSquare },
    { id: 'health', label: 'Health Data', icon: Activity },
    { id: 'fitness', label: 'Fitness', icon: Dumbbell },
  ]

  return (
    <div className="space-y-4">
      {/* Member Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          {/* Photo */}
          <div className="relative group">
            {member.photo_path ? (
              <img
                src={`/api/team/photos/${member.photo_path.split('/').pop()}`}
                alt={member.name}
                className="w-20 h-20 rounded-full object-cover"
              />
            ) : (
              <div className="w-20 h-20 rounded-full bg-gray-600 flex items-center justify-center text-2xl text-gray-400">
                {member.name.charAt(0).toUpperCase()}
              </div>
            )}
            <label className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full opacity-0 group-hover:opacity-100 cursor-pointer transition-opacity">
              <span className="text-xs text-white">Change</span>
              <input
                type="file"
                accept="image/*"
                onChange={handlePhotoUpload}
                className="hidden"
              />
            </label>
          </div>

          {/* Name and info */}
          <div className="flex-1">
            <div className="flex items-center gap-3 flex-wrap">
              <h2 className="text-xl font-bold">{member.name}</h2>
              {/* Readiness & Fitness Badges */}
              {(() => {
                const overallStatus = readinessAnalysis?.overall_status || member.overall_readiness
                const overallScore = readinessAnalysis?.score ?? member.readiness_score
                const perfScore = readinessAnalysis?.performance_readiness ?? member.performance_readiness_score
                const medStatus = readinessAnalysis?.medical_safety?.status || member.medical_safety_status
                const statusBg = (s) => s === 'GREEN' ? 'bg-green-600' : s === 'AMBER' ? 'bg-yellow-600' : s === 'RED' ? 'bg-red-600' : 'bg-gray-600'
                const scoreBg = (v) => v != null ? (v >= 80 ? 'bg-green-600' : v >= 60 ? 'bg-yellow-600' : 'bg-red-600') : 'bg-gray-600'
                const fitTier = member.fitness_tier
                const fitBg = fitTier === 'SF' ? 'bg-yellow-500 text-yellow-900' : fitTier === 'MARINE' ? 'bg-green-500 text-green-900' : fitTier ? 'bg-blue-500 text-blue-900' : null
                return (
                  <div className="flex items-center gap-2">
                    <div className="flex flex-col items-center" title="Overall Readiness">
                      <span className={`px-2 py-0.5 rounded text-sm font-bold text-white ${statusBg(overallStatus)}`}>
                        {overallScore != null ? Math.round(overallScore) : '—'}
                      </span>
                      <span className="text-[9px] text-gray-500 mt-0.5">OVERALL</span>
                    </div>
                    <div className="flex flex-col items-center" title="Performance Readiness">
                      <span className={`px-2 py-0.5 rounded text-sm font-bold text-white ${scoreBg(perfScore)}`}>
                        {perfScore != null ? Math.round(perfScore) : '—'}
                      </span>
                      <span className="text-[9px] text-gray-500 mt-0.5">PERF</span>
                    </div>
                    <div className="flex flex-col items-center" title="Medical Safety">
                      <span className={`px-2 py-0.5 rounded text-sm font-bold text-white ${statusBg(medStatus)}`}>
                        {medStatus === 'GREEN' ? '✓' : medStatus === 'AMBER' ? '!' : medStatus === 'RED' ? '✗' : '—'}
                      </span>
                      <span className="text-[9px] text-gray-500 mt-0.5">MED</span>
                    </div>
                    {fitBg && (
                      <div className="flex flex-col items-center" title={`Fitness: ${fitTier} ${member.fitness_sub_tier || ''}`}>
                        <span className={`px-2 py-0.5 rounded text-sm font-bold ${fitBg}`}>
                          {fitTier}
                        </span>
                        <span className="text-[9px] text-gray-500 mt-0.5">FIT</span>
                      </div>
                    )}
                  </div>
                )
              })()}
              {/* Blood Type - solid red, no border */}
              {member.blood_type && (
                <span className="px-3 py-1 bg-red-600 rounded-lg text-white font-bold text-sm flex items-center gap-1">
                  <Heart className="w-4 h-4" />
                  {member.blood_type}
                </span>
              )}
              {/* Anaphylaxis Allergies - grouped together */}
              {member.allergies && member.allergies.some(a => typeof a === 'object' && a.anaphylaxis) && (
                <span className="px-2 py-1 bg-red-900/50 border border-red-600 rounded text-red-300 font-bold text-xs flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  ANAPHYLAXIS: {member.allergies.filter(a => typeof a === 'object' && a.anaphylaxis).map(a => a.name).join(', ')}
                </span>
              )}
            </div>
            {member.nickname && (
              <p className="text-gray-400">"{member.nickname}"</p>
            )}
            <p className="text-sm text-gray-400">
              {member.role_title || member.role}
              {member.callsign && ` · Callsign: ${member.callsign}`}
            </p>
            <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
              {member.email && (
                <span className="flex items-center gap-1">
                  <Mail className="w-3 h-3" /> {member.email}
                </span>
              )}
              {member.phone && (
                <span className="flex items-center gap-1">
                  <Phone className="w-3 h-3" /> {member.phone}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <button
            onClick={onEdit}
            className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-gray-700"
            title="Edit Member"
          >
            <Edit className="w-5 h-5" />
          </button>
          <button
            onClick={onDelete}
            className="p-2 text-gray-400 hover:text-red-400 rounded-lg hover:bg-gray-700"
            title="Delete Member"
          >
            <Trash2 className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Sub-tabs */}
      <div className="flex gap-1 border-b border-gray-700 pb-1 overflow-x-auto">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-3 py-2 rounded-t-lg text-sm font-medium transition-colors whitespace-nowrap flex items-center gap-2 ${
              activeTab === tab.id
                ? 'bg-gray-700 text-white'
                : 'text-gray-400 hover:text-white hover:bg-gray-700/50'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="min-h-[400px]">
        {loading ? (
          <div className="flex items-center justify-center h-32 text-gray-400">
            Loading...
          </div>
        ) : (
          <>
            {/* Profile Tab */}
            {activeTab === 'profile' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* 1. Basic Info */}
                <div className="bg-gray-700 rounded-lg p-4">
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <User className="w-4 h-4 text-farm-green" />
                    Basic Information
                  </h3>
                  <table className="w-full text-sm">
                    <tbody>
                      <tr>
                        <td className="text-gray-400 py-1 pr-4">Role</td>
                        <td className="py-1">{member.role_title || member.role}</td>
                      </tr>
                      {member.gender && (
                        <tr>
                          <td className="text-gray-400 py-1 pr-4">Gender</td>
                          <td className="py-1 capitalize">{member.gender}</td>
                        </tr>
                      )}
                      {member.birth_date && (
                        <tr>
                          <td className="text-gray-400 py-1 pr-4">Age</td>
                          <td className="py-1">{calculateAge(member.birth_date)} years old</td>
                        </tr>
                      )}
                      {member.join_date && (
                        <tr>
                          <td className="text-gray-400 py-1 pr-4">Joined</td>
                          <td className="py-1">{formatDate(member.join_date)}</td>
                        </tr>
                      )}
                      <tr>
                        <td className="text-gray-400 py-1 pr-4">Height</td>
                        <td className="py-1">{formatHeight(member.height_inches)}</td>
                      </tr>
                      <tr>
                        <td className="text-gray-400 py-1 pr-4">Weight</td>
                        <td className="py-1">{formatWeight(member.current_weight)}</td>
                      </tr>
                      {member.target_weight && (
                        <tr>
                          <td className="text-gray-400 py-1 pr-4">Target</td>
                          <td className="py-1">{formatWeight(member.target_weight)}</td>
                        </tr>
                      )}
                      {member.blood_type && (
                        <tr>
                          <td className="text-gray-400 py-1 pr-4">Blood Type</td>
                          <td className="py-1 font-bold text-red-400">{member.blood_type}</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* 2. Skills */}
                <div className="bg-gray-700 rounded-lg p-4">
                  <h3 className="font-semibold mb-3">Skills</h3>
                  {member.skills && member.skills.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {member.skills.map((skill, idx) => (
                        <span key={idx} className="px-2 py-1 rounded text-sm" style={{ backgroundColor: '#4a5d4a', color: '#ffffff' }}>
                          {skill}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-400 text-sm">No skills listed</p>
                  )}
                </div>

                {/* 3. Allergies - Critical Health Info */}
                <div className="bg-gray-700 rounded-lg p-4">
                  <h3 className="font-semibold mb-3 text-red-400 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" />
                    Allergies
                  </h3>
                  {member.allergies && member.allergies.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {member.allergies.map((allergy, idx) => {
                        const isObject = typeof allergy === 'object'
                        const name = isObject ? allergy.name : allergy
                        const isAnaphylaxis = isObject && allergy.anaphylaxis
                        return (
                          <span
                            key={idx}
                            className={`px-2 py-1 rounded text-sm flex items-center gap-1 font-bold ${
                              isAnaphylaxis
                                ? 'bg-red-900/50 border border-red-600 text-red-300'
                                : ''
                            }`}
                            style={!isAnaphylaxis ? { backgroundColor: '#b8763c', color: '#ffffff' } : {}}
                          >
                            {isAnaphylaxis && <AlertTriangle className="w-3 h-3" />}
                            {name}
                            {isAnaphylaxis && <span className="text-xs">(ANAPHYLAXIS)</span>}
                          </span>
                        )
                      })}
                    </div>
                  ) : (
                    <p className="text-gray-400 text-sm">No known allergies</p>
                  )}
                </div>

                {/* 4. Medical Conditions */}
                <div className="bg-gray-700 rounded-lg p-4">
                  <h3 className="font-semibold mb-3">Medical Conditions</h3>
                  {member.medical_conditions && member.medical_conditions.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {member.medical_conditions.map((condition, idx) => (
                        <span key={idx} className="px-2 py-1 bg-orange-900/50 text-orange-300 rounded text-sm">
                          {condition}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-400 text-sm">None reported</p>
                  )}
                </div>

                {/* 5. Emergency Contact */}
                {(member.emergency_contact_name || member.emergency_contact_phone) && (
                  <div className="bg-red-900/30 border border-red-700 rounded-lg p-4 md:col-span-2">
                    <h3 className="font-semibold mb-2 text-red-300 flex items-center gap-2">
                      <AlertCircle className="w-4 h-4" />
                      Emergency Contact
                    </h3>
                    <p className="text-white">{member.emergency_contact_name}</p>
                    {member.emergency_contact_phone && (
                      <p className="text-gray-400">{member.emergency_contact_phone}</p>
                    )}
                  </div>
                )}

                {/* 6. Responsibilities */}
                {member.responsibilities && member.responsibilities.length > 0 && (
                  <div className="bg-gray-700 rounded-lg p-4">
                    <h3 className="font-semibold mb-3">Responsibilities</h3>
                    <ul className="space-y-1 text-sm">
                      {member.responsibilities.map((resp, idx) => (
                        <li key={idx} className="text-gray-300">• {resp}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* 7. Trainings */}
                {member.trainings && member.trainings.length > 0 && (
                  <div className="bg-gray-700 rounded-lg p-4">
                    <h3 className="font-semibold mb-3">Completed Training</h3>
                    <div className="flex flex-wrap gap-2">
                      {member.trainings.map((training, idx) => (
                        <span key={idx} className="px-2 py-1 bg-green-900/50 text-green-300 rounded text-sm">
                          {training}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* 8. Notes */}
                {member.notes && (
                  <div className="bg-gray-700 rounded-lg p-4 md:col-span-2">
                    <h3 className="font-semibold mb-2">Notes</h3>
                    <p className="text-gray-300 whitespace-pre-wrap">{member.notes}</p>
                  </div>
                )}

                {/* 9. Gear Sizing - LAST */}
                <div className="bg-gray-700 rounded-lg p-4 md:col-span-2">
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <Shield className="w-4 h-4 text-farm-green" />
                    Gear Sizing
                  </h3>
                  <div className="grid grid-cols-5 gap-4 text-sm">
                    <div>
                      <span className="text-gray-400">Shoe</span>
                      <p className="font-medium">{member.shoe_size || 'N/A'}</p>
                    </div>
                    <div>
                      <span className="text-gray-400">Shirt</span>
                      <p className="font-medium">{member.shirt_size || 'N/A'}</p>
                    </div>
                    <div>
                      <span className="text-gray-400">Pants</span>
                      <p className="font-medium">{member.pants_size || 'N/A'}</p>
                    </div>
                    <div>
                      <span className="text-gray-400">Hat</span>
                      <p className="font-medium">{member.hat_size || 'N/A'}</p>
                    </div>
                    <div>
                      <span className="text-gray-400">Gloves</span>
                      <p className="font-medium">{member.glove_size || 'N/A'}</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Tasks Tab */}
            {activeTab === 'tasks' && (
              <MemberTasksTab member={member} onUpdate={onUpdate} />
            )}

            {/* Gear Tab */}
            {activeTab === 'gear' && (
              <MemberGearTab member={member} onUpdate={onUpdate} />
            )}

            {/* Supplies Tab */}
            {activeTab === 'supplies' && (
              <MemberSupplyRequestsTab member={member} onUpdate={onUpdate} />
            )}

            {/* Training Tab */}
            {activeTab === 'training' && (
              <MemberTrainingTab member={member} onUpdate={onUpdate} />
            )}

            {/* Medical Tab */}
            {activeTab === 'medical' && (
              <div className="space-y-6">
                {/* Readiness Status */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-gray-700 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-gray-400 text-sm">Medical Readiness</span>
                      <ReadinessIndicator status={member.medical_readiness} />
                    </div>
                    {member.medical_readiness_notes && (
                      <p className="text-sm text-gray-300">{member.medical_readiness_notes}</p>
                    )}
                  </div>
                  <div className="bg-gray-700 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-gray-400 text-sm">Dental Status</span>
                      <ReadinessIndicator status={member.dental_status} />
                    </div>
                    <div className="text-sm text-gray-400">
                      {member.last_dental_date && (
                        <p>Last: {formatDate(member.last_dental_date)}</p>
                      )}
                      {member.next_dental_due && (
                        <p>Next: {formatDate(member.next_dental_due)}</p>
                      )}
                    </div>
                  </div>
                  <div className="bg-gray-700 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-gray-400 text-sm">Vision Status</span>
                      <span className="text-sm">{member.vision_status || 'N/A'}</span>
                    </div>
                    <div className="text-sm text-gray-400">
                      {member.vision_prescription && (
                        <p>Rx: {member.vision_prescription}</p>
                      )}
                      {member.next_vision_due && (
                        <p>Next: {formatDate(member.next_vision_due)}</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Physical Exam */}
                <div className="bg-gray-700 rounded-lg p-4">
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <Stethoscope className="w-4 h-4 text-farm-green" />
                    Physical Exam
                  </h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-400">Last Physical:</span>
                      <span className="ml-2">{formatDate(member.last_physical_date)}</span>
                    </div>
                    <div>
                      <span className="text-gray-400">Next Due:</span>
                      <span className="ml-2">{formatDate(member.next_physical_due)}</span>
                    </div>
                  </div>
                  {member.physical_limitations && (
                    <div className="mt-3 p-2 bg-yellow-900/30 border border-yellow-700 rounded">
                      <p className="text-sm text-yellow-300">
                        <AlertCircle className="w-4 h-4 inline mr-1" />
                        Limitations: {member.physical_limitations}
                      </p>
                    </div>
                  )}
                </div>

                {/* Medical Appointments */}
                <MedicalAppointmentsSection
                  member={member}
                  appointments={appointments}
                  onUpdate={async () => {
                    const apptRes = await getMemberAppointments(member.id)
                    setAppointments(apptRes.data)
                  }}
                />

                {/* Current Medications */}
                {member.current_medications && member.current_medications.length > 0 && (
                  <div className="bg-gray-700 rounded-lg p-4">
                    <h3 className="font-semibold mb-3">Current Medications</h3>
                    <div className="space-y-2">
                      {member.current_medications.map((med, idx) => (
                        <div key={idx} className="flex items-center gap-4 text-sm">
                          <span className="font-medium">{med.name}</span>
                          {med.dosage && <span className="text-gray-400">{med.dosage}</span>}
                          {med.frequency && <span className="text-gray-400">{med.frequency}</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Medical History Log */}
                {medicalHistory.length > 0 && (
                  <div className="bg-gray-700 rounded-lg p-4">
                    <h3 className="font-semibold mb-3">Medical History Log</h3>
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {medicalHistory.map(log => (
                        <div key={log.id} className="text-sm border-l-2 border-gray-600 pl-3">
                          <div className="flex items-center gap-2">
                            <span className="text-gray-400">{formatDate(log.recorded_at)}</span>
                            <span className="text-gray-500">·</span>
                            <span className="capitalize">{log.log_type.replace('_', ' ')}</span>
                          </div>
                          {log.notes && <p className="text-gray-300">{log.notes}</p>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Mentoring Tab */}
            {activeTab === 'mentoring' && (
              <MemberMentoringTab
                member={member}
                sessions={sessions}
                settings={settings}
                onUpdate={async () => {
                  const sessRes = await getMentoringSessions(member.id)
                  setSessions(sessRes.data)
                }}
              />
            )}

            {/* Observations Tab */}
            {activeTab === 'observations' && (
              <MemberObservationsTab
                member={member}
                observations={observations}
                onUpdate={async () => {
                  const obsRes = await getMemberObservations(member.id)
                  setObservations(obsRes.data)
                }}
              />
            )}

            {/* Health Data Tab */}
            {activeTab === 'health' && (
              <HealthDataTab
                member={member}
                settings={settings}
                weightHistory={weightHistory}
                vitalsHistory={vitalsHistory}
                vitalsAverages={vitalsAverages}
                vitalTypes={vitalTypes}
                formatWeight={formatWeight}
                formatHeight={formatHeight}
                formatDate={formatDate}
                readinessAnalysis={readinessAnalysis}
                analysisLoading={analysisLoading}
                analysisError={analysisError}
                onRefreshAnalysis={fetchReadinessAnalysis}
                onUpdate={async () => {
                  const [wRes, vRes, aRes] = await Promise.all([
                    getWeightHistory(member.id),
                    getVitalsHistory(member.id),
                    getVitalsAverages(member.id)
                  ])
                  setWeightHistory(wRes.data)
                  setVitalsHistory(vRes.data)
                  setVitalsAverages(aRes.data)
                }}
              />
            )}

            {/* Fitness Tab */}
            {activeTab === 'fitness' && (
              <FitnessTab
                member={member}
                settings={settings}
                formatDate={formatDate}
              />
            )}

          </>
        )}
      </div>
    </div>
  )
}

// Medical Appointments Section Component
const APPOINTMENT_TYPES = [
  { value: 'PHYSICAL', label: 'Physical Exam' },
  { value: 'DENTAL', label: 'Dental' },
  { value: 'VISION', label: 'Vision/Eye' },
  { value: 'SPECIALIST', label: 'Specialist' },
  { value: 'IMMUNIZATION', label: 'Immunization' },
  { value: 'LAB_WORK', label: 'Lab Work' },
  { value: 'OBGYN', label: 'OB/GYN' },
  { value: 'MAMMOGRAM', label: 'Mammogram' },
  { value: 'PAP_SMEAR', label: 'Pap Smear' },
  { value: 'PEDIATRIC', label: 'Pediatric' },
  { value: 'WELL_CHILD', label: 'Well Child Visit' },
  { value: 'CUSTOM', label: 'Custom' }
]

function MedicalAppointmentsSection({ member, appointments, onUpdate }) {
  const [showAdd, setShowAdd] = useState(false)
  const [editingAppt, setEditingAppt] = useState(null)
  const [error, setError] = useState(null)

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A'
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: '2-digit',
      day: '2-digit',
      year: 'numeric'
    })
  }

  const getDueDateClass = (dateStr) => {
    if (!dateStr) return ''
    const due = new Date(dateStr)
    const today = new Date()
    const diffDays = Math.ceil((due - today) / (1000 * 60 * 60 * 24))
    if (diffDays < 0) return 'text-red-400'
    if (diffDays <= 30) return 'text-yellow-400'
    return 'text-green-400'
  }

  const handleComplete = async (appt) => {
    try {
      await completeMemberAppointment(member.id, appt.id, {
        appointment_date: new Date().toISOString()
      })
      onUpdate()
    } catch (err) {
      setError(err.userMessage || 'Failed to mark complete')
    }
  }

  const handleDelete = async (apptId) => {
    if (!confirm('Delete this appointment tracking?')) return
    try {
      await deleteMemberAppointment(member.id, apptId)
      onUpdate()
    } catch (err) {
      setError(err.userMessage || 'Failed to delete')
    }
  }

  return (
    <div className="bg-gray-700 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold flex items-center gap-2">
          <Calendar className="w-4 h-4 text-farm-green" />
          Tracked Appointments
        </h3>
        <button
          onClick={() => setShowAdd(true)}
          className="text-sm text-farm-green hover:text-green-400 flex items-center gap-1"
        >
          <Plus className="w-4 h-4" /> Add
        </button>
      </div>

      {error && (
        <div className="mb-3 p-2 bg-red-900/50 border border-red-700 rounded text-red-200 text-sm">
          {error}
        </div>
      )}

      {appointments.length === 0 ? (
        <p className="text-sm text-gray-400">No appointments tracked. Add appointment types to track.</p>
      ) : (
        <div className="space-y-2">
          {appointments.map(appt => (
            <div key={appt.id} className="bg-gray-800 rounded p-3 flex items-center justify-between">
              <div>
                <div className="font-medium text-sm">{appt.display_type}</div>
                <div className="text-xs text-gray-400">
                  {appt.provider_name && <span>{appt.provider_name} · </span>}
                  Every {appt.frequency_months} months
                </div>
                <div className="text-xs flex gap-4">
                  <span className="text-gray-400">
                    Last: {formatDate(appt.last_appointment)}
                  </span>
                  <span className={getDueDateClass(appt.next_due)}>
                    Due: {formatDate(appt.next_due)}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleComplete(appt)}
                  className="p-1 text-green-400 hover:text-green-300"
                  title="Mark Complete"
                >
                  <Check className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setEditingAppt(appt)}
                  className="p-1 text-gray-400 hover:text-white"
                >
                  <Edit className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDelete(appt.id)}
                  className="p-1 text-gray-400 hover:text-red-400"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Modal */}
      {(showAdd || editingAppt) && (
        <AppointmentModal
          appointment={editingAppt}
          memberId={member.id}
          onClose={() => { setShowAdd(false); setEditingAppt(null) }}
          onSave={() => {
            setShowAdd(false)
            setEditingAppt(null)
            onUpdate()
          }}
        />
      )}
    </div>
  )
}

// Appointment Modal
function AppointmentModal({ appointment, memberId, onClose, onSave }) {
  const [formData, setFormData] = useState({
    appointment_type: appointment?.appointment_type || 'PHYSICAL',
    custom_type_name: appointment?.custom_type_name || '',
    provider_name: appointment?.provider_name || '',
    provider_phone: appointment?.provider_phone || '',
    provider_address: appointment?.provider_address || '',
    last_appointment: appointment?.last_appointment ? appointment.last_appointment.split('T')[0] : '',
    next_due: appointment?.next_due ? appointment.next_due.split('T')[0] : '',
    frequency_months: appointment?.frequency_months || 12,
    notes: appointment?.notes || '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const data = {
        ...formData,
        last_appointment: formData.last_appointment ? new Date(formData.last_appointment).toISOString() : null,
        next_due: formData.next_due ? new Date(formData.next_due).toISOString() : null,
        frequency_months: parseInt(formData.frequency_months),
      }
      if (appointment) {
        await updateMemberAppointment(memberId, appointment.id, data)
      } else {
        await createMemberAppointment(memberId, data)
      }
      onSave()
    } catch (err) {
      setError(err.userMessage || 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-lg w-full max-w-sm sm:max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <h3 className="font-semibold">{appointment ? 'Edit Appointment' : 'Add Appointment Type'}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {error && (
            <div className="p-3 bg-red-900/50 border border-red-700 rounded text-red-200 text-sm">
              {error}
            </div>
          )}
          <div>
            <label className="block text-sm text-gray-400 mb-1">Appointment Type *</label>
            <select
              value={formData.appointment_type}
              onChange={(e) => setFormData({ ...formData, appointment_type: e.target.value })}
              className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2"
              required
            >
              {APPOINTMENT_TYPES.map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
          {formData.appointment_type === 'CUSTOM' && (
            <div>
              <label className="block text-sm text-gray-400 mb-1">Custom Type Name *</label>
              <input
                type="text"
                value={formData.custom_type_name}
                onChange={(e) => setFormData({ ...formData, custom_type_name: e.target.value })}
                className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2"
                required
              />
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Last Appointment</label>
              <input
                type="date"
                value={formData.last_appointment}
                onChange={(e) => setFormData({ ...formData, last_appointment: e.target.value })}
                className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Next Due</label>
              <input
                type="date"
                value={formData.next_due}
                onChange={(e) => setFormData({ ...formData, next_due: e.target.value })}
                className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Frequency (months)</label>
            <select
              value={formData.frequency_months}
              onChange={(e) => setFormData({ ...formData, frequency_months: e.target.value })}
              className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2"
            >
              <option value={3}>Every 3 months</option>
              <option value={6}>Every 6 months</option>
              <option value={12}>Annually</option>
              <option value={24}>Every 2 years</option>
              <option value={36}>Every 3 years</option>
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Provider Name</label>
            <input
              type="text"
              value={formData.provider_name}
              onChange={(e) => setFormData({ ...formData, provider_name: e.target.value })}
              className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Phone</label>
              <input
                type="tel"
                value={formData.provider_phone}
                onChange={(e) => setFormData({ ...formData, provider_phone: e.target.value })}
                className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Address</label>
            <textarea
              value={formData.provider_address}
              onChange={(e) => setFormData({ ...formData, provider_address: e.target.value })}
              rows={2}
              className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Notes</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={2}
              className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2"
            />
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <button type="button" onClick={onClose} className="px-4 py-2 text-gray-400 hover:text-white">
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-farm-green text-white rounded hover:bg-green-600 disabled:opacity-50"
            >
              {saving ? 'Saving...' : appointment ? 'Save Changes' : 'Add Appointment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}


// ============================================
// Health Data Tab Component
// ============================================

function HealthDataTab({ member, settings, weightHistory, vitalsHistory, vitalsAverages, vitalTypes, formatWeight, formatHeight, formatDate, readinessAnalysis, analysisLoading, analysisError, onRefreshAnalysis, onUpdate }) {
  const [showAddVital, setShowAddVital] = useState(false)
  const [showAddWeight, setShowAddWeight] = useState(false)
  const [selectedType, setSelectedType] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  // Readiness Analysis UI state (data comes from parent)
  const [showAnalysisDetails, setShowAnalysisDetails] = useState(false)
  const [calculatingBodyFat, setCalculatingBodyFat] = useState(false)

  // Handle calculate body fat
  const handleCalculateBodyFat = async () => {
    setCalculatingBodyFat(true)
    try {
      await calculateBodyFat(member.id)
      // Refresh vitals to show new body fat
      onUpdate()
    } catch (err) {
      setError(err.response?.data?.detail || err.userMessage || 'Failed to calculate body fat')
    } finally {
      setCalculatingBodyFat(false)
    }
  }

  // Use onRefreshAnalysis from parent to trigger analysis refresh
  const fetchReadinessAnalysis = onRefreshAnalysis

  // Available context factors for vitals
  const CONTEXT_FACTORS = [
    { id: 'caffeine', label: 'Caffeine', icon: '☕' },
    { id: 'stress', label: 'Stress', icon: '😰' },
    { id: 'white_coat', label: 'White Coat', icon: '🩺' },
    { id: 'post_exercise', label: 'Post-Exercise', icon: '🏃' },
    { id: 'fasting', label: 'Fasting', icon: '🍽️' },
    { id: 'dehydrated', label: 'Dehydrated', icon: '💧' },
    { id: 'poor_sleep', label: 'Poor Sleep', icon: '😴' },
  ]

  // Form states
  const [vitalForm, setVitalForm] = useState({
    vital_type: '',
    value: '',
    value_secondary: '',
    context_factors: [],
    notes: ''
  })
  const [weightForm, setWeightForm] = useState({
    weight: '',
    notes: ''
  })

  // Editing state
  const [editingVital, setEditingVital] = useState(null)
  const [editForm, setEditForm] = useState({
    value: '',
    value_secondary: '',
    context_factors: [],
    notes: ''
  })

  // Get latest vital by type (moved up for body fat calc)
  const getLatestVital = (vitalType) => {
    return vitalsHistory.find(v => v.vital_type === vitalType)
  }

  // Get body fat - first check for stored body_fat vital, then calculate from measurements
  const getBodyFat = () => {
    // First, check for a stored body_fat vital
    const storedBodyFat = getLatestVital('body_fat')
    if (storedBodyFat) {
      return storedBodyFat.value
    }

    // Otherwise, calculate from taping measurements
    const height = member.height_inches
    const waistVital = getLatestVital('waist')
    const neckVital = getLatestVital('neck')
    const hipVital = getLatestVital('hip')
    const isFemale = member.gender === 'female'

    if (!height || !waistVital || !neckVital) return null

    const waist = waistVital.value
    const neck = neckVital.value
    const hip = hipVital?.value

    // Female formula requires hip measurement
    if (isFemale) {
      if (!hip) return null  // Cannot calculate without hip for females
      const circumference = waist + hip - neck
      if (circumference <= 0) return null
      return 163.205 * Math.log10(circumference) - 97.684 * Math.log10(height) - 78.387
    } else {
      // Male formula
      const circumference = waist - neck
      if (circumference <= 0) return null
      return 86.010 * Math.log10(circumference) - 70.041 * Math.log10(height) + 36.76
    }
  }

  // Get body fat info with category - using ACE fitness standards (gender-specific)
  const bodyFat = getBodyFat()
  const getBodyFatCategory = (bf) => {
    if (bf === null) return { label: 'N/A', color: 'text-gray-400' }
    const isFemale = member.gender === 'female'

    if (isFemale) {
      // Women's body fat categories (ACE fitness standards)
      // Essential: 10-13%, Athletes: 14-20%, Fitness: 21-24%, Normal: 25-31%, Obesity: 32%+
      if (bf < 14) return { label: 'Essential', color: 'text-blue-400' }
      if (bf < 21) return { label: 'Athletic', color: 'text-green-400' }
      if (bf < 25) return { label: 'Fitness', color: 'text-green-400' }
      if (bf < 32) return { label: 'Normal', color: 'text-green-400' }
      if (bf < 40) return { label: 'Above Normal', color: 'text-yellow-400' }
      return { label: 'High', color: 'text-orange-400' }
    } else {
      // Men's body fat categories (ACE fitness standards)
      // Essential: 2-5%, Athletes: 6-13%, Fitness: 14-17%, Normal: 18-24%, Obesity: 25%+
      if (bf < 6) return { label: 'Essential', color: 'text-blue-400' }
      if (bf < 14) return { label: 'Athletic', color: 'text-green-400' }
      if (bf < 18) return { label: 'Fitness', color: 'text-green-400' }
      if (bf < 25) return { label: 'Normal', color: 'text-green-400' }
      if (bf < 32) return { label: 'Above Normal', color: 'text-yellow-400' }
      return { label: 'High', color: 'text-orange-400' }
    }
  }
  const bodyFatInfo = getBodyFatCategory(bodyFat)

  // Calculate lean mass (total weight - fat mass)
  const leanMass = (bodyFat !== null && member.current_weight)
    ? member.current_weight * (1 - bodyFat / 100)
    : null

  // Get latest resting heart rate (prefer resting_heart_rate, fall back to heart_rate)
  const latestRHR = getLatestVital('resting_heart_rate') || getLatestVital('heart_rate')
  // Get latest active/normal heart rate
  const latestActiveHR = getLatestVital('heart_rate')

  // Format vital value for display
  const formatVitalValue = (vital) => {
    if (!vital) return 'N/A'
    if (vital.vital_type === 'blood_pressure' && vital.value_secondary) {
      return `${Math.round(vital.value)}/${Math.round(vital.value_secondary)} ${vital.unit}`
    }
    return `${vital.value} ${vital.unit}`
  }

  // Handle add vital
  const handleAddVital = async (e) => {
    e.preventDefault()
    if (!vitalForm.vital_type || !vitalForm.value) return

    setSubmitting(true)
    setError(null)
    try {
      await logVital(member.id, {
        vital_type: vitalForm.vital_type,
        value: parseFloat(vitalForm.value),
        value_secondary: vitalForm.value_secondary ? parseFloat(vitalForm.value_secondary) : null,
        context_factors: vitalForm.context_factors.length > 0 ? vitalForm.context_factors : null,
        notes: vitalForm.notes || null
      })
      setVitalForm({ vital_type: '', value: '', value_secondary: '', context_factors: [], notes: '' })
      setShowAddVital(false)
      // Auto-refresh vitals, averages, and readiness analysis
      await onUpdate()
      fetchReadinessAnalysis(true)
    } catch (err) {
      setError(err.userMessage || 'Failed to add vital')
    } finally {
      setSubmitting(false)
    }
  }

  // Handle add weight
  const handleAddWeight = async (e) => {
    e.preventDefault()
    if (!weightForm.weight) return

    setSubmitting(true)
    setError(null)
    try {
      await logWeight(member.id, {
        weight: parseFloat(weightForm.weight),
        notes: weightForm.notes || null
      })
      setWeightForm({ weight: '', notes: '' })
      setShowAddWeight(false)
      onUpdate()
    } catch (err) {
      setError(err.userMessage || 'Failed to add weight')
    } finally {
      setSubmitting(false)
    }
  }

  // Handle delete vital
  const handleDeleteVital = async (vitalId) => {
    if (!confirm('Delete this reading?')) return
    try {
      await deleteVital(member.id, vitalId)
      onUpdate()
    } catch (err) {
      console.error('Failed to delete vital:', err)
    }
  }

  // Handle start editing vital
  const handleStartEdit = (vital) => {
    setEditingVital(vital)
    setEditForm({
      value: vital.value?.toString() || '',
      value_secondary: vital.value_secondary?.toString() || '',
      context_factors: vital.context_factors || [],
      notes: vital.notes || ''
    })
  }

  // Handle save edit vital
  const handleSaveEdit = async () => {
    if (!editingVital || !editForm.value) return

    setSubmitting(true)
    setError(null)
    try {
      await updateVital(member.id, editingVital.id, {
        value: parseFloat(editForm.value),
        value_secondary: editForm.value_secondary ? parseFloat(editForm.value_secondary) : null,
        context_factors: editForm.context_factors.length > 0 ? editForm.context_factors : null,
        notes: editForm.notes || null
      })
      setEditingVital(null)
      setEditForm({ value: '', value_secondary: '', context_factors: [], notes: '' })
      onUpdate()
    } catch (err) {
      setError(err.userMessage || 'Failed to update vital')
    } finally {
      setSubmitting(false)
    }
  }

  // Get vital history by type
  const getVitalsByType = (vitalType) => {
    return vitalsHistory.filter(v => v.vital_type === vitalType)
  }

  // Selected vital type info
  const selectedVitalType = vitalTypes.find(t => t.value === vitalForm.vital_type)

  // Helper for status colors
  const getStatusColor = (status) => {
    switch (status) {
      case 'GREEN': return { bg: 'bg-green-600', text: 'text-green-400', border: 'border-green-500' }
      case 'AMBER': return { bg: 'bg-yellow-600', text: 'text-yellow-400', border: 'border-yellow-500' }
      case 'RED': return { bg: 'bg-red-600', text: 'text-red-400', border: 'border-red-500' }
      default: return { bg: 'bg-gray-600', text: 'text-gray-400', border: 'border-gray-500' }
    }
  }

  // Helper for trend icons
  const getTrendIcon = (trend) => {
    switch (trend) {
      case 'improving': return <TrendingUp className="w-3 h-3 text-green-400" />
      case 'declining': return <TrendingDown className="w-3 h-3 text-red-400" />
      case 'stable': return <Minus className="w-3 h-3 text-gray-400" />
      default: return <Info className="w-3 h-3 text-gray-500" />
    }
  }

  // Helper for severity badge
  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'critical': return 'bg-red-600 text-white'
      case 'high': return 'bg-red-500/80 text-white'
      case 'moderate': return 'bg-yellow-500/80 text-white'
      case 'low': return 'bg-blue-500/60 text-white'
      default: return 'bg-gray-500 text-white'
    }
  }

  return (
    <div className="space-y-4">
      {/* Readiness Analysis Panel */}
      <div className="bg-gray-700 rounded-lg p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-lg">Overall Readiness Assessment</h3>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowAddVital(true)}
              className="text-sm text-farm-green hover:text-green-400 flex items-center gap-1"
            >
              <Plus className="w-4 h-4" /> Add Recording
            </button>
            <button
              onClick={() => fetchReadinessAnalysis(true)}
              disabled={analysisLoading}
              className="text-sm text-farm-green hover:text-green-400 flex items-center gap-1 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${analysisLoading ? 'animate-spin' : ''}`} />
              {analysisLoading ? 'Analyzing...' : 'Refresh'}
            </button>
          </div>
        </div>

        {analysisError && (
          <div className="text-red-400 text-sm mb-3">{analysisError}</div>
        )}

        {readinessAnalysis ? (
          <div className="space-y-4">
            {/* Main Status Row */}
            <div className="flex flex-col md:flex-row gap-4">
              {/* Overall Score */}
              <div className={`flex-shrink-0 p-4 rounded-lg ${getStatusColor(readinessAnalysis.overall_status).bg} text-white text-center min-w-[120px]`}>
                <div className="text-3xl font-bold">{Math.round(readinessAnalysis.score)}</div>
                <div className="text-sm font-semibold">OVERALL</div>
                <div className="text-lg font-bold">{readinessAnalysis.overall_status}</div>
                <div className={`text-xs mt-1 px-2 py-0.5 rounded ${
                  readinessAnalysis.confidence === 'HIGH' ? 'bg-green-900/50' :
                  readinessAnalysis.confidence === 'MEDIUM' ? 'bg-yellow-900/50' :
                  'bg-red-900/50'
                }`}>
                  {readinessAnalysis.confidence} Confidence
                </div>
              </div>

              {/* Medical Safety & Performance */}
              <div className="flex-grow space-y-3">
                {/* Medical Safety - Hard Gate */}
                {readinessAnalysis.medical_safety && (
                  <div className={`flex items-center gap-3 p-2 rounded ${
                    readinessAnalysis.medical_safety.status === 'RED' ? 'bg-red-900/30 border border-red-600' :
                    readinessAnalysis.medical_safety.status === 'AMBER' ? 'bg-yellow-900/30 border border-yellow-600' :
                    'bg-green-900/20 border border-green-800'
                  }`}>
                    <Shield className={`w-5 h-5 ${
                      readinessAnalysis.medical_safety.status === 'RED' ? 'text-red-400' :
                      readinessAnalysis.medical_safety.status === 'AMBER' ? 'text-yellow-400' :
                      'text-green-400'
                    }`} />
                    <div className="flex-grow">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">Medical Safety</span>
                        <span className={`px-2 py-0.5 rounded text-xs font-bold ${getStatusColor(readinessAnalysis.medical_safety.status).bg} text-white`}>
                          {readinessAnalysis.medical_safety.status}
                        </span>
                        {readinessAnalysis.medical_safety.status === 'RED' && (
                          <span className="text-xs text-red-400">(HARD GATE)</span>
                        )}
                      </div>
                      {readinessAnalysis.medical_safety.recommendation && (
                        <p className="text-xs text-gray-400 mt-1">{readinessAnalysis.medical_safety.recommendation}</p>
                      )}
                    </div>
                  </div>
                )}

                {/* Performance Readiness */}
                <div className="flex items-center gap-3">
                  <span className="text-gray-400 w-36">Performance</span>
                  <span className={`px-2 py-0.5 rounded text-sm font-medium ${getStatusColor(readinessAnalysis.physical_status || readinessAnalysis.overall_status).bg} text-white`}>
                    {readinessAnalysis.physical_status || readinessAnalysis.overall_status}
                  </span>
                  <span className="text-gray-300">
                    {readinessAnalysis.indicators?.find(i => i.name === 'Physical Readiness')?.value?.toFixed(0) || '-'}
                  </span>
                </div>

                {/* Training Load Analysis */}
                {readinessAnalysis.training_load && (
                  <div className="bg-gray-800 rounded p-2">
                    <div className="flex items-center gap-2 mb-2">
                      <Activity className="w-4 h-4 text-blue-400" />
                      <span className="text-xs text-gray-400 font-medium">TRAINING LOAD</span>
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                        readinessAnalysis.training_load.risk === 'HIGH' ? 'bg-red-600' :
                        readinessAnalysis.training_load.risk === 'MODERATE' ? 'bg-yellow-600' :
                        'bg-green-600'
                      } text-white`}>
                        {readinessAnalysis.training_load.risk} RISK
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-3 text-xs">
                      <div>
                        <span className="text-gray-500">ACWR:</span>
                        <span className={`ml-1 font-medium ${
                          readinessAnalysis.training_load.acwr > 1.5 ? 'text-red-400' :
                          readinessAnalysis.training_load.acwr > 1.3 ? 'text-yellow-400' :
                          'text-green-400'
                        }`}>
                          {readinessAnalysis.training_load.acwr?.toFixed(2) || '-'}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-500">Acute:</span>
                        <span className="ml-1">{readinessAnalysis.training_load.acute_load?.toFixed(0) || '-'}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Chronic:</span>
                        <span className="ml-1">{readinessAnalysis.training_load.chronic_load?.toFixed(0) || '-'}</span>
                      </div>
                    </div>
                    {readinessAnalysis.training_load.spike_detected && (
                      <div className="mt-2 text-xs text-yellow-400 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" />
                        Training load spike detected - injury risk elevated
                      </div>
                    )}
                  </div>
                )}

                {/* Physical Breakdown */}
                {readinessAnalysis.indicators?.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-gray-600">
                    <div className="text-xs text-gray-400 mb-2">PHYSICAL BREAKDOWN:</div>
                    <div className="space-y-2">
                      {readinessAnalysis.indicators
                        .filter(ind => ['autonomic', 'cardiovascular', 'illness', 'body_composition'].includes(ind.category))
                        .map(ind => (
                          <div key={ind.category}>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-gray-400 w-28 truncate" title={ind.name}>{ind.name}</span>
                              <div className="flex-grow bg-gray-800 rounded-full h-2 overflow-hidden">
                                <div
                                  className={`h-full ${ind.value >= 80 ? 'bg-green-500' : ind.value >= 60 ? 'bg-yellow-500' : 'bg-red-500'}`}
                                  style={{ width: `${ind.value}%` }}
                                />
                              </div>
                              <span className="text-xs w-8 text-right">{ind.value?.toFixed(0) || '-'}</span>
                              {getTrendIcon(ind.trend)}
                            </div>
                            {ind.explanation && (
                              <div className="text-xs text-gray-500 ml-[7.5rem] mt-0.5">{ind.explanation}</div>
                            )}
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Primary Drivers */}
            {readinessAnalysis.primary_drivers?.length > 0 && (
              <div className="bg-gray-800 rounded p-3">
                <div className="text-xs text-gray-400 mb-2">PRIMARY DRIVERS</div>
                <ul className="space-y-1">
                  {readinessAnalysis.primary_drivers.map((driver, i) => (
                    <li key={i} className="text-sm text-gray-300 flex items-start gap-2">
                      <span className="text-gray-500">-</span>
                      {driver}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Risk Flags */}
            {readinessAnalysis.risk_flags?.length > 0 && (
              <div className="space-y-2">
                <div className="text-xs text-gray-400">RISK FLAGS</div>
                {readinessAnalysis.risk_flags.map((flag, i) => (
                  <div key={i} className={`rounded p-3 border-l-4 ${flag.severity === 'critical' || flag.severity === 'high' ? 'bg-red-900/30 border-red-500' : flag.severity === 'moderate' ? 'bg-yellow-900/30 border-yellow-500' : 'bg-blue-900/30 border-blue-500'}`}>
                    <div className="flex items-center gap-2 mb-1">
                      <AlertTriangle className={`w-4 h-4 ${flag.severity === 'critical' || flag.severity === 'high' ? 'text-red-400' : flag.severity === 'moderate' ? 'text-yellow-400' : 'text-blue-400'}`} />
                      <span className="font-medium">{flag.title}</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded ${getSeverityColor(flag.severity)}`}>
                        {flag.severity}
                      </span>
                      <span className="text-xs text-gray-500">[{flag.source}]</span>
                    </div>
                    <p className="text-sm text-gray-300 ml-6">{flag.explanation}</p>
                    {flag.recommendation && (
                      <p className="text-xs text-gray-400 ml-6 mt-1">
                        <span className="text-gray-500">Recommendation:</span> {flag.recommendation}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Details Toggle */}
            <button
              onClick={() => setShowAnalysisDetails(!showAnalysisDetails)}
              className="text-sm text-gray-400 hover:text-white flex items-center gap-1"
            >
              {showAnalysisDetails ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              {showAnalysisDetails ? 'Hide Details' : 'Show Details'}
            </button>

            {/* Detailed View */}
            {showAnalysisDetails && (
              <div className="space-y-3 pt-2 border-t border-gray-600">
                {/* Data Quality */}
                <div className="bg-gray-800 rounded p-3">
                  <div className="text-xs text-gray-400 mb-2">DATA QUALITY</div>
                  {readinessAnalysis.data_quality_note && (
                    <p className="text-sm text-gray-300 mb-2">{readinessAnalysis.data_quality_note}</p>
                  )}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                    <div>
                      <span className="text-gray-500">7-day readings:</span>
                      <span className="ml-1">{readinessAnalysis.data_quality?.data_points_7d || 0}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">30-day readings:</span>
                      <span className="ml-1">{readinessAnalysis.data_quality?.data_points_30d || 0}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Taping method:</span>
                      <span className={`ml-1 ${readinessAnalysis.data_quality?.taping_available ? 'text-green-400' : 'text-gray-500'}`}>
                        {readinessAnalysis.data_quality?.taping_available ? 'Available' : 'Missing data'}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500">Updated member:</span>
                      <span className={`ml-1 ${readinessAnalysis.member_updated ? 'text-green-400' : 'text-gray-500'}`}>
                        {readinessAnalysis.member_updated ? 'Yes' : 'No'}
                      </span>
                    </div>
                  </div>
                  {readinessAnalysis.data_sources_used?.length > 0 && (
                    <div className="mt-2 text-xs text-gray-500">
                      Data sources: {readinessAnalysis.data_sources_used.join(', ')}
                    </div>
                  )}
                  {readinessAnalysis.data_quality?.vitals_missing?.length > 0 && (
                    <div className="mt-2 text-xs text-gray-500">
                      Missing vitals: {readinessAnalysis.data_quality.vitals_missing.join(', ')}
                    </div>
                  )}
                </div>

                {/* All Indicators */}
                <div className="bg-gray-800 rounded p-3">
                  <div className="text-xs text-gray-400 mb-2">ALL INDICATORS</div>
                  <div className="space-y-2">
                    {readinessAnalysis.indicators.map(ind => (
                      <div key={ind.name} className="text-sm">
                        <div className="flex items-center justify-between">
                          <span className="text-gray-300">{ind.name}</span>
                          <div className="flex items-center gap-2">
                            {getTrendIcon(ind.trend)}
                            <span className={ind.value >= 80 ? 'text-green-400' : ind.value >= 60 ? 'text-yellow-400' : 'text-red-400'}>
                              {ind.value.toFixed(0)}
                            </span>
                            <span className="text-xs text-gray-500">({ind.confidence} conf)</span>
                          </div>
                        </div>
                        {ind.contributing_factors?.length > 0 && (
                          <div className="text-xs text-gray-500 ml-2">
                            {ind.contributing_factors.join('; ')}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="text-xs text-gray-500 text-right">
                  Analyzed: {new Date(readinessAnalysis.analyzed_at).toLocaleString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="text-gray-400 text-center py-4">
            {analysisLoading ? 'Loading analysis...' : 'No analysis available'}
          </div>
        )}
      </div>

      {/* Current Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <div className="bg-gray-700 rounded-lg p-4">
          <div className="text-gray-400 text-sm mb-1">Weight</div>
          <div className="text-2xl font-bold">{formatWeight(member.current_weight)}</div>
          {member.target_weight && (
            <div className="text-xs text-gray-400">
              Target: {formatWeight(member.target_weight)}
            </div>
          )}
        </div>
        <div className="bg-gray-700 rounded-lg p-4">
          <div className="text-gray-400 text-sm mb-1">Height</div>
          <div className="text-2xl font-bold">{formatHeight(member.height_inches)}</div>
        </div>
        <div className="bg-gray-700 rounded-lg p-4">
          <div className="text-gray-400 text-sm mb-1">Body Fat %</div>
          <div className="text-2xl font-bold">{bodyFat !== null ? `${bodyFat.toFixed(1)}%` : 'N/A'}</div>
          <div className={`text-xs ${bodyFatInfo.color}`}>{bodyFatInfo.label}</div>
          {bodyFat === null && (
            <>
              {/* Show what's missing for body fat calculation */}
              {(() => {
                const isFemale = member.gender === 'female'
                const hasHeight = !!member.height_inches
                const hasWaist = !!getLatestVital('waist')
                const hasNeck = !!getLatestVital('neck')
                const hasHip = !!getLatestVital('hip')

                const missing = []
                if (!hasHeight) missing.push('height')
                if (!hasWaist) missing.push('waist')
                if (!hasNeck) missing.push('neck')
                if (isFemale && !hasHip) missing.push('hip')

                if (missing.length > 0) {
                  return (
                    <div className="text-xs text-yellow-400 mt-1">
                      Missing: {missing.join(', ')}
                      {isFemale && !hasHip && <span className="block text-gray-400">(Hip required for women)</span>}
                    </div>
                  )
                }

                // Has all measurements, show calculate button
                return (
                  <button
                    onClick={handleCalculateBodyFat}
                    disabled={calculatingBodyFat}
                    className="mt-2 text-xs px-2 py-1 bg-blue-600 hover:bg-blue-700 rounded disabled:opacity-50"
                  >
                    {calculatingBodyFat ? 'Calculating...' : 'Calculate from Measurements'}
                  </button>
                )
              })()}
            </>
          )}
        </div>
        <div className="bg-gray-700 rounded-lg p-4">
          <div className="text-gray-400 text-sm mb-1">Lean Mass</div>
          <div className="text-2xl font-bold">{leanMass !== null ? formatWeight(leanMass) : 'N/A'}</div>
          {bodyFat !== null && (
            <div className="text-xs text-gray-400">
              Fat: {formatWeight(member.current_weight - leanMass)}
            </div>
          )}
        </div>
        <div className="bg-gray-700 rounded-lg p-4">
          <div className="text-gray-400 text-sm mb-1">Resting HR</div>
          <div className="text-2xl font-bold">{latestRHR ? `${Math.round(latestRHR.value)}` : 'N/A'}</div>
          {latestRHR && <div className="text-xs text-gray-400">bpm</div>}
        </div>
        <div className="bg-gray-700 rounded-lg p-4">
          <div className="text-gray-400 text-sm mb-1">Active HR</div>
          <div className="text-2xl font-bold">{latestActiveHR ? `${Math.round(latestActiveHR.value)}` : 'N/A'}</div>
          {latestActiveHR && <div className="text-xs text-gray-400">bpm</div>}
        </div>
        <div className="bg-gray-700 rounded-lg p-4">
          <div className="text-gray-400 text-sm mb-1">Blood Type</div>
          <div className="text-2xl font-bold text-red-400">{member.blood_type || 'N/A'}</div>
        </div>
      </div>


      {/* Latest Vitals - includes weight and all measurements */}
      <div className="bg-gray-700 rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold">Latest Vitals</h3>
          <span className="text-xs text-gray-500">Click any card to see history</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {/* Weight card first */}
          <div
            className="bg-gray-800 rounded p-3 cursor-pointer hover:bg-gray-750"
            onClick={() => setSelectedType(selectedType === 'weight' ? null : 'weight')}
          >
            <div className="text-xs text-gray-400 mb-1">Weight</div>
            <div className="font-medium">
              {member.current_weight ? formatWeight(member.current_weight) : 'No data'}
            </div>
            {weightHistory.length > 1 && (
              <div className="text-xs text-gray-500 mt-1 space-y-0.5">
                {weightHistory.slice(1, 4).map((w, i) => (
                  <div key={w.id} className="flex justify-between">
                    <span>{formatDate(w.recorded_at)}</span>
                    <span>{formatWeight(w.weight)}</span>
                  </div>
                ))}
              </div>
            )}
            {weightHistory.length > 0 && (
              <div className="text-xs text-gray-500 mt-1">{formatDate(weightHistory[0]?.recorded_at)}</div>
            )}
          </div>
          {/* Other vital types - hide hip for males */}
          {vitalTypes.filter(type => !(type.value === 'hip' && member.gender !== 'female')).map(type => {
            const allReadings = getVitalsByType(type.value)
            const latest = allReadings[0]
            const recentReadings = allReadings.slice(1, 4) // Next 3 readings after latest
            return (
              <div
                key={type.value}
                className="bg-gray-800 rounded p-3 cursor-pointer hover:bg-gray-750"
                onClick={() => setSelectedType(selectedType === type.value ? null : type.value)}
              >
                <div className="text-xs text-gray-400 mb-1">{type.label}</div>
                <div className="font-medium">
                  {latest ? formatVitalValue(latest) : 'No data'}
                </div>
                {recentReadings.length > 0 && (
                  <div className="text-xs text-gray-500 mt-1 space-y-0.5">
                    {recentReadings.map(v => (
                      <div key={v.id} className="flex justify-between">
                        <span>{formatDate(v.recorded_at)}</span>
                        <span>{type.value === 'blood_pressure' && v.value_secondary
                          ? `${Math.round(v.value)}/${Math.round(v.value_secondary)}`
                          : v.value} {type.unit}</span>
                      </div>
                    ))}
                  </div>
                )}
                {latest && (
                  <div className="text-xs text-gray-500 mt-1">{formatDate(latest.recorded_at)}</div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Selected Vital/Weight History */}
      {selectedType && (
        <div className="bg-gray-700 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold">
              {selectedType === 'weight' ? 'Weight' : vitalTypes.find(t => t.value === selectedType)?.label || selectedType} History
            </h3>
            <button
              onClick={() => setSelectedType(null)}
              className="text-sm text-gray-400 hover:text-white"
            >
              Close
            </button>
          </div>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {selectedType === 'weight' ? (
              // Weight history
              weightHistory.length > 0 ? (
                weightHistory.map(entry => (
                  <div key={entry.id} className="flex items-center justify-between py-2 border-b border-gray-600 last:border-0">
                    <div className="flex items-center gap-4">
                      <span className="text-gray-400 text-sm w-24">{formatDate(entry.recorded_at)}</span>
                      <span className="font-medium">{formatWeight(entry.weight)}</span>
                      {entry.notes && <span className="text-gray-400 text-sm">{entry.notes}</span>}
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-gray-400 text-sm">No weight readings recorded</p>
              )
            ) : (
              // Vital history
              getVitalsByType(selectedType).length > 0 ? (
                getVitalsByType(selectedType).map(vital => (
                  <div key={vital.id} className="flex items-center justify-between py-2 border-b border-gray-600 last:border-0">
                    <div className="flex items-center gap-4">
                      <span className="text-gray-400 text-sm w-24">{formatDate(vital.recorded_at)}</span>
                      <span className="font-medium">{formatVitalValue(vital)}</span>
                      {vital.context_factors?.length > 0 && (
                        <span className="text-sm" title={vital.context_factors.map(f => CONTEXT_FACTORS.find(cf => cf.id === f)?.label || f).join(', ')}>
                          {vital.context_factors.map(f => CONTEXT_FACTORS.find(cf => cf.id === f)?.icon || '').join(' ')}
                        </span>
                      )}
                      {vital.notes && <span className="text-gray-400 text-sm">{vital.notes}</span>}
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleStartEdit(vital)}
                        className="p-1 text-gray-400 hover:text-blue-400"
                        title="Edit reading"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteVital(vital.id)}
                        className="p-1 text-gray-400 hover:text-red-400"
                        title="Delete reading"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-gray-400 text-sm">No readings recorded</p>
              )
            )}
          </div>
        </div>
      )}

      {/* Add Recording Modal - unified for all vitals including weight */}
      {showAddVital && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-lg w-full max-w-sm sm:max-w-md">
            <div className="flex items-center justify-between p-4 border-b border-gray-700">
              <h3 className="font-semibold">Add Recording</h3>
              <button onClick={() => { setShowAddVital(false); setVitalForm({ vital_type: '', value: '', value_secondary: '', notes: '' }) }} className="text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={async (e) => {
              e.preventDefault()
              if (vitalForm.vital_type === 'weight') {
                // Handle weight submission directly
                if (!weightForm.weight) return
                setSubmitting(true)
                setError(null)
                try {
                  await logWeight(member.id, {
                    weight: parseFloat(weightForm.weight),
                    notes: weightForm.notes || null
                  })
                  setWeightForm({ weight: '', notes: '' })
                  setVitalForm({ vital_type: '', value: '', value_secondary: '', context_factors: [], notes: '' })
                  setShowAddVital(false)
                  // Auto-refresh vitals and analysis
                  await onUpdate()
                  fetchReadinessAnalysis(true)
                } catch (err) {
                  setError(err.userMessage || 'Failed to add weight')
                } finally {
                  setSubmitting(false)
                }
              } else {
                handleAddVital(e)
              }
            }} className="p-4 space-y-4">
              {error && (
                <div className="p-3 bg-red-900/50 border border-red-700 rounded text-red-200 text-sm">
                  {error}
                </div>
              )}
              <div>
                <label className="block text-sm text-gray-400 mb-1">Recording Type *</label>
                <select
                  value={vitalForm.vital_type}
                  onChange={(e) => {
                    const newType = e.target.value
                    setVitalForm({ ...vitalForm, vital_type: newType, value: '', value_secondary: '' })
                    if (newType === 'weight') {
                      setWeightForm({ weight: '', notes: '' })
                    }
                  }}
                  className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2"
                  required
                >
                  <option value="">Select type...</option>
                  <option value="weight">Weight</option>
                  {vitalTypes.filter(type => !(type.value === 'hip' && member.gender !== 'female')).map(type => (
                    <option key={type.value} value={type.value}>{type.label}</option>
                  ))}
                </select>
              </div>
              {vitalForm.vital_type === 'weight' ? (
                <>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">
                      Weight ({settings?.team_units === 'metric' ? 'kg' : 'lbs'}) *
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={weightForm.weight}
                      onChange={(e) => setWeightForm({ ...weightForm, weight: e.target.value })}
                      className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Notes</label>
                    <input
                      type="text"
                      value={weightForm.notes}
                      onChange={(e) => setWeightForm({ ...weightForm, notes: e.target.value })}
                      className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2"
                      placeholder="Optional notes..."
                    />
                  </div>
                </>
              ) : vitalForm.vital_type && (
                <>
                  <div className={selectedVitalType?.has_secondary ? 'grid grid-cols-2 gap-4' : ''}>
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">
                        {selectedVitalType?.has_secondary ? 'Systolic *' : `Value (${selectedVitalType?.unit}) *`}
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        value={vitalForm.value}
                        onChange={(e) => setVitalForm({ ...vitalForm, value: e.target.value })}
                        className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2"
                        placeholder={selectedVitalType?.has_secondary ? '120' : ''}
                        required
                      />
                    </div>
                    {selectedVitalType?.has_secondary && (
                      <div>
                        <label className="block text-sm text-gray-400 mb-1">Diastolic *</label>
                        <input
                          type="number"
                          step="0.1"
                          value={vitalForm.value_secondary}
                          onChange={(e) => setVitalForm({ ...vitalForm, value_secondary: e.target.value })}
                          className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2"
                          placeholder="80"
                          required
                        />
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Context Factors</label>
                    <div className="flex flex-wrap gap-2">
                      {CONTEXT_FACTORS.map(factor => (
                        <label
                          key={factor.id}
                          className={`flex items-center gap-1 px-2 py-1 rounded cursor-pointer text-sm transition-colors ${
                            vitalForm.context_factors.includes(factor.id)
                              ? 'bg-blue-600 text-white'
                              : 'bg-gray-600 text-gray-300 hover:bg-gray-500'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={vitalForm.context_factors.includes(factor.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setVitalForm({ ...vitalForm, context_factors: [...vitalForm.context_factors, factor.id] })
                              } else {
                                setVitalForm({ ...vitalForm, context_factors: vitalForm.context_factors.filter(f => f !== factor.id) })
                              }
                            }}
                            className="hidden"
                          />
                          <span>{factor.icon}</span>
                          <span>{factor.label}</span>
                        </label>
                      ))}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">Select any factors that may affect this reading</p>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Notes</label>
                    <input
                      type="text"
                      value={vitalForm.notes}
                      onChange={(e) => setVitalForm({ ...vitalForm, notes: e.target.value })}
                      className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2"
                      placeholder="Optional notes..."
                    />
                  </div>
                </>
              )}
              <div className="flex justify-end gap-3 pt-4">
                <button type="button" onClick={() => { setShowAddVital(false); setVitalForm({ vital_type: '', value: '', value_secondary: '', context_factors: [], notes: '' }) }} className="px-4 py-2 text-gray-400 hover:text-white">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || !vitalForm.vital_type || (vitalForm.vital_type === 'weight' ? !weightForm.weight : !vitalForm.value)}
                  className="px-4 py-2 bg-farm-green text-white rounded hover:bg-green-600 disabled:opacity-50"
                >
                  {submitting ? 'Saving...' : 'Save Recording'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Vital Modal */}
      {editingVital && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-lg w-full max-w-sm sm:max-w-md">
            <div className="flex items-center justify-between p-4 border-b border-gray-700">
              <h3 className="font-semibold">Edit {vitalTypes.find(t => t.value === editingVital.vital_type)?.label || editingVital.vital_type}</h3>
              <button onClick={() => { setEditingVital(null); setEditForm({ value: '', value_secondary: '', context_factors: [], notes: '' }); setError(null) }} className="text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              {error && (
                <div className="p-3 bg-red-900/50 border border-red-700 rounded text-red-200 text-sm">
                  {error}
                </div>
              )}
              <div className="text-sm text-gray-400 mb-2">
                Recorded: {formatDate(editingVital.recorded_at)}
              </div>
              {editingVital.vital_type === 'blood_pressure' ? (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Systolic (mmHg) *</label>
                    <input
                      type="number"
                      value={editForm.value}
                      onChange={(e) => setEditForm({ ...editForm, value: e.target.value })}
                      className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Diastolic (mmHg) *</label>
                    <input
                      type="number"
                      value={editForm.value_secondary}
                      onChange={(e) => setEditForm({ ...editForm, value_secondary: e.target.value })}
                      className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2"
                      required
                    />
                  </div>
                </div>
              ) : (
                <div>
                  <label className="block text-sm text-gray-400 mb-1">
                    Value ({vitalTypes.find(t => t.value === editingVital.vital_type)?.unit || ''}) *
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={editForm.value}
                    onChange={(e) => setEditForm({ ...editForm, value: e.target.value })}
                    className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2"
                    required
                  />
                </div>
              )}
              <div>
                <label className="block text-sm text-gray-400 mb-1">Context Factors</label>
                <div className="flex flex-wrap gap-2">
                  {CONTEXT_FACTORS.map(factor => (
                    <label
                      key={factor.id}
                      className={`flex items-center gap-1 px-2 py-1 rounded cursor-pointer text-sm transition-colors ${
                        editForm.context_factors.includes(factor.id)
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-600 text-gray-300 hover:bg-gray-500'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={editForm.context_factors.includes(factor.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setEditForm({ ...editForm, context_factors: [...editForm.context_factors, factor.id] })
                          } else {
                            setEditForm({ ...editForm, context_factors: editForm.context_factors.filter(f => f !== factor.id) })
                          }
                        }}
                        className="hidden"
                      />
                      <span>{factor.icon}</span>
                      <span>{factor.label}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Notes</label>
                <input
                  type="text"
                  value={editForm.notes}
                  onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                  className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2"
                  placeholder="Optional notes..."
                />
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <button type="button" onClick={() => { setEditingVital(null); setEditForm({ value: '', value_secondary: '', context_factors: [], notes: '' }); setError(null) }} className="px-4 py-2 text-gray-400 hover:text-white">
                  Cancel
                </button>
                <button
                  onClick={handleSaveEdit}
                  disabled={submitting || !editForm.value}
                  className="px-4 py-2 bg-farm-green text-white rounded hover:bg-green-600 disabled:opacity-50"
                >
                  {submitting ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}


// ============================================
// Fitness Tab Component
// ============================================

const WORKOUT_TYPES = [
  { value: 'RUN', label: 'Run', icon: '🏃' },
  { value: 'RUCK', label: 'Ruck', icon: '🎒' },
  { value: 'SWIM', label: 'Swim', icon: '🏊' },
  { value: 'BIKE', label: 'Bike', icon: '🚴' },
  { value: 'ROW', label: 'Row', icon: '🚣' },
  { value: 'STRENGTH', label: 'Strength', icon: '🏋️' },
  { value: 'HIIT', label: 'HIIT', icon: '⚡' },
  { value: 'COMBAT', label: 'Combat', icon: '🥊' },
  { value: 'PT_TEST', label: 'PT Test', icon: '📋' },
  { value: 'MOBILITY', label: 'Mobility', icon: '🧘' },
  { value: 'OTHER', label: 'Other', icon: '💪' },
]

function FitnessTab({ member, settings, formatDate }) {
  const [workouts, setWorkouts] = useState([])
  const [stats, setStats] = useState(null)
  const [fitnessProfile, setFitnessProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showAddWorkout, setShowAddWorkout] = useState(false)
  const [editingWorkout, setEditingWorkout] = useState(null)  // Workout being edited
  const [submitting, setSubmitting] = useState(false)
  const [selectedType, setSelectedType] = useState(null)
  const [viewMode, setViewMode] = useState('stats') // 'list' or 'stats'
  const [expandedScoreType, setExpandedScoreType] = useState(null) // which type's scoring details are expanded

  // Form state
  const [workoutForm, setWorkoutForm] = useState({
    workout_type: '',
    workout_date: new Date().toISOString().split('T')[0],
    duration_minutes: '',
    distance_miles: '',
    weight_carried_lbs: '',
    elevation_gain_ft: '',
    avg_heart_rate: '',
    calories_burned: '',
    rpe: '',
    quality_rating: '',
    exercises: [],
    notes: ''
  })

  // Load workouts and stats
  useEffect(() => {
    loadData()
  }, [member.id])

  const loadData = async () => {
    setLoading(true)
    try {
      const [workoutsRes, statsRes, profileRes] = await Promise.all([
        getWorkouts(member.id, { limit: 50, days_back: 365 }),
        getWorkoutStats(member.id, 30),
        getFitnessProfile(member.id).catch(() => ({ data: null }))
      ])
      setWorkouts(workoutsRes.data)
      setStats(statsRes.data)
      setFitnessProfile(profileRes.data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // Handle workout submission
  const handleSubmit = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)

    try {
      const data = {
        workout_type: workoutForm.workout_type,
        workout_date: workoutForm.workout_date ? new Date(workoutForm.workout_date).toISOString() : null,
        duration_minutes: workoutForm.duration_minutes ? parseInt(workoutForm.duration_minutes) : null,
        distance_miles: workoutForm.distance_miles ? parseFloat(workoutForm.distance_miles) : null,
        weight_carried_lbs: workoutForm.weight_carried_lbs ? parseFloat(workoutForm.weight_carried_lbs) : null,
        elevation_gain_ft: workoutForm.elevation_gain_ft ? parseFloat(workoutForm.elevation_gain_ft) : null,
        avg_heart_rate: workoutForm.avg_heart_rate ? parseInt(workoutForm.avg_heart_rate) : null,
        calories_burned: workoutForm.calories_burned ? parseInt(workoutForm.calories_burned) : null,
        rpe: workoutForm.rpe ? parseInt(workoutForm.rpe) : null,
        quality_rating: workoutForm.quality_rating ? parseInt(workoutForm.quality_rating) : null,
        exercises: workoutForm.exercises.length > 0 ? workoutForm.exercises : null,
        notes: workoutForm.notes || null
      }

      await logWorkout(member.id, data)
      await loadData()
      closeWorkoutModal()
    } catch (err) {
      setError(err.response?.data?.detail || err.message)
    } finally {
      setSubmitting(false)
    }
  }

  // Handle delete
  const handleDelete = async (workoutId) => {
    if (!window.confirm('Delete this workout?')) return
    try {
      await deleteWorkout(member.id, workoutId)
      await loadData()
    } catch (err) {
      setError(err.message)
    }
  }

  // Start editing a workout
  const handleStartEdit = (workout) => {
    setEditingWorkout(workout)
    setWorkoutForm({
      workout_type: workout.workout_type || '',
      workout_date: workout.workout_date ? new Date(workout.workout_date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
      duration_minutes: workout.duration_minutes || '',
      distance_miles: workout.distance_miles || '',
      weight_carried_lbs: workout.weight_carried_lbs || '',
      elevation_gain_ft: workout.elevation_gain_ft || '',
      avg_heart_rate: workout.avg_heart_rate || '',
      calories_burned: workout.calories_burned || '',
      rpe: workout.rpe || '',
      quality_rating: workout.quality_rating || '',
      exercises: workout.exercises || [],
      notes: workout.notes || ''
    })
    setShowAddWorkout(true)
  }

  // Save edit
  const handleSaveEdit = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)

    try {
      const data = {
        workout_type: workoutForm.workout_type,
        workout_date: workoutForm.workout_date ? new Date(workoutForm.workout_date).toISOString() : null,
        duration_minutes: workoutForm.duration_minutes ? parseInt(workoutForm.duration_minutes) : null,
        distance_miles: workoutForm.distance_miles ? parseFloat(workoutForm.distance_miles) : null,
        weight_carried_lbs: workoutForm.weight_carried_lbs ? parseFloat(workoutForm.weight_carried_lbs) : null,
        elevation_gain_ft: workoutForm.elevation_gain_ft ? parseFloat(workoutForm.elevation_gain_ft) : null,
        avg_heart_rate: workoutForm.avg_heart_rate ? parseInt(workoutForm.avg_heart_rate) : null,
        calories_burned: workoutForm.calories_burned ? parseInt(workoutForm.calories_burned) : null,
        rpe: workoutForm.rpe ? parseInt(workoutForm.rpe) : null,
        quality_rating: workoutForm.quality_rating ? parseInt(workoutForm.quality_rating) : null,
        exercises: workoutForm.exercises.length > 0 ? workoutForm.exercises : null,
        notes: workoutForm.notes || null
      }

      await updateWorkout(member.id, editingWorkout.id, data)
      await loadData()
      closeWorkoutModal()
    } catch (err) {
      setError(err.response?.data?.detail || err.message)
    } finally {
      setSubmitting(false)
    }
  }

  // Close workout modal (add or edit)
  const closeWorkoutModal = () => {
    setShowAddWorkout(false)
    setEditingWorkout(null)
    setWorkoutForm({
      workout_type: '',
      workout_date: new Date().toISOString().split('T')[0],
      duration_minutes: '',
      distance_miles: '',
      weight_carried_lbs: '',
      elevation_gain_ft: '',
      avg_heart_rate: '',
      calories_burned: '',
      rpe: '',
      quality_rating: '',
      exercises: [],
      notes: ''
    })
    setSelectedType(null)
  }

  // Format pace (seconds per mile to mm:ss)
  const formatPace = (seconds) => {
    if (!seconds) return '--'
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  // Check if workout type is cardio (shows distance fields)
  const isCardioType = ['RUN', 'RUCK', 'SWIM', 'BIKE', 'ROW'].includes(workoutForm.workout_type)
  const isRuck = workoutForm.workout_type === 'RUCK'
  const isStrength = workoutForm.workout_type === 'STRENGTH'

  if (loading) {
    return <div className="text-center py-8 text-gray-400">Loading fitness data...</div>
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Dumbbell className="w-6 h-6 text-blue-400" />
          <h3 className="text-lg font-semibold">Fitness Tracking</h3>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-gray-700 rounded-lg p-1">
            <button
              onClick={() => setViewMode('list')}
              className={`px-3 py-1 rounded text-sm ${viewMode === 'list' ? 'bg-gray-600' : 'hover:bg-gray-600'}`}
            >
              Workouts
            </button>
            <button
              onClick={() => setViewMode('stats')}
              className={`px-3 py-1 rounded text-sm ${viewMode === 'stats' ? 'bg-gray-600' : 'hover:bg-gray-600'}`}
            >
              Stats
            </button>
          </div>
          <button
            onClick={() => setShowAddWorkout(true)}
            className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            <Plus className="w-4 h-4" />
            Log Workout
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-900/50 border border-red-500 rounded p-3 text-red-200">
          {error}
        </div>
      )}

      {/* Stats View */}
      {viewMode === 'stats' && stats && (
        <div className="space-y-6">
          {/* Fitness Profile Tier Badge */}
          {fitnessProfile && fitnessProfile.overall_tier && (
            <div className={`rounded-lg p-4 border-2 ${
              fitnessProfile.overall_tier === 'SF' ? 'bg-yellow-900/20 border-yellow-500' :
              fitnessProfile.overall_tier === 'MARINE' ? 'bg-green-900/20 border-green-500' :
              'bg-blue-900/20 border-blue-500'
            }`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`px-3 py-1 rounded-full font-bold ${
                    fitnessProfile.overall_tier === 'SF' ? 'bg-yellow-500 text-yellow-900' :
                    fitnessProfile.overall_tier === 'MARINE' ? 'bg-green-500 text-green-900' :
                    'bg-blue-500 text-blue-900'
                  }`}>
                    {fitnessProfile.overall_tier}
                  </div>
                  <div>
                    <div className="font-semibold text-white">{fitnessProfile.overall_sub_tier}</div>
                    <div className="text-sm text-gray-400">Overall Fitness Level</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-3xl font-bold">{Math.round(fitnessProfile.overall_score || 0)}</div>
                  <div className="text-xs text-gray-400">FITNESS SCORE</div>
                </div>
              </div>
              {/* Score Explanation - Detailed Breakdown */}
              {fitnessProfile.by_type && Object.keys(fitnessProfile.by_type).length > 0 && (
                <div className="mt-4 pt-4 border-t border-gray-600">
                  <div className="text-xs text-gray-400 mb-3">SCORE BREAKDOWN <span className="text-gray-500">(tap type to expand details)</span></div>
                  <div className="space-y-2">
                    {Object.entries(fitnessProfile.by_type)
                      .sort((a, b) => (b[1].best_score || b[1].score || 0) - (a[1].best_score || a[1].score || 0))
                      .map(([type, data]) => {
                        const bestScore = data.best_score || data.score || 0
                        const avgScore = data.average_score || data.score || 0
                        const typeLabel = WORKOUT_TYPES.find(t => t.value === type)
                        const icon = typeLabel ? typeLabel.icon : ''
                        const isExpanded = expandedScoreType === type
                        const details = data.scoring_details
                        return (
                          <div key={type} className="bg-gray-800 rounded overflow-hidden">
                            {/* Clickable header row */}
                            <div
                              className="p-3 cursor-pointer hover:bg-gray-750"
                              onClick={() => setExpandedScoreType(isExpanded ? null : type)}
                            >
                              <div className="flex items-center justify-between mb-1">
                                <div className="flex items-center gap-2">
                                  {icon && <span className="text-sm">{icon}</span>}
                                  <span className="text-sm font-medium text-gray-200">{typeLabel?.label || type}</span>
                                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                                    data.tier === 'SF' ? 'bg-yellow-500 text-yellow-900' :
                                    data.tier === 'MARINE' ? 'bg-green-500 text-green-900' :
                                    'bg-blue-500 text-blue-900'
                                  }`}>
                                    {data.tier} {data.sub_tier || ''}
                                  </span>
                                  {isExpanded ? <ChevronUp className="w-3 h-3 text-gray-500" /> : <ChevronDown className="w-3 h-3 text-gray-500" />}
                                </div>
                                <div className="flex items-center gap-3">
                                  <span className="text-xs text-gray-500">{data.workout_count || 0} workout{(data.workout_count || 0) !== 1 ? 's' : ''}</span>
                                  <span className={`text-lg font-bold ${
                                    bestScore >= 90 ? 'text-yellow-400' :
                                    bestScore >= 70 ? 'text-green-400' :
                                    bestScore >= 40 ? 'text-blue-400' :
                                    'text-gray-400'
                                  }`}>{Math.round(bestScore)}</span>
                                </div>
                              </div>
                              {/* Progress bar */}
                              <div className="w-full bg-gray-700 rounded-full h-2 mt-1">
                                <div
                                  className={`h-2 rounded-full transition-all ${
                                    bestScore >= 90 ? 'bg-yellow-500' :
                                    bestScore >= 70 ? 'bg-green-500' :
                                    bestScore >= 40 ? 'bg-blue-500' :
                                    'bg-gray-500'
                                  }`}
                                  style={{ width: `${Math.min(100, bestScore)}%` }}
                                />
                              </div>
                              {/* Score markers */}
                              <div className="flex justify-between text-[10px] text-gray-600 mt-0.5 px-0.5">
                                <span>0</span>
                                <span className="text-blue-600">|40 CIV</span>
                                <span className="text-green-600">|70 MAR</span>
                                <span className="text-yellow-600">|90 SF</span>
                                <span>100</span>
                              </div>
                              {/* Average vs Best */}
                              {data.workout_count > 1 && avgScore !== bestScore && (
                                <div className="text-xs text-gray-500 mt-1">
                                  Best: {Math.round(bestScore)} | Avg: {Math.round(avgScore)}
                                  {bestScore - avgScore > 15 && (
                                    <span className="text-yellow-500 ml-2">High variance - consistency will improve score</span>
                                  )}
                                </div>
                              )}
                            </div>

                            {/* Expanded scoring details */}
                            {isExpanded && details && (
                              <div className="px-3 pb-3 border-t border-gray-700 space-y-3">
                                {/* Scoring method */}
                                <div className="mt-3">
                                  <div className="text-xs font-semibold text-gray-300 mb-1">SCORING METHOD</div>
                                  <div className="text-xs text-gray-400">{details.scoring_method}</div>
                                  <div className="text-xs text-gray-500 mt-0.5">
                                    Standards: {details.gender}, age {details.age_bracket}
                                  </div>
                                </div>

                                {/* Tier pace targets for RUN */}
                                {details.tier_paces && (
                                  <div>
                                    <div className="text-xs font-semibold text-gray-300 mb-1">PACE TARGETS</div>
                                    <div className="grid grid-cols-1 gap-1">
                                      {details.tier_paces.map((tp, i) => (
                                        <div key={i} className="flex justify-between text-xs bg-gray-900 rounded px-2 py-1">
                                          <span className={
                                            tp.label.includes('SF') ? 'text-yellow-400' :
                                            tp.label.includes('Marine') ? 'text-green-400' :
                                            'text-blue-400'
                                          }>{tp.label}</span>
                                          <span className="text-gray-300">{tp.pace} ({tp.time_3mi} 3mi)</span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {/* Generic thresholds (RUCK pace, SWIM times, BIKE speeds, ROW splits, HIIT formula, PT_TEST mapping, MOBILITY) */}
                                {details.thresholds && details.thresholds.length > 0 && !details.tier_paces && (
                                  <div>
                                    <div className="text-xs font-semibold text-gray-300 mb-1">
                                      {type === 'RUCK' ? 'PACE STANDARDS (at ~45lb)' :
                                       type === 'SWIM' ? '300M TIME STANDARDS' :
                                       type === 'BIKE' ? 'SPEED STANDARDS' :
                                       type === 'ROW' ? '500M SPLIT STANDARDS' :
                                       'SCORING THRESHOLDS'}
                                    </div>
                                    <div className="grid grid-cols-1 gap-1">
                                      {details.thresholds.map((t, i) => (
                                        <div key={i} className="flex justify-between text-xs bg-gray-900 rounded px-2 py-1">
                                          <span className={
                                            t.label.includes('SF') ? 'text-yellow-400' :
                                            t.label.includes('Mar') ? 'text-green-400' :
                                            t.label.includes('Civ') ? 'text-blue-400' :
                                            'text-gray-300'
                                          }>{t.label}</span>
                                          <span className="text-gray-300">
                                            {t.pace || t.time_300m || t.split_500m || t.speed
                                              ? [t.pace, t.time_300m, t.split_500m, t.speed].filter(Boolean).join(' / ')
                                              : t.value || t.score || ''}
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {/* Strength: Lift BW ratio thresholds */}
                                {details.lift_thresholds && (
                                  <div>
                                    <div className="text-xs font-semibold text-gray-300 mb-1">BARBELL LIFT STANDARDS (1RM / Body Weight)</div>
                                    {Object.entries(details.lift_thresholds).map(([lift, entries]) => (
                                      <div key={lift} className="mb-2">
                                        <div className="text-xs text-gray-400 font-medium mb-0.5">{lift}</div>
                                        <div className="grid grid-cols-3 gap-1">
                                          {entries.filter((_, i) => [0, 2, 5, 8].includes(i)).map((e, i) => (
                                            <div key={i} className="text-[11px] bg-gray-900 rounded px-1.5 py-0.5 text-center">
                                              <span className={
                                                e.label.includes('SF') ? 'text-yellow-400' :
                                                e.label.includes('Mar') ? 'text-green-400' :
                                                'text-blue-400'
                                              }>{e.label.replace(' Exc', '').replace(' Pass', '')}</span>
                                              <span className="text-gray-400 mx-1">{e.bw_ratio}</span>
                                              {e.weight && <span className="text-gray-500">({e.weight})</span>}
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}

                                {/* Strength: Bodyweight exercise thresholds */}
                                {details.bodyweight_thresholds && (
                                  <div>
                                    <div className="text-xs font-semibold text-gray-300 mb-1">BODYWEIGHT EXERCISE STANDARDS</div>
                                    {Object.entries(details.bodyweight_thresholds).map(([exercise, entries]) => (
                                      <div key={exercise} className="mb-1.5">
                                        <div className="text-xs text-gray-400 font-medium mb-0.5">{exercise}</div>
                                        <div className="flex flex-wrap gap-1">
                                          {entries.filter((_, i) => [0, 2, 5, 8].includes(i)).map((e, i) => (
                                            <span key={i} className="text-[11px] bg-gray-900 rounded px-1.5 py-0.5">
                                              <span className={
                                                e.label.includes('SF') ? 'text-yellow-400' :
                                                e.label.includes('Mar') ? 'text-green-400' :
                                                'text-blue-400'
                                              }>{e.label.replace(' Exc', '').replace(' Pass', '')}</span>
                                              <span className="text-gray-400 ml-1">{e.reps != null ? `${e.reps} reps` : e.time}</span>
                                            </span>
                                          ))}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}

                                {/* Pack weight adjustments (RUCK) */}
                                {details.adjustments && details.adjustments.length > 0 && (
                                  <div>
                                    <div className="text-xs font-semibold text-gray-300 mb-1">
                                      {type === 'RUCK' ? 'PACK WEIGHT ADJUSTMENTS' :
                                       type === 'STRENGTH' ? 'SCORING ADJUSTMENTS' :
                                       'ADJUSTMENTS'}
                                    </div>
                                    <div className="grid grid-cols-1 gap-1">
                                      {details.adjustments.map((adj, i) => (
                                        <div key={i} className="flex justify-between text-xs bg-gray-900 rounded px-2 py-1">
                                          <span className="text-gray-400">{adj.label}{adj.condition ? `: ${adj.condition}` : ''}</span>
                                          <span className={
                                            (adj.adjustment || '').includes('+') ? 'text-green-400' :
                                            (adj.adjustment || '').includes('-') ? 'text-red-400' :
                                            'text-gray-300'
                                          }>{adj.adjustment || adj.value || ''}</span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {/* Body weight context for RUCK */}
                                {details.body_weight_context && (
                                  <div>
                                    <div className="text-xs font-semibold text-gray-300 mb-1">YOUR BODY WEIGHT CONTEXT</div>
                                    <div className="text-xs text-gray-400 mb-1">Body weight: {details.body_weight_context.body_weight}</div>
                                    <div className="grid grid-cols-1 gap-1">
                                      {Object.entries(details.body_weight_context.weight_targets).map(([label, val]) => (
                                        <div key={label} className="flex justify-between text-xs bg-gray-900 rounded px-2 py-1">
                                          <span className="text-gray-400">{label}</span>
                                          <span className="text-gray-300">{val}</span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {/* Distance scaling */}
                                {details.distance_scaling && (
                                  <div>
                                    <div className="text-xs font-semibold text-gray-300 mb-1">DISTANCE SCALING</div>
                                    <div className="text-xs text-gray-400 mb-1">Full credit: {details.distance_scaling.full_credit}</div>
                                    <div className="grid grid-cols-1 gap-1">
                                      {(details.distance_scaling.levels || []).map((l, i) => (
                                        <div key={i} className="flex justify-between text-xs bg-gray-900 rounded px-2 py-1">
                                          <span className="text-gray-400">{l.distance}</span>
                                          <span className="text-gray-300">{l.credit}</span>
                                        </div>
                                      ))}
                                    </div>
                                    {details.distance_scaling.note && (
                                      <div className="text-[11px] text-gray-500 mt-1">{details.distance_scaling.note}</div>
                                    )}
                                  </div>
                                )}

                                {/* Notes */}
                                {details.notes && details.notes.length > 0 && (
                                  <div>
                                    <div className="text-xs font-semibold text-gray-300 mb-1">NOTES</div>
                                    <ul className="text-xs text-gray-500 space-y-0.5">
                                      {details.notes.map((note, i) => (
                                        <li key={i}>• {note}</li>
                                      ))}
                                    </ul>
                                  </div>
                                )}

                                {/* Tier scale reference */}
                                {details.scale && (
                                  <div>
                                    <div className="text-xs font-semibold text-gray-300 mb-1">GRADE SCALE</div>
                                    <div className="grid grid-cols-2 gap-1">
                                      {details.scale.filter(s => !s.label.includes('Below')).map((s, i) => (
                                        <div key={i} className="flex justify-between text-[11px] bg-gray-900 rounded px-2 py-0.5">
                                          <span className={
                                            s.color === 'gold' ? 'text-yellow-400' :
                                            s.color === 'green' ? 'text-green-400' :
                                            'text-blue-400'
                                          }>{s.label}</span>
                                          <span className="text-gray-500">{s.score}</span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )
                      })}
                  </div>
                  {/* How scoring works */}
                  <div className="mt-3 text-xs text-gray-500">
                    Overall score = average of your best score in each category. Only your top performance per type counts.
                  </div>
                </div>
              )}

              {/* Recent Scored Workouts */}
              {fitnessProfile.recent_scored_workouts && fitnessProfile.recent_scored_workouts.length > 0 && (
                <div className="mt-4 pt-4 border-t border-gray-600">
                  <div className="text-xs text-gray-400 mb-2">RECENT SCORED WORKOUTS</div>
                  <div className="space-y-1">
                    {fitnessProfile.recent_scored_workouts.slice(0, 8).map((w, i) => {
                      const typeLabel = WORKOUT_TYPES.find(t => t.value === w.type)
                      return (
                        <div key={w.workout_id || i} className="flex items-center justify-between text-sm bg-gray-800 rounded px-3 py-2">
                          <div className="flex items-center gap-2">
                            <span>{typeLabel?.icon || ''}</span>
                            <span className="text-gray-300">{typeLabel?.label || w.type}</span>
                            <span className="text-xs text-gray-500">{w.date ? new Date(w.date).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }) : ''}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`px-1.5 py-0.5 rounded text-xs ${
                              w.tier === 'SF' ? 'bg-yellow-500/20 text-yellow-400' :
                              w.tier === 'MARINE' ? 'bg-green-500/20 text-green-400' :
                              'bg-blue-500/20 text-blue-400'
                            }`}>{w.tier}</span>
                            <span className={`font-medium ${
                              w.score >= 90 ? 'text-yellow-400' :
                              w.score >= 70 ? 'text-green-400' :
                              w.score >= 40 ? 'text-blue-400' :
                              'text-gray-400'
                            }`}>{Math.round(w.score)}</span>
                            {w.confidence && w.confidence !== 'HIGH' && (
                              <span className="text-xs text-yellow-600">({w.confidence})</span>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-gray-700/50 rounded-lg p-4 text-center">
              <div className="text-3xl font-bold text-blue-400">{stats.total_workouts}</div>
              <div className="text-sm text-gray-400">Workouts (30d)</div>
            </div>
            <div className="bg-gray-700/50 rounded-lg p-4 text-center">
              <div className="text-3xl font-bold text-green-400">{stats.workouts_per_week}</div>
              <div className="text-sm text-gray-400">Per Week</div>
            </div>
            <div className="bg-gray-700/50 rounded-lg p-4 text-center">
              <div className="text-3xl font-bold text-purple-400">{stats.total_distance_miles}</div>
              <div className="text-sm text-gray-400">Miles</div>
            </div>
            <div className="bg-gray-700/50 rounded-lg p-4 text-center">
              <div className="text-3xl font-bold text-orange-400">{Math.round(stats.total_duration_minutes / 60)}h</div>
              <div className="text-sm text-gray-400">Total Time</div>
            </div>
          </div>

          {/* Trend Indicator */}
          <div className="bg-gray-700/30 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <span className="text-gray-400">Trend:</span>
              {stats.trend === 'increasing' && (
                <span className="flex items-center gap-1 text-green-400">
                  <TrendingUp className="w-4 h-4" />
                  Increasing activity
                </span>
              )}
              {stats.trend === 'decreasing' && (
                <span className="flex items-center gap-1 text-red-400">
                  <TrendingDown className="w-4 h-4" />
                  Decreasing activity
                </span>
              )}
              {stats.trend === 'stable' && (
                <span className="flex items-center gap-1 text-blue-400">
                  <Minus className="w-4 h-4" />
                  Stable activity
                </span>
              )}
              <span className="text-gray-500 text-sm">
                ({stats.recent_count_7d} workouts last 7d vs {stats.previous_count_7d} previous 7d)
              </span>
            </div>
          </div>

          {/* Breakdown by Type */}
          {Object.keys(stats.by_type || {}).length > 0 && (
            <div className="bg-gray-700/30 rounded-lg p-4">
              <h4 className="font-semibold mb-3">Breakdown by Type</h4>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {Object.entries(stats.by_type).map(([type, data]) => {
                  const typeInfo = WORKOUT_TYPES.find(t => t.value === type) || { label: type, icon: '💪' }
                  return (
                    <div key={type} className="bg-gray-800 rounded p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <span>{typeInfo.icon}</span>
                        <span className="font-medium">{typeInfo.label}</span>
                      </div>
                      <div className="text-sm text-gray-400 space-y-1">
                        <div>{data.count} sessions</div>
                        {data.distance_miles > 0 && (
                          <div>{data.distance_miles.toFixed(1)} miles</div>
                        )}
                        <div>{Math.round(data.duration_minutes / 60)}h {data.duration_minutes % 60}m</div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Best Performances */}
          {Object.keys(stats.best_performances || {}).length > 0 && (
            <div className="bg-gray-700/30 rounded-lg p-4">
              <h4 className="font-semibold mb-3">Best Performances (30d)</h4>
              <div className="space-y-3">
                {Object.entries(stats.best_performances).map(([type, perf]) => {
                  const typeInfo = WORKOUT_TYPES.find(t => t.value === type) || { label: type, icon: '💪' }
                  return (
                    <div key={type} className="flex items-center justify-between bg-gray-800 rounded p-3">
                      <div className="flex items-center gap-2">
                        <span>{typeInfo.icon}</span>
                        <span className="font-medium">{typeInfo.label}</span>
                      </div>
                      <div className="text-right text-sm">
                        <div className="text-green-400 font-medium">
                          {perf.distance_miles} mi @ {formatPace(perf.pace_seconds_per_mile)}/mi
                        </div>
                        {perf.weight_carried_lbs && (
                          <div className="text-gray-400">{perf.weight_carried_lbs} lbs</div>
                        )}
                        <div className="text-gray-500 text-xs">
                          {formatDate(perf.date)}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* List View */}
      {viewMode === 'list' && (
        <div className="space-y-4">
          {workouts.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              No workouts logged yet. Start tracking your fitness!
            </div>
          ) : (
            workouts.map((workout) => {
              const typeInfo = WORKOUT_TYPES.find(t => t.value === workout.workout_type) || { label: workout.workout_type, icon: '💪' }
              return (
                <div key={workout.id} className="bg-gray-700/50 rounded-lg p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{typeInfo.icon}</span>
                      <div>
                        <div className="font-semibold">{typeInfo.label}</div>
                        <div className="text-sm text-gray-400">{formatDate(workout.workout_date)}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleStartEdit(workout)}
                        className="text-gray-500 hover:text-blue-400"
                        title="Edit workout"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(workout.id)}
                        className="text-gray-500 hover:text-red-400"
                        title="Delete workout"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                    {workout.duration_minutes && (
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-gray-400" />
                        <span>{workout.duration_minutes} min</span>
                      </div>
                    )}
                    {workout.distance_miles && (
                      <div className="flex items-center gap-2">
                        <Activity className="w-4 h-4 text-gray-400" />
                        <span>{workout.distance_miles} mi</span>
                      </div>
                    )}
                    {workout.pace_seconds_per_mile && (
                      <div className="flex items-center gap-2">
                        <Timer className="w-4 h-4 text-gray-400" />
                        <span>{formatPace(workout.pace_seconds_per_mile)}/mi</span>
                      </div>
                    )}
                    {workout.weight_carried_lbs && (
                      <div className="flex items-center gap-2">
                        <Package className="w-4 h-4 text-gray-400" />
                        <span>{workout.weight_carried_lbs} lbs</span>
                      </div>
                    )}
                    {workout.elevation_gain_ft && (
                      <div className="flex items-center gap-2">
                        <Mountain className="w-4 h-4 text-gray-400" />
                        <span>{workout.elevation_gain_ft} ft</span>
                      </div>
                    )}
                    {workout.avg_heart_rate && (
                      <div className="flex items-center gap-2">
                        <Heart className="w-4 h-4 text-gray-400" />
                        <span>{workout.avg_heart_rate} bpm</span>
                      </div>
                    )}
                    {workout.calories_burned && (
                      <div className="flex items-center gap-2">
                        <Flame className="w-4 h-4 text-gray-400" />
                        <span>{workout.calories_burned} cal</span>
                      </div>
                    )}
                    {workout.rpe && (
                      <div className="flex items-center gap-2">
                        <Activity className="w-4 h-4 text-gray-400" />
                        <span>RPE {workout.rpe}/10</span>
                      </div>
                    )}
                  </div>

                  {workout.notes && (
                    <div className="mt-2 text-sm text-gray-400 italic">
                      {workout.notes}
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
      )}

      {/* Add/Edit Workout Modal */}
      {showAddWorkout && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 w-full max-w-sm sm:max-w-lg max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold mb-4">{editingWorkout ? 'Edit Workout' : 'Log Workout'}</h3>

            <form onSubmit={editingWorkout ? handleSaveEdit : handleSubmit} className="space-y-4">
              {/* Workout Type Selection */}
              <div>
                <label className="block text-sm text-gray-400 mb-2">Workout Type *</label>
                <div className="grid grid-cols-4 gap-2">
                  {WORKOUT_TYPES.map(type => (
                    <button
                      key={type.value}
                      type="button"
                      onClick={() => {
                        setWorkoutForm({ ...workoutForm, workout_type: type.value })
                        setSelectedType(type)
                      }}
                      className={`p-2 rounded text-center ${
                        workoutForm.workout_type === type.value
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-700 hover:bg-gray-600'
                      }`}
                    >
                      <div className="text-xl">{type.icon}</div>
                      <div className="text-xs mt-1">{type.label}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Date and Duration */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Date *</label>
                  <input
                    type="date"
                    value={workoutForm.workout_date}
                    onChange={(e) => setWorkoutForm({ ...workoutForm, workout_date: e.target.value })}
                    className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Duration (minutes)</label>
                  <input
                    type="number"
                    value={workoutForm.duration_minutes}
                    onChange={(e) => setWorkoutForm({ ...workoutForm, duration_minutes: e.target.value })}
                    className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2"
                    placeholder="45"
                  />
                </div>
              </div>

              {/* Cardio-specific fields */}
              {isCardioType && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">Distance (miles)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={workoutForm.distance_miles}
                        onChange={(e) => setWorkoutForm({ ...workoutForm, distance_miles: e.target.value })}
                        className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2"
                        placeholder="3.0"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">Elevation Gain (ft)</label>
                      <input
                        type="number"
                        value={workoutForm.elevation_gain_ft}
                        onChange={(e) => setWorkoutForm({ ...workoutForm, elevation_gain_ft: e.target.value })}
                        className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2"
                        placeholder="250"
                      />
                    </div>
                  </div>

                  {isRuck && (
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">Weight Carried (lbs)</label>
                      <input
                        type="number"
                        value={workoutForm.weight_carried_lbs}
                        onChange={(e) => setWorkoutForm({ ...workoutForm, weight_carried_lbs: e.target.value })}
                        className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2"
                        placeholder="45"
                      />
                    </div>
                  )}
                </>
              )}

              {/* Heart Rate and Calories */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Avg Heart Rate (bpm)</label>
                  <input
                    type="number"
                    value={workoutForm.avg_heart_rate}
                    onChange={(e) => setWorkoutForm({ ...workoutForm, avg_heart_rate: e.target.value })}
                    className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2"
                    placeholder="145"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Calories Burned</label>
                  <input
                    type="number"
                    value={workoutForm.calories_burned}
                    onChange={(e) => setWorkoutForm({ ...workoutForm, calories_burned: e.target.value })}
                    className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2"
                    placeholder="350"
                  />
                </div>
              </div>

              {/* RPE and Quality */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">RPE (1-10)</label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={workoutForm.rpe}
                    onChange={(e) => setWorkoutForm({ ...workoutForm, rpe: e.target.value })}
                    className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2"
                    placeholder="7"
                  />
                  <p className="text-xs text-gray-500 mt-1">Rate of Perceived Exertion</p>
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Quality (1-5)</label>
                  <input
                    type="number"
                    min="1"
                    max="5"
                    value={workoutForm.quality_rating}
                    onChange={(e) => setWorkoutForm({ ...workoutForm, quality_rating: e.target.value })}
                    className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2"
                    placeholder="4"
                  />
                  <p className="text-xs text-gray-500 mt-1">How good did the workout feel?</p>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm text-gray-400 mb-1">Notes</label>
                <textarea
                  value={workoutForm.notes}
                  onChange={(e) => setWorkoutForm({ ...workoutForm, notes: e.target.value })}
                  className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2"
                  rows={3}
                  placeholder="How did it feel? Any PRs?"
                />
              </div>

              {/* Form Actions */}
              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={closeWorkoutModal}
                  className="px-4 py-2 text-gray-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || !workoutForm.workout_type}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                >
                  {submitting ? 'Saving...' : (editingWorkout ? 'Save Changes' : 'Log Workout')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}


export default MemberDossier
