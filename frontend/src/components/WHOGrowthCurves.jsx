import { useState, useEffect } from 'react'
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
import api from '../services/api'
import { usePreferences } from '../context/PreferencesContext'

export default function WHOGrowthCurves({ gender, history, patientName }) {
  const [curveData, setCurveData] = useState(null)
  const [loading, setLoading] = useState(true)
  const { convertWeight, convertHeight, getUnitLabel } = usePreferences()
  const weightUnit = getUnitLabel('weight')
  const heightUnit = getUnitLabel('height')

  useEffect(() => {
    const fetchCurves = async () => {
      try {
        // Max 60 months (5 years) as per WHO child growth standards
        const response = await api.get(`/growth/curves/${gender}/60`)
        setCurveData(response.data)
      } catch (error) {
        console.error('Error fetching WHO curves:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchCurves()
  }, [gender])

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
    const maxAge = 60
    
    for (let age = 0; age <= maxAge; age++) {
      const dataPoint = {
        age,
        p3: converter(typeData.p3[age]?.value, true),
        p15: converter(typeData.p15[age]?.value, true),
        p50: converter(typeData.p50[age]?.value, true),
        p85: converter(typeData.p85[age]?.value, true),
        p97: converter(typeData.p97[age]?.value, true),
      }

      // Add patient data if exists for this age
      const patientPoint = history.find(h => h.ageMonths === age)
      if (patientPoint && patientPoint[type]) {
        dataPoint.patientValue = converter(patientPoint[type], true)
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
      <div className="flex justify-between items-center">
        <h3 className="text-xl font-bold text-gray-900 dark:text-white">
          Curvas de Crecimiento OMS - {patientName}
        </h3>
        <div className="flex gap-4 text-xs font-medium">
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-full bg-red-500"></span> P97 / P3
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-full bg-orange-400"></span> P85 / P15
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-full bg-green-500"></span> P50 (Ideal)
          </span>
          <span className="flex items-center gap-1">
            <span className="w-4 h-4 rounded-full border-2 border-primary-600 bg-white dark:bg-gray-800"></span> Paciente
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Weight Chart */}
        <div className="card p-4">
          <h4 className="font-bold text-gray-700 dark:text-gray-300 mb-4 flex items-center gap-2">
            ⚖️ Peso para la Edad ({weightUnit})
          </h4>
          <div className="h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={weightChartData} margin={{ top: 5, right: 20, left: 0, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis 
                  dataKey="age" 
                  label={{ value: 'Edad (meses)', position: 'bottom', offset: 0, fontSize: 12 }} 
                  fontSize={10}
                />
                <YAxis fontSize={10} width={30} />
                <Tooltip content={<CustomTooltip unit={weightUnit} />} />
                
                {/* Percentile Lines */}
                <Line type="monotone" dataKey="p2" stroke="#ff0000" strokeWidth={1} dot={false} strokeDasharray="3 3" name="P3" />
                <Line type="monotone" dataKey="p3" stroke="#ff4d4d" strokeWidth={1} dot={false} name="P3" />
                <Line type="monotone" dataKey="p15" stroke="#ffa64d" strokeWidth={1} dot={false} name="P15" />
                <Line type="monotone" dataKey="p50" stroke="#22c55e" strokeWidth={2} dot={false} name="P50" />
                <Line type="monotone" dataKey="p85" stroke="#ffa64d" strokeWidth={1} dot={false} name="P85" />
                <Line type="monotone" dataKey="p97" stroke="#ff4d4d" strokeWidth={1} dot={false} name="P97" />
                
                {/* Patient Data */}
                <Line 
                  type="monotone" 
                  dataKey="patientValue" 
                  stroke="#2563eb" 
                  name="Paciente" 
                  strokeWidth={3} 
                  dot={{ r: 5, fill: '#2563eb', stroke: '#fff', strokeWidth: 2 }}
                  connectNulls
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Height Chart */}
        <div className="card p-4">
          <h4 className="font-bold text-gray-700 dark:text-gray-300 mb-4 flex items-center gap-2">
            📏 Talla para la Edad ({heightUnit})
          </h4>
          <div className="h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={heightChartData} margin={{ top: 5, right: 20, left: 0, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis 
                  dataKey="age" 
                  label={{ value: 'Edad (meses)', position: 'bottom', offset: 0, fontSize: 12 }} 
                  fontSize={10}
                />
                <YAxis fontSize={10} width={30} />
                <Tooltip content={<CustomTooltip unit={heightUnit} />} />
                
                {/* Percentile Lines */}
                <Line type="monotone" dataKey="p3" stroke="#ff4d4d" strokeWidth={1} dot={false} name="P3" />
                <Line type="monotone" dataKey="p15" stroke="#ffa64d" strokeWidth={1} dot={false} name="P15" />
                <Line type="monotone" dataKey="p50" stroke="#22c55e" strokeWidth={2} dot={false} name="P50" />
                <Line type="monotone" dataKey="p85" stroke="#ffa64d" strokeWidth={1} dot={false} name="P85" />
                <Line type="monotone" dataKey="p97" stroke="#ff4d4d" strokeWidth={1} dot={false} name="P97" />
                
                {/* Patient Data */}
                <Line 
                  type="monotone" 
                  dataKey="patientValue" 
                  stroke="#2563eb" 
                  name="Paciente" 
                  strokeWidth={3} 
                  dot={{ r: 5, fill: '#2563eb', stroke: '#fff', strokeWidth: 2 }}
                  connectNulls
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg text-[10px] text-gray-500 italic">
        * Basado en los patrones de crecimiento infantil de la Organización Mundial de la Salud (OMS) para niños de 0 a 5 años.
        Las líneas representan los percentiles 3, 15, 50, 85 y 97.
      </div>
    </div>
  )
}
