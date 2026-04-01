import { Briefcase, ChevronDown, Check, Globe } from 'lucide-react'
import { useProject } from '../context/ProjectContext'
import { useState, useRef, useEffect } from 'react'

export default function GlobalProjectSelector() {
  const { activeProject, projects, selectProject, loadingProjects } = useProject()
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef(null)

  // Handle click outside to close dropdown
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  if (loadingProjects) return <div className="h-10 w-32 animate-pulse bg-slate-100 dark:bg-white/5 rounded-xl"></div>

  return (
    <div className="relative" ref={dropdownRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/50 dark:bg-white/5 border border-white/20 hover:bg-white transition-all shadow-sm"
      >
        <div className="p-1.5 bg-brand-accent/10 rounded-lg">
          <Briefcase className="h-4 w-4 text-brand-accent" />
        </div>
        <div className="text-left hidden sm:block">
          <p className="text-[10px] font-black text-brand-muted uppercase leading-none mb-1 tracking-tighter">Proyecto Activo</p>
          <p className="text-sm font-bold text-brand-dark dark:text-white truncate max-w-[150px]">
            {activeProject ? activeProject.name : 'Todos los Proyectos'}
          </p>
        </div>
        <ChevronDown className={`h-4 w-4 text-brand-muted transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute top-full mt-2 left-0 sm:right-0 sm:left-auto w-64 bg-white dark:bg-brand-dark rounded-2xl shadow-2xl border border-white/10 p-2 z-[999] animate-in zoom-in-95 duration-200">
          <button
            onClick={() => { selectProject(null); setIsOpen(false); }}
            className={`w-full flex items-center justify-between p-3 rounded-xl transition-colors ${!activeProject ? 'bg-brand-accent/10 text-brand-accent' : 'hover:bg-slate-50 dark:hover:bg-white/5'}`}
          >
            <div className="flex items-center gap-3">
              <Globe className="h-4 w-4" />
              <span className="font-bold text-sm">Resumen Global</span>
            </div>
            {!activeProject && <Check className="h-4 w-4" />}
          </button>
          
          <div className="my-2 h-px bg-white/10" />
          
          <div className="max-h-64 overflow-y-auto space-y-1">
            {projects.map(project => (
              <button
                key={project.id}
                onClick={() => { selectProject(project); setIsOpen(false); }}
                className={`w-full flex items-center justify-between p-3 rounded-xl transition-colors ${activeProject?.id === project.id ? 'bg-brand-accent/10 text-brand-accent' : 'hover:bg-slate-50 dark:hover:bg-white/5'}`}
              >
                <div className="flex items-center gap-3 overflow-hidden">
                  {project.logoUrl ? (
                    <img src={project.logoUrl} alt={project.name} className="h-5 w-5 rounded-md object-contain" />
                  ) : (
                    <div className="h-5 w-5 bg-slate-200 dark:bg-white/10 rounded-md flex-shrink-0" />
                  )}
                  <span className="font-bold text-sm truncate">{project.name}</span>
                </div>
                {activeProject?.id === project.id && <Check className="h-4 w-4" />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
