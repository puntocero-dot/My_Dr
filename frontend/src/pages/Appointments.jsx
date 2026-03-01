import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import api from '../services/api'
import { useAuth } from '../context/AuthContext'
import {
  Calendar, Clock, Plus, ChevronLeft, ChevronRight, X,
  User, Phone, CheckCircle, XCircle, Play, AlertCircle
} from 'lucide-react'

export default function Appointments() {
  const { isDoctor, isSecretary, isAdmin } = useAuth()
  const [appointments, setAppointments] = useState([])
  const [doctors, setDoctors] = useState([])
  const [patients, setPatients] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
  const [showModal, setShowModal] = useState(false)
  const [selectedDoctor, setSelectedDoctor] = useState('')

  useEffect(() => {
    fetchAppointments()
    fetchDoctors()
  }, [selectedDate, selectedDoctor])

  const fetchAppointments = async () => {
    try {
      const params = { date: selectedDate }
      if (selectedDoctor) params.doctorId = selectedDoctor
      const response = await api.get('/appointments', { params })
      setAppointments(response.data)
    } catch (error) {
      console.error('Error fetching appointments:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchDoctors = async () => {
    try {
      const response = await api.get('/users/role/doctors')
      setDoctors(response.data)
    } catch (error) {
      console.error('Error fetching doctors:', error)
    }
  }

  const updateStatus = async (id, status) => {
    try {
      await api.patch(`/appointments/${id}/status`, { status })
      fetchAppointments()
    } catch (error) {
      console.error('Error updating status:', error)
    }
  }

  const changeDate = (days) => {
    const date = new Date(selectedDate)
    date.setDate(date.getDate() + days)
    setSelectedDate(date.toISOString().split('T')[0])
  }

  const statusColors = {
    scheduled: 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300',
    confirmed: 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300',
    in_progress: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300',
    completed: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
    cancelled: 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300',
    no_show: 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300',
  }

  const statusLabels = {
    scheduled: 'Programada',
    confirmed: 'Confirmada',
    in_progress: 'En curso',
    completed: 'Completada',
    cancelled: 'Cancelada',
    no_show: 'No asistió',
  }

  const typeLabels = {
    first_visit: 'Primera vez',
    follow_up: 'Control',
    emergency: 'Urgencia',
    vaccination: 'Vacunación',
    teleconsultation: 'Teleconsulta',
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Citas</h1>
          <p className="text-gray-500 dark:text-gray-400">Gestión de agenda médica</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="btn-primary flex items-center gap-2"
        >
          <Plus className="h-5 w-5" />
          Nueva Cita
        </button>
      </div>

      {/* Filters */}
      <div className="card p-4">
        <div className="flex flex-col sm:flex-row gap-4 items-center">
          {/* Date Navigation */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => changeDate(-1)}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
            >
              <ChevronLeft className="h-5 w-5 text-gray-500" />
            </button>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="input-field w-auto"
            />
            <button
              onClick={() => changeDate(1)}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
            >
              <ChevronRight className="h-5 w-5 text-gray-500" />
            </button>
            <button
              onClick={() => setSelectedDate(new Date().toISOString().split('T')[0])}
              className="btn-secondary text-sm"
            >
              Hoy
            </button>
          </div>

          {/* Doctor Filter */}
          {(isAdmin || isSecretary) && (
            <select
              value={selectedDoctor}
              onChange={(e) => setSelectedDoctor(e.target.value)}
              className="input-field w-auto"
            >
              <option value="">Todos los doctores</option>
              {doctors.map((doc) => (
                <option key={doc.doctorId} value={doc.doctorId}>
                  Dr. {doc.firstName} {doc.lastName}
                </option>
              ))}
            </select>
          )}

          <div className="flex-1" />

          <p className="text-sm text-gray-500">
            {appointments.length} cita{appointments.length !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      {/* Appointments List */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        </div>
      ) : appointments.length > 0 ? (
        <div className="space-y-3">
          {appointments.map((apt) => (
            <div key={apt.id} className="card p-4">
              <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                {/* Time */}
                <div className="flex items-center gap-3 sm:w-24">
                  <Clock className="h-5 w-5 text-gray-400" />
                  <span className="font-medium text-gray-900 dark:text-white">
                    {apt.scheduledTime?.slice(0, 5)}
                  </span>
                </div>

                {/* Patient Info */}
                <div className="flex-1">
                  <Link
                    to={`/patients/${apt.patientId}`}
                    className="font-medium text-gray-900 dark:text-white hover:text-primary-600"
                  >
                    {apt.patient?.firstName} {apt.patient?.lastName}
                  </Link>
                  <div className="flex flex-wrap items-center gap-2 mt-1 text-sm text-gray-500">
                    <span className={`badge ${statusColors[apt.status]}`}>
                      {statusLabels[apt.status]}
                    </span>
                    <span className="badge badge-info">
                      {typeLabels[apt.type]}
                    </span>
                    {apt.reason && <span>• {apt.reason}</span>}
                  </div>
                  {apt.patient?.allergies?.length > 0 && (
                    <div className="flex items-center gap-1 mt-1 text-xs text-red-600">
                      <AlertCircle className="h-3 w-3" />
                      Alergias: {apt.patient.allergies.join(', ')}
                    </div>
                  )}
                </div>

                {/* Doctor */}
                {(isAdmin || isSecretary) && (
                  <div className="text-sm text-gray-500">
                    Dr. {apt.doctor?.firstName} {apt.doctor?.lastName}
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center gap-2">
                  {apt.status === 'scheduled' && (
                    <>
                      <button
                        onClick={() => updateStatus(apt.id, 'confirmed')}
                        className="p-2 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg"
                        title="Confirmar"
                      >
                        <CheckCircle className="h-5 w-5" />
                      </button>
                      <button
                        onClick={() => updateStatus(apt.id, 'cancelled')}
                        className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
                        title="Cancelar"
                      >
                        <XCircle className="h-5 w-5" />
                      </button>
                    </>
                  )}
                  {apt.status === 'confirmed' && (isDoctor || isAdmin) && (
                    <Link
                      to={`/consultation/new?appointmentId=${apt.id}&patientId=${apt.patientId}`}
                      className="btn-primary text-sm flex items-center gap-1"
                    >
                      <Play className="h-4 w-4" />
                      Iniciar
                    </Link>
                  )}
                  {apt.status === 'in_progress' && (isDoctor || isAdmin) && (
                    <Link
                      to={`/consultation/${apt.id}`}
                      className="btn-primary text-sm"
                    >
                      Continuar
                    </Link>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="card p-12 text-center">
          <Calendar className="h-12 w-12 mx-auto text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            Sin citas para esta fecha
          </h3>
          <p className="text-gray-500 mb-4">
            No hay citas programadas para el {new Date(selectedDate).toLocaleDateString('es-ES')}
          </p>
          <button onClick={() => setShowModal(true)} className="btn-primary">
            Programar Cita
          </button>
        </div>
      )}

      {/* New Appointment Modal */}
      {showModal && (
        <NewAppointmentModal
          doctors={doctors}
          onClose={() => setShowModal(false)}
          onSuccess={() => {
            setShowModal(false)
            fetchAppointments()
          }}
        />
      )}
    </div>
  )
}

function NewAppointmentModal({ doctors, onClose, onSuccess }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [patients, setPatients] = useState([])
  const [searchPatient, setSearchPatient] = useState('')
  const [availableSlots, setAvailableSlots] = useState([])
  const { user } = useAuth()
  const [formData, setFormData] = useState({
    doctorId: user?.doctorId || '',
    clinicId: user?.clinicId || '',
    patientId: '',
    scheduledDate: new Date().toISOString().split('T')[0],
    scheduledTime: '',
    type: 'follow_up',
    reason: ''
  })

  useEffect(() => {
    if (searchPatient.length >= 2) {
      searchPatients()
    }
  }, [searchPatient])

  useEffect(() => {
    if (formData.doctorId && formData.scheduledDate) {
      fetchAvailableSlots()
    }
  }, [formData.doctorId, formData.scheduledDate])

  const searchPatients = async () => {
    try {
      const response = await api.get('/patients', { params: { search: searchPatient, limit: 10 } })
      setPatients(response.data)
    } catch (error) {
      console.error('Error searching patients:', error)
    }
  }

  const fetchAvailableSlots = async () => {
    try {
      const response = await api.get(`/appointments/slots/${formData.doctorId}/${formData.scheduledDate}`)
      setAvailableSlots(response.data.availableSlots || [])
    } catch (error) {
      console.error('Error fetching slots:', error)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      await api.post('/appointments', formData)
      onSuccess()
    } catch (err) {
      setError(err.response?.data?.error || 'Error al crear cita')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Nueva Cita</h2>
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

          {/* Doctor */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Doctor *
            </label>
            <select
              required
              value={formData.doctorId}
              onChange={(e) => setFormData({ ...formData, doctorId: e.target.value })}
              className="input-field"
            >
              <option value="">Seleccionar doctor</option>
              {doctors.map((doc) => (
                <option key={doc.doctorId} value={doc.doctorId}>
                  Dr. {doc.firstName} {doc.lastName} - {doc.specialty}
                </option>
              ))}
            </select>
          </div>

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
                  value={searchPatient}
                  onChange={(e) => setSearchPatient(e.target.value)}
                  placeholder="Buscar paciente..."
                  className="input-field"
                />
                {patients.length > 0 && searchPatient.length >= 2 && (
                  <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    {patients.map((patient) => (
                      <button
                        key={patient.id}
                        type="button"
                        onClick={() => {
                          setFormData({ ...formData, patientId: patient.id })
                          setSearchPatient('')
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

          {/* Date and Time */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Fecha *
              </label>
              <input
                type="date"
                required
                min={new Date().toISOString().split('T')[0]}
                value={formData.scheduledDate}
                onChange={(e) => setFormData({ ...formData, scheduledDate: e.target.value, scheduledTime: '' })}
                className="input-field"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Hora *
              </label>
              <select
                required
                value={formData.scheduledTime}
                onChange={(e) => setFormData({ ...formData, scheduledTime: e.target.value })}
                className="input-field"
                disabled={!formData.doctorId}
              >
                <option value="">Seleccionar hora</option>
                {availableSlots.map((slot) => (
                  <option key={slot} value={slot}>{slot}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Tipo de Cita
            </label>
            <select
              value={formData.type}
              onChange={(e) => setFormData({ ...formData, type: e.target.value })}
              className="input-field"
            >
              <option value="first_visit">Primera vez</option>
              <option value="follow_up">Control</option>
              <option value="emergency">Urgencia</option>
              <option value="vaccination">Vacunación</option>
              <option value="teleconsultation">Teleconsulta</option>
            </select>
          </div>

          {/* Reason */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Motivo
            </label>
            <input
              type="text"
              value={formData.reason}
              onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
              className="input-field"
              placeholder="Motivo de la consulta"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            <button type="button" onClick={onClose} className="btn-secondary">
              Cancelar
            </button>
            <button type="submit" disabled={loading || !formData.patientId} className="btn-primary">
              {loading ? 'Guardando...' : 'Crear Cita'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
