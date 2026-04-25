import { useState, useEffect } from 'react'
import api from '../services/api'
import {
  Building2, Plus, X,
  Phone, Mail, MapPin, Palette, Layout, Upload, ImagePlus, Monitor
} from 'lucide-react'

export default function Clinics() {
  const [clinics, setClinics] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingClinic, setEditingClinic] = useState(null)

  useEffect(() => {
    fetchClinics()
  }, [])

  const fetchClinics = async () => {
    try {
      const response = await api.get('/clinics')
      // Fetch stats for each clinic
      const clinicsWithStats = await Promise.all(
        response.data.map(async (clinic) => {
          try {
            const statsRes = await api.get(`/clinics/${clinic.id}/stats`)
            return { ...clinic, stats: statsRes.data }
          } catch {
            return { ...clinic, stats: null }
          }
        })
      )
      setClinics(clinicsWithStats)
    } catch (error) {
      console.error('Error fetching clinics:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Clínicas</h1>
          <p className="text-gray-500 dark:text-gray-400">Gestión de clínicas y sucursales</p>
        </div>
        <button
          onClick={() => { setEditingClinic(null); setShowModal(true) }}
          className="btn-primary flex items-center gap-2"
        >
          <Plus className="h-5 w-5" />
          Nueva Clínica
        </button>
      </div>

      {/* Clinics Grid */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        </div>
      ) : clinics.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {clinics.map((clinic) => (
            <div key={clinic.id} className="card p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 rounded-lg bg-primary-100 dark:bg-primary-900 flex items-center justify-center">
                  <Building2 className="h-6 w-6 text-primary-600" />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => { setEditingClinic(clinic); setShowModal(true) }}
                    className="flex items-center gap-2 px-3 py-1.5 text-xs font-bold bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400 rounded-xl transition-all border border-blue-100 dark:border-blue-800"
                  >
                    <Palette className="h-4 w-4" />
                    Configurar
                  </button>
                </div>
              </div>

              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                {clinic.name}
              </h3>

              <div className="space-y-2 text-sm text-gray-500 dark:text-gray-400 mb-4">
                {clinic.address && (
                  <p className="flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    {clinic.address}
                  </p>
                )}
                {clinic.phone && (
                  <p className="flex items-center gap-2">
                    <Phone className="h-4 w-4" />
                    {clinic.phone}
                  </p>
                )}
                {clinic.email && (
                  <p className="flex items-center gap-2">
                    <Mail className="h-4 w-4" />
                    {clinic.email}
                  </p>
                )}
              </div>

              {clinic.stats && (
                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <div>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">
                      {clinic.stats.activeDoctors}
                    </p>
                    <p className="text-xs text-gray-500">Doctores</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">
                      {clinic.stats.totalPatients}
                    </p>
                    <p className="text-xs text-gray-500">Pacientes</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">
                      {clinic.stats.todayAppointments}
                    </p>
                    <p className="text-xs text-gray-500">Citas Hoy</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">
                      {clinic.stats.monthConsultations}
                    </p>
                    <p className="text-xs text-gray-500">Consultas/Mes</p>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="card p-12 text-center">
          <Building2 className="h-12 w-12 mx-auto text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            Sin clínicas registradas
          </h3>
          <p className="text-gray-500 mb-4">
            Comienza agregando tu primera clínica
          </p>
          <button onClick={() => setShowModal(true)} className="btn-primary">
            Agregar Clínica
          </button>
        </div>
      )}

      {/* Clinic Modal */}
      {showModal && (
        <ClinicModal
          clinic={editingClinic}
          onClose={() => { setShowModal(false); setEditingClinic(null) }}
          onSuccess={() => {
            setShowModal(false)
            setEditingClinic(null)
            fetchClinics()
          }}
        />
      )}
    </div>
  )
}

function ClinicModal({ clinic, onClose, onSuccess }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [formData, setFormData] = useState({
    name: clinic?.name || '',
    address: clinic?.address || '',
    phone: clinic?.phone || '',
    email: clinic?.email || '',
    logoUrl: clinic?.logoUrl || '',
    settings: clinic?.settings || {
      primaryColor: '#0ea5e9',
      fontFamily: 'Inter',
      loginBgPosition: 'top center',
      enabledModules: ['dashboard', 'patients', 'appointments', 'vaccinations', 'documents', 'lab_exams', 'ai_assistant']
    }
  })
  const [logoFile, setLogoFile] = useState(null)
  const [logoPreview, setLogoPreview] = useState(clinic?.logoUrl || '')
  const [loginBgFile, setLoginBgFile] = useState(null)
  const [loginBgPreview, setLoginBgPreview] = useState(clinic?.settings?.loginBgUrl || '')

  const modules = [
    { id: 'dashboard', name: 'Dashboard' },
    { id: 'patients', name: 'Pacientes' },
    { id: 'appointments', name: 'Citas' },
    { id: 'vaccinations', name: 'Vacunación' },
    { id: 'documents', name: 'Documentos' },
    { id: 'referrals', name: 'Referencias' },
    { id: 'lab_exams', name: 'Exámenes Lab' },
    { id: 'ai_assistant', name: 'Asistente IA' }
  ]

  const fonts = ['Inter', 'Roboto', 'Montserrat', 'Outfit']

  const toggleModule = (moduleId) => {
    const current = formData.settings.enabledModules || []
    const updated = current.includes(moduleId)
      ? current.filter(id => id !== moduleId)
      : [...current, moduleId]
    
    setFormData({
      ...formData,
      settings: { ...formData.settings, enabledModules: updated }
    })
  }

  const handleFileChange = (e) => {
    const file = e.target.files[0]
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setError('El logo no debe superar los 5MB')
        return
      }
      setLogoFile(file)
      setLogoPreview(URL.createObjectURL(file))
    }
  }

  const handleLoginBgChange = (e) => {
    const file = e.target.files[0]
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        setError('La imagen de fondo no debe superar los 10MB')
        return
      }
      setLoginBgFile(file)
      setLoginBgPreview(URL.createObjectURL(file))
    }
  }

  const BG_POSITIONS = [
    { label: '↖', value: 'top left' },
    { label: '↑', value: 'top center' },
    { label: '↗', value: 'top right' },
    { label: '←', value: 'center left' },
    { label: '·', value: 'center' },
    { label: '→', value: 'center right' },
    { label: '↙', value: 'bottom left' },
    { label: '↓', value: 'bottom center' },
    { label: '↘', value: 'bottom right' },
  ]

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const data = new FormData()
      data.append('name', formData.name)
      if (formData.address) data.append('address', formData.address)
      if (formData.phone) data.append('phone', formData.phone)
      if (formData.email) data.append('email', formData.email)
      
      if (!logoFile && formData.logoUrl) {
        data.append('logoUrl', formData.logoUrl)
      }
      if (logoFile) {
        data.append('logo', logoFile)
      }
      if (loginBgFile) {
        data.append('loginBg', loginBgFile)
      }

      data.append('settings', JSON.stringify(formData.settings))

      const config = { headers: { 'Content-Type': 'multipart/form-data' } }

      if (clinic) {
        await api.put(`/clinics/${clinic.id}`, data, config)
      } else {
        await api.post('/clinics', data, config)
      }
      onSuccess()
    } catch (err) {
      setError(err.response?.data?.error || 'Error al guardar clínica')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-hidden flex flex-col animate-in zoom-in-95 duration-300">
        <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-gray-700">
          <div>
            <h2 className="text-xl font-black text-gray-900 dark:text-white">
              {clinic ? 'Configurar Proyecto' : 'Nueva Clínica'}
            </h2>
            <p className="text-sm text-gray-500 font-medium">Ajustes generales y de marca</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-colors">
            <X className="h-6 w-6 text-gray-400" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6 overflow-y-auto custom-scrollbar">
          {error && (
            <div className="p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-2xl text-sm font-bold border border-red-100 dark:border-red-800">
              {error}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Nombre de la Clínica *</label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="input-field"
                placeholder="Ej. Clínica Pediátrica Central"
              />
            </div>

            <div>
              <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Dirección Física</label>
              <input
                type="text"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                className="input-field"
                placeholder="Ej. Col. Escalón, San Salvador"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Teléfono</label>
                <input
                  type="text"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="input-field"
                  placeholder="2222-3333"
                />
              </div>
              <div>
                <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Email</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="input-field"
                  placeholder="contacto@clinica.com"
                />
              </div>
            </div>
          </div>

          <div className="space-y-4 border-t border-gray-100 dark:border-gray-700 pt-6">
            <h3 className="text-sm font-black text-gray-900 dark:text-white flex items-center gap-2 uppercase tracking-wide">
              <Palette className="h-4 w-4 text-primary-600" />
              Identidad Visual (SaaS)
            </h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Color Primario</label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={formData.settings.primaryColor}
                    onChange={(e) => setFormData({ 
                      ...formData, 
                      settings: { ...formData.settings, primaryColor: e.target.value } 
                    })}
                    className="h-10 w-12 rounded-xl cursor-pointer bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 p-1"
                  />
                  <input
                    type="text"
                    value={formData.settings.primaryColor}
                    onChange={(e) => setFormData({ 
                      ...formData, 
                      settings: { ...formData.settings, primaryColor: e.target.value } 
                    })}
                    className="input-field font-mono text-xs"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Tipografía</label>
                <select
                  value={formData.settings.fontFamily}
                  onChange={(e) => setFormData({ 
                    ...formData, 
                    settings: { ...formData.settings, fontFamily: e.target.value } 
                  })}
                  className="input-field text-sm"
                >
                  {fonts.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
              </div>
            </div>

            <div>
               <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Logo del Proyecto (Recomendado 1:1)</label>
               <div className="flex items-center gap-4 mt-2">
                 <div className="w-16 h-16 rounded-2xl bg-gray-50 dark:bg-gray-700 border-2 border-dashed border-gray-200 dark:border-gray-600 flex items-center justify-center overflow-hidden shrink-0">
                   {logoPreview ? (
                     <img src={logoPreview} alt="Logo preview" className="w-full h-full object-contain p-1" />
                   ) : (
                     <ImagePlus className="h-6 w-6 text-gray-400" />
                   )}
                 </div>
                 <div className="flex-1">
                   <label className="flex items-center justify-center w-full px-4 py-2 border border-gray-200 dark:border-gray-600 rounded-xl cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                     <Upload className="h-4 w-4 mr-2 text-gray-500" />
                     <span className="text-sm font-bold text-gray-600 dark:text-gray-300">
                       {logoFile ? logoFile.name : 'Subir archivo...'}
                     </span>
                     <input
                       type="file"
                       accept="image/png, image/jpeg, image/webp, image/svg+xml"
                       className="hidden"
                       onChange={handleFileChange}
                     />
                   </label>
                   <p className="text-[10px] text-gray-400 mt-1">PNG, JPG, WebP o SVG. Máx 5MB.</p>
                 </div>
               </div>
            </div>
          </div>

          {/* Login Background */}
          <div className="space-y-4 border-t border-gray-100 dark:border-gray-700 pt-6">
            <h3 className="text-sm font-black text-gray-900 dark:text-white flex items-center gap-2 uppercase tracking-wide">
              <Monitor className="h-4 w-4 text-primary-600" />
              Fondo de Pantalla de Login
            </h3>

            <div className="flex gap-4">
              {/* Preview */}
              <div
                className="w-28 h-20 rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-600 overflow-hidden shrink-0 bg-gray-100 dark:bg-gray-700"
                style={loginBgPreview ? {
                  backgroundImage: `url(${loginBgPreview})`,
                  backgroundSize: 'cover',
                  backgroundPosition: formData.settings.loginBgPosition || 'top center',
                  borderStyle: 'solid',
                } : {}}
              >
                {!loginBgPreview && (
                  <div className="w-full h-full flex items-center justify-center">
                    <ImagePlus className="h-6 w-6 text-gray-400" />
                  </div>
                )}
              </div>

              <div className="flex-1 space-y-2">
                <label className="flex items-center justify-center w-full px-4 py-2 border border-gray-200 dark:border-gray-600 rounded-xl cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                  <Upload className="h-4 w-4 mr-2 text-gray-500" />
                  <span className="text-sm font-bold text-gray-600 dark:text-gray-300">
                    {loginBgFile ? loginBgFile.name : loginBgPreview ? 'Cambiar imagen...' : 'Subir imagen...'}
                  </span>
                  <input
                    type="file"
                    accept="image/png, image/jpeg, image/webp"
                    className="hidden"
                    onChange={handleLoginBgChange}
                  />
                </label>
                <p className="text-[10px] text-gray-400">PNG, JPG o WebP. Máx 10MB. Recomendado: 1920×1080.</p>

                {/* Position grid */}
                <div>
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Posición del foco</p>
                  <div className="grid grid-cols-3 gap-1 w-24">
                    {BG_POSITIONS.map(pos => (
                      <button
                        key={pos.value}
                        type="button"
                        onClick={() => setFormData({
                          ...formData,
                          settings: { ...formData.settings, loginBgPosition: pos.value }
                        })}
                        className={`h-7 w-7 rounded-lg text-sm font-bold flex items-center justify-center transition-all ${
                          (formData.settings.loginBgPosition || 'top center') === pos.value
                            ? 'bg-primary-600 text-white shadow-md'
                            : 'bg-gray-100 dark:bg-gray-700 text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-600'
                        }`}
                        title={pos.value}
                      >
                        {pos.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-4 border-t border-gray-100 dark:border-gray-700 pt-6">
            <h3 className="text-sm font-black text-gray-900 dark:text-white flex items-center gap-2 uppercase tracking-wide">
              <Layout className="h-4 w-4 text-primary-600" />
              Módulos del Proyecto
            </h3>
            <div className="grid grid-cols-2 gap-2">
              {modules.map(mod => (
                <label key={mod.id} className="flex items-center gap-3 p-3 rounded-2xl hover:bg-gray-50 dark:hover:bg-white/5 cursor-pointer transition-all border border-transparent hover:border-gray-100 dark:hover:border-white/10">
                  <input
                    type="checkbox"
                    checked={formData.settings.enabledModules?.includes(mod.id)}
                    onChange={() => toggleModule(mod.id)}
                    className="rounded-lg text-primary-600 focus:ring-primary-500 h-5 w-5 border-gray-300"
                  />
                  <span className="text-sm font-bold text-gray-700 dark:text-gray-300">{mod.name}</span>
                </label>
              ))}
            </div>
          </div>
        </form>

        <div className="p-6 border-t border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-black/10 flex justify-end gap-3">
          <button type="button" onClick={onClose} className="px-6 py-2.5 text-sm font-bold text-gray-500 hover:text-gray-700 transition-colors">
            Cancelar
          </button>
          <button 
            onClick={handleSubmit}
            disabled={loading} 
            className="btn-primary px-8 py-2.5 rounded-2xl shadow-lg shadow-primary-600/20"
          >
            {loading ? 'Guardando...' : clinic ? 'Guardar Cambios' : 'Crear Proyecto'}
          </button>
        </div>
      </div>
    </div>
  )
}


