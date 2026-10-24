// Price band URL me ?price=under-300 jaise rehta hai; server ko minPrice/maxPrice chahiye ("from" price par lagta hai).
export const PRICE_BANDS = [
  { value: '', label: 'Any price' },
  { value: 'under-300', label: 'Under ₹300', max: 300 },
  { value: '300-700', label: '₹300 – ₹700', min: 300, max: 700 },
  { value: '700-up', label: '₹700 & above', min: 700 },
]

export const RATINGS = [
  { value: '', label: 'Any rating' },
  { value: '4.5', label: '4.5 ★ & above' },
  { value: '4', label: '4.0 ★ & above' },
  { value: '3.5', label: '3.5 ★ & above' },
]

// URL ke price band ko API ke minPrice/maxPrice me badalta hai
export function priceRange(band) {
  const found = PRICE_BANDS.find((b) => b.value === band)
  return { minPrice: found?.min ?? '', maxPrice: found?.max ?? '' }
}
