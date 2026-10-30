'use client'

import NextLink from 'next/link'
import { useParams as useNextParams, usePathname, useRouter } from 'next/navigation'
import { useEffect, type ReactNode } from 'react'

type LinkProps = {
  to: string
  className?: string
  children?: ReactNode
  title?: string
  onClick?: () => void
}

export function Link({ to, className, children, title, onClick }: LinkProps) {
  return (
    <NextLink href={to} className={className} title={title} onClick={onClick}>
      {children}
    </NextLink>
  )
}

export function useNavigate() {
  const router = useRouter()
  return (to: string) => router.push(to)
}

export function useLocation() {
  const pathname = usePathname() || '/'
  return { pathname }
}

export function useParams<T extends Record<string, string | undefined>>() {
  return (useNextParams() ?? {}) as T
}

export function Navigate({ to }: { to: string; replace?: boolean }) {
  const router = useRouter()
  useEffect(() => {
    router.replace(to)
  }, [router, to])
  return null
}

export function NavLink({
  to,
  end,
  className,
  children,
  title,
}: {
  to: string
  end?: boolean
  className?: string | ((state: { isActive: boolean }) => string)
  children?: ReactNode
  title?: string
}) {
  const pathname = usePathname() || '/'
  const isActive = end ? pathname === to : pathname === to || pathname.startsWith(`${to}/`)
  const cls = typeof className === 'function' ? className({ isActive }) : className
  return (
    <NextLink href={to} className={cls} title={title}>
      {children}
    </NextLink>
  )
}
