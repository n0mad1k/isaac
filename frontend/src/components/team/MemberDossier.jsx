import React, { useState, useEffect } from 'react'
import {
  User, Heart, Brain, MessageSquare, Activity,
  Edit, Trash2, Phone, Mail, Calendar, AlertCircle,
  Shield, Eye, Stethoscope, ChevronDown, ChevronUp, Plus
} from 'lucide-react'
import {
  getWeightHistory, logWeight, getMedicalHistory, updateMedicalStatus,
  getMentoringSessions, createMentoringSession,
  getMemberObservations, createObservation, uploadMemberPhoto, deleteMemberPhoto
} from '../../services/api'
import MemberMentoringTab from './MemberMentoringTab'
import MemberObservationsTab from './MemberObservationsTab'

function MemberDossier({ member, settings, onEdit, onDelete, onUpdate }) {
  const [activeTab, setActiveTab] = useState('profile')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  // Data states
  const [weightHistory, setWeightHistory] = useState([])
  const [medicalHistory, setMedicalHistory] = useState([])
  const [sessions, setSessions] = useState([])
  const [observations, setObservations] = useState([])

  // Load tab-specific data
  useEffect(() => {
    const loadTabData = async () => {
      setLoading(true)
      try {
        switch (activeTab) {
          case 'weight':
            const weightRes = await getWeightHistory(member.id)
            setWeightHistory(weightRes.data)
            break
          case 'medical':
            const medRes = await getMedicalHistory(member.id)
            setMedicalHistory(medRes.data)
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
    { id: 'medical', label: 'Medical', icon: Heart },
    { id: 'mentoring', label: 'Mentoring', icon: Brain },
    { id: 'observations', label: 'Observations', icon: MessageSquare },
    { id: 'weight', label: 'Weight', icon: Activity },
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
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-bold">{member.name}</h2>
              <ReadinessIndicator status={member.overall_readiness} />
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
                {/* Basic Info */}
                <div className="bg-gray-700 rounded-lg p-4">
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <User className="w-4 h-4 text-farm-green" />
                    Basic Information
                  </h3>
                  <dl className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <dt className="text-gray-400">Role</dt>
                      <dd>{member.role_title || member.role}</dd>
                    </div>
                    {member.birth_date && (
                      <div className="flex justify-between">
                        <dt className="text-gray-400">Age</dt>
                        <dd>{calculateAge(member.birth_date)} years old</dd>
                      </div>
                    )}
                    {member.join_date && (
                      <div className="flex justify-between">
                        <dt className="text-gray-400">Joined</dt>
                        <dd>{formatDate(member.join_date)}</dd>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <dt className="text-gray-400">Height</dt>
                      <dd>{formatHeight(member.height_inches)}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-gray-400">Weight</dt>
                      <dd>{formatWeight(member.current_weight)}</dd>
                    </div>
                    {member.target_weight && (
                      <div className="flex justify-between">
                        <dt className="text-gray-400">Target Weight</dt>
                        <dd>{formatWeight(member.target_weight)}</dd>
                      </div>
                    )}
                    {member.blood_type && (
                      <div className="flex justify-between">
                        <dt className="text-gray-400">Blood Type</dt>
                        <dd className="font-bold text-red-400">{member.blood_type}</dd>
                      </div>
                    )}
                  </dl>
                </div>

                {/* Sizing */}
                <div className="bg-gray-700 rounded-lg p-4">
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <Shield className="w-4 h-4 text-farm-green" />
                    Gear Sizing
                  </h3>
                  <dl className="space-y-2 text-sm">
                    {member.shoe_size && (
                      <div className="flex justify-between">
                        <dt className="text-gray-400">Shoe Size</dt>
                        <dd>{member.shoe_size}</dd>
                      </div>
                    )}
                    {member.shirt_size && (
                      <div className="flex justify-between">
                        <dt className="text-gray-400">Shirt Size</dt>
                        <dd>{member.shirt_size}</dd>
                      </div>
                    )}
                    {member.pants_size && (
                      <div className="flex justify-between">
                        <dt className="text-gray-400">Pants Size</dt>
                        <dd>{member.pants_size}</dd>
                      </div>
                    )}
                    {member.hat_size && (
                      <div className="flex justify-between">
                        <dt className="text-gray-400">Hat Size</dt>
                        <dd>{member.hat_size}</dd>
                      </div>
                    )}
                    {member.glove_size && (
                      <div className="flex justify-between">
                        <dt className="text-gray-400">Glove Size</dt>
                        <dd>{member.glove_size}</dd>
                      </div>
                    )}
                  </dl>
                </div>

                {/* Skills */}
                {member.skills && member.skills.length > 0 && (
                  <div className="bg-gray-700 rounded-lg p-4">
                    <h3 className="font-semibold mb-3">Skills</h3>
                    <div className="flex flex-wrap gap-2">
                      {member.skills.map((skill, idx) => (
                        <span key={idx} className="px-2 py-1 bg-blue-900/50 text-blue-300 rounded text-sm">
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Responsibilities */}
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

                {/* Trainings */}
                {member.trainings && member.trainings.length > 0 && (
                  <div className="bg-gray-700 rounded-lg p-4 md:col-span-2">
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

                {/* Allergies & Medical Conditions */}
                <div className="bg-gray-700 rounded-lg p-4">
                  <h3 className="font-semibold mb-3 text-red-400 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" />
                    Allergies
                  </h3>
                  {member.allergies && member.allergies.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {member.allergies.map((allergy, idx) => (
                        <span key={idx} className="px-2 py-1 bg-red-900/50 text-red-300 rounded text-sm">
                          {allergy}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-400 text-sm">No known allergies</p>
                  )}
                </div>

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

                {/* Emergency Contact */}
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

                {/* Notes */}
                {member.notes && (
                  <div className="bg-gray-700 rounded-lg p-4 md:col-span-2">
                    <h3 className="font-semibold mb-2">Notes</h3>
                    <p className="text-gray-300 whitespace-pre-wrap">{member.notes}</p>
                  </div>
                )}
              </div>
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

            {/* Weight Tab */}
            {activeTab === 'weight' && (
              <div className="space-y-4">
                {/* Current Stats */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-gray-700 rounded-lg p-4">
                    <div className="text-gray-400 text-sm mb-1">Current Weight</div>
                    <div className="text-2xl font-bold">{formatWeight(member.current_weight)}</div>
                  </div>
                  <div className="bg-gray-700 rounded-lg p-4">
                    <div className="text-gray-400 text-sm mb-1">Target Weight</div>
                    <div className="text-2xl font-bold">{formatWeight(member.target_weight)}</div>
                  </div>
                  <div className="bg-gray-700 rounded-lg p-4">
                    <div className="text-gray-400 text-sm mb-1">Height</div>
                    <div className="text-2xl font-bold">{formatHeight(member.height_inches)}</div>
                  </div>
                </div>

                {/* Weight History */}
                {weightHistory.length > 0 ? (
                  <div className="bg-gray-700 rounded-lg p-4">
                    <h3 className="font-semibold mb-3">Weight History</h3>
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {weightHistory.map(entry => (
                        <div key={entry.id} className="text-sm flex items-center gap-4 py-2 border-b border-gray-600 last:border-0">
                          <span className="text-gray-400 w-24">{formatDate(entry.recorded_at)}</span>
                          <span className="font-medium">{formatWeight(entry.weight)}</span>
                          {entry.notes && <span className="text-gray-400 flex-1">{entry.notes}</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="bg-gray-700 rounded-lg p-8 text-center text-gray-400">
                    <Activity className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>No weight history recorded</p>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default MemberDossier
