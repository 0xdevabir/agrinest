const CROPS = new Set([
  'rice', 'wheat', 'maize', 'potato', 'tomato', 'brinjal', 'onion', 'mustard', 'lentil', 'jute',
  'banana', 'beans', 'cabbage', 'cauliflower', 'chili', 'cucumber', 'mango', 'okra', 'potol', 'pumpkin', 'spinach',
])

export function cropSrc(id?: string | null) {
  return id && CROPS.has(id) ? `/crops/${id}.jpg` : '/crops/fallow.jpg'
}

export type Frame = 'tile' | 'chip' | 'inline' | 'hero' | 'badge' | 'empty' | 'card' | 'demo'

export function Picture({ src, frame = 'tile', alt = '', dim = false }: { src: string; frame?: Frame; alt?: string; dim?: boolean }) {
  return <img className={`pic pic-${frame}${dim ? ' dim' : ''}`} src={src} alt={alt} />
}

export function CropPicture({ crop, frame = 'tile', alt = '' }: { crop?: string | null; frame?: Frame; alt?: string }) {
  return <Picture src={cropSrc(crop)} frame={frame} alt={alt} />
}

export type MarkName =
  | 'farmer' | 'agent' | 'officer' | 'buyer' | 'admin'
  | 'basket' | 'inbox' | 'handshake' | 'seedling' | 'camera'
  | 'pin' | 'done' | 'alert' | 'clipboard' | 'search'
  | 'lock' | 'people' | 'storm' | 'water' | 'fertilizer'
  | 'leaf' | 'harvest' | 'coins'

export function Mark({ name, frame = 'tile', alt = '', dim = false }: { name: MarkName; frame?: Frame; alt?: string; dim?: boolean }) {
  return <Picture src={`/marks/${name}.jpg`} frame={frame} alt={alt} dim={dim} />
}
