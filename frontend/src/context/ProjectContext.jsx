import { createContext, useContext, useState, useEffect } from 'react'
import api from '../services/api'
import { useAuth } from './AuthContext'

const ProjectContext = createContext()

export function ProjectProvider({ children }) {
  const { user, isAdmin } = useAuth()
  const [activeProject, setActiveProject] = useState(null)
  const [projects, setProjects] = useState([])
  const [loadingProjects, setLoadingProjects] = useState(true)

  // Persist project selection
  useEffect(() => {
    const savedProjectId = localStorage.getItem('selectedProjectId')
    if (savedProjectId && isAdmin) {
      // We'll fetch the project after loading the list
    }
  }, [isAdmin])

  useEffect(() => {
    if (user && !isAdmin && user.clinicId) {
      // If doctor/secretary has a clinic assigned, load it automatically
      fetchSingleProject(user.clinicId)
    } else if (isAdmin) {
      fetchProjects()
    } else {
      setLoadingProjects(false)
    }
  }, [user, isAdmin])

  const fetchSingleProject = async (projectId) => {
    try {
      setLoadingProjects(true)
      const response = await api.get(`/clinics/${projectId}`)
      setActiveProject(response.data)
    } catch (error) {
      console.error('Error fetching assigned clinic:', error)
    } finally {
      setLoadingProjects(false)
    }
  }

  const fetchProjects = async () => {
    try {
      const response = await api.get('/clinics')
      setProjects(response.data)
      
      const savedProjectId = localStorage.getItem('selectedProjectId')
      if (savedProjectId) {
        const project = response.data.find(p => p.id === savedProjectId)
        if (project) {
          setActiveProject(project)
        }
      }
    } catch (error) {
      console.error('Error fetching projects:', error)
    } finally {
      setLoadingProjects(false)
    }
  }

  const selectProject = (project) => {
    setActiveProject(project)
    if (project) {
      localStorage.setItem('selectedProjectId', project.id)
    } else {
      localStorage.removeItem('selectedProjectId')
    }
  }

  const value = {
    activeProject,
    projects,
    selectProject,
    loadingProjects,
    refreshProjects: fetchProjects
  }

  return (
    <ProjectContext.Provider value={value}>
      {children}
    </ProjectContext.Provider>
  )
}

export const useProject = () => useContext(ProjectContext)
