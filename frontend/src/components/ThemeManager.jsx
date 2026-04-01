import { useEffect } from 'react'
import { useProject } from '../context/ProjectContext'

export default function ThemeManager() {
  const { activeProject } = useProject()

  useEffect(() => {
    const root = document.documentElement
    
    if (activeProject && activeProject.settings) {
      const { primaryColor, fontFamily } = activeProject.settings
      
      // Inject Primary Color
      if (primaryColor) {
        root.style.setProperty('--brand-accent', primaryColor)
        root.style.setProperty('--brand-primary', primaryColor)
      }

      // Inject Font Family
      if (fontFamily) {
        root.style.setProperty('--font-family', `"${fontFamily}"`)
        document.body.style.fontFamily = `"${fontFamily}", sans-serif`
        
        // Link to Google font if not already there
        const fontId = 'dynamic-google-font'
        let link = document.getElementById(fontId)
        if (!link) {
          link = document.createElement('link')
          link.id = fontId
          link.rel = 'stylesheet'
          document.head.appendChild(link)
        }
        link.href = `https://fonts.googleapis.com/css2?family=${fontFamily.replace(/\s+/g, '+')}:wght@300;400;500;600;700;800;900&display=swap`
      }
    } else {
      // Reset to defaults
      root.style.removeProperty('--brand-accent')
      root.style.removeProperty('--brand-primary')
      root.style.removeProperty('--font-family')
      document.body.style.fontFamily = ''
    }
  }, [activeProject])

  return null
}
