const KEY = 'agri_basket'

export type BasketLine = { id: string; kg: number }

export function readBasket(): BasketLine[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || '[]') as BasketLine[]
    if (!Array.isArray(raw)) return []
    return raw.filter((line) => line && typeof line.id === 'string' && line.kg > 0)
  } catch {
    return []
  }
}

export function writeBasket(lines: BasketLine[]) {
  localStorage.setItem(KEY, JSON.stringify(lines))
}

export function addToBasket(id: string, kg: number): BasketLine[] {
  const lines = readBasket()
  const hit = lines.find((line) => line.id === id)
  const next = Math.round(kg * 10) / 10
  if (hit) hit.kg = Math.round((hit.kg + next) * 10) / 10
  else lines.push({ id, kg: next })
  writeBasket(lines)
  return lines
}

export function setLineKg(id: string, kg: number): BasketLine[] {
  const lines = readBasket()
    .map((line) => (line.id === id ? { ...line, kg: Math.round(kg * 10) / 10 } : line))
    .filter((line) => line.kg > 0)
  writeBasket(lines)
  return lines
}

export function clearBasket(): BasketLine[] {
  writeBasket([])
  return []
}
