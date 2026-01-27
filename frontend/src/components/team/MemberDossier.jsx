import React, { useState, useEffect } from 'react'
import {
  User, Heart, Brain, MessageSquare, Activity,
  Edit, Trash2, Phone, Mail, Calendar, AlertCircle, AlertTriangle,
  Shield, Eye, Stethoscope, ChevronDown, ChevronUp, Plus, Target, Check, X,
  ListTodo, Package
} from 'lucide-react'
import {
  getWeightHistory, logWeight, getMedicalHistory, updateMedicalStatus,
  getMentoringSessions, createMentoringSession,
  getMemberObservations, createObservation, uploadMemberPhoto, deleteMemberPhoto,
  getMemberAppointments, createMemberAppointment, updateMemberAppointment,
  deleteMemberAppointment, completeMemberAppointment,
  getVitalsHistory, getVitalsAverages, logVital, deleteVital, getVitalTypes
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

  // Load tab-specific data
  useEffect(() => {
    const loadTabData = async () => {
      // These tabs load their own data
      if (['gear', 'training', 'tasks', 'supplies'].includes(activeTab)) {
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

  // Format date
  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A'
    return new Date(dateStr).toLocaleDateString()
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
              <ReadinessIndicator status={member.overall_readiness} />
              {/* Blood Type - Prominent Display (hazy red) */}
              {member.blood_type && (
                <span className="px-3 py-1 bg-red-900/50 border border-red-600 rounded-lg text-red-300 font-bold text-sm flex items-center gap-1">
                  <Heart className="w-4 h-4" />
                  {member.blood_type}
                </span>
              )}
              {/* Anaphylaxis Allergies - Same line as name and blood type (bright red) */}
              {member.allergies && member.allergies.filter(a => typeof a === 'object' && a.anaphylaxis).map((allergy, idx) => (
                <span key={idx} className="px-2 py-1 bg-red-600 border border-red-400 rounded text-white text-xs font-bold flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  ANAPHYLAXIS: {typeof allergy === 'object' ? allergy.name : allergy}
                </span>
              ))}
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
                        <span key={idx} className="px-2 py-1 bg-blue-900/50 text-blue-300 rounded text-sm">
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
                            className={`px-2 py-1 rounded text-sm flex items-center gap-1 ${
                              isAnaphylaxis
                                ? 'bg-red-600 text-white font-bold border border-red-400'
                                : 'bg-red-900/50 text-red-300'
                            }`}
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
    return new Date(dateStr).toLocaleDateString()
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
      <div className="bg-gray-800 rounded-lg w-full max-w-md max-h-[90vh] overflow-y-auto">
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

function HealthDataTab({ member, settings, weightHistory, vitalsHistory, vitalsAverages, vitalTypes, formatWeight, formatHeight, formatDate, onUpdate }) {
  const [showAddVital, setShowAddVital] = useState(false)
  const [showAddWeight, setShowAddWeight] = useState(false)
  const [selectedType, setSelectedType] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  // Form states
  const [vitalForm, setVitalForm] = useState({
    vital_type: '',
    value: '',
    value_secondary: '',
    notes: ''
  })
  const [weightForm, setWeightForm] = useState({
    weight: '',
    notes: ''
  })

  // Calculate BMI
  const calculateBMI = (weightLbs, heightInches) => {
    if (!weightLbs || !heightInches) return null
    return ((weightLbs / (heightInches * heightInches)) * 703).toFixed(1)
  }

  const bmi = calculateBMI(member.current_weight, member.height_inches)
  const getBMICategory = (bmi) => {
    if (!bmi) return { label: 'N/A', color: 'text-gray-400' }
    const val = parseFloat(bmi)
    if (val < 18.5) return { label: 'Underweight', color: 'text-blue-400' }
    if (val < 25) return { label: 'Normal', color: 'text-green-400' }
    if (val < 30) return { label: 'Overweight', color: 'text-yellow-400' }
    return { label: 'Obese', color: 'text-red-400' }
  }
  const bmiInfo = getBMICategory(bmi)

  // Get latest vital by type
  const getLatestVital = (vitalType) => {
    return vitalsHistory.find(v => v.vital_type === vitalType)
  }

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
        notes: vitalForm.notes || null
      })
      setVitalForm({ vital_type: '', value: '', value_secondary: '', notes: '' })
      setShowAddVital(false)
      onUpdate()
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

  // Get vital history by type
  const getVitalsByType = (vitalType) => {
    return vitalsHistory.filter(v => v.vital_type === vitalType)
  }

  // Selected vital type info
  const selectedVitalType = vitalTypes.find(t => t.value === vitalForm.vital_type)

  return (
    <div className="space-y-4">
      {/* Current Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
          <div className="text-gray-400 text-sm mb-1">BMI</div>
          <div className="text-2xl font-bold">{bmi || 'N/A'}</div>
          <div className={`text-xs ${bmiInfo.color}`}>{bmiInfo.label}</div>
        </div>
        <div className="bg-gray-700 rounded-lg p-4">
          <div className="text-gray-400 text-sm mb-1">Blood Type</div>
          <div className="text-2xl font-bold text-red-400">{member.blood_type || 'N/A'}</div>
        </div>
      </div>

      {/* Latest Vitals Quick View */}
      <div className="bg-gray-700 rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold">Latest Vitals</h3>
          <button
            onClick={() => setShowAddVital(true)}
            className="text-sm text-farm-green hover:text-green-400 flex items-center gap-1"
          >
            <Plus className="w-4 h-4" /> Add Reading
          </button>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {vitalTypes.map(type => {
            const latest = getLatestVital(type.value)
            const avg = vitalsAverages?.[type.value]
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
                {avg?.count >= 1 && (
                  <div className="text-xs text-cyan-400 mt-1 p-1 bg-cyan-900/30 rounded">
                    <span className="font-medium">{avg.count > 1 ? 'Baseline:' : 'Current:'}</span>{' '}
                    {type.value === 'blood_pressure' && avg.average_secondary
                      ? `${avg.average}/${avg.average_secondary}`
                      : avg.average} {avg.unit}
                    {avg.count > 1 && <span className="text-gray-400"> (n={avg.count})</span>}
                  </div>
                )}
                {latest && (
                  <div className="text-xs text-gray-500">{formatDate(latest.recorded_at)}</div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Selected Vital History */}
      {selectedType && (
        <div className="bg-gray-700 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold">
              {vitalTypes.find(t => t.value === selectedType)?.label || selectedType} History
            </h3>
            <button
              onClick={() => setSelectedType(null)}
              className="text-sm text-gray-400 hover:text-white"
            >
              Close
            </button>
          </div>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {getVitalsByType(selectedType).length > 0 ? (
              getVitalsByType(selectedType).map(vital => (
                <div key={vital.id} className="flex items-center justify-between py-2 border-b border-gray-600 last:border-0">
                  <div className="flex items-center gap-4">
                    <span className="text-gray-400 text-sm w-24">{formatDate(vital.recorded_at)}</span>
                    <span className="font-medium">{formatVitalValue(vital)}</span>
                    {vital.notes && <span className="text-gray-400 text-sm">{vital.notes}</span>}
                  </div>
                  <button
                    onClick={() => handleDeleteVital(vital.id)}
                    className="p-1 text-gray-400 hover:text-red-400"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))
            ) : (
              <p className="text-gray-400 text-sm">No readings recorded</p>
            )}
          </div>
        </div>
      )}

      {/* Weight History */}
      <div className="bg-gray-700 rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold">Weight History</h3>
          <button
            onClick={() => setShowAddWeight(true)}
            className="text-sm text-farm-green hover:text-green-400 flex items-center gap-1"
          >
            <Plus className="w-4 h-4" /> Log Weight
          </button>
        </div>
        {weightHistory.length > 0 ? (
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {weightHistory.map(entry => (
              <div key={entry.id} className="text-sm flex items-center gap-4 py-2 border-b border-gray-600 last:border-0">
                <span className="text-gray-400 w-24">{formatDate(entry.recorded_at)}</span>
                <span className="font-medium">{formatWeight(entry.weight)}</span>
                {entry.notes && <span className="text-gray-400 flex-1">{entry.notes}</span>}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center text-gray-400 py-4">
            <Activity className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>No weight history recorded</p>
          </div>
        )}
      </div>

      {/* Add Vital Modal */}
      {showAddVital && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-lg w-full max-w-md">
            <div className="flex items-center justify-between p-4 border-b border-gray-700">
              <h3 className="font-semibold">Add Vital Reading</h3>
              <button onClick={() => setShowAddVital(false)} className="text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleAddVital} className="p-4 space-y-4">
              {error && (
                <div className="p-3 bg-red-900/50 border border-red-700 rounded text-red-200 text-sm">
                  {error}
                </div>
              )}
              <div>
                <label className="block text-sm text-gray-400 mb-1">Vital Type *</label>
                <select
                  value={vitalForm.vital_type}
                  onChange={(e) => setVitalForm({ ...vitalForm, vital_type: e.target.value, value: '', value_secondary: '' })}
                  className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2"
                  required
                >
                  <option value="">Select type...</option>
                  {vitalTypes.map(type => (
                    <option key={type.value} value={type.value}>{type.label}</option>
                  ))}
                </select>
              </div>
              {vitalForm.vital_type && (
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
                <button type="button" onClick={() => setShowAddVital(false)} className="px-4 py-2 text-gray-400 hover:text-white">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || !vitalForm.vital_type || !vitalForm.value}
                  className="px-4 py-2 bg-farm-green text-white rounded hover:bg-green-600 disabled:opacity-50"
                >
                  {submitting ? 'Saving...' : 'Save Reading'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Weight Modal */}
      {showAddWeight && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-lg w-full max-w-md">
            <div className="flex items-center justify-between p-4 border-b border-gray-700">
              <h3 className="font-semibold">Log Weight</h3>
              <button onClick={() => setShowAddWeight(false)} className="text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleAddWeight} className="p-4 space-y-4">
              {error && (
                <div className="p-3 bg-red-900/50 border border-red-700 rounded text-red-200 text-sm">
                  {error}
                </div>
              )}
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
              <div className="flex justify-end gap-3 pt-4">
                <button type="button" onClick={() => setShowAddWeight(false)} className="px-4 py-2 text-gray-400 hover:text-white">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || !weightForm.weight}
                  className="px-4 py-2 bg-farm-green text-white rounded hover:bg-green-600 disabled:opacity-50"
                >
                  {submitting ? 'Saving...' : 'Save Weight'}
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
