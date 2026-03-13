import { useState, useMemo, useCallback, useRef, useEffect } from 'react'

// ──────────────────────────────────────────────
// OMS Growth Standards (Lookup Tables - P50)
// ──────────────────────────────────────────────
const OMS_PROPORTIONS = [
    { maxAge: 3, headRatio: 0.25, headScale: 1.3 },
    { maxAge: 12, headRatio: 0.22, headScale: 1.2 },
    { maxAge: 36, headRatio: 0.20, headScale: 1.1 },
    { maxAge: 72, headRatio: 0.18, headScale: 1.0 },
    { maxAge: 144, headRatio: 0.15, headScale: 0.92 },
    { maxAge: 216, headRatio: 0.13, headScale: 0.85 },
]

function getProportionsForAge(ageMonths) {
    const clamped = Math.max(0, Math.min(216, ageMonths))
    let lower = OMS_PROPORTIONS[0]
    let upper = OMS_PROPORTIONS[0]

    for (let i = 0; i < OMS_PROPORTIONS.length; i++) {
        if (clamped <= OMS_PROPORTIONS[i].maxAge) {
            upper = OMS_PROPORTIONS[i]
            lower = i > 0 ? OMS_PROPORTIONS[i - 1] : OMS_PROPORTIONS[i]
            break
        }
    }

    if (lower === upper) return { ...lower }

    const t = (clamped - lower.maxAge) / (upper.maxAge - lower.maxAge)
    return {
        headRatio: lower.headRatio + (upper.headRatio - lower.headRatio) * t,
        headScale: lower.headScale + (upper.headScale - lower.headScale) * t,
    }
}

// ──────────────────────────────────────────────
// CSS 3D Body — Pure CSS with drag-to-rotate
// ──────────────────────────────────────────────
function CSS3DBody({ height = 180, widthScale = 1, bodyFat = 0, color = '#3b82f6', isGhost = false, label, sublabel, borderColor }) {
    const proportions = getProportionsForAge(24) // will be overridden by parent
    
    // Calibración para que la suma de las partes sea exactamente 'height'
    // headRatio (0.13 a 0.25) determina cuánto de la altura total es cabeza
    const headH = height * proportions.headRatio
    const bodyH = height - headH
    
    const headSize = headH * 1.2 * (1 + bodyFat * 0.05)
    const neckH = height * 0.05
    const torsoH = bodyH * 0.45
    const legH = bodyH * 0.50
    
    const torsoW = (height * 0.25) * widthScale * (1 + bodyFat * 0.35)
    const armW = (height * 0.08) + bodyFat * 4
    const armH = bodyH * 0.40
    const legW = (height * 0.10) + bodyFat * 5
    const hipGap = torsoW * 0.2
    const neckW = (height * 0.08) + bodyFat * 3

    const opacity = isGhost ? 0.25 : 1
    const fill = isGhost ? 'transparent' : color
    const border = isGhost ? `2px dashed ${color}` : 'none'
    const shadow = isGhost ? 'none' : `0 4px 20px ${color}44`

    return (
        <div className="flex flex-col items-center" style={{ opacity }}>
            {/* Head */}
            <div style={{
                width: headSize, height: headSize, borderRadius: '50%',
                background: isGhost ? 'transparent' : `radial-gradient(circle at 40% 35%, ${color}cc, ${color})`,
                border, boxShadow: shadow,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 0.6s ease',
            }}>
                {!isGhost && (
                    <div className="flex gap-1.5 mt-[-2px]">
                        <div className="w-1.5 h-1.5 rounded-full bg-white/60"></div>
                        <div className="w-1.5 h-1.5 rounded-full bg-white/60"></div>
                    </div>
                )}
            </div>

            {/* Neck */}
            <div style={{
                width: neckW, height: neckH,
                background: fill, border,
                transition: 'all 0.6s ease',
                marginTop: -(neckH * 0.3)
            }}></div>

            {/* Upper body = arms + torso */}
            <div className="flex items-start" style={{ transition: 'all 0.6s ease' }}>
                {/* Left Arm */}
                <div style={{
                    width: armW, height: armH,
                    borderRadius: `${armW / 2}px`,
                    background: isGhost ? 'transparent' : `linear-gradient(180deg, ${color}dd, ${color}aa)`,
                    border, boxShadow: shadow,
                    transform: 'rotate(8deg)', transformOrigin: 'top center',
                    marginRight: -2,
                    transition: 'all 0.6s ease',
                }}></div>

                {/* Torso */}
                <div style={{
                    width: torsoW, height: torsoH,
                    borderRadius: `${torsoW * 0.15}px / ${torsoH * 0.1}px`,
                    background: isGhost ? 'transparent' : `linear-gradient(180deg, ${color}, ${color}cc)`,
                    border, boxShadow: shadow,
                    position: 'relative',
                    transition: 'all 0.6s ease',
                }}>
                    {/* Abdomen bulge for overweight */}
                    {bodyFat > 0.2 && !isGhost && (
                        <div style={{
                            position: 'absolute', bottom: -4, left: '50%', transform: 'translateX(-50%)',
                            width: torsoW * 0.8, height: torsoW * 0.3 * bodyFat,
                            borderRadius: '50%',
                            background: `${color}bb`,
                            transition: 'all 0.6s ease',
                        }}></div>
                    )}
                </div>

                {/* Right Arm */}
                <div style={{
                    width: armW, height: armH,
                    borderRadius: `${armW / 2}px`,
                    background: isGhost ? 'transparent' : `linear-gradient(180deg, ${color}dd, ${color}aa)`,
                    border, boxShadow: shadow,
                    transform: 'rotate(-8deg)', transformOrigin: 'top center',
                    marginLeft: -2,
                    transition: 'all 0.6s ease',
                }}></div>
            </div>

            {/* Legs */}
            <div className="flex" style={{ gap: hipGap * 0.3, marginTop: -2, transition: 'all 0.6s ease' }}>
                <div style={{
                    width: legW, height: legH,
                    borderRadius: `${legW * 0.4}px ${legW * 0.4}px ${legW * 0.5}px ${legW * 0.5}px`,
                    background: isGhost ? 'transparent' : `linear-gradient(180deg, ${color}cc, ${color}99)`,
                    border, boxShadow: shadow,
                    transition: 'all 0.6s ease',
                }}></div>
                <div style={{
                    width: legW, height: legH,
                    borderRadius: `${legW * 0.4}px ${legW * 0.4}px ${legW * 0.5}px ${legW * 0.5}px`,
                    background: isGhost ? 'transparent' : `linear-gradient(180deg, ${color}cc, ${color}99)`,
                    border, boxShadow: shadow,
                    transition: 'all 0.6s ease',
                }}></div>
            </div>

            {/* Label */}
            {label && (
                <div className="mt-4 text-center bg-white/80 dark:bg-gray-700/80 rounded-xl px-4 py-2 shadow-sm"
                    style={{ borderWidth: 2, borderStyle: 'solid', borderColor: borderColor || color }}>
                    <p className="text-sm font-bold" style={{ color: borderColor || color }}>{label}</p>
                    {sublabel && <p className="text-xs mt-0.5" style={{ color: borderColor || color }}>{sublabel}</p>}
                </div>
            )}
        </div>
    )
}

// ──────────────────────────────────────────────
// Pediatric4DViewer — CSS 3D (no WebGL)
// ──────────────────────────────────────────────
export default function Pediatric4DViewer({
    edadEnMeses = 24,
    currentWeight = 0,
    currentHeight = 0,
    idealWeight = 0,
    idealHeight = 0,
    gender = 'male',
    healthStatus,
    bmi,
    transform3D,
}) {
    const containerRef = useRef(null)
    const [rotateY, setRotateY] = useState(0)
    const [isDragging, setIsDragging] = useState(false)
    const lastX = useRef(0)

    // Drag-to-rotate logic
    const handlePointerDown = useCallback((e) => {
        setIsDragging(true)
        lastX.current = e.clientX || e.touches?.[0]?.clientX || 0
    }, [])

    const handlePointerMove = useCallback((e) => {
        if (!isDragging) return
        const x = e.clientX || e.touches?.[0]?.clientX || 0
        const delta = x - lastX.current
        setRotateY(prev => prev + delta * 0.5)
        lastX.current = x
    }, [isDragging])

    const handlePointerUp = useCallback(() => {
        setIsDragging(false)
    }, [])

    useEffect(() => {
        window.addEventListener('pointerup', handlePointerUp)
        window.addEventListener('pointermove', handlePointerMove)
        return () => {
            window.removeEventListener('pointerup', handlePointerUp)
            window.removeEventListener('pointermove', handlePointerMove)
        }
    }, [handlePointerUp, handlePointerMove])

    // Calibración Unificada
    const SCENE_HEIGHT = 220
    const maxCm = Math.max(currentHeight, idealHeight) + 10
    const pxPerCm = SCENE_HEIGHT / maxCm
    
    const currentHeightPx = currentHeight * pxPerCm
    const idealHeightPx = idealHeight * pxPerCm
    const bodyFat = transform3D?.bodyFatIntensity || 0
    const widthScale = transform3D?.scaleXZ || 1
    
    const patientColor = '#94a3b8' // Cambiado a Gris como solicitó el usuario
    const idealColor = '#22c55e'   // Verde OMS
    const lastColor = '#3b82f6'    // Azul Última Consulta

    const percentileLabel = useMemo(() => {
        if (!transform3D?.ratioWeight) return null
        const r = transform3D.ratioWeight
        if (r > 1.2) return 'Sobrepeso significativo'
        if (r > 1.1) return 'Sobrepeso leve'
        if (r > 0.9) return 'Peso normal'
        if (r > 0.8) return 'Bajo peso leve'
        return 'Bajo peso significativo'
    }, [transform3D])

    if (!currentWeight && !currentHeight) {
        return (
            <div className="h-[450px] flex flex-col items-center justify-center bg-gradient-to-b from-blue-50 to-white dark:from-gray-800 dark:to-gray-900 rounded-2xl">
                <div className="w-20 h-20 mb-4 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-3xl">🧍</div>
                <p className="text-gray-600 dark:text-gray-300 font-medium mb-1">Sin datos para modelo 3D</p>
                <p className="text-sm text-gray-400 dark:text-gray-500">Registra peso y talla en la consulta</p>
            </div>
        )
    }

    return (
        <div
            ref={containerRef}
            className="relative rounded-2xl overflow-hidden bg-gradient-to-b from-slate-100 via-slate-50 to-white dark:from-gray-800 dark:via-gray-850 dark:to-gray-900 select-none"
            style={{ height: 500, cursor: isDragging ? 'grabbing' : 'grab', perspective: '800px' }}
            onPointerDown={handlePointerDown}
        >
            {/* Health Status Banner */}
            {healthStatus && (
                <div
                    className="absolute top-3 left-3 z-10 px-4 py-2 rounded-xl text-white text-sm font-semibold shadow-lg"
                    style={{ backgroundColor: healthStatus.color + 'dd' }}
                >
                    {healthStatus.label}
                    {bmi && <span className="ml-2 opacity-80">— IMC: {bmi.toFixed(1)}</span>}
                </div>
            )}

            {/* Metrics overlay */}
            {transform3D && (
                <div className="absolute top-3 right-3 z-10 flex flex-col gap-1.5">
                    <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-lg px-3 py-1.5 text-center shadow-sm">
                        <p className="text-[9px] text-gray-500 uppercase tracking-wide">Peso</p>
                        <p className="text-sm font-bold" style={{ color: patientColor }}>{currentWeight} kg</p>
                    </div>
                    <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-lg px-3 py-1.5 text-center shadow-sm">
                        <p className="text-[9px] text-gray-500 uppercase tracking-wide">Talla</p>
                        <p className="text-sm font-bold text-blue-600">{currentHeight} cm</p>
                    </div>
                    <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-lg px-3 py-1.5 text-center shadow-sm">
                        <p className="text-[9px] text-gray-500 uppercase tracking-wide">Ratio</p>
                        <p className="text-sm font-bold" style={{ color: patientColor }}>
                            {(transform3D.ratioWeight * 100).toFixed(0)}%
                        </p>
                    </div>
                </div>
            )}

            {/* Interaction hint */}
            <div className="absolute bottom-3 left-3 z-10 px-3 py-1.5 bg-black/30 backdrop-blur-sm rounded-lg text-[10px] text-white/80 flex items-center gap-1.5">
                <span>🖱️</span> Arrastra para rotar
            </div>

            {/* Legend */}
            <div className="absolute bottom-3 right-3 z-20 flex gap-2 text-[10px]">
                <span className="flex items-center gap-1 bg-black/30 backdrop-blur-sm text-white/80 px-2 py-1 rounded-lg">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: patientColor }}></span> Actual
                </span>
                <span className="flex items-center gap-1 bg-black/30 backdrop-blur-sm text-white/80 px-2 py-1 rounded-lg">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: idealColor }}></span> Ideal OMS
                </span>
            </div>

            {/* 3D Scene with CSS transforms */}
            <div
                className="w-full h-full flex justify-center items-end pb-16 pt-10 relative z-0"
                style={{
                    transformStyle: 'preserve-3d',
                    transform: `rotateY(${rotateY}deg)`,
                    transition: isDragging ? 'none' : 'transform 0.3s ease-out',
                }}
            >
                {/* Horizontal Guide Lines Overlay (Fixed, not rotating) - We subtract rotation to keep it flat relative to viewer */}
                <div className="absolute inset-0 pointer-events-none z-10" style={{ transform: 'translateZ(0px)', rotateY: `${-rotateY}deg` }}>
                    {/* Ruler */}
                    <div className="absolute left-6 bottom-16 top-8 w-12 border-r border-slate-300/30 dark:border-white/10">
                        {(() => {
                            return [...Array(Math.ceil(maxCm / 10) + 1)].map((_, i) => {
                                const cm = i * 10;
                                const bottom = cm * pxPerCm;
                                return (
                                    <div key={cm} className="absolute left-0 w-full flex items-center" style={{ bottom: `${bottom}px` }}>
                                        <div className="w-3 h-0.5 bg-slate-400/40 dark:bg-white/20"></div>
                                        <span className="text-[9px] font-bold text-slate-400 dark:text-gray-500 ml-1">{cm}</span>
                                    </div>
                                )
                            });
                        })()}
                    </div>

                    {/* Lines crossing the current child */}
                    {(() => {
                        const currentY = currentHeight * pxPerCm;
                        const idealY = idealHeight * pxPerCm;
                        return (
                            <>
                                {/* Ideal Line (Green) */}
                                <div className="absolute left-6 right-6 border-t border-dashed border-green-500/40 transition-all duration-1000" style={{ bottom: `${idealY + 64}px` }}>
                                    <div className="absolute -top-4 right-0 text-[10px] font-black text-green-500/60 uppercase tracking-tighter">Ideal ({idealHeight}cm)</div>
                                </div>
                                {/* Current Line (Gray) */}
                                <div className="absolute left-6 right-6 border-t-2 border-dashed border-slate-400/50 transition-all duration-1000" style={{ bottom: `${currentY + 64}px` }}>
                                    <div className="absolute -top-8 left-12 flex flex-col items-start">
                                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-tighter">Actual ({currentHeight}cm)</span>
                                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-white/90 dark:bg-gray-800/90 text-slate-500 border border-slate-200 dark:border-slate-700 shadow-sm">
                                           Dif: {currentHeight > idealHeight ? '+' : ''}{(currentHeight - idealHeight).toFixed(1)} cm
                                        </span>
                                    </div>
                                </div>
                            </>
                        )
                    })()}
                </div>

                {/* Ghost ideal (behind, slightly offset) */}
                <div style={{ transform: 'translateZ(-20px)', position: 'absolute', bottom: 64 }}>
                    <CSS3DBody
                        height={idealHeightPx}
                        widthScale={1}
                        bodyFat={0}
                        color={idealColor}
                        isGhost={true}
                        label="Ideal (OMS P50)"
                        sublabel={`${idealHeight} cm / ${idealWeight} kg`}
                        borderColor={idealColor}
                    />
                </div>

                {/* Patient model (front) */}
                <div style={{ transform: 'translateZ(20px)', position: 'relative', zIndex: 2 }}>
                    <CSS3DBody
                        height={currentHeightPx}
                        widthScale={widthScale}
                        bodyFat={bodyFat}
                        color={patientColor}
                        label="Paciente Actual"
                        sublabel={`${currentHeight} cm / ${currentWeight} kg`}
                        borderColor={patientColor}
                    />
                </div>
            </div>

            {/* Percentile label */}
            {percentileLabel && (
                <div className="absolute top-14 left-3 z-10 px-3 py-1 rounded-lg text-xs font-medium"
                    style={{ backgroundColor: patientColor + '22', color: '#64748b' }}>
                    {percentileLabel}
                </div>
            )}
        </div>
    )
}
