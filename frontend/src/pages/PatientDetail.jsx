import { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import api, { BACKEND_URL } from '../services/api'
import { useAuth } from '../context/AuthContext'
import { usePreferences } from '../context/PreferencesContext'
import {
  ArrowLeft, User, Calendar, Phone, Mail, AlertTriangle,
  FileText, Syringe, Activity, Edit, Plus, Clock,
  Heart, Thermometer, Scale, Ruler, Trash2, Bell, Pill, Settings, Check, Stethoscope
} from 'lucide-react'
import ConfirmDialog from '../components/ConfirmDialog'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import GrowthComparison3D from '../components/GrowthComparison3D'
import WHOGrowthCurves from '../components/WHOGrowthCurves'
import PrescriptionModal from '../components/PrescriptionModal'
import DocumentModal from '../components/DocumentModal'

export default function PatientDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user, isDoctor, isAdmin } = useAuth()
  const { convertWeight, convertHeight, getUnitLabel } = usePreferences()
  const weightUnit = getUnitLabel('weight')
  const heightUnit = getUnitLabel('height')
  const [patient, setPatient] = useState(null)
  const [consultations, setConsultations] = useState([])
  const [vaccinations, setVaccinations] = useState(null)
  const [growthData, setGrowthData] = useState([])
  const [growthComparison, setGrowthComparison] = useState(null)
  const [growthHistory, setGrowthHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('overview')
  const [view3DMode, setView3DMode] = useState('bars')
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [labExams, setLabExams] = useState([])
  const [showLabExamModal, setShowLabExamModal] = useState(false)
  const [deleteConsultId, setDeleteConsultId] = useState(null)
  const [deleteConfirmText, setDeleteConfirmText] = useState('')
  const [showDeleteConsultModal, setShowDeleteConsultModal] = useState(false)
  const [showParentModal, setShowParentModal] = useState(false)
  const [availableParents, setAvailableParents] = useState([])
  const [parentSearch, setParentSearch] = useState('')
  const [parentRelationship, setParentRelationship] = useState('padre')
  const [activePrescriptions, setActivePrescriptions] = useState([])
  const [notificationSettings, setNotificationSettings] = useState(null)
  const [showAlertsModal, setShowAlertsModal] = useState(false)
  const [showPrescriptionModal, setShowPrescriptionModal] = useState(false)
  const [showDocumentModal, setShowDocumentModal] = useState(false)

  useEffect(() => {
    if (!id || id === 'undefined') {
      setLoading(false)
      navigate('/patients')
      return
    }
    fetchPatientData()
    fetchPrescriptions()
  }, [id])

  const fetchLabExams = async () => {
    try {
      const response = await api.get(`/lab-exams/patient/${id}`)
      setLabExams(response.data)
    } catch (error) {
      console.log('Lab exams not available:', error.message)
    }
  }

  const fetchPatientData = async () => {
    if (!id || id === 'undefined') return;
    try {
      const [patientRes, consultRes, vaccRes] = await Promise.all([
        api.get(`/patients/${id}`),
        api.get(`/consultations/patient/${id}/history`),
        api.get(`/vaccinations/patient/${id}`)
      ])
      setPatient(patientRes.data)
      setConsultations(consultRes.data)
      setVaccinations(vaccRes.data)

      // Fetch lab exams
      fetchLabExams()

      // Fetch growth data separately to handle errors gracefully
      try {
        const [comparison3d, history] = await Promise.all([
          api.get(`/growth/patient/${id}/comparison3d`),
          api.get(`/growth/patient/${id}/history`)
        ])
        setGrowthComparison(comparison3d.data)
        setGrowthHistory(history.data?.history || [])
      } catch (growthError) {
        console.log('Growth data not available:', growthError.message)
      }
    } catch (error) {
      console.error('Error fetching patient:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchPrescriptions = async () => {
    try {
      const response = await api.get(`/prescriptions/patient/${id}/history`)
      setActivePrescriptions(response.data)
    } catch (error) {
      console.error('Error fetching prescriptions:', error)
    }
  }

  const handleLogDose = async (itemId) => {
    try {
      await api.post('/prescriptions/log-dose', {
        prescriptionItemId: itemId,
        status: 'taken'
      })
      fetchPrescriptions()
      fetchPatientData() // Also refresh history to update next dose times in other views
    } catch (error) {
      console.error('Error logging dose:', error)
      alert('Error al marcar la toma. Por favor, reintente.')
    }
  }

  const handleConfigureAlerts = () => {
    setShowAlertsModal(true);
  }

  const formatDate = (dateString) => {
    if (!dateString) return '';
    // Use part-based formatting to avoid timezone shifts
    const d = new Date(dateString);
    return d.toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
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
    if (years < 3) {
      const remainingMonths = months < 0 ? 12 + months : months
      return `${years} año${years > 1 ? 's' : ''} ${remainingMonths} meses`
    }
    return `${years} años`
  }

  const handleDeletePatient = async () => {
    setDeleting(true)
    try {
      await api.delete(`/patients/${id}`)
      navigate('/patients')
    } catch (error) {
      console.error('Error deleting patient:', error)
      alert(error.response?.data?.error || 'Error al eliminar paciente')
    } finally {
      setDeleting(false)
    }
  }

  const handleDeleteConsultation = async () => {
    if (deleteConfirmText !== 'BORRAR') return
    try {
      await api.delete(`/consultations/${deleteConsultId}`)
      setShowDeleteConsultModal(false)
      setDeleteConsultId(null)
      setDeleteConfirmText('')
      fetchPatientData()
    } catch (error) {
      console.error('Error deleting consultation:', error)
      alert('Error al eliminar consulta')
    }
  }

  const fetchAvailableParents = async (search = '') => {
    try {
      const res = await api.get(`/patients/parents/available${search ? `?search=${search}` : ''}`)
      setAvailableParents(res.data)
    } catch (error) {
      console.error('Error fetching parents:', error)
    }
  }

  const handleAssignParent = async (parentId) => {
    try {
      await api.post(`/patients/${id}/parents`, {
        parentId,
        relationship: parentRelationship
      })
      setShowParentModal(false)
      fetchPatientData()
    } catch (error) {
      console.error('Error assigning parent:', error)
    }
  }

  const handleRemoveParent = async (parentId) => {
    try {
      await api.delete(`/patients/${id}/parents/${parentId}`)
      fetchPatientData()
    } catch (error) {
      console.error('Error removing parent:', error)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  if (!patient) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Paciente no encontrado</p>
        <Link to="/patients" className="text-primary-600 hover:underline mt-2 inline-block">
          Volver a pacientes
        </Link>
      </div>
    )
  }

  const tabs = [
    { id: 'overview', label: 'General' },
    { id: 'history', label: 'Historial' },
    { id: 'medications', label: 'Medicación' },
    { id: 'labExams', label: 'Laboratorio' },
    { id: 'vaccinations', label: 'Vacunas' },
    { id: 'growth', label: 'Crecimiento' },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate(-1)}
          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
        >
          <ArrowLeft className="h-5 w-5 text-gray-500" />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              {patient.firstName} {patient.lastName}
            </h1>
            {patient.allergies?.length > 0 && (
              <span className="badge badge-danger flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                Alergias
              </span>
            )}
          </div>
          <p className="text-brand-muted dark:text-slate-400 font-medium">
            {patient.medicalRecordNumber} • {calculateAge(patient.dateOfBirth)}
          </p>
        </div>
        {(isDoctor || isAdmin) && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowEditModal(true)}
              className="p-2 text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              title="Editar paciente"
            >
              <Edit className="h-5 w-5" />
            </button>
            <button
              onClick={() => setShowDocumentModal(true)}
              className="btn-secondary flex items-center gap-2"
              title="Generar incapacidad, constancia, etc."
            >
              <FileText className="h-5 w-5 text-purple-600" />
              Documento
            </button>
            <Link
              to={`/consultation/new?patientId=${id}`}
              className="btn-primary flex items-center gap-2"
            >
              <Plus className="h-5 w-5" />
              Nueva Consulta
            </Link>
            {isAdmin && (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                title="Eliminar paciente"
              >
                <Trash2 className="h-5 w-5" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Patient Info Card */}
      <div className="card p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div>
            <p className="text-xs font-black text-brand-muted uppercase tracking-widest mb-1">Fecha de Nacimiento</p>
            <p className="font-bold text-brand-dark dark:text-white">
              {new Date(patient.dateOfBirth).toLocaleDateString('es-ES')}
            </p>
          </div>
          <div>
            <p className="text-xs font-black text-brand-muted uppercase tracking-widest mb-1">Género</p>
            <p className="font-bold text-brand-dark dark:text-white">
              {patient.gender === 'male' ? 'Masculino' : 'Femenino'}
            </p>
          </div>
          <div>
            <p className="text-xs font-black text-brand-muted uppercase tracking-widest mb-1">Tipo de Sangre</p>
            <p className="font-bold text-brand-dark dark:text-white">
              {patient.bloodType || 'No registrado'}
            </p>
          </div>
          <div>
            <p className="text-xs font-black text-brand-muted uppercase tracking-widest mb-1">Seguro</p>
            <p className="font-bold text-brand-dark dark:text-white">
              {patient.insuranceProvider || 'Sin seguro'}
            </p>
          </div>
        </div>

        {patient.allergies?.length > 0 && (
          <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
            <p className="text-sm font-medium text-red-700 dark:text-red-400 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Alergias:
            </p>
            <div className="flex flex-wrap gap-2 mt-2">
              {patient.allergies.map((allergy, i) => (
                <span key={i} className="badge badge-danger">{allergy}</span>
              ))}
            </div>
          </div>
        )}

        {patient.chronicConditions?.length > 0 && (
          <div className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
            <p className="text-sm font-medium text-yellow-700 dark:text-yellow-400">
              Condiciones Crónicas:
            </p>
            <div className="flex flex-wrap gap-2 mt-2">
              {patient.chronicConditions.map((condition, i) => (
                <span key={i} className="badge badge-warning">{condition}</span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Parents & Guardians Section */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <User className="h-5 w-5 text-primary-600" />
            Padres y Tutores
          </h3>
          <button
            onClick={() => {
              setParentSearch('')
              setAvailableParents([])
              setShowParentModal(true)
            }}
            className="text-primary-600 hover:text-primary-700 text-sm font-medium flex items-center gap-1"
          >
            <Plus className="h-4 w-4" />
            Asignar Padre
          </button>
        </div>

        {patient.parents && patient.parents.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {patient.parents.map((p, i) => (
              <div key={i} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-100 dark:border-gray-600">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center text-primary-700 dark:text-primary-400">
                    <User className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="font-bold text-brand-dark dark:text-white">
                      {p.firstName} {p.lastName}
                    </p>
                    <p className="text-[10px] text-brand-accent font-black uppercase tracking-widest mb-1">
                      {p.relationship} {p.isPrimaryContact && '• Responsable'}
                    </p>
                    <div className="flex gap-3 mt-2">
                      {p.phone && <span className="text-[10px] text-brand-muted font-bold flex items-center gap-1"><Phone className="h-3 w-3" /> {p.phone}</span>}
                      {p.email && <span className="text-[10px] text-brand-muted font-bold flex items-center gap-1"><Mail className="h-3 w-3" /> {p.email}</span>}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => handleRemoveParent(p.id)}
                  className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                  title="Eliminar asignación"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-6 bg-gray-50 dark:bg-gray-700/30 rounded-lg border border-dashed border-gray-200 dark:border-gray-700">
            <p className="text-sm text-gray-500">No hay padres o tutores asignados</p>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="flex gap-4">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${activeTab === tab.id
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Birth Data */}
          <div className="card p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Datos de Nacimiento
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-slate-50 dark:bg-white/5 rounded-2xl border border-transparent hover:border-white/10 transition-colors">
                <p className="text-[10px] font-black text-brand-muted uppercase tracking-widest mb-1">Peso al nacer</p>
                <p className="font-bold text-brand-dark dark:text-white">{patient.birthWeightGrams ? `${patient.birthWeightGrams} g` : '-'}</p>
              </div>
              <div className="p-4 bg-slate-50 dark:bg-white/5 rounded-2xl border border-transparent hover:border-white/10 transition-colors">
                <p className="text-[10px] font-black text-brand-muted uppercase tracking-widest mb-1">Talla al nacer</p>
                <p className="font-bold text-brand-dark dark:text-white">{patient.birthHeightCm ? `${patient.birthHeightCm} cm` : '-'}</p>
              </div>
              <div className="p-4 bg-slate-50 dark:bg-white/5 rounded-2xl border border-transparent hover:border-white/10 transition-colors">
                <p className="text-[10px] font-black text-brand-muted uppercase tracking-widest mb-1">APGAR 1 min</p>
                <p className="font-bold text-brand-dark dark:text-white">{patient.apgar1min || '-'}</p>
              </div>
              <div className="p-4 bg-slate-50 dark:bg-white/5 rounded-2xl border border-transparent hover:border-white/10 transition-colors">
                <p className="text-[10px] font-black text-brand-muted uppercase tracking-widest mb-1">APGAR 5 min</p>
                <p className="font-bold text-brand-dark dark:text-white">{patient.apgar5min || '-'}</p>
              </div>
              <div className="p-4 bg-slate-50 dark:bg-white/5 rounded-2xl border border-transparent hover:border-white/10 transition-colors">
                <p className="text-[10px] font-black text-brand-muted uppercase tracking-widest mb-1">Gestation</p>
                <p className="font-bold text-brand-dark dark:text-white">{patient.gestationalWeeks || '-'} semanas</p>
              </div>
            </div>
          </div>



          {/* Recent Consultations */}
          <div className="card p-6 lg:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Últimas Consultas
              </h3>
              <button
                onClick={() => setActiveTab('history')}
                className="text-primary-600 hover:text-primary-700 text-sm font-medium"
              >
                Ver todas
              </button>
            </div>
            {consultations.length > 0 ? (
              <div className="space-y-3">
                {consultations.slice(0, 3).map((consultation) => (
                  <div key={consultation.id} className="flex items-center gap-4 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                    <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                      <FileText className="h-5 w-5 text-blue-600" />
                    </div>
                    <div className="flex-1">
                      <p className="font-bold text-brand-dark dark:text-white">
                        {consultation.reasonForVisit || 'Consulta'}
                      </p>
                      <p className="text-xs font-semibold text-brand-muted flex items-center gap-2 mt-1">
                        <Calendar className="h-3 w-3" /> {new Date(consultation.consultationDate).toLocaleDateString('es-ES')}
                        <span className="opacity-20">•</span>
                        <Stethoscope className="h-3 w-3" /> {consultation.doctor}
                      </p>
                    </div>
                    {consultation.diagnosisDescriptions?.[0] && (
                      <span className="badge badge-info">
                        {consultation.diagnosisDescriptions[0]}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-4">Sin consultas registradas</p>
            )}
          </div>
        </div>
      )}

      {activeTab === 'history' && (
        <div className="card">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <h3 className="font-semibold text-gray-900 dark:text-white">Historial de Consultas</h3>
          </div>
          {consultations.length > 0 ? (
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {consultations.map((consultation) => (
                <div key={consultation.id} className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-gray-900 dark:text-white">
                          {consultation.reasonForVisit || 'Consulta general'}
                        </p>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${consultation.status === 'completed'
                          ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                          : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                          }`}>
                          {consultation.status === 'completed' ? 'Completada' : 'En progreso'}
                        </span>
                      </div>
                      <p className="text-sm text-gray-500 mt-1">
                        {formatDate(consultation.consultationDate)}
                        {consultation.ageMonths != null && (
                          <span className="ml-2 text-primary-600 dark:text-primary-400 font-medium">
                            • Edad: {consultation.ageMonths} meses
                          </span>
                        )}
                      </p>
                      <p className="text-sm text-gray-500">{consultation.doctor}</p>
                      {(consultation.weightKg || consultation.heightCm) && (
                        <p className="text-xs text-gray-400 mt-1">
                          {consultation.weightKg && `Peso: ${convertWeight(consultation.weightKg, true)} ${weightUnit}`}
                          {consultation.weightKg && consultation.heightCm && ' • '}
                          {consultation.heightCm && `Talla: ${convertHeight(consultation.heightCm, true)} ${heightUnit}`}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-right mr-2">
                        {consultation.diagnosisDescriptions?.map((diag, i) => (
                          <span key={i} className="badge badge-info ml-1">{diag}</span>
                        ))}
                      </div>
                      <button
                        onClick={() => navigate(`/consultation/${consultation.id}`)}
                        className="p-1.5 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded"
                        title="Editar consulta"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => {
                          setDeleteConsultId(consultation.id)
                          setDeleteConfirmText('')
                          setShowDeleteConsultModal(true)
                        }}
                        className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                        title="Borrar consulta"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  {consultation.treatmentPlan && (
                    <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                      <p className="text-sm text-gray-600 dark:text-gray-300">
                        <strong>Tratamiento:</strong> {consultation.treatmentPlan}
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center text-gray-500">
              Sin consultas registradas
            </div>
          )}
        </div>
      )}

      {activeTab === 'labExams' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Exámenes de Laboratorio
            </h3>
            {(isDoctor || isAdmin) && (
              <button
                onClick={() => setShowLabExamModal(true)}
                className="btn-primary flex items-center gap-2"
              >
                <Plus className="h-4 w-4" />
                Nuevo Examen
              </button>
            )}
          </div>

          {labExams.length > 0 ? (
            <div className="space-y-4">
              {labExams.map((exam) => (
                <LabExamCard
                  key={exam.id}
                  exam={exam}
                  onRefresh={fetchLabExams}
                />
              ))}
            </div>
          ) : (
            <div className="card p-12 text-center">
              <FileText className="h-12 w-12 mx-auto text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                Sin exámenes de laboratorio
              </h3>
              <p className="text-gray-500 mb-4">
                Los exámenes se registrarán aquí con opción de análisis por IA
              </p>
              {(isDoctor || isAdmin) && (
                <button
                  onClick={() => setShowLabExamModal(true)}
                  className="btn-primary inline-flex items-center gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Agregar Examen
                </button>
              )}
            </div>
          )}
        </div>
      )}
      {activeTab === 'medications' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">Active Prescriptions</h3>
            <div className="flex gap-2">
              <button
                onClick={() => setShowPrescriptionModal(true)}
                className="btn-primary text-sm flex items-center gap-2"
              >
                <Plus className="h-4 w-4" />
                Agregar Medicamento
              </button>
              <button
                onClick={handleConfigureAlerts}
                className="p-2 text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-lg transition-colors border border-primary-200 dark:border-primary-800"
                title="Configurar recordatorios"
              >
                <Bell className="h-5 w-5" />
              </button>
            </div>
          </div>

          {activePrescriptions.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {(() => {
                // Filter to show only unique medications (latest one first)
                const uniqueMeds = {};
                activePrescriptions.forEach(p => {
                  (p.items || []).forEach(item => {
                    if (!uniqueMeds[item.name] || new Date(p.prescriptionDate) > new Date(uniqueMeds[item.name].prescriptionDate)) {
                      uniqueMeds[item.name] = { ...item, prescriptionDate: p.prescriptionDate };
                    }
                  });
                });

                return Object.values(uniqueMeds).map((item) => {
                  const nextDoseAt = item.nextDoseAt ? new Date(item.nextDoseAt) : null;
                  const isOverdue = nextDoseAt && nextDoseAt < new Date();

                  const getTimeRemaining = (date) => {
                    if (!date) return 'No programada';
                    const diff = date - new Date();
                    if (diff < 0) return 'Retrasado';
                    const hours = Math.floor(diff / (1000 * 60 * 60));
                    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                    return `en ${hours}h ${minutes}m`;
                  };

                  return (
                    <div key={item.id} className="card p-4 space-y-3 relative overflow-hidden">
                      <div className="flex justify-between items-start">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isOverdue ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'
                            }`}>
                            <Pill className="h-5 w-5" />
                          </div>
                          <div>
                            <p className="font-semibold text-gray-900 dark:text-white">{item.name}</p>
                            <p className="text-xs text-gray-500">{item.dose} {item.doseUnit} • {item.frequency}</p>
                          </div>
                        </div>
                        <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${isOverdue ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
                          }`}>
                          {isOverdue ? 'Atraso' : 'Al día'}
                        </span>
                      </div>

                      <div className="bg-gray-50 dark:bg-gray-700/50 p-3 rounded-lg flex items-center justify-between">
                        <div className="flex items-center gap-2 text-sm">
                          <Clock className={`h-4 w-4 ${isOverdue ? 'text-red-500' : 'text-blue-500'}`} />
                          <div>
                            <p className="text-gray-500 text-[10px]">Próxima dosis</p>
                            <p className="font-medium text-gray-900 dark:text-white">
                              {nextDoseAt ? nextDoseAt.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) : 'N/A'}
                              <span className="text-xs font-normal text-gray-500 ml-1">({getTimeRemaining(nextDoseAt)})</span>
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() => handleLogDose(item.id)}
                          className="btn-primary text-xs py-1.5 px-3 flex items-center gap-1"
                        >
                          <Check className="h-3 w-3" />
                          Marcar Toma
                        </button>
                      </div>

                      {item.instructions && (
                        <p className="text-[10px] text-gray-500 italic">
                          Nota: {item.instructions}
                        </p>
                      )}
                    </div>
                  );
                });
              })()}
            </div>
          ) : (
            <div className="card p-12 text-center">
              <Pill className="h-12 w-12 mx-auto text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                Sin medicamentos activos
              </h3>
              <p className="text-gray-500">
                Las recetas guardadas en las consultas aparecerán aquí para control de dosis.
              </p>
            </div>
          )}
        </div>
      )}

      {activeTab === 'vaccinations' && (
        <div className="space-y-6">
          {/* Applied Vaccines */}
          <div className="card p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <Syringe className="h-5 w-5 text-green-600" />
              Vacunas Aplicadas ({vaccinations?.applied?.length || 0})
            </h3>
            {vaccinations?.applied?.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {vaccinations.applied.map((vac) => (
                  <div key={vac.id} className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                    <p className="font-medium text-gray-900 dark:text-white">{vac.vaccineName}</p>
                    <p className="text-sm text-gray-500">
                      {new Date(vac.administrationDate).toLocaleDateString('es-ES')}
                      {vac.lotNumber && ` • Lote: ${vac.lotNumber}`}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500">Sin vacunas registradas</p>
            )}
          </div>

          {/* Pending Vaccines */}
          {vaccinations?.pending?.length > 0 && (
            <div className="card p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-red-600" />
                Vacunas Pendientes ({vaccinations.pending.length})
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {vaccinations.pending.map((vac) => (
                  <div key={vac.id} className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                    <p className="font-medium text-gray-900 dark:text-white">{vac.name}</p>
                    <p className="text-sm text-red-600 dark:text-red-400">Atrasada</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Upcoming Vaccines */}
          {vaccinations?.upcoming?.length > 0 && (
            <div className="card p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <Clock className="h-5 w-5 text-blue-600" />
                Próximas Vacunas
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {vaccinations.upcoming.map((vac) => (
                  <div key={vac.id} className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                    <p className="font-medium text-gray-900 dark:text-white">{vac.name}</p>
                    <p className="text-sm text-blue-600 dark:text-blue-400">
                      A los {vac.nextDueAgeMonths} meses
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'growth' && (
        <div className="space-y-6">
          {/* 3D Comparison */}
          <div className="card p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Comparación de Crecimiento
              </h3>
              <div className="flex gap-2">
                <button
                  onClick={() => setView3DMode('bars')}
                  className={`px-3 py-1 rounded text-sm ${view3DMode === 'bars' ? 'bg-primary-600 text-white' : 'bg-gray-100 dark:bg-gray-700'
                    }`}
                >
                  Barras
                </button>
                <button
                  onClick={() => setView3DMode('silhouette')}
                  className={`px-3 py-1 rounded text-sm ${view3DMode === 'silhouette' ? 'bg-primary-600 text-white' : 'bg-gray-100 dark:bg-gray-700'
                    }`}
                >
                  Silueta
                </button>
                <button
                  onClick={() => setView3DMode('3d')}
                  className={`px-3 py-1 rounded text-sm font-medium ${view3DMode === '3d' ? 'bg-primary-600 text-white' : 'bg-gray-100 dark:bg-gray-700'
                    }`}
                >
                  🧍 3D
                </button>
                <button
                  onClick={() => setView3DMode('curves')}
                  className={`px-3 py-1 rounded text-sm font-medium ${view3DMode === 'curves' ? 'bg-primary-600 text-white' : 'bg-gray-100 dark:bg-gray-700'
                    }`}
                >
                  📈 Curvas OMS
                </button>
              </div>
            </div>

            {view3DMode === 'curves' ? (
              <WHOGrowthCurves 
                gender={patient?.gender} 
                history={growthHistory} 
                patientName={`${patient?.firstName} ${patient?.lastName}`} 
              />
            ) : (
              <GrowthComparison3D data={growthComparison} viewMode={view3DMode} />
            )}

            {!growthComparison?.hasData && growthComparison?.ideal && (
              <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  <strong>Valores ideales para {patient?.firstName}:</strong><br />
                  Peso: {growthComparison.ideal.weight} kg | Talla: {growthComparison.ideal.height} cm
                </p>
                <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                  Registra peso y talla en una consulta para ver la comparación.
                </p>
              </div>
            )}
          </div>

          {/* Growth History Charts */}
          {growthHistory.length > 0 && (
            <>
              <div className="card p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  Evolución del Peso
                </h3>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={growthHistory}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="ageMonths"
                      label={{ value: 'Edad (meses)', position: 'bottom', offset: -5 }}
                    />
                    <YAxis
                      label={{ value: `Peso (${weightUnit})`, angle: -90, position: 'insideLeft' }}
                    />
                    <Tooltip
                      formatter={(value, name) => [
                        `${convertWeight(value, true)} ${weightUnit}`,
                        name === 'weight' ? 'Peso' : name
                      ]}
                      labelFormatter={(label) => `Edad: ${label} meses`}
                    />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="weight"
                      stroke="#3b82f6"
                      strokeWidth={2}
                      dot={{ fill: '#3b82f6', r: 4 }}
                      name={`Peso (${weightUnit})`}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              <div className="card p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  Evolución de la Talla
                </h3>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={growthHistory}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="ageMonths"
                      label={{ value: 'Edad (meses)', position: 'bottom', offset: -5 }}
                    />
                    <YAxis
                      label={{ value: `Talla (${heightUnit})`, angle: -90, position: 'insideLeft' }}
                    />
                    <Tooltip
                      formatter={(value, name) => [
                        `${convertHeight(value, true)} ${heightUnit}`,
                        name === 'height' ? 'Talla' : name
                      ]}
                      labelFormatter={(label) => `Edad: ${label} meses`}
                    />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="height"
                      stroke="#10b981"
                      strokeWidth={2}
                      dot={{ fill: '#10b981', r: 4 }}
                      name={`Talla (${heightUnit})`}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* History Table */}
              <div className="card p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  Historial de Mediciones
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-gray-500 border-b border-gray-200 dark:border-gray-700">
                        <th className="pb-2">Fecha</th>
                        <th className="pb-2">Edad</th>
                        <th className="pb-2">Peso</th>
                        <th className="pb-2">Talla</th>
                        <th className="pb-2">P. Cefálico</th>
                        <th className="pb-2">Percentil Peso</th>
                        <th className="pb-2">Percentil Talla</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                      {growthHistory.slice().reverse().map((h, i) => (
                        <tr key={i} className="text-gray-700 dark:text-gray-300">
                          <td className="py-2">{new Date(h.date).toLocaleDateString('es-ES')}</td>
                          <td className="py-2">{h.ageMonths}m</td>
                          <td className="py-2">{h.weight ? `${convertWeight(h.weight, true)} ${weightUnit}` : '-'}</td>
                          <td className="py-2">{h.height ? `${convertHeight(h.height, true)} ${heightUnit}` : '-'}</td>
                          <td className="py-2">{h.headCircumference ? `${convertHeight(h.headCircumference, true)} ${heightUnit}` : '-'}</td>
                          <td className="py-2">
                            {h.metrics?.weight?.percentile ? (
                              <span className={`badge ${h.metrics.weight.percentile < 3 || h.metrics.weight.percentile > 97
                                ? 'badge-danger'
                                : h.metrics.weight.percentile < 15 || h.metrics.weight.percentile > 85
                                  ? 'badge-warning'
                                  : 'badge-success'
                                }`}>
                                P{h.metrics.weight.percentile.toFixed(0)}
                              </span>
                            ) : '-'}
                          </td>
                          <td className="py-2">
                            {h.metrics?.height?.percentile ? (
                              <span className={`badge ${h.metrics.height.percentile < 3 || h.metrics.height.percentile > 97
                                ? 'badge-danger'
                                : h.metrics.height.percentile < 15 || h.metrics.height.percentile > 85
                                  ? 'badge-warning'
                                  : 'badge-success'
                                }`}>
                                P{h.metrics.height.percentile.toFixed(0)}
                              </span>
                            ) : '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {!growthHistory.length && !growthComparison?.hasData && (
            <div className="card p-12 text-center">
              <Activity className="h-12 w-12 mx-auto text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                Sin datos de crecimiento
              </h3>
              <p className="text-gray-500 mb-4">
                Los datos se registrarán automáticamente en cada consulta
              </p>
              {(isDoctor || isAdmin) && (
                <Link
                  to={`/consultation/new?patientId=${id}`}
                  className="btn-primary inline-flex items-center gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Iniciar Consulta
                </Link>
              )}
            </div>
          )}
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleDeletePatient}
        title="¿Eliminar paciente?"
        message={`¿Estás seguro de que deseas eliminar a ${patient?.firstName} ${patient?.lastName}? Esta acción eliminará todo el historial médico, consultas y vacunas asociadas. Esta acción no se puede deshacer.`}
        confirmText={deleting ? 'Eliminando...' : 'Sí, eliminar'}
        type="danger"
      />

      {/* Edit Patient Modal */}
      {showEditModal && (
        <EditPatientModal
          patient={patient}
          onClose={() => setShowEditModal(false)}
          onSuccess={() => {
            setShowEditModal(false)
            fetchPatientData()
          }}
        />
      )}

      {/* Lab Exam Modal */}
      {showLabExamModal && (
        <LabExamModal
          patientId={id}
          onClose={() => setShowLabExamModal(false)}
          onSuccess={() => {
            setShowLabExamModal(false)
            fetchLabExams()
          }}
        />
      )}
      {/* Delete Consultation Confirmation Modal */}
      {showDeleteConsultModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 max-w-md w-full shadow-xl">
            <h3 className="text-lg font-bold text-red-600 mb-2">⚠️ Eliminar Consulta</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Esta acción es irreversible. Se eliminarán todos los datos de la consulta, recetas y mediciones.
            </p>
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Escribe <span className="text-red-600 font-bold">BORRAR</span> para confirmar:
            </p>
            <input
              type="text"
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              className="input-field mb-4"
              placeholder="Escribe BORRAR"
              autoFocus
            />
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => { setShowDeleteConsultModal(false); setDeleteConfirmText('') }}
                className="btn-secondary"
              >
                Cancelar
              </button>
              <button
                onClick={handleDeleteConsultation}
                disabled={deleteConfirmText !== 'BORRAR'}
                className="px-4 py-2 bg-red-600 text-white rounded-lg disabled:opacity-30 disabled:cursor-not-allowed hover:bg-red-700 transition-colors"
              >
                Eliminar Consulta
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Parent Assignment Modal */}
      {showParentModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 max-w-lg w-full shadow-xl">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Asignar Padre/Tutor</h3>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Relación</label>
              <select
                value={parentRelationship}
                onChange={(e) => setParentRelationship(e.target.value)}
                className="input-field"
              >
                <option value="padre">Padre</option>
                <option value="madre">Madre</option>
                <option value="tutor">Tutor Legal</option>
                <option value="abuelo">Abuelo/a</option>
                <option value="otro">Otro</option>
              </select>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Buscar usuario</label>
              <input
                type="text"
                value={parentSearch}
                onChange={(e) => {
                  setParentSearch(e.target.value)
                  fetchAvailableParents(e.target.value)
                }}
                className="input-field"
                placeholder="Nombre, apellido o DUI..."
              />
            </div>

            <div className="max-h-48 overflow-y-auto space-y-2 mb-4">
              {availableParents.length > 0 ? availableParents.map(p => (
                <div key={p.parentId} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">{p.firstName} {p.lastName}</p>
                    <p className="text-xs text-gray-500">{p.phone || p.email || p.dui || 'Sin contacto'}</p>
                  </div>
                  <button
                    onClick={() => handleAssignParent(p.parentId)}
                    className="btn-primary text-sm"
                  >
                    Asignar
                  </button>
                </div>
              )) : (
                <p className="text-center text-gray-400 py-4">Busca un usuario con rol "padre" para asignar</p>
              )}
            </div>

            <div className="flex justify-end">
              <button onClick={() => setShowParentModal(false)} className="btn-secondary">Cerrar</button>
            </div>
          </div>
        </div>
      )}

      {/* Alerts Configuration Modal */}
      {showAlertsModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <Bell className="h-5 w-5 text-primary-600" />
                Configurar Alertas
              </h3>
              <button
                onClick={() => setShowAlertsModal(false)}
                className="text-gray-400 hover:text-gray-600 text-2xl"
              >
                &times;
              </button>
            </div>

            <p className="text-sm text-gray-500 mb-6">
              Define los medios por los cuales el padre recibirá recordatorios de las tomas de medicamentos.
            </p>

            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-green-100 text-green-600 rounded-lg flex items-center justify-center">
                    <Phone className="h-4 w-4" />
                  </div>
                  <span className="text-sm font-medium">WhatsApp</span>
                </div>
                <input type="checkbox" className="w-5 h-5 rounded border-gray-300 text-primary-600 focus:ring-primary-500" defaultChecked />
              </div>

              <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center">
                    <Mail className="h-4 w-4" />
                  </div>
                  <span className="text-sm font-medium">Correo Electrónico</span>
                </div>
                <input type="checkbox" className="w-5 h-5 rounded border-gray-300 text-primary-600 focus:ring-primary-500" />
              </div>

              <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-purple-100 text-purple-600 rounded-lg flex items-center justify-center">
                    <Bell className="h-4 w-4" />
                  </div>
                  <span className="text-sm font-medium">Notificaciones Push</span>
                </div>
                <input type="checkbox" className="w-5 h-5 rounded border-gray-300 text-primary-600 focus:ring-primary-500" defaultChecked />
              </div>
            </div>

            <div className="mt-8 flex gap-3">
              <button
                onClick={() => setShowAlertsModal(false)}
                className="flex-1 btn-secondary"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  alert('Configuración guardada exitosamente (Simulado)');
                  setShowAlertsModal(false);
                }}
                className="flex-1 btn-primary"
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Prescription Modal */}
      {showPrescriptionModal && (
        <PrescriptionModal
          patientId={id}
          doctorId={user?.doctorId}
          onClose={() => setShowPrescriptionModal(false)}
          onSuccess={() => {
            setShowPrescriptionModal(false)
            fetchPrescriptions()
          }}
        />
      )}

      {/* Document Modal */}
      {showDocumentModal && (
        <DocumentModal
          patientId={id}
          initialPatient={patient}
          doctorId={user?.doctorId}
          onClose={() => setShowDocumentModal(false)}
          onSuccess={() => {
            setShowDocumentModal(false)
            // Redirect or refresh documents if view integrated
            alert('Documento generado exitosamente')
          }}
        />
      )}

    </div>
  )
}

function EditPatientModal({ patient, onClose, onSuccess }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [formData, setFormData] = useState({
    firstName: patient?.firstName || '',
    lastName: patient?.lastName || '',
    dateOfBirth: patient?.dateOfBirth?.split('T')[0] || '',
    gender: patient?.gender || 'male',
    bloodType: patient?.bloodType || 'unknown',
    allergies: patient?.allergies?.join(', ') || '',
    chronicConditions: patient?.chronicConditions?.join(', ') || '',
    insuranceProvider: patient?.insuranceProvider || '',
    insurancePolicyNumber: patient?.insurancePolicyNumber || '',
    birthWeightGrams: patient?.birthWeightGrams || '',
    birthHeightCm: patient?.birthHeightCm || '',
    gestationalWeeks: patient?.gestationalWeeks || ''
  })

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const data = {
        ...formData,
        birthWeightGrams: formData.birthWeightGrams ? parseInt(formData.birthWeightGrams) : null,
        birthHeightCm: formData.birthHeightCm ? parseFloat(formData.birthHeightCm) : null,
        gestationalWeeks: formData.gestationalWeeks ? parseInt(formData.gestationalWeeks) : null,
        allergies: formData.allergies ? formData.allergies.split(',').map(a => a.trim()).filter(a => a) : [],
        chronicConditions: formData.chronicConditions ? formData.chronicConditions.split(',').map(c => c.trim()).filter(c => c) : []
      }
      await api.put(`/patients/${patient.id}`, data)
      onSuccess()
    } catch (err) {
      setError(err.response?.data?.error || 'Error al actualizar paciente')
    } finally {
      setLoading(false)
    }
  }

  const bloodTypes = ['unknown', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Editar Paciente</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
            <span className="text-gray-500 text-xl">&times;</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Nombre
              </label>
              <input
                type="text"
                value={formData.firstName}
                onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                className="input-field"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Apellido
              </label>
              <input
                type="text"
                value={formData.lastName}
                onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                className="input-field"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Fecha de Nacimiento
              </label>
              <input
                type="date"
                value={formData.dateOfBirth}
                onChange={(e) => setFormData({ ...formData, dateOfBirth: e.target.value })}
                className="input-field"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Género
              </label>
              <select
                value={formData.gender}
                onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                className="input-field"
              >
                <option value="male">Masculino</option>
                <option value="female">Femenino</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Tipo de Sangre
              </label>
              <select
                value={formData.bloodType}
                onChange={(e) => setFormData({ ...formData, bloodType: e.target.value })}
                className="input-field"
              >
                {bloodTypes.map(type => (
                  <option key={type} value={type}>
                    {type === 'unknown' ? 'No registrado' : type}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Alergias (separadas por coma)
            </label>
            <input
              type="text"
              value={formData.allergies}
              onChange={(e) => setFormData({ ...formData, allergies: e.target.value })}
              className="input-field"
              placeholder="Penicilina, Mariscos, Polen..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Condiciones Crónicas (separadas por coma)
            </label>
            <input
              type="text"
              value={formData.chronicConditions}
              onChange={(e) => setFormData({ ...formData, chronicConditions: e.target.value })}
              className="input-field"
              placeholder="Asma, Diabetes..."
            />
          </div>

          <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
            <h3 className="font-medium text-gray-900 dark:text-white mb-3">Seguro Médico</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Aseguradora
                </label>
                <input
                  type="text"
                  value={formData.insuranceProvider}
                  onChange={(e) => setFormData({ ...formData, insuranceProvider: e.target.value })}
                  className="input-field"
                  placeholder="ISSS, Asesuisa, Mapfre..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Número de Póliza
                </label>
                <input
                  type="text"
                  value={formData.insurancePolicyNumber}
                  onChange={(e) => setFormData({ ...formData, insurancePolicyNumber: e.target.value })}
                  className="input-field"
                  placeholder="POL-123456"
                />
              </div>
            </div>
          </div>

          <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
            <h3 className="font-medium text-gray-900 dark:text-white mb-3">Datos de Nacimiento</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Peso al nacer (g)
                </label>
                <input
                  type="number"
                  value={formData.birthWeightGrams}
                  onChange={(e) => setFormData({ ...formData, birthWeightGrams: e.target.value })}
                  className="input-field"
                  placeholder="3200"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Talla al nacer (cm)
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={formData.birthHeightCm}
                  onChange={(e) => setFormData({ ...formData, birthHeightCm: e.target.value })}
                  className="input-field"
                  placeholder="50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Semanas de gestación
                </label>
                <input
                  type="number"
                  value={formData.gestationalWeeks}
                  onChange={(e) => setFormData({ ...formData, gestationalWeeks: e.target.value })}
                  className="input-field"
                  placeholder="40"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button type="button" onClick={onClose} className="btn-secondary">
              Cancelar
            </button>
            <button type="submit" disabled={loading} className="btn-primary">
              {loading ? 'Guardando...' : 'Guardar Cambios'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function LabExamCard({ exam, onRefresh }) {
  const [analyzing, setAnalyzing] = useState(false)
  const [showInterpretation, setShowInterpretation] = useState(false)

  const analyzeWithAI = async () => {
    setAnalyzing(true)
    try {
      const response = await api.post(`/lab-exams/${exam.id}/analyze`)
      exam.aiInterpretation = response.data.interpretation
      setShowInterpretation(true)
      onRefresh()
    } catch (error) {
      console.error('Error analyzing:', error)
      alert('Error al analizar el examen')
    } finally {
      setAnalyzing(false)
    }
  }

  const statusColors = {
    pending: 'badge-warning',
    completed: 'badge-info',
    reviewed: 'badge-success'
  }

  const statusLabels = {
    pending: 'Pendiente',
    completed: 'Completado',
    reviewed: 'Revisado'
  }

  return (
    <div className="card p-4">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h4 className="font-semibold text-gray-900 dark:text-white">{exam.examName}</h4>
            <span className={`badge ${statusColors[exam.status]}`}>
              {statusLabels[exam.status]}
            </span>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            {exam.examType} • {new Date(exam.examDate).toLocaleDateString('es-ES')}
            {exam.labName && ` • ${exam.labName}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {exam.fileUrl && (
            <a
              href={`${BACKEND_URL}${exam.fileUrl}`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-secondary text-sm px-3 py-1"
            >
              Ver Archivo
            </a>
          )}
          {exam.fileUrl && !exam.aiInterpretation && (
            <button
              onClick={analyzeWithAI}
              disabled={analyzing}
              className="btn-primary text-sm px-3 py-1 flex items-center gap-1"
            >
              {analyzing ? 'Analizando...' : '🤖 Analizar con IA'}
            </button>
          )}
        </div>
      </div>

      {exam.notes && (
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">{exam.notes}</p>
      )}

      {exam.aiInterpretation && (
        <div className="mt-3">
          <button
            onClick={() => setShowInterpretation(!showInterpretation)}
            className="text-sm text-primary-600 hover:underline flex items-center gap-1"
          >
            🤖 {showInterpretation ? 'Ocultar' : 'Ver'} Interpretación IA
          </button>
          {showInterpretation && (
            <div className="mt-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-sm whitespace-pre-wrap">
              {exam.aiInterpretation}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function LabExamModal({ patientId, onClose, onSuccess }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [file, setFile] = useState(null)
  const [formData, setFormData] = useState({
    examType: 'Hemograma',
    examName: '',
    examDate: new Date().toISOString().split('T')[0],
    labName: '',
    notes: ''
  })

  const examTypes = [
    'Hemograma',
    'Química Sanguínea',
    'Orina',
    'Heces',
    'Perfil Lipídico',
    'Función Hepática',
    'Función Renal',
    'Tiroides',
    'Glucosa',
    'Cultivo',
    'Rayos X',
    'Ultrasonido',
    'Otro'
  ]

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const data = new FormData()
      data.append('patientId', patientId)
      data.append('examType', formData.examType)
      data.append('examName', formData.examName || formData.examType)
      data.append('examDate', formData.examDate)
      data.append('labName', formData.labName)
      data.append('notes', formData.notes)
      if (file) {
        data.append('file', file)
      }

      await api.post('/lab-exams', data, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      onSuccess()
    } catch (err) {
      setError(err.response?.data?.error || 'Error al crear examen')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Nuevo Examen de Laboratorio</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
            <span className="text-gray-500 text-xl">&times;</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Tipo de Examen
            </label>
            <select
              value={formData.examType}
              onChange={(e) => setFormData({ ...formData, examType: e.target.value })}
              className="input-field"
            >
              {examTypes.map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Nombre del Examen
            </label>
            <input
              type="text"
              value={formData.examName}
              onChange={(e) => setFormData({ ...formData, examName: e.target.value })}
              className="input-field"
              placeholder="Ej: Hemograma Completo, BHC..."
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Fecha del Examen
              </label>
              <input
                type="date"
                value={formData.examDate}
                onChange={(e) => setFormData({ ...formData, examDate: e.target.value })}
                className="input-field"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Laboratorio
              </label>
              <input
                type="text"
                value={formData.labName}
                onChange={(e) => setFormData({ ...formData, labName: e.target.value })}
                className="input-field"
                placeholder="Nombre del laboratorio"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Archivo (Imagen o PDF)
            </label>
            <input
              type="file"
              accept="image/*,.pdf"
              onChange={(e) => setFile(e.target.files[0])}
              className="input-field"
            />
            <p className="text-xs text-gray-500 mt-1">
              Sube una foto o PDF del examen para análisis con IA
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Notas
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="input-field"
              rows={2}
              placeholder="Observaciones adicionales..."
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button type="button" onClick={onClose} className="btn-secondary">
              Cancelar
            </button>
            <button type="submit" disabled={loading} className="btn-primary">
              {loading ? 'Guardando...' : 'Guardar Examen'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
