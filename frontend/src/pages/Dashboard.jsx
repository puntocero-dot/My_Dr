import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useProject } from '../context/ProjectContext'
import api from '../services/api'
import {
  Users, Calendar, Clock, TrendingUp, AlertTriangle,
  ChevronRight, Activity, Stethoscope
} from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

export default function Dashboard() {
  const { user, isAdmin, isDoctor, isSecretary } = useAuth()
  const { activeProject } = useProject()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchDashboard()
  }, [activeProject])

  const fetchDashboard = async () => {
    try {
      setLoading(true)
      let endpoint = '/dashboard/doctor'
      if (isAdmin) endpoint = '/dashboard/admin'
      else if (isSecretary) endpoint = '/dashboard/secretary'

      const params = {}
      if (activeProject) params.clinicId = activeProject.id

      const response = await api.get(endpoint, { params })
      setData(response.data)
    } catch (error) {
      console.error('Dashboard error:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl font-extrabold text-brand-dark dark:text-white tracking-tight">
            {activeProject ? activeProject.name : `Bienvenido, ${user?.firstName}`}
          </h1>
          <p className="text-brand-muted font-medium mt-1">
            {activeProject 
              ? `Panel de control: ${activeProject.name}` 
              : (isAdmin ? 'Resumen Global de Proyectos' : isDoctor ? 'Panel Médico Especializado' : 'Gestión de Recepción')
            }
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm font-bold text-brand-muted bg-white/50 dark:bg-white/5 px-4 py-2 rounded-xl backdrop-blur-sm border border-white/20">
          <Calendar className="h-4 w-4 text-brand-accent" />
          {new Date().toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Pacientes Hoy"
          value={data?.stats?.patientsToday || 0}
          icon={Users}
          color="accent"
        />
        <StatCard
          title="Citas Pendientes"
          value={data?.stats?.pendingToday || data?.stats?.appointmentsToday || 0}
          icon={Calendar}
          color="blue"
        />
        <StatCard
          title="Esta Semana"
          value={data?.stats?.patientsWeek || data?.stats?.consultationsMonth || 0}
          icon={TrendingUp}
          color="purple"
        />
        <StatCard
          title={isAdmin ? 'Total Pacientes' : 'Consultas Mes'}
          value={data?.stats?.totalPatients || data?.stats?.patientsMonth || 0}
          icon={Activity}
          color="rose"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Today's Appointments */}
        <div className="glass-card p-8 group">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-brand-accent/10 rounded-lg text-brand-accent">
                <Clock className="h-5 w-5" />
              </div>
              <h2 className="text-xl font-bold text-brand-dark dark:text-white">
                Citas de Hoy
              </h2>
            </div>
            <Link to="/appointments" className="text-brand-accent hover:text-emerald-400 text-sm font-bold flex items-center gap-1 transition-colors">
              Gestionar todo <ChevronRight className="h-4 w-4" />
            </Link>
          </div>

          {data?.todayAppointments?.length > 0 ? (
            <div className="space-y-4">
              {data.todayAppointments.slice(0, 5).map((apt) => (
                <div key={apt.id} className="flex items-center gap-4 p-4 hover:bg-white/40 dark:hover:bg-white/5 rounded-2xl transition-all duration-300 border border-transparent hover:border-white/20">
                  <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center font-bold text-brand-muted">
                    {apt.scheduledTime?.slice(0, 5)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-brand-dark dark:text-white truncate">
                      {apt.patient?.firstName} {apt.patient?.lastName}
                    </p>
                    <p className="text-xs font-semibold text-brand-muted flex items-center gap-1 mt-0.5">
                      <Stethoscope className="h-3 w-3" /> {apt.reason || apt.type}
                    </p>
                  </div>
                  <StatusBadge status={apt.status} />
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-brand-muted">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-slate-50 dark:bg-slate-800/50 rounded-full mb-4 opacity-40">
                <Calendar className="h-8 w-8" />
              </div>
              <p className="font-medium">No hay citas programadas para hoy</p>
            </div>
          )}
        </div>

        {/* Top Diagnoses or Waiting Room */}
        <div className="glass-card p-8">
          <div className="flex items-center gap-3 mb-8">
            <div className="p-2 bg-purple-500/10 rounded-lg text-purple-500">
              <Activity className="h-5 w-5" />
            </div>
            <h2 className="text-xl font-bold text-brand-dark dark:text-white">
              {isSecretary ? 'Sala de Espera' : 'Métricas de Salud'}
            </h2>
          </div>

          {isSecretary && data?.waitingRoom ? (
            <div className="space-y-4">
              {data.waitingRoom.length > 0 ? (
                data.waitingRoom.map((item) => (
                  <div key={item.id} className="flex items-center gap-4 p-4 bg-amber-500/5 border border-amber-500/10 rounded-2xl">
                    <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-500">
                      <Users className="h-6 w-6" />
                    </div>
                    <div>
                      <p className="font-bold text-brand-dark dark:text-white">
                        {item.patient?.firstName} {item.patient?.lastName}
                      </p>
                      <p className="text-xs font-bold text-amber-600/60 flex items-center gap-1">
                        <Clock className="h-3 w-3" /> 
                        Llegó: {new Date(item.checkedInAt).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                    <div className="ml-auto">
                      <span className="animate-ping inline-flex h-2 w-2 rounded-full bg-amber-400 opacity-75"></span>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-center py-12 text-brand-muted font-medium">Sala de espera vacía</p>
              )}
            </div>
          ) : data?.topDiagnoses?.length > 0 ? (
            <div className="h-[240px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.topDiagnoses.slice(0, 5)} layout="vertical" margin={{ left: -20 }}>
                  <XAxis type="number" hide />
                  <YAxis dataKey="diagnosis" type="category" width={120} tick={{ fontSize: 11, fontWeight: 600, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                    cursor={{ fill: 'rgba(16, 185, 129, 0.05)' }}
                  />
                  <Bar dataKey="count" fill="#10b981" radius={[0, 8, 8, 0]} barSize={24} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="text-center py-12 text-brand-muted">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-slate-50 dark:bg-slate-800/50 rounded-full mb-4 opacity-40">
                <Stethoscope className="h-8 w-8" />
              </div>
              <p className="font-medium">Sin datos suficientes para métricas</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function StatCard({ title, value, icon: Icon, color }) {
  const colorSchemes = {
    accent: 'from-emerald-500/20 to-emerald-500/5 text-emerald-500',
    blue: 'from-blue-500/20 to-blue-500/5 text-blue-500',
    purple: 'from-purple-500/20 to-purple-500/5 text-purple-500',
    rose: 'from-rose-500/20 to-rose-500/5 text-rose-500',
  }

  return (
    <div className="glass-card p-6 relative overflow-hidden group hover:scale-[1.02] transition-all duration-300">
      <div className={`absolute top-0 right-0 w-24 h-24 bg-gradient-to-br ${colorSchemes[color]} blur-2xl opacity-20 -mr-8 -mt-8 transition-opacity group-hover:opacity-40`} />
      <div className="flex items-center gap-5">
        <div className={`p-4 rounded-2xl bg-gradient-to-br ${colorSchemes[color]} shadow-lg shadow-current/5`}>
          <Icon className="h-7 w-7" />
        </div>
        <div>
          <p className="text-3xl font-black text-brand-dark dark:text-white tracking-tight">{value}</p>
          <p className="text-xs font-bold text-brand-muted uppercase tracking-wider mt-0.5">{title}</p>
        </div>
      </div>
    </div>
  )
}

function StatusBadge({ status }) {
  const styles = {
    scheduled: 'badge-info',
    confirmed: 'badge-success',
    in_progress: 'badge-warning',
    completed: 'badge-success',
    cancelled: 'badge-danger',
    no_show: 'badge-danger',
  }

  const labels = {
    scheduled: 'Programada',
    confirmed: 'Confirmada',
    in_progress: 'En curso',
    completed: 'Finalizada',
    cancelled: 'Cancelada',
    no_show: 'Ausente',
  }

  return (
    <span className={`badge ${styles[status] || 'badge-info'} text-[10px]`}>
      {labels[status] || status}
    </span>
  )
}
