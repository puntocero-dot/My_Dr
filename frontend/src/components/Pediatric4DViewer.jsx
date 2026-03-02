import { useRef, useState, useMemo, useCallback, Suspense } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, Environment, ContactShadows, Html } from '@react-three/drei'
import * as THREE from 'three'

// ──────────────────────────────────────────────
// OMS Growth Standards (Lookup Tables - P50)
// ──────────────────────────────────────────────
const OMS_PROPORTIONS = [
    { maxAge: 3, headRatio: 0.25, trunkRatio: 0.35, limbRatio: 0.25, headScale: 1.3 },
    { maxAge: 12, headRatio: 0.22, trunkRatio: 0.35, limbRatio: 0.28, headScale: 1.2 },
    { maxAge: 36, headRatio: 0.20, trunkRatio: 0.34, limbRatio: 0.30, headScale: 1.1 },
    { maxAge: 72, headRatio: 0.18, trunkRatio: 0.33, limbRatio: 0.33, headScale: 1.0 },
    { maxAge: 144, headRatio: 0.15, trunkRatio: 0.32, limbRatio: 0.35, headScale: 0.92 },
    { maxAge: 216, headRatio: 0.13, trunkRatio: 0.30, limbRatio: 0.37, headScale: 0.85 },
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

    const lowerAge = lower.maxAge
    const upperAge = upper.maxAge
    const t = (clamped - lowerAge) / (upperAge - lowerAge)

    return {
        headRatio: THREE.MathUtils.lerp(lower.headRatio, upper.headRatio, t),
        trunkRatio: THREE.MathUtils.lerp(lower.trunkRatio, upper.trunkRatio, t),
        limbRatio: THREE.MathUtils.lerp(lower.limbRatio, upper.limbRatio, t),
        headScale: THREE.MathUtils.lerp(lower.headScale, upper.headScale, t),
    }
}

// ──────────────────────────────────────────────
// Body Part Names
// ──────────────────────────────────────────────
const BODY_PARTS = {
    head: 'Cabeza',
    torso: 'Torso',
    leftArm: 'Brazo Izquierdo',
    rightArm: 'Brazo Derecho',
    leftLeg: 'Pierna Izquierda',
    rightLeg: 'Pierna Derecha',
}

// ──────────────────────────────────────────────
// HumanBodyModel — Procedural 3D mannequin
// ──────────────────────────────────────────────
function HumanBodyModel({
    ageMonths = 24,
    heightScale = 1,
    widthScale = 1,
    bodyFatIntensity = 0,
    color = '#3b82f6',
    isGhost = false,
    isIdeal = false,
    onPartClick,
    positionX = 0,
}) {
    const groupRef = useRef()
    const [highlightedPart, setHighlightedPart] = useState(null)
    const highlightTimer = useRef(null)

    // Get age-proportional body params
    const proportions = useMemo(() => getProportionsForAge(ageMonths), [ageMonths])

    // Animate smooth transitions
    const currentProportions = useRef(proportions)
    useFrame((_, delta) => {
        const cp = currentProportions.current
        const speed = 3 * delta
        cp.headRatio = THREE.MathUtils.lerp(cp.headRatio, proportions.headRatio, speed)
        cp.trunkRatio = THREE.MathUtils.lerp(cp.trunkRatio, proportions.trunkRatio, speed)
        cp.limbRatio = THREE.MathUtils.lerp(cp.limbRatio, proportions.limbRatio, speed)
        cp.headScale = THREE.MathUtils.lerp(cp.headScale, proportions.headScale, speed)
    })

    // Weight deformation
    const torsoScaleX = useMemo(() => {
        const base = widthScale || 1
        const fatFactor = 1 + (bodyFatIntensity * 0.4)
        return base * fatFactor
    }, [widthScale, bodyFatIntensity])

    const torsoScaleZ = useMemo(() => {
        const base = widthScale || 1
        const fatFactor = 1 + (bodyFatIntensity * 0.5)
        return base * fatFactor
    }, [widthScale, bodyFatIntensity])

    // Material
    const material = useMemo(() => {
        if (isGhost) {
            return new THREE.MeshStandardMaterial({
                color: '#22c55e',
                wireframe: true,
                transparent: true,
                opacity: 0.25,
                depthWrite: false,
            })
        }
        return new THREE.MeshStandardMaterial({
            color: color,
            roughness: 0.55,
            metalness: 0.05,
            flatShading: false,
            transparent: isIdeal,
            opacity: isIdeal ? 0.5 : 1,
        })
    }, [color, isGhost, isIdeal])

    // Highlighted material
    const highlightMaterial = useMemo(() => {
        return new THREE.MeshStandardMaterial({
            color: '#ffffff',
            emissive: color,
            emissiveIntensity: 0.8,
            roughness: 0.3,
            metalness: 0.1,
        })
    }, [color])

    const handleClick = useCallback((partName, e) => {
        if (isGhost || isIdeal) return
        e.stopPropagation()

        setHighlightedPart(partName)
        if (highlightTimer.current) clearTimeout(highlightTimer.current)
        highlightTimer.current = setTimeout(() => setHighlightedPart(null), 600)

        if (onPartClick) {
            onPartClick({
                partName,
                partLabel: BODY_PARTS[partName] || partName,
            })
        }
    }, [onPartClick, isGhost, isIdeal, color])

    const getMaterial = useCallback((partName) => {
        return highlightedPart === partName ? highlightMaterial : material
    }, [highlightedPart, highlightMaterial, material])

    // Dimensions based on a normalized total height of ~2 units
    const totalH = 2.0 * heightScale
    const p = proportions

    const headRadius = 0.22 * p.headScale
    const neckH = 0.08
    const torsoH = totalH * p.trunkRatio
    const torsoW = 0.28 * torsoScaleX
    const torsoD = 0.18 * torsoScaleZ
    const armLen = totalH * p.limbRatio * 0.9
    const armR = 0.06 + (bodyFatIntensity * 0.02)
    const legLen = totalH * p.limbRatio
    const legR = 0.08 + (bodyFatIntensity * 0.025)
    const hipW = 0.14 * torsoScaleX

    const headY = totalH - headRadius
    const neckY = headY - headRadius - neckH / 2
    const torsoTopY = neckY - neckH / 2
    const torsoCenterY = torsoTopY - torsoH / 2
    const hipY = torsoTopY - torsoH
    const legCenterY = hipY - legLen / 2
    const shoulderY = torsoTopY - 0.04
    const armCenterY = shoulderY - armLen / 2

    // Slow idle rotation for visual appeal
    useFrame((_, delta) => {
        if (groupRef.current && !isGhost) {
            groupRef.current.rotation.y += delta * 0.08
        }
    })

    const cursor = (!isGhost && !isIdeal) ? 'pointer' : 'default'

    return (
        <group ref={groupRef} position={[positionX, -totalH / 2, 0]}>
            {/* Head */}
            <mesh
                position={[0, headY, 0]}
                material={getMaterial('head')}
                onClick={(e) => handleClick('head', e)}
                castShadow
                onPointerOver={() => { if (!isGhost && !isIdeal) document.body.style.cursor = 'pointer' }}
                onPointerOut={() => { document.body.style.cursor = 'default' }}
            >
                <sphereGeometry args={[headRadius, 24, 24]} />
            </mesh>

            {/* Neck */}
            <mesh position={[0, neckY, 0]} material={material} castShadow>
                <cylinderGeometry args={[0.05, 0.06, neckH, 12]} />
            </mesh>

            {/* Torso */}
            <mesh
                position={[0, torsoCenterY, 0]}
                material={getMaterial('torso')}
                onClick={(e) => handleClick('torso', e)}
                castShadow
                onPointerOver={() => { if (!isGhost && !isIdeal) document.body.style.cursor = 'pointer' }}
                onPointerOut={() => { document.body.style.cursor = 'default' }}
            >
                <capsuleGeometry args={[torsoW, torsoH * 0.5, 8, 16]} />
                {/* Apply non-uniform scale for weight */}
            </mesh>

            {/* Abdomen bulge for overweight */}
            {bodyFatIntensity > 0.2 && !isGhost && (
                <mesh
                    position={[0, torsoCenterY - torsoH * 0.15, torsoD * 0.3]}
                    material={material}
                    castShadow
                >
                    <sphereGeometry args={[torsoW * 0.7 * bodyFatIntensity, 16, 16]} />
                </mesh>
            )}

            {/* Left Arm */}
            <mesh
                position={[-(torsoW + armR + 0.02), armCenterY, 0]}
                material={getMaterial('leftArm')}
                onClick={(e) => handleClick('leftArm', e)}
                castShadow
                rotation={[0, 0, 0.15]}
                onPointerOver={() => { if (!isGhost && !isIdeal) document.body.style.cursor = 'pointer' }}
                onPointerOut={() => { document.body.style.cursor = 'default' }}
            >
                <capsuleGeometry args={[armR, armLen * 0.6, 6, 12]} />
            </mesh>

            {/* Right Arm */}
            <mesh
                position={[(torsoW + armR + 0.02), armCenterY, 0]}
                material={getMaterial('rightArm')}
                onClick={(e) => handleClick('rightArm', e)}
                castShadow
                rotation={[0, 0, -0.15]}
                onPointerOver={() => { if (!isGhost && !isIdeal) document.body.style.cursor = 'pointer' }}
                onPointerOut={() => { document.body.style.cursor = 'default' }}
            >
                <capsuleGeometry args={[armR, armLen * 0.6, 6, 12]} />
            </mesh>

            {/* Left Leg */}
            <mesh
                position={[-hipW, legCenterY, 0]}
                material={getMaterial('leftLeg')}
                onClick={(e) => handleClick('leftLeg', e)}
                castShadow
                onPointerOver={() => { if (!isGhost && !isIdeal) document.body.style.cursor = 'pointer' }}
                onPointerOut={() => { document.body.style.cursor = 'default' }}
            >
                <capsuleGeometry args={[legR, legLen * 0.6, 6, 12]} />
            </mesh>

            {/* Right Leg */}
            <mesh
                position={[hipW, legCenterY, 0]}
                material={getMaterial('rightLeg')}
                onClick={(e) => handleClick('rightLeg', e)}
                castShadow
                onPointerOver={() => { if (!isGhost && !isIdeal) document.body.style.cursor = 'pointer' }}
                onPointerOut={() => { document.body.style.cursor = 'default' }}
            >
                <capsuleGeometry args={[legR, legLen * 0.6, 6, 12]} />
            </mesh>

            {/* Feet (small spheres) */}
            {!isGhost && (
                <>
                    <mesh position={[-hipW, legCenterY - legLen / 2 - legR * 0.3, legR * 0.4]} material={material} castShadow>
                        <sphereGeometry args={[legR * 0.9, 8, 8]} />
                    </mesh>
                    <mesh position={[hipW, legCenterY - legLen / 2 - legR * 0.3, legR * 0.4]} material={material} castShadow>
                        <sphereGeometry args={[legR * 0.9, 8, 8]} />
                    </mesh>
                </>
            )}

            {/* Hands (small spheres) */}
            {!isGhost && (
                <>
                    <mesh position={[-(torsoW + armR + 0.04), armCenterY - armLen * 0.35, 0]} material={material} castShadow>
                        <sphereGeometry args={[armR * 0.9, 8, 8]} />
                    </mesh>
                    <mesh position={[(torsoW + armR + 0.04), armCenterY - armLen * 0.35, 0]} material={material} castShadow>
                        <sphereGeometry args={[armR * 0.9, 8, 8]} />
                    </mesh>
                </>
            )}
        </group>
    )
}

// ──────────────────────────────────────────────
// Scene setup: lights, floor, controls
// ──────────────────────────────────────────────
function SceneEnvironment() {
    return (
        <>
            <ambientLight intensity={0.45} />
            <directionalLight
                position={[4, 6, 4]}
                intensity={0.9}
                castShadow
                shadow-mapSize={[1024, 1024]}
                shadow-camera-far={20}
                shadow-camera-left={-3}
                shadow-camera-right={3}
                shadow-camera-top={3}
                shadow-camera-bottom={-3}
            />
            <hemisphereLight
                color="#b1e1ff"
                groundColor="#b97a20"
                intensity={0.25}
            />
            <ContactShadows
                position={[0, -1.15, 0]}
                opacity={0.35}
                scale={6}
                blur={2.5}
                far={4}
            />
            <OrbitControls
                enablePan={false}
                minDistance={2.5}
                maxDistance={7}
                minPolarAngle={Math.PI / 6}
                maxPolarAngle={Math.PI / 1.8}
                target={[0, 0.2, 0]}
                autoRotate={false}
            />
        </>
    )
}

// ──────────────────────────────────────────────
// Info Tooltip — shows on body part click
// ──────────────────────────────────────────────
function InfoTooltip({ data, onClose }) {
    if (!data) return null
    return (
        <div
            className="absolute top-4 right-4 bg-white dark:bg-gray-800 rounded-xl shadow-xl p-4 z-20 min-w-[200px] border border-gray-200 dark:border-gray-700 animate-in"
            style={{ animation: 'fadeInUp 0.3s ease-out' }}
        >
            <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-bold text-gray-900 dark:text-white">
                    🩺 {data.partLabel}
                </span>
                <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg leading-none">&times;</button>
            </div>
            <div className="space-y-1 text-xs text-gray-600 dark:text-gray-400">
                <p><strong>Edad:</strong> {data.ageMonths} meses</p>
                <p><strong>Peso:</strong> {data.currentWeight} kg</p>
                <p><strong>Talla:</strong> {data.currentHeight} cm</p>
                {data.bmi && <p><strong>IMC:</strong> {data.bmi.toFixed(1)}</p>}
                {data.percentileLabel && (
                    <p className="mt-1 font-medium" style={{ color: data.healthColor }}>
                        {data.percentileLabel}
                    </p>
                )}
            </div>
        </div>
    )
}

// ──────────────────────────────────────────────
// Loading Spinner for Canvas Suspense
// ──────────────────────────────────────────────
function CanvasLoader() {
    return (
        <Html center>
            <div className="flex flex-col items-center gap-2">
                <div className="w-10 h-10 border-3 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                <p className="text-xs text-gray-500 font-medium">Cargando modelo 3D...</p>
            </div>
        </Html>
    )
}

// ──────────────────────────────────────────────
// Pediatric4DViewer — Main exported component
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
    onBodyPartClick,
}) {
    const [tooltipData, setTooltipData] = useState(null)

    // Compute scales from data
    const heightScale = useMemo(() => {
        if (!idealHeight || !currentHeight) return 1
        return currentHeight / idealHeight
    }, [currentHeight, idealHeight])

    const widthScale = useMemo(() => {
        return transform3D?.scaleXZ || 1
    }, [transform3D])

    const bodyFat = useMemo(() => {
        return transform3D?.bodyFatIntensity || 0
    }, [transform3D])

    const patientColor = useMemo(() => {
        return healthStatus?.color || '#3b82f6'
    }, [healthStatus])

    const percentileLabel = useMemo(() => {
        if (!transform3D?.ratioWeight) return null
        const r = transform3D.ratioWeight
        if (r > 1.2) return 'Sobrepeso significativo'
        if (r > 1.1) return 'Sobrepeso leve'
        if (r > 0.9) return 'Peso normal'
        if (r > 0.8) return 'Bajo peso leve'
        return 'Bajo peso significativo'
    }, [transform3D])

    const handlePartClick = useCallback((partInfo) => {
        setTooltipData({
            ...partInfo,
            ageMonths: edadEnMeses,
            currentWeight,
            currentHeight,
            bmi,
            percentileLabel,
            healthColor: patientColor,
        })
        if (onBodyPartClick) {
            onBodyPartClick({
                ...partInfo,
                currentAge: edadEnMeses,
                currentHeight,
                currentWeight,
                percentileVsOMS: transform3D?.ratioWeight || null,
            })
        }
    }, [edadEnMeses, currentWeight, currentHeight, bmi, percentileLabel, patientColor, onBodyPartClick, transform3D])

    if (!currentWeight && !currentHeight) {
        return (
            <div className="h-[450px] flex flex-col items-center justify-center bg-gradient-to-b from-blue-50 to-white dark:from-gray-800 dark:to-gray-900 rounded-2xl">
                <div className="w-20 h-20 mb-4 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-3xl">
                    🧍
                </div>
                <p className="text-gray-600 dark:text-gray-300 font-medium mb-1">Sin datos para modelo 3D</p>
                <p className="text-sm text-gray-400 dark:text-gray-500">Registra peso y talla en la consulta</p>
            </div>
        )
    }

    return (
        <div className="relative rounded-2xl overflow-hidden bg-gradient-to-b from-slate-100 to-slate-200 dark:from-gray-800 dark:to-gray-900" style={{ height: 480 }}>
            {/* Health Status Banner */}
            {healthStatus && (
                <div
                    className="absolute top-3 left-3 z-10 px-4 py-2 rounded-xl text-white text-sm font-semibold shadow-lg backdrop-blur-sm"
                    style={{ backgroundColor: healthStatus.color + 'dd' }}
                >
                    {healthStatus.label}
                    {bmi && <span className="ml-2 opacity-80">— IMC: {bmi.toFixed(1)}</span>}
                </div>
            )}

            {/* Interaction hint */}
            <div className="absolute bottom-3 left-3 z-10 px-3 py-1.5 bg-black/40 backdrop-blur-sm rounded-lg text-[10px] text-white/80 flex items-center gap-1.5">
                <span>🖱️</span> Arrastra para rotar • Clic en el cuerpo para detalles
            </div>

            {/* Legend labels */}
            <div className="absolute bottom-3 right-3 z-10 flex gap-3 text-[10px]">
                <span className="flex items-center gap-1 bg-black/40 backdrop-blur-sm text-white/80 px-2 py-1 rounded-lg">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: patientColor }}></span>
                    Paciente
                </span>
                <span className="flex items-center gap-1 bg-black/40 backdrop-blur-sm text-white/80 px-2 py-1 rounded-lg">
                    <span className="w-2 h-2 rounded-full bg-green-400 opacity-50"></span>
                    Ideal OMS
                </span>
            </div>

            {/* Info tooltip */}
            <InfoTooltip data={tooltipData} onClose={() => setTooltipData(null)} />

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

            {/* 3D Canvas */}
            <Canvas
                camera={{ position: [0, 0.8, 4.5], fov: 45 }}
                shadows
                dpr={[1, 2]}
                gl={{ antialias: true, alpha: true }}
            >
                <Suspense fallback={<CanvasLoader />}>
                    <SceneEnvironment />

                    {/* Patient model */}
                    <HumanBodyModel
                        ageMonths={edadEnMeses}
                        heightScale={heightScale}
                        widthScale={widthScale}
                        bodyFatIntensity={bodyFat}
                        color={patientColor}
                        onPartClick={handlePartClick}
                        positionX={-0.4}
                    />

                    {/* Ghost ideal (OMS P50) */}
                    <HumanBodyModel
                        ageMonths={edadEnMeses}
                        heightScale={1}
                        widthScale={1}
                        bodyFatIntensity={0}
                        color="#22c55e"
                        isGhost={true}
                        positionX={0.4}
                    />

                    {/* Grid floor */}
                    <gridHelper args={[6, 12, '#cbd5e1', '#e2e8f0']} position={[0, -1.15, 0]} />
                </Suspense>
            </Canvas>
        </div>
    )
}
