export function FieldBackdrop() {
  return (
    <div className="field-bg" aria-hidden="true">
      <img
        alt=""
        width={1920}
        height={1080}
        src="/landing/field-1280.webp"
        srcSet="/landing/field-640.webp 640w, /landing/field-960.webp 960w, /landing/field-1280.webp 1280w, /landing/field-1920.webp 1920w"
        sizes="100vw"
        fetchPriority="high"
        decoding="async"
      />
    </div>
  )
}
