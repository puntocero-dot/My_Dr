import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Stethoscope, Eye, EyeOff, AlertCircle, ChevronRight } from 'lucide-react'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      await login(email, password)
      navigate('/dashboard')
    } catch (err) {
      console.error('Login error:', err)
      if (err.code === 'ERR_NETWORK') {
        setError(`Error de red: No se pudo conectar al servidor (${import.meta.env.VITE_API_URL || 'localhost:3001'})`)
      } else if (err.message?.includes('CORS') || err.message?.includes('Network Error')) {
        setError(`Error CORS/Red: ${err.message}`)
      } else {
        setError(err.response?.data?.error || err.message || 'Error al iniciar sesión')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen relative overflow-hidden bg-brand-dark flex items-center justify-center p-4">
      {/* Decorative background elements */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-brand-accent/20 rounded-full blur-[120px] animate-pulse" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[30%] h-[30%] bg-blue-500/10 rounded-full blur-[100px]" />
      
      <div className="w-full max-w-lg relative z-10 transition-all duration-500 ease-out animate-in fade-in zoom-in duration-700">
        <div className="glass-card p-8 md:p-12">
          {/* Logo & Header */}
          <div className="text-center mb-10">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-tr from-brand-accent to-emerald-400 rounded-2xl rotate-3 shadow-lg shadow-emerald-500/20 mb-6 transition-transform hover:rotate-0 duration-500">
              <Stethoscope className="h-10 w-10 text-white" />
            </div>
            <h1 className="text-4xl font-extrabold text-white tracking-tight mb-2">
              My<span className="text-brand-accent">_</span>Dr
            </h1>
            <p className="text-slate-400 font-medium">
              Gestión Médica de Próxima Generación
            </p>
          </div>

          {/* Error message */}
          {error && (
            <div className="mb-8 p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl flex items-center gap-3 text-rose-400 animate-in slide-in-from-top-2 duration-300">
              <AlertCircle className="h-5 w-5 flex-shrink-0" />
              <span className="text-sm font-medium">{error}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-slate-300 ml-1">
                Correo electrónico
              </label>
              <div className="relative group">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input-field group-hover:border-brand-accent/50 transition-colors"
                  placeholder="doctor@mydr.com"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-semibold text-slate-300 ml-1">
                Contraseña
              </label>
              <div className="relative group">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input-field pr-12 group-hover:border-brand-accent/50 transition-colors"
                  placeholder="••••••••"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full btn-primary py-4 text-lg mt-4 group"
            >
              {loading ? (
                <div className="flex items-center gap-3">
                  <div className="animate-spin rounded-full h-5 w-5 border-2 border-white/30 border-t-white" />
                  <span>Autenticando...</span>
                </div>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  Entrar al Portal <ChevronRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
                </span>
              )}
            </button>
          </form>

        </div>

        <p className="text-center text-xs text-slate-500 mt-8 font-medium">
          © {new Date().getFullYear()} My_Dr • Plataforma Médica Segura
        </p>
      </div>
    </div>
  )
}
