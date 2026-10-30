import type { ReactNode } from 'react'

export default function LoginLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <link
        rel="preload"
        as="image"
        href="/landing/field-1280.webp"
        imageSrcSet="/landing/field-640.webp 640w, /landing/field-960.webp 960w, /landing/field-1280.webp 1280w, /landing/field-1920.webp 1920w"
        imageSizes="100vw"
        fetchPriority="high"
      />
      {children}
    </>
  )
}
