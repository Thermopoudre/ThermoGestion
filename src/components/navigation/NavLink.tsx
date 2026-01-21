'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

interface NavLinkProps {
  href: string
  children: React.ReactNode
  className?: string
  activeClassName?: string
  exact?: boolean
}

export function NavLink({ 
  href, 
  children, 
  className = '',
  activeClassName = 'text-orange-600 dark:text-orange-400 font-bold',
  exact = false 
}: NavLinkProps) {
  const pathname = usePathname()
  
  // Vérifier si le lien est actif
  const isActive = exact 
    ? pathname === href 
    : pathname.startsWith(href) && (href !== '/app' || pathname === '/app')

  const baseClass = "text-sm font-medium transition-colors"
  const inactiveClass = "text-gray-700 dark:text-gray-300 hover:text-orange-600 dark:hover:text-orange-400"
  
  return (
    <Link 
      href={href}
      className={`${baseClass} ${isActive ? activeClassName : inactiveClass} ${className}`}
    >
      {children}
    </Link>
  )
}
