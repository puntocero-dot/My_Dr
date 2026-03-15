import { useState, useEffect, useMemo } from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ReferenceDot
} from 'recharts'
import { Maximize2, X } from 'lucide-react'
import api from '../services/api'
import { usePreferences } from '../context/PreferencesContext'

export default function WHOGrowthCurves({ gender, history, patientName }) {
  const [curveData, setCurveData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const { convertWeight, convertHeight, getUnitLabel } = usePreferences()
  
  const weightUnit = getUnitLabel('weight')
  const heightUnit = getUnitLabel('height')

  // Calculate dynamic max age based on history
  const maxAge = useMemo(() => {
    if (!history?.length) return 60
    const lastAge = Math.max(...history.map(h => h.ageMonths))
    return Math.max(60, Math.min(228, Math.ceil(lastAge / 12) * 12 + 12)) 
  }, [history])

  useEffect(() => {
    const fetchCurves = async () => {
      try {
        setLoading(true)
        const response = await api.get(`/growth/curves/${gender}/${maxAge}`)
        setCurveData(response.data)
      } catch (error) {
        console.error('Error fetching WHO curves:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchCurves()
  }, [gender, maxAge])

  if (loading) {
    return (
      <div className="h-64 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  if (!curveData) return null

  // Process data for Recharts - we need to merge curves and patient points
  const prepareChartData = (type) => {
    const typeData = curveData[type]
    if (!typeData) return []

    const converter = type === 'weight' ? convertWeight : convertHeight
    
    // Map curves to a combined object array
    const combined = []
    
    // Create a dense set of patient points to ensure they're visible
    const patientMap = {}
    history?.forEach(h => {
      if (h[type]) patientMap[h.ageMonths] = converter(h[type], true)
    })

    const dataLength = (curveData[type].p50 || []).length
    
    for (let age = 0; age < dataLength; age++) {
      const dataPoint = {
        age,
        p3: converter(typeData.p3[age]?.value, true),
        p15: converter(typeData.p15[age]?.value, true),
        p50: converter(typeData.p50[age]?.value, true),
        p85: converter(typeData.p85[age]?.value, true),
        p97: converter(typeData.p97[age]?.value, true),
      }

      if (patientMap[age] !== undefined) {
        dataPoint.patientValue = patientMap[age]
      }

      combined.push(dataPoint)
    }
    return combined
  }

  const weightChartData = prepareChartData('weight')
  const heightChartData = prepareChartData('height')

  const CustomTooltip = ({ active, payload, label, unit }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white dark:bg-gray-800 p-3 border border-gray-200 dark:border-gray-700 shadow-lg rounded-lg text-xs">
          <p className="font-bold mb-1">Edad: {label} meses</p>
          {payload.map((entry, index) => (
            <p key={index} style={{ color: entry.color }}>
              {entry.name}: {entry.value.toFixed(1)} {unit}
            </p>
          ))}
        </div>
      )
    }
    return null
  }

  return (
    <div className="space-y-8 bg-white dark:bg-gray-900 p-4 rounded-xl border border-gray-100 dark:border-gray-800">
      <div className="flex justify-between items-center bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 pb-4">
        <div>
          <h3 className="text-xl font-bold text-gray-900 dark:text-white">
            Curvas de Crecimiento OMS
          </h3>
          <p className="text-sm text-gray-500">{patientName}</p>
        </div>
        <div className="flex items-center gap-6">
          <div className="flex gap-4 text-[10px] font-medium uppercase tracking-wider">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500 shadow-sm"></span> P97 / P3
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-orange-400 shadow-sm"></span> P85 / P15
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-green-500 shadow-sm"></span> P50
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full border-2 border-primary-600 bg-white dark:bg-gray-800 shadow-sm"></span> Paciente
            </span>
          </div>
          <button 
            onClick={() => setShowModal(true)}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors text-gray-500"
            title="Expandir"
          >
            <Maximize2 size={20} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {renderCharts()}
      </div>

      <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg text-[10px] text-gray-500 italic">
        * Basado en los patrones de crecimiento infantil de la Organización Mundial de la Salud (OMS).
        Rango visualizado: 0 a {maxAge} meses.
      </div>

      {showModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 md:p-8">
          <div className="bg-white dark:bg-gray-900 w-full h-full max-w-7xl rounded-2xl shadow-2xl overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-gray-800">
              <div>
                <h3 className="text-2xl font-black text-gray-900 dark:text-white">Vista Ampliada - Curvas OMS</h3>
                <p className="text-gray-500">{patientName} • {maxAge} meses</p>
              </div>
              <button 
                onClick={() => setShowModal(false)}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors text-gray-500"
              >
                <X size={28} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-8 space-y-12">
              {renderCharts(true)}
            </div>
          </div>
        </div>
      )}
    </div>
  )

  function renderCharts(isExpanded = false) {
    const chartHeight = isExpanded ? "h-[500px]" : "h-[350px]"
    
    return (
      <>
        {/* Weight Chart */}
        <div className={`${isExpanded ? 'bg-slate-50/50 dark:bg-gray-800/30' : ''} rounded-xl p-4 transition-all`}>
          <h4 className="font-bold text-gray-700 dark:text-gray-300 mb-6 flex items-center gap-2">
            <span className="p-1.5 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg text-lg">⚖️</span>
            Peso para la Edad ({weightUnit})
          </h4>
          <div className={chartHeight}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={weightChartData} margin={{ top: 5, right: 30, left: 10, bottom: 30 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.15} />
                <XAxis 
                  dataKey="age" 
                  label={{ value: 'Edad (meses)', position: 'bottom', offset: 10, fontSize: 12, fill: '#64748b' }} 
                  fontSize={10}
                  tick={{ fill: '#64748b' }}
                  interval={Math.floor(maxAge / 10)}
                />
                <YAxis fontSize={10} tick={{ fill: '#64748b' }} width={35} />
                <Tooltip content={<CustomTooltip unit={weightUnit} />} />
                
                <Line type="monotone" dataKey="p3" stroke="#ef4444" strokeWidth={1} dot={false} strokeOpacity={0.4} />
                <Line type="monotone" dataKey="p15" stroke="#f59e0b" strokeWidth={1} dot={false} strokeOpacity={0.4} />
                <Line type="monotone" dataKey="p50" stroke="#10b981" strokeWidth={2.5} dot={false} />
                <Line type="monotone" dataKey="p85" stroke="#f59e0b" strokeWidth={1} dot={false} strokeOpacity={0.4} />
                <Line type="monotone" dataKey="p97" stroke="#ef4444" strokeWidth={1} dot={false} strokeOpacity={0.4} />
                
                <Line 
                  type="monotone" 
                  dataKey="patientValue" 
                  stroke="#3b82f6" 
                  strokeWidth={4} 
                  dot={{ r: 5, fill: '#3b82f6', stroke: '#fff', strokeWidth: 2 }}
                  activeDot={{ r: 7 }}
                  connectNulls
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Height Chart */}
        <div className={`${isExpanded ? 'bg-slate-50/50 dark:bg-gray-800/30' : ''} rounded-xl p-4 transition-all`}>
          <h4 className="font-bold text-gray-700 dark:text-gray-300 mb-6 flex items-center gap-2">
            <span className="p-1.5 bg-blue-100 dark:bg-blue-900/30 rounded-lg text-lg">📏</span>
            Talla para la Edad ({heightUnit})
          </h4>
          <div className={chartHeight}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={heightChartData} margin={{ top: 5, right: 30, left: 10, bottom: 30 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.15} />
                <XAxis 
                  dataKey="age" 
                  label={{ value: 'Edad (meses)', position: 'bottom', offset: 10, fontSize: 12, fill: '#64748b' }} 
                  fontSize={10}
                  tick={{ fill: '#64748b' }}
                  interval={Math.floor(maxAge / 10)}
                />
                <YAxis fontSize={10} tick={{ fill: '#64748b' }} width={35} />
                <Tooltip content={<CustomTooltip unit={heightUnit} />} />
                
                <Line type="monotone" dataKey="p3" stroke="#ef4444" strokeWidth={1} dot={false} strokeOpacity={0.4} />
                <Line type="monotone" dataKey="p15" stroke="#f59e0b" strokeWidth={1} dot={false} strokeOpacity={0.4} />
                <Line type="monotone" dataKey="p50" stroke="#10b981" strokeWidth={2.5} dot={false} />
                <Line type="monotone" dataKey="p85" stroke="#f59e0b" strokeWidth={1} dot={false} strokeOpacity={0.4} />
                <Line type="monotone" dataKey="p97" stroke="#ef4444" strokeWidth={1} dot={false} strokeOpacity={0.4} />
                
                <Line 
                  type="monotone" 
                  dataKey="patientValue" 
                  stroke="#3b82f6" 
                  strokeWidth={4} 
                  dot={{ r: 5, fill: '#3b82f6', stroke: '#fff', strokeWidth: 2 }}
                  activeDot={{ r: 7 }}
                  connectNulls
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </>
    )
  }
}
