import { useState, useEffect, useMemo } from 'react'
import api from '../services/api'
import { useAuth } from '../context/AuthContext'
import {
  Syringe, Search, AlertTriangle, CheckCircle, Clock,
  User, Calendar, Plus, X
} from 'lucide-react'

export default function Vaccinations() {
  const { isDoctor, isAdmin } = useAuth()
  const [overduePatients, setOverduePatients] = useState([])
  const [vaccines, setVaccines] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchPatient, setSearchPatient] = useState('')
  const [selectedPatient, setSelectedPatient] = useState(null)
  const [patientVaccinations, setPatientVaccinations] = useState(null)
  const [showModal, setShowModal] = useState(false)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      const [overdueRes, vaccinesRes] = await Promise.all([
        api.get('/vaccinations/overdue'),
        api.get('/vaccinations/catalog')
      ])
      setOverduePatients(overdueRes.data)
      setVaccines(vaccinesRes.data)
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }

  const searchPatientVaccinations = async (patientId) => {
    try {
      const response = await api.get(`/vaccinations/patient/${patientId}`)
      setPatientVaccinations(response.data)
      setSelectedPatient(patientId)
    } catch (error) {
      console.error('Error fetching patient vaccinations:', error)
    }
  }

  const groupedVaccinations = useMemo(() => {
    if (!patientVaccinations) return []

    const map = new Map()

    const addToMap = (vac, ageMonths) => {
      const key = ageMonths === 0 ? 'Al nacer' : (ageMonths === 1 ? '1 Mes' : `${ageMonths} Meses`)
      if (!map.has(ageMonths)) {
        map.set(ageMonths, { label: key, age: ageMonths, items: [] })
      }
      map.get(ageMonths).items.push(vac)
    }

    if (patientVaccinations.pending) {
      patientVaccinations.pending.forEach(v => addToMap({ ...v, renderStatus: 'pending' }, v.dueAgeMonths))
    }
    if (patientVaccinations.expired) {
      patientVaccinations.expired.forEach(v => addToMap({ ...v, renderStatus: 'expired' }, v.dueAgeMonths))
    }
    if (patientVaccinations.upcoming) {
      patientVaccinations.upcoming.forEach(v => addToMap({ ...v, renderStatus: 'upcoming' }, v.nextDueAgeMonths))
    }

    return Array.from(map.values()).sort((a, b) => a.age - b.age)
  }, [patientVaccinations])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Control de Vacunación</h1>
          <p className="text-gray-500 dark:text-gray-400">Esquema nacional de vacunación pediátrica</p>
        </div>
        {(isDoctor || isAdmin) && (
          <button
            onClick={() => setShowModal(true)}
            className="btn-primary flex items-center gap-2"
          >
            <Plus className="h-5 w-5" />
            Registrar Vacuna
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Overdue Patients */}
        <div className="lg:col-span-2 space-y-4">
          <div className="card">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-red-500" />
                Pacientes con Vacunas Pendientes ({overduePatients.length})
              </h2>
            </div>
            {overduePatients.length > 0 ? (
              <div className="divide-y divide-gray-200 dark:divide-gray-700">
                {overduePatients.map((patient) => (
                  <div
                    key={patient.id}
                    className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer"
                    onClick={() => searchPatientVaccinations(patient.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">
                          {patient.firstName} {patient.lastName}
                        </p>
                        <p className="text-sm text-gray-500">
                          {patient.ageMonths} meses
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-red-600 dark:text-red-400">
                          {patient.pendingVaccines?.length} vacuna(s) pendiente(s)
                        </p>
                        <div className="flex flex-wrap gap-1 mt-1 justify-end">
                          {patient.pendingVaccines?.slice(0, 3).map((v, i) => (
                            <span key={i} className="badge badge-danger text-xs">{v}</span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center text-gray-500">
                <CheckCircle className="h-12 w-12 mx-auto mb-2 text-green-500" />
                <p>Todos los pacientes tienen sus vacunas al día</p>
              </div>
            )}
          </div>

          {/* Selected Patient Vaccination Record */}
          {patientVaccinations && (
            <div className="card p-6 space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Carné de Vacunación
                  </h3>
                  <p className="text-gray-500">
                    {patientVaccinations.patient?.firstName} {patientVaccinations.patient?.lastName} • 
                    {patientVaccinations.patient?.ageMonths} meses
                  </p>
                </div>
                <button
                  onClick={() => {
                    setPatientVaccinations(null)
                    setSelectedPatient(null)
                  }}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                >
                  <X className="h-5 w-5 text-gray-500" />
                </button>
              </div>

              {/* Applied */}
              <div>
                <h4 className="font-medium text-green-700 dark:text-green-400 mb-3 flex items-center gap-2">
                  <CheckCircle className="h-5 w-5" />
                  Vacunas Aplicadas ({patientVaccinations.applied?.length || 0})
                </h4>
                {patientVaccinations.applied?.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {patientVaccinations.applied.map((vac) => (
                      <div key={vac.id} className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                        <p className="font-medium text-gray-900 dark:text-white">{vac.vaccineName}</p>
                        <p className="text-sm text-gray-500">
                          {new Date(vac.administrationDate).toLocaleDateString('es-ES')}
                        </p>
                        {vac.lotNumber && (
                          <p className="text-xs text-gray-400">Lote: {vac.lotNumber}</p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 text-sm">Sin vacunas registradas</p>
                )}
              </div>

              {/* Timeline Grouped */}
              {groupedVaccinations.length > 0 && (
                <div className="mt-8 space-y-6">
                  <h4 className="font-medium text-gray-900 dark:text-white flex items-center gap-2 border-b border-gray-200 dark:border-gray-700 pb-2">
                    <Clock className="h-5 w-5 text-primary-500" />
                    Línea de Tiempo de Vacunación
                  </h4>
                  
                  <div className="relative border-l-2 border-gray-200 dark:border-gray-700 ml-3 space-y-8">
                    {groupedVaccinations.map((group) => (
                      <div key={group.age} className="relative pl-6">
                        {/* Timeline dot */}
                        <div className="absolute w-4 h-4 rounded-full bg-white dark:bg-gray-800 border-2 border-primary-500 left-[-9px] top-1.5" />
                        
                        <h5 className="font-bold text-gray-900 dark:text-white mb-3">
                          {group.label}
                        </h5>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {group.items.map((vac) => {
                            let bgClass = "bg-gray-50 dark:bg-gray-800/50"
                            let textClass = "text-gray-900 dark:text-white"
                            let statusTextClass = "text-gray-500"
                            let statusText = "Desconocido"
                            let icon = null

                            if (vac.renderStatus === 'pending') {
                              bgClass = "bg-rose-50 dark:bg-rose-900/20 ring-1 ring-rose-500/30"
                              statusTextClass = "text-rose-600 font-medium"
                              statusText = "Atrasada / Pendiente"
                              icon = <AlertTriangle className="h-4 w-4 text-rose-500" />
                            } else if (vac.renderStatus === 'expired') {
                              bgClass = "bg-slate-100 dark:bg-slate-800 opacity-60"
                              textClass = "text-slate-500 line-through decoration-slate-400"
                              statusTextClass = "text-slate-500 font-medium"
                              statusText = `Caducada (máx ${vac.maxAgeMonths || '?' } meses)`
                              icon = <X className="h-4 w-4 text-slate-500" />
                            } else if (vac.renderStatus === 'upcoming') {
                              bgClass = "bg-blue-50 dark:bg-blue-900/20"
                              statusTextClass = "text-blue-600 font-medium"
                              statusText = "Próxima"
                              icon = <Clock className="h-4 w-4 text-blue-500" />
                            }

                            return (
                              <div key={vac.id} className={`p-4 rounded-xl ${bgClass} transition-all`}>
                                <div className="flex justify-between items-start mb-1">
                                  <p className={`font-semibold ${textClass}`}>{vac.name}</p>
                                  {icon && <div className="mt-0.5">{icon}</div>}
                                </div>
                                <p className={`text-xs uppercase tracking-wider ${statusTextClass}`}>
                                  {statusText}
                                </p>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Vaccine Catalog */}
        <div className="card">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <Syringe className="h-5 w-5 text-primary-600" />
              Esquema de Vacunación
            </h2>
          </div>
          <div className="divide-y divide-gray-200 dark:divide-gray-700 max-h-[600px] overflow-y-auto">
            {vaccines.map((vaccine) => (
              <div key={vaccine.id} className="p-4">
                <p className="font-medium text-gray-900 dark:text-white">
                  {vaccine.name}
                </p>
                <p className="text-sm text-gray-500">{vaccine.abbreviation}</p>
                <div className="flex flex-wrap gap-1 mt-2 items-center">
                  <span className="text-xs text-gray-500 mr-1">Aplica:</span>
                  {vaccine.recommendedAgesMonths?.map((age, i) => (
                    <span key={i} className="badge badge-info text-xs">
                      {age === 0 ? 'Al nacer' : `${age}m`}
                    </span>
                  ))}
                  {vaccine.maxApplicationAgeMonths && (
                    <span className="badge bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 text-xs ml-1 border border-slate-200 dark:border-slate-700">
                      Límite: {vaccine.maxApplicationAgeMonths}m
                    </span>
                  )}
                </div>
                {vaccine.diseasePrevented?.length > 0 && (
                  <p className="text-xs text-gray-400 mt-2">
                    Previene: {vaccine.diseasePrevented.join(', ')}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Record Vaccination Modal */}
      {showModal && (
        <RecordVaccinationModal
          vaccines={vaccines}
          onClose={() => setShowModal(false)}
          onSuccess={() => {
            setShowModal(false)
            fetchData()
            if (selectedPatient) {
              searchPatientVaccinations(selectedPatient)
            }
          }}
        />
      )}
    </div>
  )
}

function RecordVaccinationModal({ vaccines, onClose, onSuccess }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [patients, setPatients] = useState([])
  const [searchTerm, setSearchTerm] = useState('')
  const [formData, setFormData] = useState({
    patientId: '',
    vaccineId: '',
    administrationDate: new Date().toISOString().split('T')[0],
    lotNumber: '',
    manufacturer: '',
    site: ''
  })

  useEffect(() => {
    if (searchTerm.length >= 2) {
      searchPatients()
    }
  }, [searchTerm])

  const searchPatients = async () => {
    try {
      const response = await api.get('/patients', { params: { search: searchTerm, limit: 10 } })
      setPatients(response.data)
    } catch (error) {
      console.error('Error searching patients:', error)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      await api.post('/vaccinations', formData)
      onSuccess()
    } catch (err) {
      setError(err.response?.data?.error || 'Error al registrar vacuna')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-lg">
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Registrar Vacunación</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-lg text-sm">
              {error}
            </div>
          )}

          {/* Patient Search */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Paciente *
            </label>
            {formData.patientId ? (
              <div className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <User className="h-5 w-5 text-gray-400" />
                <span className="flex-1">
                  {patients.find(p => p.id === formData.patientId)?.firstName}{' '}
                  {patients.find(p => p.id === formData.patientId)?.lastName}
                </span>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, patientId: '' })}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <div className="relative">
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Buscar paciente..."
                  className="input-field"
                />
                {patients.length > 0 && searchTerm.length >= 2 && (
                  <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    {patients.map((patient) => (
                      <button
                        key={patient.id}
                        type="button"
                        onClick={() => {
                          setFormData({ ...formData, patientId: patient.id })
                          setSearchTerm('')
                        }}
                        className="w-full px-4 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-700"
                      >
                        <p className="font-medium">{patient.firstName} {patient.lastName}</p>
                        <p className="text-sm text-gray-500">{patient.medicalRecordNumber}</p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Vaccine */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Vacuna *
            </label>
            <select
              required
              value={formData.vaccineId}
              onChange={(e) => setFormData({ ...formData, vaccineId: e.target.value })}
              className="input-field"
            >
              <option value="">Seleccionar vacuna</option>
              {vaccines.map((vac) => (
                <option key={vac.id} value={vac.id}>
                  {vac.name} ({vac.abbreviation})
                </option>
              ))}
            </select>
          </div>

          {/* Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Fecha de Aplicación *
            </label>
            <input
              type="date"
              required
              value={formData.administrationDate}
              onChange={(e) => setFormData({ ...formData, administrationDate: e.target.value })}
              className="input-field"
            />
          </div>

          {/* Lot and Manufacturer */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Número de Lote
              </label>
              <input
                type="text"
                value={formData.lotNumber}
                onChange={(e) => setFormData({ ...formData, lotNumber: e.target.value })}
                className="input-field"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Fabricante
              </label>
              <input
                type="text"
                value={formData.manufacturer}
                onChange={(e) => setFormData({ ...formData, manufacturer: e.target.value })}
                className="input-field"
              />
            </div>
          </div>

          {/* Site */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Sitio de Aplicación
            </label>
            <select
              value={formData.site}
              onChange={(e) => setFormData({ ...formData, site: e.target.value })}
              className="input-field"
            >
              <option value="">Seleccionar</option>
              <option value="brazo_izquierdo">Brazo izquierdo</option>
              <option value="brazo_derecho">Brazo derecho</option>
              <option value="muslo_izquierdo">Muslo izquierdo</option>
              <option value="muslo_derecho">Muslo derecho</option>
              <option value="gluteo">Glúteo</option>
            </select>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            <button type="button" onClick={onClose} className="btn-secondary">
              Cancelar
            </button>
            <button type="submit" disabled={loading || !formData.patientId} className="btn-primary">
              {loading ? 'Guardando...' : 'Registrar Vacuna'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
