import React, { useState } from 'react'
import { X, User, Shield, Heart, Phone, Activity, Plus, Trash2 } from 'lucide-react'

function MemberForm({ member, settings, onSubmit, onClose }) {
  const isEditing = !!member

  const [formData, setFormData] = useState({
    // Identity
    name: member?.name || '',
    nickname: member?.nickname || '',
    callsign: member?.callsign || '',
    role: member?.role || 'MEMBER',
    role_title: member?.role_title || '',

    // Contact
    email: member?.email || '',
    phone: member?.phone || '',
    join_date: member?.join_date ? member.join_date.split('T')[0] : '',
    birth_date: member?.birth_date ? member.birth_date.split('T')[0] : '',

    // Physical
    height_inches: member?.height_inches || '',
    current_weight: member?.current_weight || '',
    target_weight: member?.target_weight || '',

    // Sizing
    blood_type: member?.blood_type || '',
    shoe_size: member?.shoe_size || '',
    shirt_size: member?.shirt_size || '',
    pants_size: member?.pants_size || '',
    hat_size: member?.hat_size || '',
    glove_size: member?.glove_size || '',

    // Medical
    allergies: member?.allergies || [],
    medical_conditions: member?.medical_conditions || [],
    current_medications: member?.current_medications || [],
    emergency_contact_name: member?.emergency_contact_name || '',
    emergency_contact_phone: member?.emergency_contact_phone || '',

    // Medical Readiness
    medical_readiness: member?.medical_readiness || 'GREEN',
    medical_readiness_notes: member?.medical_readiness_notes || '',
    dental_status: member?.dental_status || 'GREEN',
    last_dental_date: member?.last_dental_date ? member.last_dental_date.split('T')[0] : '',
    next_dental_due: member?.next_dental_due ? member.next_dental_due.split('T')[0] : '',
    vision_status: member?.vision_status || 'N/A',
    vision_prescription: member?.vision_prescription || '',
    last_vision_date: member?.last_vision_date ? member.last_vision_date.split('T')[0] : '',
    next_vision_due: member?.next_vision_due ? member.next_vision_due.split('T')[0] : '',
    last_physical_date: member?.last_physical_date ? member.last_physical_date.split('T')[0] : '',
    next_physical_due: member?.next_physical_due ? member.next_physical_due.split('T')[0] : '',
    physical_limitations: member?.physical_limitations || '',

    // Skills & Training
    skills: member?.skills || [],
    responsibilities: member?.responsibilities || [],
    trainings: member?.trainings || [],

    // Readiness
    overall_readiness: member?.overall_readiness || 'GREEN',
    readiness_notes: member?.readiness_notes || '',

    // Status
    is_active: member?.is_active !== false,
    notes: member?.notes || '',
  })

  const [activeSection, setActiveSection] = useState('identity')
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)

  // Temporary inputs for array fields
  const [newAllergy, setNewAllergy] = useState('')
  const [newCondition, setNewCondition] = useState('')
  const [newMedication, setNewMedication] = useState({ name: '', dosage: '', frequency: '' })
  const [newSkill, setNewSkill] = useState('')
  const [newResponsibility, setNewResponsibility] = useState('')
  const [newTraining, setNewTraining] = useState('')

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handleAddArrayItem = (field, value, setter) => {
    if (!value || (typeof value === 'string' && !value.trim())) return
    setFormData(prev => ({
      ...prev,
      [field]: [...prev[field], typeof value === 'string' ? value.trim() : value]
    }))
    setter(typeof value === 'string' ? '' : { name: '', dosage: '', frequency: '' })
  }

  const handleRemoveArrayItem = (field, index) => {
    setFormData(prev => ({
      ...prev,
      [field]: prev[field].filter((_, i) => i !== index)
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!formData.name.trim()) {
      setError('Name is required')
      return
    }

    setSaving(true)
    setError(null)

    try {
      // Format dates
      const data = { ...formData }
      const dateFields = ['join_date', 'birth_date', 'last_dental_date', 'next_dental_due',
        'last_vision_date', 'next_vision_due', 'last_physical_date', 'next_physical_due']
      dateFields.forEach(field => {
        if (data[field]) {
          data[field] = new Date(data[field]).toISOString()
        } else {
          data[field] = null
        }
      })

      // Format numbers
      const numFields = ['height_inches', 'current_weight', 'target_weight']
      numFields.forEach(field => {
        if (data[field]) {
          data[field] = parseFloat(data[field])
        } else {
          data[field] = null
        }
      })

      await onSubmit(data)
    } catch (err) {
      setError(err.userMessage || 'Failed to save member')
    } finally {
      setSaving(false)
    }
  }

  const sections = [
    { id: 'identity', label: 'Identity', icon: User },
    { id: 'contact', label: 'Contact', icon: Phone },
    { id: 'physical', label: 'Physical', icon: Activity },
    { id: 'sizing', label: 'Sizing', icon: Shield },
    { id: 'medical', label: 'Medical', icon: Heart },
    { id: 'skills', label: 'Skills', icon: Shield },
  ]

  const roles = ['LEADER', 'MEMBER', 'SUPPORT', 'TRAINEE']
  const readinessStatuses = ['GREEN', 'AMBER', 'RED']
  const visionStatuses = ['CORRECTED', 'UNCORRECTED', 'N/A']
  const bloodTypes = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']
  // Expanded shirt sizes with baby, toddler, kids, and adult
  const shirtSizes = [
    // Baby
    'NB', '0-3M', '3-6M', '6-9M', '9-12M', '12-18M', '18-24M',
    // Toddler
    '2T', '3T', '4T', '5T',
    // Kids
    '4', '5', '6', '6X', '7', '8', '10', '12', '14', '16',
    // Adult
    'XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'
  ]
  const gloveSizes = ['XS', 'S', 'M', 'L', 'XL']
  // Expanded shoe sizes
  const shoeSizeOptions = [
    // Baby (0-12 months)
    { group: 'Baby', sizes: ['0', '1', '2', '3', '4', '5'] },
    // Toddler (1-4 years)
    { group: 'Toddler', sizes: ['5T', '6T', '7T', '8T', '9T', '10T'] },
    // Kids (4-8 years)
    { group: 'Kids', sizes: ['10.5K', '11K', '12K', '13K', '1Y', '2Y', '3Y', '4Y', '5Y', '6Y'] },
    // Adult
    { group: 'Adult', sizes: ['6', '6.5', '7', '7.5', '8', '8.5', '9', '9.5', '10', '10.5', '11', '11.5', '12', '13', '14', '15'] }
  ]

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-lg w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <h2 className="text-lg font-semibold">
            {isEditing ? 'Edit Team Member' : 'Add Team Member'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Section tabs */}
        <div className="flex gap-1 p-2 border-b border-gray-700 overflow-x-auto">
          {sections.map(section => (
            <button
              key={section.id}
              onClick={() => setActiveSection(section.id)}
              className={`px-3 py-2 rounded text-sm font-medium whitespace-nowrap flex items-center gap-2 transition-colors ${
                activeSection === section.id
                  ? 'bg-farm-green text-white'
                  : 'text-gray-400 hover:text-white hover:bg-gray-700'
              }`}
            >
              <section.icon className="w-4 h-4" />
              {section.label}
            </button>
          ))}
        </div>

        {/* Form Content */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4">
          {error && (
            <div className="mb-4 p-3 bg-red-900/50 border border-red-700 rounded text-red-200 text-sm">
              {error}
            </div>
          )}

          {/* Identity Section */}
          {activeSection === 'identity' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Full Name *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={e => handleChange('name', e.target.value)}
                    className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Nickname</label>
                  <input
                    type="text"
                    value={formData.nickname}
                    onChange={e => handleChange('nickname', e.target.value)}
                    className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Callsign</label>
                  <input
                    type="text"
                    value={formData.callsign}
                    onChange={e => handleChange('callsign', e.target.value)}
                    className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Role</label>
                  <select
                    value={formData.role}
                    onChange={e => handleChange('role', e.target.value)}
                    className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white"
                  >
                    {roles.map(role => (
                      <option key={role} value={role}>{role}</option>
                    ))}
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm text-gray-400 mb-1">Role Title (custom)</label>
                  <input
                    type="text"
                    value={formData.role_title}
                    onChange={e => handleChange('role_title', e.target.value)}
                    placeholder="e.g., Farm Manager, Medic, Security Lead"
                    className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white"
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={formData.is_active}
                  onChange={e => handleChange('is_active', e.target.checked)}
                  className="rounded border-gray-600 bg-gray-700"
                />
                <label htmlFor="is_active" className="text-sm text-gray-300">Active Member</label>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Notes</label>
                <textarea
                  value={formData.notes}
                  onChange={e => handleChange('notes', e.target.value)}
                  rows={3}
                  className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white"
                />
              </div>
            </div>
          )}

          {/* Contact Section */}
          {activeSection === 'contact' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Email</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={e => handleChange('email', e.target.value)}
                    className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Phone</label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={e => handleChange('phone', e.target.value)}
                    className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Join Date</label>
                  <input
                    type="date"
                    value={formData.join_date}
                    onChange={e => handleChange('join_date', e.target.value)}
                    className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Birth Date</label>
                  <input
                    type="date"
                    value={formData.birth_date}
                    onChange={e => handleChange('birth_date', e.target.value)}
                    className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white"
                  />
                </div>
              </div>
              <div className="border-t border-gray-700 pt-4">
                <h4 className="font-medium mb-3 text-red-400">Emergency Contact</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Contact Name</label>
                    <input
                      type="text"
                      value={formData.emergency_contact_name}
                      onChange={e => handleChange('emergency_contact_name', e.target.value)}
                      className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Contact Phone</label>
                    <input
                      type="tel"
                      value={formData.emergency_contact_phone}
                      onChange={e => handleChange('emergency_contact_phone', e.target.value)}
                      className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Physical Section */}
          {activeSection === 'physical' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">
                    Height ({settings?.team_units === 'metric' ? 'cm' : 'inches'})
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={formData.height_inches}
                    onChange={e => handleChange('height_inches', e.target.value)}
                    className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">
                    Current Weight ({settings?.team_units === 'metric' ? 'kg' : 'lbs'})
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={formData.current_weight}
                    onChange={e => handleChange('current_weight', e.target.value)}
                    className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">
                    Target Weight ({settings?.team_units === 'metric' ? 'kg' : 'lbs'})
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={formData.target_weight}
                    onChange={e => handleChange('target_weight', e.target.value)}
                    className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white"
                  />
                </div>
              </div>
              <div className="border-t border-gray-700 pt-4">
                <h4 className="font-medium mb-3">Overall Readiness</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Status</label>
                    <select
                      value={formData.overall_readiness}
                      onChange={e => handleChange('overall_readiness', e.target.value)}
                      className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white"
                    >
                      {readinessStatuses.map(status => (
                        <option key={status} value={status}>{status}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Notes</label>
                    <input
                      type="text"
                      value={formData.readiness_notes}
                      onChange={e => handleChange('readiness_notes', e.target.value)}
                      className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Sizing Section */}
          {activeSection === 'sizing' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Blood Type</label>
                  <select
                    value={formData.blood_type}
                    onChange={e => handleChange('blood_type', e.target.value)}
                    className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white"
                  >
                    <option value="">Select...</option>
                    {bloodTypes.map(type => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Shoe Size</label>
                  <select
                    value={formData.shoe_size}
                    onChange={e => handleChange('shoe_size', e.target.value)}
                    className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white"
                  >
                    <option value="">Select...</option>
                    {shoeSizeOptions.map(group => (
                      <optgroup key={group.group} label={group.group}>
                        {group.sizes.map(size => (
                          <option key={size} value={size}>{size}</option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Shirt Size</label>
                  <select
                    value={formData.shirt_size}
                    onChange={e => handleChange('shirt_size', e.target.value)}
                    className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white"
                  >
                    <option value="">Select...</option>
                    {shirtSizes.map(size => (
                      <option key={size} value={size}>{size}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Pants Size</label>
                  <input
                    type="text"
                    value={formData.pants_size}
                    onChange={e => handleChange('pants_size', e.target.value)}
                    placeholder="e.g., 32x30, 34W"
                    className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Hat Size</label>
                  <input
                    type="text"
                    value={formData.hat_size}
                    onChange={e => handleChange('hat_size', e.target.value)}
                    placeholder="e.g., 7 1/4, L/XL"
                    className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Glove Size</label>
                  <select
                    value={formData.glove_size}
                    onChange={e => handleChange('glove_size', e.target.value)}
                    className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white"
                  >
                    <option value="">Select...</option>
                    {gloveSizes.map(size => (
                      <option key={size} value={size}>{size}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Medical Section */}
          {activeSection === 'medical' && (
            <div className="space-y-6">
              {/* Readiness Statuses */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Medical Readiness</label>
                  <select
                    value={formData.medical_readiness}
                    onChange={e => handleChange('medical_readiness', e.target.value)}
                    className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white"
                  >
                    {readinessStatuses.map(status => (
                      <option key={status} value={status}>{status}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Dental Status</label>
                  <select
                    value={formData.dental_status}
                    onChange={e => handleChange('dental_status', e.target.value)}
                    className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white"
                  >
                    {readinessStatuses.map(status => (
                      <option key={status} value={status}>{status}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Vision Status</label>
                  <select
                    value={formData.vision_status}
                    onChange={e => handleChange('vision_status', e.target.value)}
                    className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white"
                  >
                    {visionStatuses.map(status => (
                      <option key={status} value={status}>{status}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Dates */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Last Dental</label>
                  <input
                    type="date"
                    value={formData.last_dental_date}
                    onChange={e => handleChange('last_dental_date', e.target.value)}
                    className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Next Dental Due</label>
                  <input
                    type="date"
                    value={formData.next_dental_due}
                    onChange={e => handleChange('next_dental_due', e.target.value)}
                    className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Last Physical</label>
                  <input
                    type="date"
                    value={formData.last_physical_date}
                    onChange={e => handleChange('last_physical_date', e.target.value)}
                    className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Next Physical Due</label>
                  <input
                    type="date"
                    value={formData.next_physical_due}
                    onChange={e => handleChange('next_physical_due', e.target.value)}
                    className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white"
                  />
                </div>
              </div>

              {/* Allergies */}
              <div>
                <label className="block text-sm text-gray-400 mb-1">Allergies</label>
                <div className="flex gap-2 mb-2 items-center">
                  <input
                    type="text"
                    value={typeof newAllergy === 'object' ? newAllergy.name : newAllergy}
                    onChange={e => setNewAllergy(typeof newAllergy === 'object' ? { ...newAllergy, name: e.target.value } : e.target.value)}
                    placeholder="Add allergy..."
                    className="flex-1 bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white"
                    onKeyPress={e => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        const allergyName = typeof newAllergy === 'object' ? newAllergy.name : newAllergy
                        if (allergyName.trim()) {
                          const allergyData = typeof newAllergy === 'object' && newAllergy.anaphylaxis
                            ? { name: allergyName.trim(), anaphylaxis: true }
                            : allergyName.trim()
                          handleAddArrayItem('allergies', allergyData, () => setNewAllergy(''))
                        }
                      }
                    }}
                  />
                  <label className="flex items-center gap-1 text-xs text-red-400 whitespace-nowrap">
                    <input
                      type="checkbox"
                      checked={typeof newAllergy === 'object' && newAllergy.anaphylaxis}
                      onChange={e => setNewAllergy(prev =>
                        e.target.checked
                          ? { name: typeof prev === 'string' ? prev : prev.name, anaphylaxis: true }
                          : typeof prev === 'object' ? prev.name : prev
                      )}
                      className="rounded border-red-600 bg-red-900/50"
                    />
                    Anaphylaxis
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      const allergyName = typeof newAllergy === 'object' ? newAllergy.name : newAllergy
                      if (allergyName && allergyName.trim()) {
                        const allergyData = typeof newAllergy === 'object' && newAllergy.anaphylaxis
                          ? { name: allergyName.trim(), anaphylaxis: true }
                          : allergyName.trim()
                        handleAddArrayItem('allergies', allergyData, () => setNewAllergy(''))
                      }
                    }}
                    className="px-3 py-2 bg-gray-700 rounded hover:bg-gray-600"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {formData.allergies.map((allergy, idx) => {
                    const isObject = typeof allergy === 'object'
                    const name = isObject ? allergy.name : allergy
                    const isAnaphylaxis = isObject && allergy.anaphylaxis
                    return (
                      <span
                        key={idx}
                        className={`px-2 py-1 rounded text-sm flex items-center gap-1 ${
                          isAnaphylaxis
                            ? 'bg-red-700 text-white font-bold border border-red-500'
                            : 'bg-red-900/50 text-red-300'
                        }`}
                      >
                        {isAnaphylaxis && '⚠️ '}
                        {name}
                        {isAnaphylaxis && <span className="text-xs ml-1">(ANAPH)</span>}
                        <button
                          type="button"
                          onClick={() => {
                            // Toggle anaphylaxis status
                            setFormData(prev => ({
                              ...prev,
                              allergies: prev.allergies.map((a, i) => {
                                if (i !== idx) return a
                                const aName = typeof a === 'object' ? a.name : a
                                const aAnaph = typeof a === 'object' && a.anaphylaxis
                                return aAnaph ? aName : { name: aName, anaphylaxis: true }
                              })
                            }))
                          }}
                          className="ml-1 text-xs hover:text-yellow-300"
                          title="Toggle anaphylaxis"
                        >
                          {isAnaphylaxis ? '↓' : '↑'}
                        </button>
                        <button type="button" onClick={() => handleRemoveArrayItem('allergies', idx)}>
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    )
                  })}
                </div>
                <p className="text-xs text-gray-500 mt-1">Use the ↑↓ button to toggle anaphylaxis severity on existing allergies</p>
              </div>

              {/* Medical Conditions */}
              <div>
                <label className="block text-sm text-gray-400 mb-1">Medical Conditions</label>
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={newCondition}
                    onChange={e => setNewCondition(e.target.value)}
                    placeholder="Add condition..."
                    className="flex-1 bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white"
                    onKeyPress={e => e.key === 'Enter' && (e.preventDefault(), handleAddArrayItem('medical_conditions', newCondition, setNewCondition))}
                  />
                  <button
                    type="button"
                    onClick={() => handleAddArrayItem('medical_conditions', newCondition, setNewCondition)}
                    className="px-3 py-2 bg-gray-700 rounded hover:bg-gray-600"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {formData.medical_conditions.map((condition, idx) => (
                    <span key={idx} className="px-2 py-1 bg-orange-900/50 text-orange-300 rounded text-sm flex items-center gap-1">
                      {condition}
                      <button type="button" onClick={() => handleRemoveArrayItem('medical_conditions', idx)}>
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              </div>

              {/* Physical Limitations */}
              <div>
                <label className="block text-sm text-gray-400 mb-1">Physical Limitations</label>
                <textarea
                  value={formData.physical_limitations}
                  onChange={e => handleChange('physical_limitations', e.target.value)}
                  rows={2}
                  className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white"
                />
              </div>
            </div>
          )}

          {/* Skills Section */}
          {activeSection === 'skills' && (
            <div className="space-y-6">
              {/* Skills */}
              <div>
                <label className="block text-sm text-gray-400 mb-1">Skills</label>
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={newSkill}
                    onChange={e => setNewSkill(e.target.value)}
                    placeholder="Add skill..."
                    className="flex-1 bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white"
                    onKeyPress={e => e.key === 'Enter' && (e.preventDefault(), handleAddArrayItem('skills', newSkill, setNewSkill))}
                  />
                  <button
                    type="button"
                    onClick={() => handleAddArrayItem('skills', newSkill, setNewSkill)}
                    className="px-3 py-2 bg-gray-700 rounded hover:bg-gray-600"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {formData.skills.map((skill, idx) => (
                    <span key={idx} className="px-2 py-1 bg-blue-900/50 text-blue-300 rounded text-sm flex items-center gap-1">
                      {skill}
                      <button type="button" onClick={() => handleRemoveArrayItem('skills', idx)}>
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              </div>

              {/* Responsibilities */}
              <div>
                <label className="block text-sm text-gray-400 mb-1">Responsibilities</label>
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={newResponsibility}
                    onChange={e => setNewResponsibility(e.target.value)}
                    placeholder="Add responsibility..."
                    className="flex-1 bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white"
                    onKeyPress={e => e.key === 'Enter' && (e.preventDefault(), handleAddArrayItem('responsibilities', newResponsibility, setNewResponsibility))}
                  />
                  <button
                    type="button"
                    onClick={() => handleAddArrayItem('responsibilities', newResponsibility, setNewResponsibility)}
                    className="px-3 py-2 bg-gray-700 rounded hover:bg-gray-600"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {formData.responsibilities.map((resp, idx) => (
                    <span key={idx} className="px-2 py-1 bg-purple-900/50 text-purple-300 rounded text-sm flex items-center gap-1">
                      {resp}
                      <button type="button" onClick={() => handleRemoveArrayItem('responsibilities', idx)}>
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              </div>

              {/* Trainings */}
              <div>
                <label className="block text-sm text-gray-400 mb-1">Completed Training / Qualifications</label>
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={newTraining}
                    onChange={e => setNewTraining(e.target.value)}
                    placeholder="Add training..."
                    className="flex-1 bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white"
                    onKeyPress={e => e.key === 'Enter' && (e.preventDefault(), handleAddArrayItem('trainings', newTraining, setNewTraining))}
                  />
                  <button
                    type="button"
                    onClick={() => handleAddArrayItem('trainings', newTraining, setNewTraining)}
                    className="px-3 py-2 bg-gray-700 rounded hover:bg-gray-600"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {formData.trainings.map((training, idx) => (
                    <span key={idx} className="px-2 py-1 bg-green-900/50 text-green-300 rounded text-sm flex items-center gap-1">
                      {training}
                      <button type="button" onClick={() => handleRemoveArrayItem('trainings', idx)}>
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}
        </form>

        {/* Footer */}
        <div className="flex justify-end gap-3 p-4 border-t border-gray-700">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-gray-400 hover:text-white"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="px-4 py-2 bg-farm-green text-white rounded hover:bg-green-600 disabled:opacity-50"
          >
            {saving ? 'Saving...' : isEditing ? 'Save Changes' : 'Add Member'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default MemberForm
