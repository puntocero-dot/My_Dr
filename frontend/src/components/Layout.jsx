import { useState } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import {
  LayoutDashboard, Users, Calendar, FileText, Syringe,
  Building2, Settings, LogOut, Menu, X, UserCircle,
  Stethoscope, Moon, Sun, Briefcase
} from 'lucide-react'
import GlobalProjectSelector from './GlobalProjectSelector'
import { useProject } from '../context/ProjectContext'

export default function Layout() {
  const { user, logout, isAdmin, isDoctor } = useAuth()
  const { activeProject } = useProject()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [darkMode, setDarkMode] = useState(
    localStorage.getItem('darkMode') === 'true'
  )

  const toggleDarkMode = () => {
    const newMode = !darkMode
    setDarkMode(newMode)
    localStorage.setItem('darkMode', newMode)
    document.documentElement.classList.toggle('dark', newMode)
  }

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const navigation = [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, module: 'dashboard' },
    { name: 'Pacientes', href: '/patients', icon: Users, module: 'patients' },
    { name: 'Citas', href: '/appointments', icon: Calendar, module: 'appointments' },
    { name: 'Vacunación', href: '/vaccinations', icon: Syringe, module: 'vaccinations' },
    { name: 'Documentos', href: '/documents', icon: FileText, module: 'documents' },
    ...(isAdmin || isDoctor ? [
      { name: 'Referencias', href: '/referrals', icon: Stethoscope, module: 'referrals' },
    ] : []),
    ...(isAdmin ? [
      { name: 'Usuarios', href: '/users', icon: UserCircle, module: 'users' },
      { name: 'Clínicas', href: '/clinics', icon: Building2, module: 'clinics' },
    ] : []),
    { name: 'Configuración', href: '/settings', icon: Settings },
  ].filter(item => {
    // If we're Admin and no project is selected, show everything
    if (isAdmin && !activeProject) return true;
    
    // If a project is selected (or we're a restricted user), check against enabledModules
    if (activeProject?.settings?.enabledModules && item.module) {
      return activeProject.settings.enabledModules.includes(item.module);
    }
    
    // Always show items without a specific module (like Settings)
    return true;
  })

  return (
    <div className={`min-h-screen ${darkMode ? 'dark' : ''} selection:bg-brand-accent/30`}>
      <div className="min-h-screen bg-brand-surface dark:bg-brand-dark transition-colors duration-500">
        {/* Mobile sidebar backdrop */}
        {(sidebarOpen || userMenuOpen) && (
          <div 
            className="fixed inset-0 bg-brand-dark/40 backdrop-blur-sm z-40 lg:hidden animate-in fade-in duration-300"
            onClick={() => { setSidebarOpen(false); setUserMenuOpen(false); }}
          />
        )}
        {/* Desktop menu backdrop */}
        {userMenuOpen && (
          <div 
            className="fixed inset-0 z-40 hidden lg:block"
            onClick={() => setUserMenuOpen(false)}
          />
        )}

        {/* Sidebar */}
        <aside className={`
          fixed top-0 left-0 z-50 h-full w-72 bg-white/80 dark:bg-brand-dark/80 backdrop-blur-xl border-r border-white/20 dark:border-white/5
          transform transition-all duration-500 cubic-bezier(0.4, 0, 0.2, 1)
          ${sidebarOpen ? 'translate-x-0 shadow-2xl shadow-brand-dark/20' : '-translate-x-full'}
          lg:translate-x-0
        `}>
          <div className="flex items-center justify-between h-20 px-6 border-b border-white/10">
            <div className="flex items-center gap-3 group px-2 py-1 rounded-xl transition-all duration-300">
              {activeProject?.logoUrl ? (
                <div className="h-10 w-10 flex items-center justify-center overflow-hidden rounded-lg bg-white shadow-sm border border-white/20">
                  <img src={activeProject.logoUrl} alt="Logo" className="max-h-full max-w-full object-contain" />
                </div>
              ) : (
                <div className="p-2 bg-gradient-to-tr from-brand-accent to-emerald-400 rounded-lg shadow-lg shadow-emerald-500/20 group-hover:rotate-12 transition-transform font-black text-white">
                  <Stethoscope className="h-6 w-6 text-white" />
                </div>
              )}
              <span className="text-2xl font-black text-brand-dark dark:text-white tracking-tighter">
                {activeProject ? activeProject.name.split(' ')[0] : 'My'}<span className="text-brand-accent">{activeProject ? '' : '_'}</span>{activeProject ? '' : 'Dr'}
              </span>
            </div>
            <button 
              className="lg:hidden p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
              onClick={() => setSidebarOpen(false)}
            >
              <X className="h-5 w-5 text-brand-muted" />
            </button>
          </div>

          <nav className="p-6 space-y-2 overflow-y-auto h-[calc(100%-16rem)] custom-scrollbar">
            {navigation.map((item) => (
              <NavLink
                key={item.name}
                to={item.href}
                onClick={() => setSidebarOpen(false)}
                className={({ isActive }) => `
                  flex items-center gap-3 px-4 py-3.5 rounded-2xl text-sm font-bold transition-all duration-300 group
                  ${isActive 
                    ? 'bg-brand-dark dark:bg-brand-accent text-white shadow-lg shadow-brand-dark/20 dark:shadow-brand-accent/20 translate-x-1' 
                    : 'text-brand-muted hover:bg-slate-100 dark:hover:bg-white/5 hover:text-brand-dark dark:hover:text-white'}
                `}
              >
                <item.icon className={`h-5 w-5 transition-transform group-hover:scale-110`} />
                {item.name}
              </NavLink>
            ))}
          </nav>

          <div className="absolute bottom-0 left-0 right-0 p-6">
            <div className="glass-card mb-4 p-4 border-white/5 bg-brand-surface/50 dark:bg-white/5">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-slate-200 to-slate-100 dark:from-white/10 dark:to-white/5 border border-white/20 flex items-center justify-center shadow-inner">
                  <span className="text-brand-dark dark:text-brand-accent font-black tracking-tighter">
                    {user?.firstName?.[0]}{user?.lastName?.[0]}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-black text-brand-dark dark:text-white truncate">
                    {user?.firstName} {user?.lastName}
                  </p>
                  <p className="text-[10px] font-bold text-brand-accent uppercase tracking-widest mt-0.5">
                    {user?.role}
                  </p>
                </div>
              </div>
              <div className="flex gap-2 mt-4 pt-4 border-t border-white/10">
                <button
                  onClick={toggleDarkMode}
                  className="flex-1 flex items-center justify-center p-3 text-brand-muted hover:text-brand-dark dark:hover:text-white glass-card border-none bg-slate-100 dark:bg-white/5 hover:bg-slate-200"
                  aria-label="Toggle Dark Mode"
                >
                  {darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                </button>
                <button
                  onClick={handleLogout}
                  className="flex-1 flex items-center justify-center p-3 text-rose-500 hover:text-white glass-card border-none bg-rose-500/10 hover:bg-rose-500 shadow-none hover:shadow-lg hover:shadow-rose-500/30"
                  aria-label="Logout"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </aside>

        {/* Main content */}
        <div className="lg:pl-72 transition-all duration-500">
          {/* Top bar - minimal and floating */}
          <header className="sticky top-0 z-30 h-20 bg-brand-surface/70 dark:bg-brand-dark/70 backdrop-blur-md flex items-center px-6 lg:px-10 justify-between">
            <button
              className="lg:hidden p-3 rounded-2xl bg-white dark:bg-white/5 border border-white/20 shadow-sm"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="h-5 w-5 text-brand-dark dark:text-white" />
            </button>
            
            <div className="flex items-center gap-6">
              <div className="hidden lg:block">
                <p className="text-sm font-bold text-brand-muted">
                  Buen día, <span className="text-brand-dark dark:text-white">{user?.firstName}</span> 👋
                </p>
              </div>
              {isAdmin && <GlobalProjectSelector />}
            </div>
            
            <div className="flex items-center gap-4 relative">
               <button 
                 onClick={() => setUserMenuOpen(!userMenuOpen)}
                 className={`p-2 rounded-xl transition-all duration-300 relative group z-50 ${userMenuOpen ? 'bg-brand-accent text-white scale-110 shadow-lg shadow-brand-accent/20' : 'hover:bg-slate-100 dark:hover:bg-white/5'}`}
               >
                 {!userMenuOpen && <div className="absolute top-2 right-2 w-2 h-2 bg-brand-accent rounded-full border-2 border-brand-surface dark:border-brand-dark"></div>}
                 <UserCircle className={`h-6 w-6 ${userMenuOpen ? 'text-white' : 'text-brand-muted group-hover:text-brand-dark dark:group-hover:text-white'}`} />
               </button>

               {/* Profile Dropdown */}
               {userMenuOpen && (
                 <div className="absolute top-14 right-0 w-64 glass-card p-4 z-50 animate-in fade-in zoom-in-95 slide-in-from-top-4 duration-300 border-white/10 shadow-2xl">
                    <div className="flex items-center gap-3 p-2 mb-4 border-b border-white/10 pb-4">
                      <div className="w-10 h-10 rounded-xl bg-brand-accent/10 flex items-center justify-center text-brand-accent font-black">
                        {user?.firstName?.[0]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-black text-brand-dark dark:text-white truncate">{user?.firstName}</p>
                        <p className="text-[10px] font-bold text-brand-accent uppercase">{user?.role}</p>
                      </div>
                    </div>
                    
                    <div className="space-y-1">
                      <button 
                        onClick={() => { navigate('/settings'); setUserMenuOpen(false); }}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold text-brand-muted hover:bg-slate-100 dark:hover:bg-white/5 hover:text-brand-dark dark:hover:text-white transition-all"
                      >
                        <Settings className="h-4 w-4" /> Configuración
                      </button>
                      <button 
                        onClick={handleLogout}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold text-rose-500 hover:bg-rose-500/10 transition-all"
                      >
                        <LogOut className="h-4 w-4" /> Cerrar Sesión
                      </button>
                    </div>
                 </div>
               )}
            </div>
          </header>

          {/* Page content */}
          <main className="p-6 lg:p-10 max-w-7xl mx-auto">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  )
}
