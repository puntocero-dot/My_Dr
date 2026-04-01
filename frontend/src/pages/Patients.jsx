import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import api from '../services/api'
import {
  Search, Plus, Filter, ChevronRight, User, Calendar,
  AlertTriangle, Phone, X, Briefcase
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useProject } from '../context/ProjectContext'

export default function Patients() {
  const { user, isAdmin } = useAuth()
  const { activeProject } = useProject()
  const [patients, setPatients] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  
  // Local sub-filters (for when in global view or to filter by doctor)
  const [doctors, setDoctors] = useState([])
  const [clinicId, setClinicId] = useState('')
  const [doctorId, setDoctorId] = useState('')

  // Sync with Global Project
  useEffect(() => {
    if (activeProject) {
      setClinicId(activeProject.id)
    } else {
      setClinicId('')
    }
  }, [activeProject])

  useEffect(() => {
    fetchPatients()
    if (isAdmin) {
      fetchClinicsAndDoctors()
    }
  }, [clinicId, doctorId])

  const fetchClinicsAndDoctors = async () => {
    try {
      const doctorsRes = await api.get('/users/role/doctors', {
        params: { clinicId: clinicId || activeProject?.id }
      })
      setDoctors(doctorsRes.data)
    } catch (error) {
      console.error('Error fetching filters:', error)
    }
  }

  const fetchPatients = async () => {
    try {
      setLoading(true)
      const params = { search }
      if (clinicId) params.clinicId = clinicId
      if (doctorId) params.doctorId = doctorId
      
      const response = await api.get('/patients', { params })
      setPatients(response.data)
    } catch (error) {
      console.error('Error fetching patients:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = (e) => {
    e.preventDefault()
    setLoading(true)
    fetchPatients()
  }

  const calculateAge = (dob) => {
    const birth = new Date(dob)
    const now = new Date()
    const years = now.getFullYear() - birth.getFullYear()
    const months = now.getMonth() - birth.getMonth()
    
    if (years < 1) {
      const totalMonths = years * 12 + months
      return `${totalMonths} meses`
    }
    return `${years} años`
  }

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
        <div>
          <h1 className="text-4xl font-extrabold text-brand-dark dark:text-white tracking-tight">
            Pacientes
          </h1>
          <p className="text-brand-muted font-medium mt-1">Gestión avanzada de expedientes pediátricos</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="btn-primary flex items-center gap-2 group whitespace-nowrap"
        >
          <div className="p-1 bg-white/20 rounded-md group-hover:rotate-90 transition-transform">
            <Plus className="h-4 w-4" />
          </div>
          Nuevo Registro
        </button>
      </div>

      {/* Search & Filters */}
      <form onSubmit={handleSearch} className="flex flex-col gap-4 p-2 glass-card rounded-2xl">
        <div className="flex gap-4 w-full">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-brand-muted" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nombre, expediente o representante..."
              className="w-full bg-transparent border-none focus:ring-0 pl-12 py-4 text-brand-dark dark:text-white font-medium placeholder:text-slate-400"
            />
          </div>
          <button type="submit" className="btn-primary py-3 px-8 rounded-xl hidden md:block shrink-0">
            Buscar
          </button>
        </div>        {isAdmin && !activeProject && (
          <div className="flex flex-wrap items-center gap-4 px-4 pb-4 pt-2 border-t border-white/5">
            <div className="flex items-center gap-2 text-brand-muted text-sm font-bold w-full sm:w-auto">
              <Filter className="h-4 w-4" />
              <span>Filtrar por Médico:</span>
            </div>
            
            <select
              value={doctorId}
              onChange={(e) => setDoctorId(e.target.value)}
              className="input-field max-w-[200px] text-sm py-2 bg-white/50 dark:bg-black/20"
            >
              <option value="">Todos los Doctores</option>
              {doctors.map(d => (
                <option key={d.doctorId} value={d.doctorId}>
                  Dr. {d.firstName} {d.lastName}
                </option>
              ))}
            </select>
          </div>
        )}

        {isAdmin && activeProject && (
           <div className="flex flex-wrap items-center gap-4 px-4 pb-4 pt-2 border-t border-white/5">
             <div className="flex items-center gap-2 text-brand-muted text-sm font-bold">
               <Briefcase className="h-4 w-4" />
               <span>Proyecto: <span className="text-brand-accent">{activeProject.name}</span></span>
             </div>
             <select
               value={doctorId}
               onChange={(e) => setDoctorId(e.target.value)}
               className="input-field max-w-[200px] text-sm py-2 bg-white/50 dark:bg-black/20"
             >
               <option value="">Todos los Doctores del Proyecto</option>
               {doctors.map(d => (
                 <option key={d.doctorId} value={d.doctorId}>
                   Dr. {d.firstName} {d.lastName}
                 </option>
               ))}
             </select>
           </div>
        )}
      </form>

      {/* Patients List */}
      {loading ? (
        <div className="flex flex-col items-center justify-center h-80 gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-brand-accent/20 border-t-brand-accent"></div>
          <p className="text-brand-muted font-bold animate-pulse">Cargando expedientes...</p>
        </div>
      ) : patients.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 stagger-items">
          {patients.map((patient) => (
            <Link
              key={patient.id}
              to={`/patients/${patient.id}`}
              className="glass-card glass-card-hover p-6 group flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between mb-4">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-slate-100 to-slate-50 dark:from-white/10 dark:to-white/5 border border-white/20 flex items-center justify-center shadow-inner group-hover:scale-110 transition-transform duration-500">
                    <User className="h-7 w-7 text-brand-accent" />
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="text-[10px] font-black text-brand-muted uppercase tracking-widest mb-1">Registro</span>
                    <span className="text-xs font-bold text-brand-dark dark:text-white bg-slate-100 dark:bg-white/10 px-2 py-1 rounded-md">
                      #{patient.medicalRecordNumber}
                    </span>
                  </div>
                </div>

                <div className="space-y-1">
                  <h3 className="text-lg font-black text-brand-dark dark:text-white truncate group-hover:text-brand-accent transition-colors">
                    {patient.firstName} {patient.lastName}
                  </h3>
                  <div className="flex items-center gap-2 text-brand-muted font-semibold text-sm">
                    <Calendar className="h-4 w-4" />
                    {calculateAge(patient.dateOfBirth)}
                    <span className="mx-1 opacity-20">•</span>
                    <span className={patient.gender === 'male' ? 'text-blue-500' : 'text-pink-500'}>
                      {patient.gender === 'male' ? 'Niño' : 'Niña'}
                    </span>
                  </div>
                </div>

                {patient.allergies?.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-white/10 flex flex-wrap gap-2">
                    {patient.allergies.slice(0, 2).map((allergy, i) => (
                      <span key={i} className="px-2 py-1 bg-rose-500/10 text-rose-500 text-[10px] font-black uppercase tracking-tight rounded-md border border-rose-500/20">
                        {allergy}
                      </span>
                    ))}
                    {patient.allergies.length > 2 && (
                      <span className="px-2 py-1 bg-slate-100 dark:bg-white/10 text-brand-muted text-[10px] font-black rounded-md">
                        +{patient.allergies.length - 2}
                      </span>
                    )}
                  </div>
                )}
              </div>

              <div className="mt-6 flex items-center justify-between opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                <span className="text-xs font-bold text-brand-accent">Ver expediente completo</span>
                <ChevronRight className="h-4 w-4 text-brand-accent translate-x-0 group-hover:translate-x-1 transition-transform" />
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="glass-card p-20 text-center animate-float">
          <div className="w-24 h-24 bg-slate-100 dark:bg-white/5 rounded-full flex items-center justify-center mx-auto mb-8">
            <User className="h-12 w-12 text-slate-300" />
          </div>
          <h3 className="text-2xl font-black text-brand-dark dark:text-white mb-3">
            Sin pacientes registrados
          </h3>
          <p className="text-brand-muted font-medium mb-10 max-w-sm mx-auto">
            {search ? 'No encontramos coincidencias para tu búsqueda. Intenta con otros términos.' : 'Tu clínica aún no tiene expedientes. Comienza creando el primero ahora mismo.'}
          </p>
          <button onClick={() => setShowModal(true)} className="btn-primary py-4 px-10 rounded-2xl mx-auto flex items-center gap-3">
            <Plus className="h-5 w-5" />
            Empezar Ahora
          </button>
        </div>
      )}

      {/* New Patient Modal */}
      {showModal && (
        <NewPatientModal onClose={() => setShowModal(false)} onSuccess={() => {
          setShowModal(false)
          fetchPatients()
        }} />
      )}
    </div>
  )
}
function NewPatientModal({ onClose, onSuccess }) {
  const { user } = useAuth()
  const { activeProject } = useProject()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    dateOfBirth: '',
    gender: 'male',
    bloodType: 'unknown',
    birthWeightGrams: '',
    birthHeightCm: '',
    allergies: '',
    insuranceProvider: '',
    insurancePolicyNumber: '',
    doctorId: ''
  })
  const [doctors, setDoctors] = useState([])

  useEffect(() => {
    if (user?.role !== 'doctor') {
      fetchDoctors()
    }
  }, [user])

  const fetchDoctors = async () => {
    try {
      const response = await api.get('/users/role/doctors')
      setDoctors(response.data)
    } catch (error) {
      console.error('Error fetching doctors:', error)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const data = {
        ...formData,
        clinicId: activeProject?.id,
        birthWeightGrams: formData.birthWeightGrams ? parseInt(formData.birthWeightGrams) : null,
        birthHeightCm: formData.birthHeightCm ? parseFloat(formData.birthHeightCm) : null,
        gestationalWeeks: formData.gestationalWeeks ? parseInt(formData.gestationalWeeks) : null,
        allergies: formData.allergies ? formData.allergies.split(',').map(a => a.trim()) : []
      }
      await api.post('/patients', data)
      onSuccess()
    } catch (err) {
      setError(err.response?.data?.error || 'Error al crear paciente')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-brand-dark/40 backdrop-blur-md flex items-center justify-center z-[100] p-4 animate-in fade-in duration-300">
      <div className="glass-card shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col animate-in zoom-in-95 duration-500">
        <div className="flex items-center justify-between p-8 border-b border-white/10">
          <div>
            <h2 className="text-2xl font-black text-brand-dark dark:text-white">Nuevo Paciente</h2>
            <p className="text-sm font-medium text-brand-muted">Ingresa los datos del nuevo expediente pediátrico</p>
          </div>
          <button onClick={onClose} className="p-3 hover:bg-slate-100 dark:hover:bg-white/5 rounded-2xl transition-colors">
            <X className="h-6 w-6 text-brand-muted" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-8 overflow-y-auto custom-scrollbar flex-1 max-h-[calc(90vh-10rem)]">
          {error && (
            <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-500 rounded-2xl text-sm font-bold flex items-center gap-3">
              <AlertTriangle className="h-5 w-5" />
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-2">
              <label className="text-xs font-black text-brand-muted uppercase tracking-widest ml-1">Nombre del Infante</label>
              <input
                type="text"
                required
                placeholder="Ej. Juan Andrés"
                value={formData.firstName}
                onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                className="input-field"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-black text-brand-muted uppercase tracking-widest ml-1">Apellidos</label>
              <input
                type="text"
                required
                placeholder="Ej. Pérez García"
                value={formData.lastName}
                onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                className="input-field"
              />
            </div>
          </div>

          {user?.role !== 'doctor' && (
            <div className="space-y-2">
              <label className="text-xs font-black text-brand-muted uppercase tracking-widest ml-1">Médico Tratante</label>
              <select
                value={formData.doctorId}
                onChange={(e) => setFormData({ ...formData, doctorId: e.target.value })}
                className="input-field cursor-pointer"
                required={user?.role === 'secretary'}
              >
                <option value="">Seleccionar Médico</option>
                {doctors.map(doc => (
                  <option key={doc.doctorId} value={doc.doctorId}>
                    Dra./Dr. {doc.firstName} {doc.lastName} - {doc.specialty}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
            <div className="space-y-2">
              <label className="text-xs font-black text-brand-muted uppercase tracking-widest ml-1">Fecha Nacimiento</label>
              <input
                type="date"
                required
                value={formData.dateOfBirth}
                onChange={(e) => setFormData({ ...formData, dateOfBirth: e.target.value })}
                className="input-field"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-black text-brand-muted uppercase tracking-widest ml-1">Género</label>
              <select
                value={formData.gender}
                onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                className="input-field cursor-pointer"
              >
                <option value="male">Masculino</option>
                <option value="female">Femenino</option>
                <option value="other">Otro</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-black text-brand-muted uppercase tracking-widest ml-1">RH / Sangre</label>
              <select
                value={formData.bloodType}
                onChange={(e) => setFormData({ ...formData, bloodType: e.target.value })}
                className="input-field cursor-pointer"
              >
                <option value="unknown">Desconocido</option>
                <option value="A+">A+</option>
                <option value="A-">A-</option>
                <option value="B+">B+</option>
                <option value="B-">B-</option>
                <option value="AB+">AB+</option>
                <option value="AB-">AB-</option>
                <option value="O+">O+</option>
                <option value="O-">O-</option>
              </select>
            </div>
          </div>

          <div className="bg-slate-50 dark:bg-white/5 p-6 rounded-[2rem] border border-white/10">
            <h3 className="text-xs font-black text-brand-dark dark:text-brand-accent uppercase tracking-widest mb-6 px-1">Antecedentes de Nacimiento</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-brand-muted uppercase tracking-wider ml-1">Peso (g)</label>
                <input
                  type="number"
                  value={formData.birthWeightGrams}
                  onChange={(e) => setFormData({ ...formData, birthWeightGrams: e.target.value })}
                  className="input-field bg-white dark:bg-brand-dark/50"
                  placeholder="3200"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-brand-muted uppercase tracking-wider ml-1">Talla (cm)</label>
                <input
                  type="number"
                  step="0.1"
                  value={formData.birthHeightCm}
                  onChange={(e) => setFormData({ ...formData, birthHeightCm: e.target.value })}
                  className="input-field bg-white dark:bg-brand-dark/50"
                  placeholder="50"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-brand-muted uppercase tracking-wider ml-1">Semanas</label>
                <input
                  type="number"
                  value={formData.gestationalWeeks}
                  onChange={(e) => setFormData({ ...formData, gestationalWeeks: e.target.value })}
                  className="input-field bg-white dark:bg-brand-dark/50"
                  placeholder="40"
                />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-black text-brand-muted uppercase tracking-widest ml-1">Alergias Conocidas</label>
            <textarea
              rows="2"
              value={formData.allergies}
              onChange={(e) => setFormData({ ...formData, allergies: e.target.value })}
              className="input-field py-3 resize-none"
              placeholder="Ej. Penicilina, Proteína de leche, etc. (separados por coma)"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-2">
              <label className="text-xs font-black text-brand-muted uppercase tracking-widest ml-1">Aseguradora</label>
              <input
                type="text"
                value={formData.insuranceProvider}
                onChange={(e) => setFormData({ ...formData, insuranceProvider: e.target.value })}
                className="input-field"
                placeholder="Ej. ASESUISA"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-black text-brand-muted uppercase tracking-widest ml-1">Nº Póliza</label>
              <input
                type="text"
                value={formData.insurancePolicyNumber}
                onChange={(e) => setFormData({ ...formData, insurancePolicyNumber: e.target.value })}
                className="input-field"
                placeholder="Ej. POL-123456"
              />
            </div>
          </div>
        </form>

        <div className="p-8 border-t border-white/10 bg-slate-50/50 dark:bg-black/10 flex justify-end gap-4">
          <button type="button" onClick={onClose} className="px-8 py-3.5 text-brand-muted font-bold hover:text-brand-dark dark:hover:text-white transition-colors">
            Descartar
          </button>
          <button 
            onClick={handleSubmit}
            disabled={loading} 
            className="btn-primary px-10 py-3.5 rounded-2xl shadow-lg shadow-brand-accent/20"
          >
            {loading ? (
              <div className="flex items-center gap-2">
                <div className="animate-spin h-4 w-4 border-2 border-white/30 border-t-white rounded-full" />
                <span>Guardando...</span>
              </div>
            ) : 'Crear Expediente'}
          </button>
        </div>
      </div>
    </div>
  )
}
