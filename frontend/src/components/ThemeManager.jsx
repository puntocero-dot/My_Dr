import { useEffect } from 'react'
import { useProject } from '../context/ProjectContext'

export default function ThemeManager() {
  const { activeProject } = useProject()

  useEffect(() => {
    const root = document.documentElement
    
    if (activeProject && activeProject.settings) {
      const { primaryColor, fontFamily } = activeProject.settings
      
      // Inject Primary Color and variants
      if (primaryColor) {
        root.style.setProperty('--brand-accent', primaryColor)
        root.style.setProperty('--brand-primary', primaryColor)
        
        // Add variants (simple opacity/overlay for consistency)
        root.style.setProperty('--brand-accent-50', `${primaryColor}10`) // 10% opacity
        root.style.setProperty('--brand-accent-600', `${primaryColor}ee`) // 93% opacity
        root.style.setProperty('--brand-accent-700', `${primaryColor}cc`) // 80% opacity
        root.style.setProperty('--brand-accent-900', `${primaryColor}aa`) // 66% opacity
      }

      // Inject Font Family
      if (fontFamily) {
        root.style.setProperty('--font-family', `${fontFamily}`)
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
      const props = ['--brand-accent', '--brand-primary', '--brand-accent-50', '--brand-accent-600', '--brand-accent-700', '--brand-accent-900', '--font-family']
      props.forEach(p => root.style.removeProperty(p))
      document.body.style.fontFamily = ''
    }
  }, [activeProject])

  return null
}
