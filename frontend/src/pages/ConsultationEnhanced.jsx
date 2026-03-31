import { useState, useEffect } from 'react'
import { useParams, useSearchParams, useNavigate } from 'react-router-dom'
import api from '../services/api'
import { useAuth } from '../context/AuthContext'
import { usePreferences } from '../context/PreferencesContext'
import GrowthCharts from '../components/GrowthCharts'
import GrowthComparison3D from '../components/GrowthComparison3D'
import {
  ArrowLeft, Save, AlertTriangle, Brain, Thermometer,
  Heart, Activity, Scale, Ruler, Plus, Pill, FileText,
  CheckCircle, Loader2, TrendingUp, Trash2, Sparkles, Wand2
} from 'lucide-react'

export default function ConsultationEnhanced() {
  const { id } = useParams()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { getUnitLabel, convertWeight, convertHeight, convertTemperature, convertHeadCircumference, preferences } = usePreferences()
  const weightUnit = getUnitLabel('weight')
  const heightUnit = getUnitLabel('height')

  const [consultation, setConsultation] = useState(null)
  const [patient, setPatient] = useState(null)
  const [growthComparison, setGrowthComparison] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiSuggestions, setAiSuggestions] = useState(null)
  const [activeTab, setActiveTab] = useState('vitals')
  const [view3DMode, setView3DMode] = useState('bars')
  const [consultationDate, setConsultationDate] = useState(new Date().toISOString().split('T')[0])

  const [vitals, setVitals] = useState({
    weightKg: '',
    heightCm: '',
    headCircumferenceCm: '',
    temperatureCelsius: '',
    heartRateBpm: '',
    respiratoryRate: '',
    bloodPressureSystolic: '',
    bloodPressureDiastolic: '',
    oxygenSaturation: ''
  })

  const [diagnosis, setDiagnosis] = useState({
    reasonForVisit: '',
    symptoms: '',
    symptomDuration: '',
    physicalExamNotes: '',
    diagnosisCodes: [],
    diagnosisDescriptions: [],
    treatmentPlan: '',
    followUpInstructions: '',
    followUpDays: '',
    privateNotes: ''
  })

  const [prescriptionItems, setPrescriptionItems] = useState([])
  const [showPrescriptionForm, setShowPrescriptionForm] = useState(false)
  const [medicationSuggestions, setMedicationSuggestions] = useState([])
  const [activeMedicationIndex, setActiveMedicationIndex] = useState(null)
  const [calculatingDose, setCalculatingDose] = useState(null)
  const [doseError, setDoseError] = useState(null)
  const [suggestionsLoading, setSuggestionsLoading] = useState(false)

  useEffect(() => {
    initializeConsultation()
  }, [id])

  const initializeConsultation = async () => {
    try {
      const patientId = searchParams.get('patientId')
      const appointmentId = searchParams.get('appointmentId')

      if (id && id !== 'new') {
        const response = await api.get(`/consultations/${id}`)
        setConsultation(response.data)
        setPatient(response.data.patient)
        loadVitalsFromConsultation(response.data)
        loadDiagnosisFromConsultation(response.data)
        setAiSuggestions(response.data.aiSuggestions)

        if (response.data.patient?.id) {
          fetchGrowthComparison(response.data.patient.id)
        }
      } else if (patientId) {
        const patientRes = await api.get(`/patients/${patientId}`)
        setPatient(patientRes.data)

        // Create consultation - doctorId and clinicId may be null for admin users
        const consultRes = await api.post('/consultations', {
          patientId,
          doctorId: user.doctorId || null,
          appointmentId: appointmentId || null,
          clinicId: user.clinicId || null
        })
        setConsultation(consultRes.data)
        fetchGrowthComparison(patientId)
      }
    } catch (error) {
      console.error('Error initializing consultation:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadVitalsFromConsultation = (data) => {
    // Convert from metric (stored in DB) to display units
    setVitals({
      weightKg: data.weightKg ? convertWeight(data.weightKg, true) : '',
      heightCm: data.heightCm ? convertHeight(data.heightCm, true) : '',
      headCircumferenceCm: data.headCircumferenceCm ? convertHeadCircumference(data.headCircumferenceCm, true) : '',
      temperatureCelsius: data.temperatureCelsius ? convertTemperature(data.temperatureCelsius, true) : '',
      heartRateBpm: data.heartRateBpm || '',
      respiratoryRate: data.respiratoryRate || '',
      bloodPressureSystolic: data.bloodPressureSystolic || '',
      bloodPressureDiastolic: data.bloodPressureDiastolic || '',
      oxygenSaturation: data.oxygenSaturation || ''
    })
  }

  const loadDiagnosisFromConsultation = (data) => {
    setDiagnosis({
      reasonForVisit: data.reasonForVisit || '',
      symptoms: data.symptoms || '',
      symptomDuration: data.symptomDuration || '',
      physicalExamNotes: data.physicalExamNotes || '',
      diagnosisCodes: data.diagnosisCodes || [],
      diagnosisDescriptions: data.diagnosisDescriptions || [],
      treatmentPlan: data.treatmentPlan || '',
      followUpInstructions: data.followUpInstructions || '',
      followUpDays: data.followUpDays || '',
      privateNotes: data.privateNotes || ''
    })
  }

  const fetchGrowthComparison = async (patientId) => {
    try {
      // Use advanced 3D comparison endpoint
      const response = await api.get(`/growth/patient/${patientId}/comparison3d`)
      setGrowthComparison(response.data)
    } catch (error) {
      console.error('Error fetching growth comparison:', error)
    }
  }

  const saveVitals = async () => {
    if (!consultation?.id) return
    setSaving(true)
    try {
      // Convert from display units to metric (DB always stores kg/cm/celsius)
      const weightInKg = vitals.weightKg ? convertWeight(parseFloat(vitals.weightKg), false) : null
      const heightInCm = vitals.heightCm ? convertHeight(parseFloat(vitals.heightCm), false) : null
      const headCircInCm = vitals.headCircumferenceCm ? convertHeadCircumference(parseFloat(vitals.headCircumferenceCm), false) : null
      const tempInCelsius = vitals.temperatureCelsius ? convertTemperature(parseFloat(vitals.temperatureCelsius), false) : null

      await api.patch(`/consultations/${consultation.id}/vitals`, {
        weightKg: weightInKg,
        heightCm: heightInCm,
        headCircumferenceCm: headCircInCm,
        temperatureCelsius: tempInCelsius,
        heartRateBpm: vitals.heartRateBpm ? parseInt(vitals.heartRateBpm) : null,
        respiratoryRate: vitals.respiratoryRate ? parseInt(vitals.respiratoryRate) : null,
        bloodPressureSystolic: vitals.bloodPressureSystolic ? parseInt(vitals.bloodPressureSystolic) : null,
        bloodPressureDiastolic: vitals.bloodPressureDiastolic ? parseInt(vitals.bloodPressureDiastolic) : null,
        oxygenSaturation: vitals.oxygenSaturation ? parseInt(vitals.oxygenSaturation) : null,
        consultationDate: consultationDate || null
      })

      // Refresh growth comparison after saving vitals
      if (patient?.id) {
        fetchGrowthComparison(patient.id)
      }
    } catch (error) {
      console.error('Error saving vitals:', error)
    } finally {
      setSaving(false)
    }
  }

  const saveDiagnosis = async () => {
    if (!consultation?.id) return
    setSaving(true)
    try {
      await api.patch(`/consultations/${consultation.id}/diagnosis`, diagnosis)
    } catch (error) {
      console.error('Error saving diagnosis:', error)
    } finally {
      setSaving(false)
    }
  }

  const savePrescription = async () => {
    if (!consultation?.id || prescriptionItems.length === 0) return
    setSaving(true)
    try {
      await api.post('/prescriptions', {
        consultationId: consultation.id,
        patientId: patient.id,
        doctorId: user.doctorId, // Added doctorId to fix 400 error
        items: prescriptionItems
      })
      setShowPrescriptionForm(false)
    } catch (error) {
      console.error('Error saving prescription:', error)
    } finally {
      setSaving(false)
    }
  }

  const searchMedicationIA = async (queryText, index) => {
    if (!queryText || queryText.length < 3) {
      setMedicationSuggestions([])
      return
    }
    setActiveMedicationIndex(index)
    setSuggestionsLoading(true)
    try {
      const response = await api.post('/ai/medication-suggestions', { query: queryText })
      setMedicationSuggestions(response.data.suggestions || [])
    } catch (error) {
      console.error('Error fetching medication suggestions:', error)
    } finally {
      setSuggestionsLoading(false)
    }
  }

  const getAIDoseSuggestion = async (index) => {
    const item = prescriptionItems[index]
    if (!item.medicationName || !patient?.id) return

    setCalculatingDose(index)
    setDoseError(null)
    try {
      const response = await api.post('/ai/calculate-dose-ai', {
        medicationName: item.medicationName,
        patientId: patient.id
      })

      if (response.data) {
        const updatedItems = [...prescriptionItems]
        updatedItems[index] = {
          ...updatedItems[index],
          dose: response.data.recommendedDose,
          frequency: response.data.frequency,
          route: response.data.route.toLowerCase(),
          instructions: response.data.reasoning
        }
        setPrescriptionItems(updatedItems)
      }
    } catch (error) {
      console.error('Error calculating AI dose:', error)
      setDoseError('No se pudo calcular la dosis con IA. Intente nuevamente.')
    } finally {
      setCalculatingDose(null)
    }
  }

  const selectMedicationSuggestion = (suggestion, index) => {
    const updatedItems = [...prescriptionItems]
    updatedItems[index] = {
      ...updatedItems[index],
      medicationName: suggestion.name,
      concentration: suggestion.presentation || updatedItems[index].concentration,
      genericName: suggestion.generic
    }
    setPrescriptionItems(updatedItems)
    setMedicationSuggestions([])
    setActiveMedicationIndex(null)
  }

  const getAISuggestions = async () => {
    if (!patient?.id || !diagnosis.symptoms) return
    setAiLoading(true)
    try {
      const response = await api.post('/ai/diagnose', {
        patientId: patient.id,
        symptoms: diagnosis.symptoms,
        vitals: {
          temperature: vitals.temperatureCelsius,
          heartRate: vitals.heartRateBpm,
          respiratoryRate: vitals.respiratoryRate,
          oxygenSaturation: vitals.oxygenSaturation,
          weight: vitals.weightKg
        },
        additionalInfo: `Duración: ${diagnosis.symptomDuration}. Motivo: ${diagnosis.reasonForVisit}`
      })
      setAiSuggestions(response.data)
    } catch (error) {
      console.error('Error getting AI suggestions:', error)
    } finally {
      setAiLoading(false)
    }
  }

  const completeConsultation = async () => {
    if (!consultation?.id) return
    setSaving(true)
    try {
      await saveDiagnosis()
      if (prescriptionItems.length > 0) {
        await savePrescription()
      }
      await api.patch(`/consultations/${consultation.id}/complete`)
      if (patient?.id) {
        navigate(`/patients/${patient.id}`)
      } else {
        navigate('/patients')
      }
    } catch (error) {
      console.error('Error completing consultation:', error)
    } finally {
      setSaving(false)
    }
  }

  const calculateAge = (dob, referenceDate) => {
    if (!dob) return ''
    const birth = new Date(dob)
    const ref = referenceDate ? new Date(referenceDate) : new Date()
    const years = ref.getFullYear() - birth.getFullYear()
    const months = ref.getMonth() - birth.getMonth()
    const totalMonths = years * 12 + months
    if (totalMonths < 12) return `${totalMonths} meses`
    const y = Math.floor(totalMonths / 12)
    const m = totalMonths % 12
    if (y < 3) return `${y} año${y > 1 ? 's' : ''} ${m > 0 ? m + 'm' : ''}`
    return `${y} años`
  }

  const addPrescriptionItem = () => {
    setPrescriptionItems([...prescriptionItems, {
      medicationName: '',
      concentration: '',
      dose: '',
      doseUnit: 'ml',
      frequency: '',
      duration: '',
      route: 'oral',
      instructions: ''
    }])
  }

  const updatePrescriptionItem = (index, field, value) => {
    const updated = [...prescriptionItems]
    updated[index][field] = value
    setPrescriptionItems(updated)
  }

  const removePrescriptionItem = (index) => {
    setPrescriptionItems(prescriptionItems.filter((_, i) => i !== index))
  }

  const addTreatmentToPrescription = (treatmentText) => {
    // Quick parse: "Medication (Dose)" or just "Medication"
    const namePart = treatmentText.split('(')[0].trim()
    const dosePart = treatmentText.includes('(') ? treatmentText.split('(')[1].split(')')[0].trim() : ''

    setPrescriptionItems([...prescriptionItems, {
      medicationName: namePart,
      concentration: '',
      dose: dosePart,
      doseUnit: dosePart.toLowerCase().includes('mg') ? 'mg' : 'ml',
      frequency: '',
      duration: '',
      route: 'oral',
      instructions: 'Sugerido por IA'
    }])
    setActiveTab('prescription')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  const tabs = [
    { id: 'vitals', label: 'Signos Vitales', icon: Activity },
    { id: 'exam', label: 'Examen', icon: FileText },
    { id: 'diagnosis', label: 'Diagnóstico', icon: Brain },
    { id: 'prescription', label: 'Receta', icon: Pill },
    { id: 'growth', label: 'Crecimiento', icon: TrendingUp },
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
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Consulta Médica
          </h1>
          <p className="text-gray-500 dark:text-gray-400">
            {patient?.firstName} {patient?.lastName} • {calculateAge(patient?.dateOfBirth, consultationDate)}
            {growthComparison?.current?.weight && (
              <span className="ml-2 text-primary-600">
                • P{growthComparison.current.weight.percentile?.toFixed(0)} peso
              </span>
            )}
          </p>
        </div>
        <button
          onClick={completeConsultation}
          disabled={saving}
          className="btn-primary flex items-center gap-2"
        >
          <CheckCircle className="h-5 w-5" />
          Finalizar Consulta
        </button>
      </div>

      {/* Patient Alerts */}
      {patient?.allergies?.length > 0 && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0" />
          <div>
            <p className="font-medium text-red-700 dark:text-red-400">Alergias:</p>
            <p className="text-red-600 dark:text-red-300">{patient.allergies.join(', ')}</p>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700 overflow-x-auto">
        <nav className="flex gap-4 min-w-max">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 pb-3 px-1 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${activeTab === tab.id
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          {/* Vitals Tab */}
          {activeTab === 'vitals' && (
            <div className="card p-6 space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Signos Vitales</h3>
                <div className="flex items-center gap-2">
                  <label className="text-sm text-gray-500 dark:text-gray-400">Fecha:</label>
                  <input
                    type="date"
                    value={consultationDate}
                    onChange={(e) => setConsultationDate(e.target.value)}
                    className="input-field text-sm w-40"
                  />
                  <span className="text-xs text-primary-600 font-medium">
                    Edad: {calculateAge(patient?.dateOfBirth, consultationDate)}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <VitalInput
                  icon={Scale}
                  label={`Peso (${getUnitLabel('weight')})`}
                  value={vitals.weightKg}
                  onChange={(v) => setVitals({ ...vitals, weightKg: v })}
                  placeholder={preferences.units.weight === 'kg' ? '10.5' : '23'}
                  highlight={growthComparison?.current?.weight?.percentile < 15 || growthComparison?.current?.weight?.percentile > 85}
                />
                <VitalInput
                  icon={Ruler}
                  label={`Talla (${getUnitLabel('height')})`}
                  value={vitals.heightCm}
                  onChange={(v) => setVitals({ ...vitals, heightCm: v })}
                  placeholder={preferences.units.height === 'cm' ? '75' : '30'}
                  highlight={growthComparison?.current?.height?.percentile < 15 || growthComparison?.current?.height?.percentile > 85}
                />
                <VitalInput
                  icon={Ruler}
                  label={`P. Cefálico (${getUnitLabel('headCircumference')})`}
                  value={vitals.headCircumferenceCm}
                  onChange={(v) => setVitals({ ...vitals, headCircumferenceCm: v })}
                  placeholder={preferences.units.headCircumference === 'cm' ? '45' : '18'}
                />
                <VitalInput
                  icon={Thermometer}
                  label={`Temperatura (${getUnitLabel('temperature')})`}
                  value={vitals.temperatureCelsius}
                  onChange={(v) => setVitals({ ...vitals, temperatureCelsius: v })}
                  placeholder={preferences.units.temperature === 'celsius' ? '36.5' : '97.7'}
                  highlight={parseFloat(vitals.temperatureCelsius) >= (preferences.units.temperature === 'celsius' ? 38 : 100.4)}
                  highlightColor="red"
                />
                <VitalInput
                  icon={Heart}
                  label="FC (lpm)"
                  value={vitals.heartRateBpm}
                  onChange={(v) => setVitals({ ...vitals, heartRateBpm: v })}
                  placeholder="100"
                />
                <VitalInput
                  icon={Activity}
                  label="FR (rpm)"
                  value={vitals.respiratoryRate}
                  onChange={(v) => setVitals({ ...vitals, respiratoryRate: v })}
                  placeholder="20"
                />
                <VitalInput
                  label="SpO2 (%)"
                  value={vitals.oxygenSaturation}
                  onChange={(v) => setVitals({ ...vitals, oxygenSaturation: v })}
                  placeholder="98"
                  highlight={parseInt(vitals.oxygenSaturation) < 95}
                  highlightColor="red"
                />
                <VitalInput
                  label="PA Sistólica"
                  value={vitals.bloodPressureSystolic}
                  onChange={(v) => setVitals({ ...vitals, bloodPressureSystolic: v })}
                  placeholder="100"
                />
                <VitalInput
                  label="PA Diastólica"
                  value={vitals.bloodPressureDiastolic}
                  onChange={(v) => setVitals({ ...vitals, bloodPressureDiastolic: v })}
                  placeholder="60"
                />
              </div>

              {/* Quick comparison */}
              {growthComparison?.current && (
                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <h4 className="font-medium text-blue-800 dark:text-blue-300 mb-2">Comparación con Ideal</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    {growthComparison.current.weight && (
                      <div>
                        <span className="text-gray-600 dark:text-gray-400">Peso: </span>
                        <span className="font-medium">{convertWeight(growthComparison.current.weight.value, true)} {weightUnit}</span>
                        <span className="text-gray-500"> (ideal: {convertWeight(growthComparison.ideal.weight, true)} {weightUnit})</span>
                        <span className={`ml-2 badge ${growthComparison.current.weight.percentile < 15 || growthComparison.current.weight.percentile > 85
                          ? 'badge-warning' : 'badge-success'
                          }`}>
                          P{growthComparison.current.weight.percentile?.toFixed(0)}
                        </span>
                      </div>
                    )}
                    {growthComparison.current.height && (
                      <div>
                        <span className="text-gray-600 dark:text-gray-400">Talla: </span>
                        <span className="font-medium">{convertHeight(growthComparison.current.height.value, true)} {heightUnit}</span>
                        <span className="text-gray-500"> (ideal: {convertHeight(growthComparison.ideal.height, true)} {heightUnit})</span>
                        <span className={`ml-2 badge ${growthComparison.current.height.percentile < 15 || growthComparison.current.height.percentile > 85
                          ? 'badge-warning' : 'badge-success'
                          }`}>
                          P{growthComparison.current.height.percentile?.toFixed(0)}
                        </span>
                      </div>
                    )}
                  </div>
                  {growthComparison.changes && (
                    <p className="text-xs text-gray-500 mt-2">
                      Cambio desde última consulta:
                      {growthComparison.changes.weight && ` +${convertWeight(growthComparison.changes.weight, true)} ${weightUnit}`}
                      {growthComparison.changes.height && `, +${convertHeight(growthComparison.changes.height, true)} ${heightUnit}`}
                    </p>
                  )}
                </div>
              )}

              <button onClick={saveVitals} disabled={saving} className="btn-primary">
                {saving ? 'Guardando...' : 'Guardar Signos Vitales'}
              </button>
            </div>
          )}

          {/* Exam Tab */}
          {activeTab === 'exam' && (
            <div className="card p-6 space-y-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Motivo y Examen</h3>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Motivo de Consulta
                </label>
                <input
                  type="text"
                  value={diagnosis.reasonForVisit}
                  onChange={(e) => setDiagnosis({ ...diagnosis, reasonForVisit: e.target.value })}
                  className="input-field"
                  placeholder="Fiebre, tos, control de niño sano..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Síntomas
                </label>
                <textarea
                  value={diagnosis.symptoms}
                  onChange={(e) => setDiagnosis({ ...diagnosis, symptoms: e.target.value })}
                  className="input-field"
                  rows={3}
                  placeholder="Describe los síntomas del paciente..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Duración de Síntomas
                  </label>
                  <input
                    type="text"
                    value={diagnosis.symptomDuration}
                    onChange={(e) => setDiagnosis({ ...diagnosis, symptomDuration: e.target.value })}
                    className="input-field"
                    placeholder="3 días, 1 semana..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Seguimiento en (días)
                  </label>
                  <input
                    type="number"
                    value={diagnosis.followUpDays}
                    onChange={(e) => setDiagnosis({ ...diagnosis, followUpDays: e.target.value })}
                    className="input-field"
                    placeholder="7"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Examen Físico
                </label>
                <textarea
                  value={diagnosis.physicalExamNotes}
                  onChange={(e) => setDiagnosis({ ...diagnosis, physicalExamNotes: e.target.value })}
                  className="input-field"
                  rows={4}
                  placeholder="Hallazgos del examen físico..."
                />
              </div>

              <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  onClick={getAISuggestions}
                  disabled={aiLoading || !diagnosis.symptoms}
                  className="btn-secondary flex items-center gap-2"
                >
                  {aiLoading ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <Brain className="h-5 w-5" />
                  )}
                  Obtener Sugerencias IA
                </button>
              </div>
            </div>
          )}

          {/* Diagnosis Tab */}
          {activeTab === 'diagnosis' && (
            <div className="card p-6 space-y-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Diagnóstico y Plan</h3>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Diagnóstico(s)
                </label>
                <input
                  type="text"
                  value={diagnosis.diagnosisDescriptions.join(', ')}
                  onChange={(e) => setDiagnosis({
                    ...diagnosis,
                    diagnosisDescriptions: e.target.value.split(',').map(d => d.trim()).filter(Boolean)
                  })}
                  className="input-field"
                  placeholder="Faringitis aguda, Otitis media..."
                />
                <p className="text-xs text-gray-500 mt-1">Separa múltiples diagnósticos con comas</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Plan de Tratamiento
                </label>
                <textarea
                  value={diagnosis.treatmentPlan}
                  onChange={(e) => setDiagnosis({ ...diagnosis, treatmentPlan: e.target.value })}
                  className="input-field"
                  rows={4}
                  placeholder="Tratamiento indicado, medidas generales..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Indicaciones de Seguimiento
                </label>
                <textarea
                  value={diagnosis.followUpInstructions}
                  onChange={(e) => setDiagnosis({ ...diagnosis, followUpInstructions: e.target.value })}
                  className="input-field"
                  rows={2}
                  placeholder="Regresar si persiste fiebre, signos de alarma..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Notas Privadas (solo visible para el doctor)
                </label>
                <textarea
                  value={diagnosis.privateNotes}
                  onChange={(e) => setDiagnosis({ ...diagnosis, privateNotes: e.target.value })}
                  className="input-field"
                  rows={2}
                  placeholder="Notas internas, sospechas, pendientes..."
                />
              </div>

              <button onClick={saveDiagnosis} disabled={saving} className="btn-primary">
                {saving ? 'Guardando...' : 'Guardar Diagnóstico'}
              </button>
            </div>
          )}

          {/* Prescription Tab */}
          {activeTab === 'prescription' && (
            <div className="card p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Receta Médica</h3>
                <button
                  onClick={addPrescriptionItem}
                  className="btn-secondary text-sm flex items-center gap-1"
                >
                  <Plus className="h-4 w-4" />
                  Agregar Medicamento
                </button>
              </div>

              {prescriptionItems.length > 0 ? (
                <div className="space-y-4">
                  {prescriptionItems.map((item, index) => (
                    <div key={index} className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg space-y-3">
                      <div className="flex justify-between items-start">
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          Medicamento {index + 1}
                        </span>
                        <button
                          onClick={() => removePrescriptionItem(index)}
                          className="p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="relative">
                          <input
                            type="text"
                            value={item.medicationName}
                            onChange={(e) => {
                              updatePrescriptionItem(index, 'medicationName', e.target.value)
                              searchMedicationIA(e.target.value, index)
                            }}
                            className="input-field"
                            placeholder="Nombre (ej: Tylenol)"
                          />
                          {activeMedicationIndex === index && (suggestionsLoading || medicationSuggestions.length > 0) && (
                            <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 rounded-md shadow-lg border border-gray-200 dark:border-gray-700 max-h-48 overflow-y-auto">
                              {suggestionsLoading ? (
                                <div className="px-3 py-4 text-center">
                                  <Loader2 className="h-5 w-5 animate-spin mx-auto text-primary-600" />
                                  <p className="text-xs text-gray-500 mt-1">Buscando con IA...</p>
                                </div>
                              ) : (
                                medicationSuggestions.map((s, i) => (
                                  <button
                                    key={i}
                                    className="w-full text-left px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 text-sm border-b border-gray-50 dark:border-gray-700 last:border-0"
                                    onClick={() => selectMedicationSuggestion(s, index)}
                                  >
                                    <div className="font-medium text-gray-900 dark:text-white">{s.name}</div>
                                    <div className="text-[10px] text-gray-500">{s.generic} • {s.presentation}</div>
                                  </button>
                                ))
                              )}
                            </div>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={item.concentration}
                            onChange={(e) => updatePrescriptionItem(index, 'concentration', e.target.value)}
                            className="input-field flex-1"
                            placeholder="Concentración (ej: 250mg/5ml)"
                          />
                          <button
                            onClick={() => getAIDoseSuggestion(index)}
                            title="Sugerir dosis con IA"
                            disabled={calculatingDose === index || !item.medicationName}
                            className={`p-2 rounded-lg border transition-colors ${calculatingDose === index
                              ? 'bg-primary-50 text-primary-600 animate-pulse'
                              : 'bg-white text-gray-600 hover:text-primary-600 hover:border-primary-600'
                              }`}
                          >
                            {calculatingDose === index ? <Loader2 className="h-5 w-5 animate-spin" /> : <Wand2 className="h-5 w-5" />}
                          </button>
                        </div>
                        {doseError && calculatingDose === null && (
                          <p className="text-xs text-red-500 mt-1">{doseError}</p>
                        )}
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={item.dose}
                            onChange={(e) => updatePrescriptionItem(index, 'dose', e.target.value)}
                            className="input-field flex-1"
                            placeholder="Dosis"
                          />
                          <select
                            value={item.doseUnit}
                            onChange={(e) => updatePrescriptionItem(index, 'doseUnit', e.target.value)}
                            className="input-field w-20"
                          >
                            <option value="ml">ml</option>
                            <option value="mg">mg</option>
                            <option value="gotas">gotas</option>
                            <option value="tableta">tab</option>
                          </select>
                        </div>
                        <input
                          type="text"
                          value={item.frequency}
                          onChange={(e) => updatePrescriptionItem(index, 'frequency', e.target.value)}
                          className="input-field"
                          placeholder="Frecuencia (ej: cada 8h)"
                        />
                        <input
                          type="text"
                          value={item.duration}
                          onChange={(e) => updatePrescriptionItem(index, 'duration', e.target.value)}
                          className="input-field"
                          placeholder="Duración (ej: 7 días)"
                        />
                        <select
                          value={item.route}
                          onChange={(e) => updatePrescriptionItem(index, 'route', e.target.value)}
                          className="input-field"
                        >
                          <option value="oral">Oral</option>
                          <option value="topico">Tópico</option>
                          <option value="inhalado">Inhalado</option>
                          <option value="intramuscular">IM</option>
                          <option value="intravenoso">IV</option>
                          <option value="rectal">Rectal</option>
                          <option value="oftalmico">Oftálmico</option>
                          <option value="otico">Ótico</option>
                        </select>
                      </div>
                      <input
                        type="text"
                        value={item.instructions}
                        onChange={(e) => updatePrescriptionItem(index, 'instructions', e.target.value)}
                        className="input-field"
                        placeholder="Instrucciones especiales (ej: tomar con alimentos)"
                      />
                    </div>
                  ))}

                  <button onClick={savePrescription} disabled={saving} className="btn-primary">
                    {saving ? 'Guardando...' : 'Guardar Receta'}
                  </button>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <Pill className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>Sin medicamentos agregados</p>
                  <button
                    onClick={addPrescriptionItem}
                    className="mt-2 text-primary-600 hover:underline text-sm"
                  >
                    Agregar primer medicamento
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Growth Tab */}
          {activeTab === 'growth' && (
            <div className="space-y-6">
              {/* 3D Comparison */}
              <div className="card p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Comparación 3D
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
                  </div>
                </div>

                <GrowthComparison3D data={growthComparison} viewMode={view3DMode} />

                <p className="text-xs text-gray-500 mt-2 text-center">
                  Comparación visual de crecimiento
                </p>
              </div>

              {/* Growth Charts */}
              <div className="card p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  Curvas de Crecimiento (OMS)
                </h3>
                <GrowthCharts
                  patientId={patient?.id}
                  gender={patient?.gender}
                  currentAge={growthComparison?.patient?.ageMonths}
                />
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* AI Suggestions */}
          {aiSuggestions && (
            <div className="card p-4 space-y-4">
              <h4 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <Brain className="h-5 w-5 text-primary-600" />
                Sugerencias IA
              </h4>

              {aiSuggestions.differentialDiagnoses?.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Diagnósticos Diferenciales
                  </p>
                  <div className="space-y-2">
                    {aiSuggestions.differentialDiagnoses.map((d, i) => (
                      <button
                        key={i}
                        onClick={() => {
                          if (!diagnosis.diagnosisDescriptions.includes(d.diagnosis)) {
                            setDiagnosis({
                              ...diagnosis,
                              diagnosisDescriptions: [...diagnosis.diagnosisDescriptions, d.diagnosis]
                            })
                          }
                        }}
                        className="w-full p-2 bg-blue-50 dark:bg-blue-900/20 rounded text-sm text-left hover:bg-blue-100 dark:hover:bg-blue-900/40"
                      >
                        <div className="flex justify-between">
                          <span className="font-medium">{d.diagnosis}</span>
                          <span className="text-blue-600">{d.probability}%</span>
                        </div>
                        {d.reasoning && (
                          <p className="text-gray-500 text-xs mt-1">{d.reasoning}</p>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {aiSuggestions.redFlags?.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-red-700 dark:text-red-400 mb-2">
                    Banderas Rojas
                  </p>
                  <ul className="space-y-1">
                    {aiSuggestions.redFlags.map((flag, i) => (
                      <li key={i} className="text-sm text-red-600 dark:text-red-400 flex items-start gap-2">
                        <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                        {flag}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {aiSuggestions.suggestedTreatments?.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Tratamientos Sugeridos
                  </p>
                  <div className="space-y-1">
                    {aiSuggestions.suggestedTreatments.map((t, i) => (
                      <button
                        key={i}
                        onClick={() => addTreatmentToPrescription(t)}
                        className="w-full text-left p-2 hover:bg-green-50 dark:hover:bg-green-900/10 rounded flex items-start gap-2 group transition-colors"
                      >
                        <div className="relative flex-shrink-0 mt-0.5 h-4 w-4">
                          <Plus className="absolute inset-0 h-4 w-4 text-green-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                          <Pill className="absolute inset-0 h-4 w-4 text-green-600 opacity-100 group-hover:opacity-0 transition-opacity" />
                        </div>
                        <span className="text-sm text-gray-600 dark:text-gray-400">{t}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Patient Summary */}
          <div className="card p-4">
            <h4 className="font-semibold text-gray-900 dark:text-white mb-3">Resumen Paciente</h4>
            <div className="space-y-2 text-sm">
              <p><strong>Edad:</strong> {calculateAge(patient?.dateOfBirth)}</p>
              <p><strong>Sangre:</strong> {patient?.bloodType || 'No registrado'}</p>
              {patient?.chronicConditions?.length > 0 && (
                <div>
                  <strong>Condiciones:</strong>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {patient.chronicConditions.map((c, i) => (
                      <span key={i} className="badge badge-warning">{c}</span>
                    ))}
                  </div>
                </div>
              )}
              {growthComparison?.current && (
                <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
                  <p><strong>Último peso:</strong> {growthComparison.current.weight?.value} kg</p>
                  <p><strong>Última talla:</strong> {growthComparison.current.height?.value} cm</p>
                </div>
              )}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="card p-4">
            <h4 className="font-semibold text-gray-900 dark:text-white mb-3">Acciones Rápidas</h4>
            <div className="space-y-2">
              <button
                onClick={() => setActiveTab('prescription')}
                className="w-full btn-secondary text-sm flex items-center justify-center gap-2"
              >
                <Pill className="h-4 w-4" />
                Nueva Receta
              </button>
              <button
                onClick={() => setActiveTab('growth')}
                className="w-full btn-secondary text-sm flex items-center justify-center gap-2"
              >
                <TrendingUp className="h-4 w-4" />
                Ver Crecimiento
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function VitalInput({ icon: Icon, label, value, onChange, placeholder, highlight, highlightColor = 'yellow' }) {
  const highlightClasses = highlight
    ? highlightColor === 'red'
      ? 'ring-2 ring-red-500 bg-red-50 dark:bg-red-900/20'
      : 'ring-2 ring-yellow-500 bg-yellow-50 dark:bg-yellow-900/20'
    : ''

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-1">
        {Icon && <Icon className="h-4 w-4" />}
        {label}
      </label>
      <input
        type="number"
        step="0.1"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`input-field ${highlightClasses}`}
        placeholder={placeholder}
      />
    </div>
  )
}
