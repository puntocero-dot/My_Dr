import { useState } from 'react'
import { Pill, Plus, Trash2, Loader2, Brain, Check, X } from 'lucide-react'
import api from '../services/api'

export default function PrescriptionModal({ patientId, doctorId, onClose, onSuccess }) {
  const [items, setItems] = useState([{
    medicationName: '',
    genericName: '',
    dose: '',
    doseUnit: 'ml',
    frequency: '',
    duration: '',
    route: 'oral',
    instructions: ''
  }])
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [loadingSuggestions, setLoadingSuggestions] = useState(null)
  const [suggestions, setSuggestions] = useState([])
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(null)
  const [calculatingDose, setCalculatingDose] = useState(null)
  const [searchTimeout, setSearchTimeout] = useState(null)

  const addItem = () => {
    setItems([...items, {
      medicationName: '',
      genericName: '',
      dose: '',
      doseUnit: 'ml',
      frequency: '',
      duration: '',
      route: 'oral',
      instructions: ''
    }])
  }

  const removeItem = (index) => {
    setItems(items.filter((_, i) => i !== index))
  }

  const updateItem = (index, field, value) => {
    const updated = [...items]
    updated[index][field] = value
    setItems(updated)
  }

  const handleSearch = (queryText, index) => {
    if (searchTimeout) clearTimeout(searchTimeout)
    
    if (!queryText || queryText.length < 1) {
      setSuggestions([])
      setActiveSuggestionIndex(null)
      return
    }

    // Set active index immediately so UI knows where to show suggestions/loading
    setActiveSuggestionIndex(index)

    if (queryText.length < 3) {
      setSuggestions([])
      return
    }

    const timeout = setTimeout(async () => {
      setLoadingSuggestions(index)
      try {
        const response = await api.post('/ai/medication-suggestions', { query: queryText })
        // Verify we are still on the same query/item
        setSuggestions(response.data.suggestions || [])
      } catch (error) {
        console.error('Error fetching suggestions:', error)
      } finally {
        setLoadingSuggestions(null)
      }
    }, 400)
    setSearchTimeout(timeout)
  }

  const selectSuggestion = (suggestion, index) => {
    const updated = [...items]
    updated[index] = {
      ...updated[index],
      medicationName: suggestion.name,
      genericName: suggestion.generic,
      instructions: suggestion.presentation
    }
    setItems(updated)
    setSuggestions([])
    setActiveSuggestionIndex(null)
  }

  const handleAIDose = async (index) => {
    const item = items[index]
    if (!item.medicationName || !patientId) return

    setCalculatingDose(index)
    try {
      const response = await api.post('/ai/calculate-dose-ai', {
        medicationName: item.medicationName,
        patientId: patientId
      })

      if (response.data) {
        const updated = [...items]
        updated[index] = {
          ...updated[index],
          dose: response.data.recommendedDose || '',
          frequency: response.data.frequency || '',
          duration: response.data.duration || '',
          route: response.data.route?.toLowerCase() || 'oral',
          instructions: response.data.reasoning || item.instructions
        }
        setItems(updated)
      }
    } catch (error) {
      console.error('Error calculating dose:', error)
      alert('Error en el cálculo con IA. Verifique los datos manualmente.')
    } finally {
      setCalculatingDose(null)
    }
  }

  const handleSave = async () => {
    if (items.length === 0) return
    setSaving(true)
    try {
      await api.post('/prescriptions', {
        patientId,
        doctorId,
        notes,
        items
      })
      onSuccess()
    } catch (error) {
      console.error('Error saving prescription:', error)
      alert('Error al guardar la receta')
    } finally {
      setSaving(false)
    }
  }

  const routes = [
    { value: 'oral', label: 'Oral' },
    { value: 'intravenous', label: 'Intravenosa (IV)' },
    { value: 'intramuscular', label: 'Intramuscular (IM)' },
    { value: 'topical', label: 'Tópica' },
    { value: 'ophthalmic', label: 'Oftálmica' },
    { value: 'otic', label: 'Ótica' },
    { value: 'nasal', label: 'Nasal' },
    { value: 'rectal', label: 'Rectal' },
    { value: 'nebulized', label: 'Nebulizada' }
  ]

  const doseUnits = ['ml', 'mg', 'gotas', 'tabletas', 'capsulas', 'puff', 'aplicación']

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between bg-white dark:bg-gray-800 rounded-t-2xl">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <Pill className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">Nueva Receta Médica</h2>
              <p className="text-sm text-gray-500">Agrega medicamentos directamente al perfil</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors">
            <X className="h-6 w-6 text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {items.length > 0 ? (
            <div className="space-y-4">
              {items.map((item, index) => (
                <div key={index} className="p-5 bg-gray-50 dark:bg-gray-700/30 rounded-2xl border border-gray-100 dark:border-gray-600 space-y-4 relative">
                  <div className="flex justify-between items-center">
                    <h4 className="text-xs font-black text-brand-muted uppercase tracking-widest">Medicamento {index + 1}</h4>
                    <button
                      onClick={() => removeItem(index)}
                      className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Name Search */}
                    <div className="relative">
                      <label className="block text-xs font-bold text-gray-500 mb-1 ml-1 uppercase">Nombre Comercial/Genérico</label>
                      <input
                        type="text"
                        value={item.medicationName}
                        onChange={(e) => {
                          updateItem(index, 'medicationName', e.target.value)
                          handleSearch(e.target.value, index)
                        }}
                        className="input-field"
                        placeholder="Ej: Ibuprofeno, Tylenol..."
                      />
                      {activeSuggestionIndex === index && (loadingSuggestions === index || suggestions.length > 0) && (
                        <div className="absolute z-20 w-full mt-1 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-100 dark:border-gray-700 max-h-60 overflow-y-auto overflow-x-hidden">
                          {loadingSuggestions === index ? (
                            <div className="p-4 text-center">
                              <Loader2 className="h-5 w-5 animate-spin mx-auto text-primary-600" />
                            </div>
                          ) : (
                            suggestions.map((s, i) => (
                              <button
                                key={i}
                                onClick={() => selectSuggestion(s, index)}
                                className="w-full text-left p-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors border-b border-gray-50 dark:border-gray-700 last:border-0"
                              >
                                <div className="font-bold text-gray-900 dark:text-white text-sm">{s.name}</div>
                                <div className="text-[10px] text-gray-500 dark:text-gray-400 font-medium">{s.generic} • {s.presentation}</div>
                              </button>
                            ))
                          )}
                        </div>
                      )}
                    </div>

                    {/* AI Dose Button */}
                    <div className="flex flex-col justify-end">
                      <button
                        onClick={() => handleAIDose(index)}
                        disabled={calculatingDose === index || !item.medicationName}
                        className="btn-secondary h-[42px] flex items-center justify-center gap-2 group"
                      >
                        {calculatingDose === index ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Brain className="h-4 w-4 text-primary-600 group-hover:scale-110 transition-transform" />
                        )}
                        Cálculo Pediátrico con IA
                      </button>
                    </div>

                    {/* Dose & Unit */}
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs font-bold text-gray-500 mb-1 ml-1 uppercase">Dosis</label>
                        <input
                          type="text"
                          value={item.dose}
                          onChange={(e) => updateItem(index, 'dose', e.target.value)}
                          className="input-field"
                          placeholder="Ej: 5"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-500 mb-1 ml-1 uppercase">Unidad</label>
                        <select
                          value={item.doseUnit}
                          onChange={(e) => updateItem(index, 'doseUnit', e.target.value)}
                          className="input-field"
                        >
                          {doseUnits.map(u => <option key={u} value={u}>{u}</option>)}
                        </select>
                      </div>
                    </div>

                    {/* Frequency */}
                    <div>
                      <label className="block text-xs font-bold text-gray-500 mb-1 ml-1 uppercase">Frecuencia</label>
                      <input
                        type="text"
                        value={item.frequency}
                        onChange={(e) => updateItem(index, 'frequency', e.target.value)}
                        className="input-field"
                        placeholder="Ej: Cada 8 horas"
                      />
                    </div>

                    {/* Route */}
                    <div>
                      <label className="block text-xs font-bold text-gray-500 mb-1 ml-1 uppercase">Vía</label>
                      <select
                        value={item.route}
                        onChange={(e) => updateItem(index, 'route', e.target.value)}
                        className="input-field"
                      >
                        {routes.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                      </select>
                    </div>

                    {/* Duration */}
                    <div>
                      <label className="block text-xs font-bold text-gray-500 mb-1 ml-1 uppercase">Duración</label>
                      <input
                        type="text"
                        value={item.duration}
                        onChange={(e) => updateItem(index, 'duration', e.target.value)}
                        className="input-field"
                        placeholder="Ej: 7 días"
                      />
                    </div>
                  </div>

                  {/* Instructions */}
                  <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1 ml-1 uppercase">Instrucciones / Notas</label>
                    <textarea
                      value={item.instructions}
                      onChange={(e) => updateItem(index, 'instructions', e.target.value)}
                      className="input-field min-h-[60px]"
                      placeholder="Ej: Tomar después de los alimentos"
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center bg-gray-50 dark:bg-gray-700/30 rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-600">
              <Pill className="h-12 w-12 text-gray-300 mb-3" />
              <p className="text-gray-500 font-medium">No hay medicamentos en esta receta</p>
              <button
                onClick={addItem}
                className="mt-4 text-primary-600 font-bold text-sm flex items-center gap-1 hover:underline"
              >
                <Plus className="h-4 w-4" /> Agregar primer medicamento
              </button>
            </div>
          )}

          <button
            onClick={addItem}
            className="w-full py-3 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl text-gray-500 hover:text-primary-600 hover:border-primary-600/50 transition-all flex items-center justify-center gap-2 font-bold text-sm"
          >
            <Plus className="h-4 w-4" /> Agregar otro medicamento
          </button>

          <div className="space-y-2">
            <label className="block text-xs font-black text-brand-muted uppercase tracking-widest">Notas generales de la receta</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="input-field min-h-[100px]"
              placeholder="Indicaciones generales para el padre..."
            />
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 flex items-center justify-end gap-3 rounded-b-2xl">
          <button
            onClick={onClose}
            className="px-6 py-2.5 font-bold text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving || items.length === 0}
            className="btn-primary px-8 py-2.5 flex items-center gap-2 shadow-lg shadow-primary-600/20"
          >
            {saving ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Check className="h-5 w-5" />
            )}
            {saving ? 'Guardando...' : 'Generar Receta'}
          </button>
        </div>
      </div>
    </div>
  )
}
