import React from 'react'
import { Outlet, NavLink } from 'react-router-dom'
import { Home, Leaf, PawPrint, ListTodo, Calendar, Sprout } from 'lucide-react'

function Layout() {
  const navItems = [
    { to: '/', icon: Home, label: 'Home' },
    { to: '/plants', icon: Leaf, label: 'Plants' },
    { to: '/animals', icon: PawPrint, label: 'Animals' },
    { to: '/tasks', icon: ListTodo, label: 'Tasks' },
    { to: '/seeds', icon: Sprout, label: 'Seeds' },
    { to: '/calendar', icon: Calendar, label: 'Calendar' },
  ]

  return (
    <div className="min-h-screen bg-gray-900 text-white flex">
      {/* Sidebar - Always visible */}
      <aside className="w-20 bg-gray-800 flex flex-col items-center py-4 flex-shrink-0">
        <div className="mb-8">
          <span className="text-2xl">🌾</span>
        </div>
        <nav className="flex flex-col gap-2 flex-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex flex-col items-center justify-center w-16 h-16 rounded-xl transition-colors ${
                  isActive
                    ? 'text-farm-green bg-gray-700'
                    : 'text-gray-400 hover:text-white hover:bg-gray-700'
                }`
              }
            >
              <item.icon className="w-6 h-6 mb-1" />
              <span className="text-xs">{item.label}</span>
            </NavLink>
          ))}
        </nav>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto p-4 lg:p-6">
        <Outlet />
      </main>
    </div>
  )
}

export default Layout
