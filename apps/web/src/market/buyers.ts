import type { Produce } from './catalog'

export type Copy = { bn: string; en: string }

export type BuyerOffer = {
  id: string
  name: Copy
  price: number
  qtyKg: number
  deliver: Copy
  when: Copy
  pay: Copy
}

const RICE: BuyerOffer[] = [
  {
    id: 'jamal',
    name: { bn: 'জামাল বেপারি', en: 'Jamal Bepari' },
    price: 66,
    qtyKg: 2000,
    deliver: { bn: 'মিঠাপুকুর, তার গুদাম। ট্রাক ক্ষেতে আসবে।', en: 'Mithapukur, his store. The truck comes to the field.' },
    when: { bn: 'শনিবারের মধ্যে পুরো লট', en: 'The full lot by Saturday' },
    pay: { bn: 'খালাসের সময় নগদ', en: 'Cash when it is handed over' },
  },
  {
    id: 'karim',
    name: { bn: 'করিম ট্রেডার্স', en: 'Karim Traders' },
    price: 62,
    qtyKg: 400,
    deliver: { bn: 'বদরগঞ্জ বাজার, তার গুদাম', en: 'Badarganj market, his warehouse' },
    when: { bn: 'আগামীকাল সকাল', en: 'Tomorrow morning' },
    pay: { bn: 'পৌঁছানোর পর নগদ', en: 'Cash after delivery' },
  },
  {
    id: 'shafiq',
    name: { bn: 'শফিক', en: 'Shafiq' },
    price: 59,
    qtyKg: 250,
    deliver: { bn: 'রংপুর সদর, হাইওয়ের মোড়', en: 'Rangpur sadar, the highway crossing' },
    when: { bn: 'আজ সন্ধ্যা', en: 'This evening' },
    pay: { bn: 'ওজনের পর টাকা', en: 'Payment after weighing' },
  },
  {
    id: 'fatema',
    name: { bn: 'ফাতেমা স্টোর', en: 'Fatema Store' },
    price: 54,
    qtyKg: 150,
    deliver: { bn: 'রংপুর শহর, তার দোকান', en: 'Rangpur town, her shop' },
    when: { bn: 'আগামীকাল দুপুর', en: 'Tomorrow at noon' },
    pay: { bn: 'অর্ধেক আগাম, বাকি পৌঁছে', en: 'Half in advance, the rest on delivery' },
  },
]

const PEOPLE: { id: string; name: Copy; deliver: Copy; when: Copy; pay: Copy }[] = [
  {
    id: 'anwar',
    name: { bn: 'আনোয়ার এজেন্সি', en: 'Anwar Agency' },
    deliver: { bn: 'বগুড়া সদর, তার আড়ত', en: 'Bogura sadar, his store' },
    when: { bn: 'দুই দিনের মধ্যে', en: 'Within two days' },
    pay: { bn: 'পৌঁছানোর পর নগদ', en: 'Cash after delivery' },
  },
  {
    id: 'nargis',
    name: { bn: 'নার্গিস ট্রেডার্স', en: 'Nargis Traders' },
    deliver: { bn: 'ঢাকা, কারওয়ান বাজার', en: 'Dhaka, Karwan Bazar' },
    when: { bn: 'আগামীকাল রাতের ট্রাকে', en: 'On tomorrow night’s truck' },
    pay: { bn: 'ব্যাংকে, খালাসের দিন', en: 'Bank transfer on the handover day' },
  },
  {
    id: 'babul',
    name: { bn: 'বাবুল', en: 'Babul' },
    deliver: { bn: 'ক্ষেত থেকে নিজে নেবে', en: 'He will collect it from the field' },
    when: { bn: 'আজ বিকেল', en: 'This afternoon' },
    pay: { bn: 'নেওয়ার সময় নগদ', en: 'Cash when he collects it' },
  },
  {
    id: 'rokeya',
    name: { bn: 'রোকেয়া বেপারি', en: 'Rokeya Bepari' },
    deliver: { bn: 'ময়মনসিংহ, নতুন বাজার', en: 'Mymensingh, Notun Bazar' },
    when: { bn: 'আগামীকাল সকাল', en: 'Tomorrow morning' },
    pay: { bn: 'অর্ধেক আগাম, বাকি পৌঁছে', en: 'Half in advance, the rest on delivery' },
  },
  {
    id: 'halim',
    name: { bn: 'হালিম এন্ড সন্স', en: 'Halim and Sons' },
    deliver: { bn: 'পাবনা, ঈশ্বরদী স্টেশন', en: 'Pabna, Ishwardi station' },
    when: { bn: 'তিন দিনের মধ্যে', en: 'Within three days' },
    pay: { bn: 'ওজনের পর টাকা', en: 'Payment after weighing' },
  },
  {
    id: 'mitu',
    name: { bn: 'মিতু ফুডস', en: 'Mitu Foods' },
    deliver: { bn: 'রাজশাহী, সাহেব বাজার', en: 'Rajshahi, Saheb Bazar' },
    when: { bn: 'আজ সন্ধ্যা', en: 'This evening' },
    pay: { bn: 'পৌঁছানোর পর নগদ', en: 'Cash after delivery' },
  },
]

const QTY = [80, 180, 320, 500, 140, 260]
const DELTA = [6, -3, 4, -6, 9, 2]

export function buyersFor(produce: Produce): BuyerOffer[] {
  if (produce.id === 'rice') return RICE
  const start = [...produce.id].reduce((n, ch) => n + ch.charCodeAt(0), 0)
  return [0, 1, 2].map((step) => {
    const person = PEOPLE[(start + step) % PEOPLE.length]
    const delta = DELTA[(start + step) % DELTA.length]
    return {
      id: `${produce.id}-${person.id}`,
      name: person.name,
      price: Math.max(8, produce.price + delta),
      qtyKg: QTY[(start + step * 2) % QTY.length],
      deliver: person.deliver,
      when: person.when,
      pay: person.pay,
    }
  })
}

const CHOICE = 'agri_buyer_choice'

export function readChoice(produceId: string): string | null {
  try {
    const all = JSON.parse(localStorage.getItem(CHOICE) || '{}') as Record<string, string>
    return all[produceId] || null
  } catch {
    return null
  }
}

export function writeChoice(produceId: string, buyerId: string) {
  const all = JSON.parse(localStorage.getItem(CHOICE) || '{}') as Record<string, string>
  all[produceId] = buyerId
  localStorage.setItem(CHOICE, JSON.stringify(all))
}
