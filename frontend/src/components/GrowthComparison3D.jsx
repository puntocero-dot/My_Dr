import { lazy, Suspense } from 'react'
import { usePreferences } from '../context/PreferencesContext'

const Pediatric4DViewer = lazy(() => import('./Pediatric4DViewer'))

export default function GrowthComparison3D({ data, viewMode = 'bars' }) {
  const { convertWeight, convertHeight, getUnitLabel } = usePreferences()
  const weightUnit = getUnitLabel('weight')
  const heightUnit = getUnitLabel('height')

  // Handle both old format and new advanced format
  const hasAdvancedData = data?.transform3D !== undefined

  // Extract data based on format (always in metric from backend)
  let currentWeight, currentHeight, previousWeight, previousHeight, idealWeight, idealHeight
  let healthStatus, transform3D, bmi

  if (hasAdvancedData) {
    currentWeight = data.current?.weight || 0
    currentHeight = data.current?.height || 0
    previousWeight = data.previous?.weight || null
    previousHeight = data.previous?.height || null
    idealWeight = data.ideal?.weight || 0
    idealHeight = data.ideal?.height || 0
    healthStatus = data.healthStatus || data.transform3D?.bmiStatus
    transform3D = data.transform3D
    bmi = data.current?.bmi || transform3D?.bmi
  } else {
    const { current, previous, ideal } = data || {}
    currentWeight = current?.weight?.value || current?.weight || 0
    currentHeight = current?.height?.value || current?.height || 0
    previousWeight = previous?.weight?.value || previous?.weight || null
    previousHeight = previous?.height?.value || previous?.height || null
    idealWeight = ideal?.weight || 0
    idealHeight = ideal?.height || 0
  }

  if ((!currentWeight && !currentHeight) || !idealWeight) {
    return (
      <div className="h-[400px] flex flex-col items-center justify-center bg-gradient-to-b from-blue-50 to-white dark:from-gray-800 dark:to-gray-900 rounded-2xl">
        <div className="w-20 h-20 mb-4 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
          <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
            <circle cx="20" cy="12" r="8" fill="#93c5fd" />
            <ellipse cx="20" cy="30" rx="10" ry="8" fill="#93c5fd" />
          </svg>
        </div>
        <p className="text-gray-600 dark:text-gray-300 font-medium mb-1">Sin datos de crecimiento</p>
        <p className="text-sm text-gray-400 dark:text-gray-500">Registra peso y talla en la consulta</p>
      </div>
    )
  }

  // Convert for display
  const displayCurrentWeight = convertWeight(currentWeight, true)
  const displayCurrentHeight = convertHeight(currentHeight, true)
  const displayPreviousWeight = previousWeight ? convertWeight(previousWeight, true) : null
  const displayPreviousHeight = previousHeight ? convertHeight(previousHeight, true) : null
  const displayIdealWeight = convertWeight(idealWeight, true)
  const displayIdealHeight = convertHeight(idealHeight, true)

  const maxWeight = Math.max(displayCurrentWeight, displayPreviousWeight || 0, displayIdealWeight) * 1.15
  const maxHeight = Math.max(displayCurrentHeight, displayPreviousHeight || 0, displayIdealHeight) * 1.05

  if (viewMode === '3d') {
    return (
      <Suspense fallback={
        <div className="h-[480px] flex items-center justify-center bg-gradient-to-b from-slate-100 to-slate-200 dark:from-gray-800 dark:to-gray-900 rounded-2xl">
          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 border-3 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-sm text-gray-500">Cargando visor 3D...</p>
          </div>
        </div>
      }>
        <Pediatric4DViewer
          edadEnMeses={data?.patient?.ageMonths || 24}
          currentWeight={currentWeight}
          currentHeight={currentHeight}
          idealWeight={idealWeight}
          idealHeight={idealHeight}
          gender={data?.patient?.gender || 'male'}
          healthStatus={healthStatus}
          bmi={bmi}
          transform3D={transform3D}
        />
      </Suspense>
    )
  }

  if (viewMode === 'silhouette') {
    return (
      <AdvancedSilhouetteView
        current={{ weight: currentWeight, height: currentHeight, displayWeight: displayCurrentWeight, displayHeight: displayCurrentHeight }}
        previous={previousWeight ? { weight: previousWeight, height: previousHeight, displayWeight: displayPreviousWeight, displayHeight: displayPreviousHeight } : null}
        ideal={{ weight: idealWeight, height: idealHeight, displayWeight: displayIdealWeight, displayHeight: displayIdealHeight }}
        healthStatus={healthStatus}
        transform3D={transform3D}
        bmi={bmi}
        weightUnit={weightUnit}
        heightUnit={heightUnit}
      />
    )
  }

  return (
    <div className="bg-gradient-to-b from-slate-50 to-white dark:from-gray-800 dark:to-gray-900 rounded-2xl p-6">
      {/* Health Status Banner */}
      {healthStatus && (
        <div
          className="mb-6 p-4 rounded-xl text-center text-white font-semibold shadow-md"
          style={{ backgroundColor: healthStatus.color }}
        >
          <span className="text-lg">Estado: {healthStatus.label}</span>
          {bmi && <span className="ml-2 opacity-80">(IMC: {bmi.toFixed(1)})</span>}
        </div>
      )}

      <div className="grid grid-cols-2 gap-8">
        <div>
          <h4 className="text-center font-semibold text-gray-700 dark:text-gray-300 mb-4 text-base">
            ⚖️ Peso ({weightUnit})
          </h4>
          <div className="flex justify-center items-end gap-4 h-52">
            {displayPreviousWeight && (
              <BarColumn label="Anterior" value={displayPreviousWeight} max={maxWeight} color="#94a3b8" unit={weightUnit} />
            )}
            <BarColumn
              label="Actual"
              value={displayCurrentWeight}
              max={maxWeight}
              color={healthStatus?.color || "#3b82f6"}
              unit={weightUnit}
            />
            <BarColumn label="Ideal" value={displayIdealWeight} max={maxWeight} color="#22c55e" unit={weightUnit} isIdeal />
          </div>
        </div>

        <div>
          <h4 className="text-center font-semibold text-gray-700 dark:text-gray-300 mb-4 text-base">
            📏 Talla ({heightUnit})
          </h4>
          <div className="flex justify-center items-end gap-4 h-52">
            {displayPreviousHeight && (
              <BarColumn label="Anterior" value={displayPreviousHeight} max={maxHeight} color="#94a3b8" unit={heightUnit} />
            )}
            <BarColumn label="Actual" value={displayCurrentHeight} max={maxHeight} color="#3b82f6" unit={heightUnit} />
            <BarColumn label="Ideal" value={displayIdealHeight} max={maxHeight} color="#22c55e" unit={heightUnit} isIdeal />
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex justify-center gap-6 mt-6 text-sm">
        {displayPreviousWeight && (
          <span className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-blue-500"></span>
            Última consulta
          </span>
        )}
        <span className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-slate-400"></span>
          Actual
        </span>
        <span className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-green-500"></span>
          Ideal (OMS P50)
        </span>
      </div>

      {/* Metrics Cards */}
      {transform3D && (
        <div className="mt-6 grid grid-cols-3 gap-3">
          <MetricCard
            label="Ratio Peso"
            value={`${(transform3D.ratioWeight * 100).toFixed(0)}%`}
            color={transform3D.ratioWeight > 1.15 ? '#ef4444' : transform3D.ratioWeight > 1.05 ? '#f97316' : transform3D.ratioWeight < 0.9 ? '#3b82f6' : '#22c55e'}
            icon="⚖️"
          />
          <MetricCard
            label="Ratio Talla"
            value={`${(transform3D.ratioHeight * 100).toFixed(0)}%`}
            color={transform3D.ratioHeight < 0.9 ? '#f97316' : '#22c55e'}
            icon="📏"
          />
          <MetricCard
            label="IMC"
            value={bmi?.toFixed(1) || '-'}
            color={healthStatus?.color || '#6b7280'}
            icon="📊"
          />
        </div>
      )}
    </div>
  )
}

function MetricCard({ label, value, color, icon }) {
  return (
    <div className="text-center p-3 bg-white dark:bg-gray-700/80 rounded-xl shadow-sm border border-gray-100 dark:border-gray-600 transition-transform hover:scale-105">
      <div className="text-lg mb-1">{icon}</div>
      <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">{label}</div>
      <div className="text-xl font-bold" style={{ color }}>{value}</div>
    </div>
  )
}

function BarColumn({ label, value, max, color, unit, isIdeal }) {
  const percentage = Math.max(10, (value / max) * 100)

  return (
    <div className="flex flex-col items-center gap-2 w-16">
      <span className="text-xs font-bold" style={{ color }}>
        {value}{unit}
      </span>
      <div className="w-full h-44 bg-gray-100 dark:bg-gray-700 rounded-xl overflow-hidden flex flex-col justify-end relative shadow-inner">
        <div
          className={`w-full rounded-t-lg transition-all duration-700 ease-out ${isIdeal ? 'border-2 border-dashed border-green-700' : ''}`}
          style={{ height: `${percentage}%`, backgroundColor: color, opacity: isIdeal ? 0.7 : 1 }}
        />
      </div>
      <span className="text-xs font-medium text-gray-500 dark:text-gray-400">{label}</span>
    </div>
  )
}

// Advanced silhouette view with friendly child illustration
function AdvancedSilhouetteView({ current, previous, ideal, healthStatus, transform3D, bmi, weightUnit, heightUnit }) {
  const baseHeight = 160

  // Calculate scales (based on raw metric values for proportional accuracy)
  const idealScale = 1
  const currentHeightScale = current.height / ideal.height
  const currentWidthScale = transform3D?.scaleXZ || 1
  const previousHeightScale = previous ? previous.height / ideal.height : null

  // PIXEL CONVERSION MATH
  // We use the ideal silhouette height as the reference (160px)
  const pxPerCm = 160 / ideal.height
  // Use a fixed baseline offset (e.g. 32px for labels)
  const currentHeightPx = (current.height * pxPerCm)
  const previousHeightPx = previous ? (previous.height * pxPerCm) : null
  const idealHeightPx = 160

  // Body fat intensity affects width
  const bodyFatIntensity = transform3D?.bodyFatIntensity || 0
  const abdominalExpansion = transform3D?.abdominalExpansion || 0

  return (
    <div className="bg-gradient-to-b from-blue-50 via-white to-slate-50 dark:from-gray-800 dark:via-gray-850 dark:to-gray-900 rounded-2xl p-6 overflow-hidden">
      {/* Health Status */}
      {healthStatus && (
        <div
          className="mb-5 p-4 rounded-xl text-center text-white font-semibold shadow-md z-20 relative"
          style={{ backgroundColor: healthStatus.color }}
        >
          <span className="text-lg">{healthStatus.label}</span>
          {bmi && <span className="ml-2 opacity-80">— IMC: {bmi.toFixed(1)}</span>}
        </div>
      )}

      <div className="flex justify-center items-end gap-12 min-h-[380px] relative py-8 px-12 pt-24">
        {/* Vertical Ruler */}
        <div className="absolute left-6 bottom-32 top-8 w-12 border-r border-slate-200 dark:border-white/10 z-0">
          {[...Array(Math.ceil(Math.max(current.height, ideal.height, previous?.height || 0) / 10) + 2)].map((_, i) => {
            const cm = i * 10;
            const bottom = cm * pxPerCm;
            return (
              <div key={cm} className="absolute left-0 w-full flex items-center" style={{ bottom: `${bottom}px` }}>
                <div className="w-3 h-0.5 bg-slate-300 dark:bg-white/20"></div>
                <span className="text-[10px] font-bold text-slate-400 dark:text-gray-500 ml-1.5">{cm}</span>
              </div>
            )
          })}
        </div>

        {/* Horizontal Guide Lines */}
        {/* Ideal Line (Green) */}
        <div className="absolute left-6 right-6 border-t-2 border-dashed border-green-500/20 z-0 transition-all duration-1000" style={{ bottom: `${idealHeightPx + 128}px` }}>
           <div className="absolute -top-5 right-0 text-[10px] font-black text-green-500/60 uppercase tracking-tighter">Ideal OMS ({ideal.displayHeight}{heightUnit})</div>
        </div>
        
        {/* Current Line (Gray) */}
        <div className="absolute left-6 right-6 border-t-2 border-dashed border-slate-400/30 z-20 transition-all duration-1000" style={{ bottom: `${currentHeightPx + 128}px` }}>
           <div className="absolute -top-6 left-12 flex flex-col items-start translate-y-1">
             <span className="text-[10px] font-black text-slate-500 uppercase tracking-tighter">Actual ({current.displayHeight}{heightUnit})</span>
             <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-gray-800 text-slate-400 border border-slate-200 dark:border-slate-700">
               Dif: {current.height > ideal.height ? '+' : ''}{(current.height - ideal.height).toFixed(1)} cm
             </span>
           </div>
        </div>

        {/* Previous Line (Blue) */}
        {previous && (
          <div className="absolute left-6 right-6 border-t-2 border-dashed border-blue-400/20 z-0 transition-all duration-1000" style={{ bottom: `${previousHeightPx + 128}px` }}>
             <div className="absolute -top-5 left-1/3 text-[9px] font-black text-blue-400/60 uppercase tracking-tighter">Anterior ({previous.displayHeight}{heightUnit})</div>
          </div>
        )}

        {/* Ideal Ghost (wireframe reference) */}
        <div className="absolute inset-x-12 bottom-32 flex justify-center items-end pointer-events-none opacity-20 z-0">
          <FriendlyChildSilhouette
            heightScale={idealScale}
            widthScale={1}
            color="#22c55e"
            isGhost={true}
          />
        </div>

        {/* Previous consultation (Blue silhouette) */}
        {previous && previousHeightScale && (
          <div className="flex flex-col items-center z-10 transition-all duration-500 hover:scale-105">
            <div className="h-[200px] flex items-end">
              <FriendlyChildSilhouette
                heightScale={previousHeightScale}
                widthScale={1}
                color="#3b82f6"
                bodyFat={0}
              />
            </div>
            <div className="mt-4 text-center bg-blue-50/80 dark:bg-blue-900/20 rounded-xl px-4 py-2 shadow-sm min-h-[52px] border border-blue-100 dark:border-blue-800">
              <p className="text-sm font-semibold text-blue-600 dark:text-blue-400">Anterior</p>
              <p className="text-xs text-blue-500/80 mt-1">
                {previous.displayHeight}{heightUnit} / {previous.displayWeight}{weightUnit}
              </p>
            </div>
          </div>
        )}

        {/* Current state (Gray silhouette) */}
        <div className="flex flex-col items-center z-10 transition-all duration-500 hover:scale-105">
          <div className="h-[200px] flex items-end">
            <FriendlyChildSilhouette
              heightScale={currentHeightScale}
              widthScale={currentWidthScale}
              color="#94a3b8"
              bodyFat={bodyFatIntensity}
              abdominal={abdominalExpansion}
            />
          </div>
          <div className="mt-4 text-center bg-slate-50 dark:bg-gray-800/80 rounded-xl px-4 py-2 shadow-sm border-2 min-h-[52px] border-slate-300 dark:border-slate-600">
            <p className="text-sm font-bold text-slate-600 dark:text-slate-400">
              Actual
            </p>
            <p className="text-xs mt-1 text-slate-500">
              {current.displayHeight}{heightUnit} / {current.displayWeight}{weightUnit}
            </p>
          </div>
        </div>

        {/* Ideal reference (Green silhouette) */}
        <div className="flex flex-col items-center z-10 transition-all duration-500 hover:scale-105">
          <div className="h-[200px] flex items-end">
            <FriendlyChildSilhouette
              heightScale={idealScale}
              widthScale={1}
              color="#22c55e"
              bodyFat={0}
              isIdeal={true}
            />
          </div>
          <div className="mt-4 text-center bg-green-50 dark:bg-green-900/30 rounded-xl px-4 py-2 shadow-sm border-2 border-green-300 dark:border-green-700 min-h-[52px]">
            <p className="text-sm font-bold text-green-600 dark:text-green-400">Ideal (OMS)</p>
            <p className="text-xs text-green-500 mt-1">
              {ideal.displayHeight}{heightUnit} / {ideal.displayWeight}{weightUnit}
            </p>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex justify-center gap-6 mt-4 text-xs text-gray-500">
        <span className="flex items-center gap-1">
          <span className="w-8 h-0.5 bg-green-500 opacity-30"></span>
          Silueta ideal (referencia)
        </span>
      </div>

      {/* Metrics */}
      {transform3D && (
        <div className="mt-5 grid grid-cols-3 gap-3">
          <MetricCard
            label="Ratio Peso"
            value={`${(transform3D.ratioWeight * 100).toFixed(0)}%`}
            color={transform3D.ratioWeight > 1.15 ? '#ef4444' : transform3D.ratioWeight > 1.05 ? '#f97316' : transform3D.ratioWeight < 0.9 ? '#3b82f6' : '#22c55e'}
            icon="⚖️"
          />
          <MetricCard
            label="Ratio Talla"
            value={`${(transform3D.ratioHeight * 100).toFixed(0)}%`}
            color={transform3D.ratioHeight < 0.9 ? '#f97316' : '#22c55e'}
            icon="📏"
          />
          <MetricCard
            label="IMC"
            value={bmi?.toFixed(1) || '-'}
            color={healthStatus?.color || '#6b7280'}
            icon="📊"
          />
        </div>
      )}
    </div>
  )
}

// Medical Formal silhouette: clean, solid shapes with soft gradients
function FriendlyChildSilhouette({
  heightScale = 1,
  widthScale = 1,
  color = '#3b82f6',
  bodyFat = 0,
  abdominal = 0,
  isGhost = false,
  isIdeal = false
}) {
  const baseHeight = 160
  const height = baseHeight * heightScale
  const width = 100 * widthScale

  // Proportions with safety defaults
  const torsoWidth = Number(22 + (bodyFat * 12) + (abdominal * 6)) || 22
  const headSize = Number(18 + (bodyFat * 3)) || 18

  const strokeColor = isGhost ? '#cbd5e1' : (isIdeal ? '#22c55e' : color)
  const fillColor = isGhost ? 'none' : (isIdeal ? '#22c55e' : color)
  const opacity = isGhost ? 0.3 : (isIdeal ? 0.6 : 1)

  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 100 160"
      className="transition-all duration-1000 ease-in-out drop-shadow-sm"
    >
      <defs>
        <linearGradient id={`formal-grad-${color.replace('#', '')}`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={color} stopOpacity="0.9" />
          <stop offset="100%" stopColor={color} stopOpacity="0.7" />
        </linearGradient>
        <linearGradient id="ideal-grad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#22c55e" stopOpacity="0.5" />
          <stop offset="100%" stopColor="#22c55e" stopOpacity="0.3" />
        </linearGradient>
      </defs>

      <g opacity={opacity}>
        {/* Head */}
        <circle
          cx="50" cy="22" r={headSize}
          fill={isGhost ? 'none' : (isIdeal ? 'url(#ideal-grad)' : `url(#formal-grad-${color.replace('#', '')})`)}
          stroke={strokeColor}
          strokeWidth={isGhost ? 1.5 : 0}
          strokeDasharray={isGhost ? "4 4" : "0"}
        />

        {/* Neck */}
        <path
          d="M 46,38 Q 50,42 54,38"
          fill="none"
          stroke={strokeColor}
          strokeWidth="2"
          strokeLinecap="round"
          opacity="0.5"
        />

        {/* Torso */}
        <path
          d={`M ${50 - torsoWidth},45 
             Q ${50 - torsoWidth},42 50,42 
             Q ${50 + torsoWidth},42 ${50 + torsoWidth},45 
             L ${50 + torsoWidth + 2},90 
             Q ${50 + torsoWidth + 2},100 50,100 
             Q ${50 - torsoWidth - 2},100 ${50 - torsoWidth - 2},90 
             Z`}
          fill={isGhost ? 'none' : (isIdeal ? 'url(#ideal-grad)' : `url(#formal-grad-${color.replace('#', '')})`)}
          stroke={strokeColor}
          strokeWidth={isGhost ? 1.5 : 0}
          strokeDasharray={isGhost ? "4 4" : "0"}
        />

        {/* Left Arm */}
        <path
          d={`M ${50 - torsoWidth},48 
             Q ${50 - torsoWidth - 12},48 ${50 - torsoWidth - 10},75 
             Q ${50 - torsoWidth - 8},85 ${50 - torsoWidth},82`}
          fill="none"
          stroke={strokeColor}
          strokeWidth="8"
          strokeLinecap="round"
        />

        {/* Right Arm */}
        <path
          d={`M ${50 + torsoWidth},48 
             Q ${50 + torsoWidth + 12},48 ${50 + torsoWidth + 10},75 
             Q ${50 + torsoWidth + 8},85 ${50 + torsoWidth},82`}
          fill="none"
          stroke={strokeColor}
          strokeWidth="8"
          strokeLinecap="round"
        />

        {/* Left Leg */}
        <path
          d={`M ${50 - 12},98 
             L ${50 - 15},145 
             Q ${50 - 15},152 ${50 - 25},152`}
          fill="none"
          stroke={strokeColor}
          strokeWidth="10"
          strokeLinecap="round"
        />

        {/* Right Leg */}
        <path
          d={`M ${50 + 12},98 
             L ${50 + 15},145 
             Q ${50 + 15},152 ${50 + 25},152`}
          fill="none"
          stroke={strokeColor}
          strokeWidth="10"
          strokeLinecap="round"
        />

        {/* Face details (simple medical icon style) */}
        {!isGhost && (
          <g opacity="0.6">
            <circle cx="44" cy="20" r="1.5" fill="white" />
            <circle cx="56" cy="20" r="1.5" fill="white" />
          </g>
        )}
      </g>
    </svg>
  )
}
