/** Boundary maths for the land drawer. Points are [lng, lat], rings are unclosed. */

export type Pt = number[]

const EARTH_RADIUS_M = 6371008.8
const ACRE_M2 = 4046.8564224
const rad = (d: number) => (d * Math.PI) / 180

// Keep these in step with Geo.php and FieldController::boundary, which have the final say.
export const MIN_ACRES = 0.005
export const MAX_ACRES = 2000
export const MAX_POINTS = 200
const inBangladesh = (p: Pt) => p[0] >= 87.9 && p[0] <= 92.8 && p[1] >= 20.5 && p[1] <= 26.8

export function acres(ring: Pt[]) {
  if (ring.length < 3) return 0
  let sum = 0
  ring.forEach((p, i) => {
    const q = ring[(i + 1) % ring.length]
    sum += rad(q[0] - p[0]) * (2 + Math.sin(rad(p[1])) + Math.sin(rad(q[1])))
  })
  return (Math.abs(sum) * EARTH_RADIUS_M ** 2) / 2 / ACRE_M2
}

export function metres(a: Pt, b: Pt) {
  const dLat = rad(b[1] - a[1])
  const dLng = rad(b[0] - a[0])
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[1])) * Math.cos(rad(b[1])) * Math.sin(dLng / 2) ** 2
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h))
}

export function perimeter(pts: Pt[], closed: boolean) {
  let sum = 0
  for (let i = 0; i < pts.length - 1; i++) sum += metres(pts[i], pts[i + 1])
  if (closed && pts.length > 2) sum += metres(pts[pts.length - 1], pts[0])
  return sum
}

/** A flat view in metres: land is small enough that the curve of the earth does not matter here. */
function flatten(rings: Pt[][]) {
  const o = rings[0][0]
  const k = Math.cos(rad(o[1]))
  return rings.map((r) => r.map((p) => [rad(p[0] - o[0]) * EARTH_RADIUS_M * k, rad(p[1] - o[1]) * EARTH_RADIUS_M]))
}

/** Signed distance of p from the line through a and b. */
function side(a: Pt, b: Pt, p: Pt) {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1
  return ((b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0])) / len
}

/** True when the segments cross by more than tol metres, so edges that merely touch do not count. */
function crosses(a: Pt, b: Pt, c: Pt, d: Pt, tol: number) {
  const [d1, d2, d3, d4] = [side(c, d, a), side(c, d, b), side(a, b, c), side(a, b, d)]
  return Math.min(Math.abs(d1), Math.abs(d2), Math.abs(d3), Math.abs(d4)) > tol && d1 * d2 < 0 && d3 * d4 < 0
}

/** Indexes of every edge that crosses another edge of the same closed ring. */
export function crossingEdges(pts: Pt[]) {
  const n = pts.length
  const bad = new Set<number>()
  if (n < 4) return bad
  const [f] = flatten([pts])
  for (let i = 0; i < n; i++) {
    for (let j = i + 2; j < n; j++) {
      if (i === 0 && j === n - 1) continue
      if (crosses(f[i], f[(i + 1) % n], f[j], f[(j + 1) % n], 0)) { bad.add(i); bad.add(j) }
    }
  }
  return bad
}

function strictlyInside(p: Pt, ring: Pt[], tol: number) {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [a, b] = [ring[i], ring[j]]
    const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * (b[0] - a[0]) + (p[1] - a[1]) * (b[1] - a[1])) / (((b[0] - a[0]) ** 2 + (b[1] - a[1]) ** 2) || 1)))
    if (Math.hypot(p[0] - a[0] - t * (b[0] - a[0]), p[1] - a[1] - t * (b[1] - a[1])) <= tol) return false
    if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1]) + a[0]) inside = !inside
  }
  return inside
}

/** Neighbours may share a boundary, so anything within a metre of an edge is not an overlap. */
export function overlaps(a: Pt[], b: Pt[]) {
  if (a.length < 3 || b.length < 3) return false
  const TOL = 1
  const [fa, fb] = flatten([a, b])
  const samples = (r: Pt[]) => r.flatMap((p, i) => {
    const q = r[(i + 1) % r.length]
    return [p, [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2]]
  })
  if (samples(fa).some((p) => strictlyInside(p, fb, TOL))) return true
  if (samples(fb).some((p) => strictlyInside(p, fa, TOL))) return true
  return fa.some((p, i) => fb.some((q, j) => crosses(p, fa[(i + 1) % fa.length], q, fb[(j + 1) % fb.length], TOL)))
}

/** Thins a walked GPS track, keeping the corners (Douglas-Peucker). */
export function simplify(pts: Pt[], tolMetres: number): Pt[] {
  if (pts.length < 3) return pts
  const [f] = flatten([pts])
  const keep = new Set([0, pts.length - 1])
  const walk = (lo: number, hi: number) => {
    let far = -1
    let max = tolMetres
    for (let i = lo + 1; i < hi; i++) {
      const d = Math.abs(side(f[lo], f[hi], f[i]))
      if (d > max) { max = d; far = i }
    }
    if (far < 0) return
    keep.add(far)
    walk(lo, far)
    walk(far, hi)
  }
  walk(0, pts.length - 1)
  return pts.filter((_, i) => keep.has(i))
}

export type LandIssue = 'crossing' | 'small' | 'large' | 'outside' | 'many' | null

export function landIssue(pts: Pt[]): LandIssue {
  if (pts.length < 3) return null
  if (pts.length > MAX_POINTS) return 'many'
  if (!pts.every(inBangladesh)) return 'outside'
  if (crossingEdges(pts).size) return 'crossing'
  const area = acres(pts)
  if (area < MIN_ACRES) return 'small'
  if (area > MAX_ACRES) return 'large'
  return null
}
