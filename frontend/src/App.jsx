import { useState } from 'react'
import Dashboard from './components/Dashboard'

function App() {
  return (
    <div className="w-full h-full min-h-screen flex flex-col text-art-text">
      <header className="py-6 mb-8 relative z-10">
        <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-purple-400">
          Color & Transparency Inspection
        </h1>
        <p className="text-art-muted mt-2 tracking-wide">AI-Powered Quality Control System</p>
      </header>
      
      <main className="flex-grow w-full max-w-7xl mx-auto px-4 pb-10">
        <Dashboard />
      </main>
      
      <footer className="py-6 text-center text-art-muted text-sm border-t border-white/5 mt-auto">
        <p>© 2026 CTIS | Developed with Advanced Agentic Coding</p>
      </footer>
    </div>
  )
}

export default App
