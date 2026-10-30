// Landing page ka saara text aur photos ek hi jagah. Kuch badalna ho to yahin badlo, components ko chhuna nahi padega.
// Photos: Unsplash (free license), internet se aati hain.
const photo = (id, width = 900) => `https://images.unsplash.com/photo-${id}?fm=jpg&q=65&w=${width}&auto=format&fit=crop`

// Navbar ke links. href="#features" ka matlab: isi page ka "features" wala hissa.
export const navLinks = [
  { label: 'Home', href: '#home' },
  { label: 'Features', href: '#features' },
  { label: 'Services', href: '#services' },
  { label: 'About', href: '#about' },
  { label: 'Contact', href: '#contact' },
]

export const images = {
  hero: photo('1633681926022-84c23e8cb2d6', 1800),
  about: '/images/about-salon.jpg',
}

// Hero ke slider ki 5 photos (sirf sajawat, isliye alt khali)
export const heroSlides = [
  { src: images.hero, alt: '' },
  { src: photo('1522337360788-8b13dee7a37e', 1800), alt: '' },
  { src: '/images/bridal-makeup.jpg', alt: '' },
  { src: photo('1570172619644-dfd03ed5d881', 1800), alt: '' },
  { src: photo('1516975080664-ed2fc6a32937', 1800), alt: '' },
]

// 6 features. icon ka naam components/Icon.jsx se aata hai.
export const features = [
  {
    id: 'appointments',
    icon: 'calendar',
    title: 'Appointment management',
    text: 'Book walk-ins and phone bookings in seconds. A clear day and week view helps you spot clashes before they happen.',
    points: ['Day and week calendar', 'No double booking', 'Easy rescheduling'],
  },
  {
    id: 'customers',
    icon: 'users',
    title: 'Customer records',
    text: 'Keep every client in one place: their visits, favourite stylist, skin or hair notes and message preferences.',
    points: ['Full visit history', 'Preferences and notes', 'Permission for messages'],
  },
  {
    id: 'staff',
    icon: 'clock',
    title: 'Staff scheduling',
    text: 'Set shifts, breaks and leave once. Galora only offers slots when the right person is actually free.',
    points: ['Shifts, breaks and leave', 'Skills for each service', 'Staff see their own day'],
  },
  {
    id: 'billing',
    icon: 'card',
    title: 'Billing and payments',
    text: 'Create clear invoices at checkout and record cash, UPI or card payments. See what is still due at a glance.',
    points: ['Simple invoices in ₹', 'Cash, UPI and card records', 'Track pending balances'],
  },
  {
    id: 'memberships',
    icon: 'package',
    title: 'Packages and memberships',
    text: 'Sell prepaid packages and membership plans that bring clients back, with expiry dates always in view.',
    points: ['Prepaid service packages', 'Membership discounts', 'Remaining sessions shown'],
  },
  {
    id: 'reports',
    icon: 'trending',
    title: 'Business reports',
    text: 'Know how your salon is doing without a spreadsheet: daily totals, best services and returning customers.',
    points: ['Daily collections', 'Revenue by service', 'Repeat customers'],
  },
]

// "Services" section: kis tarah ke salon ke liye
export const salonTypes = [
  { id: 'hair', title: 'Hair salons', text: 'Cuts, colour, spa and styling, with the right stylist for each client.', image: photo('1522337360788-8b13dee7a37e', 800) },
  { id: 'makeup', title: 'Makeup and bridal', text: 'Trials, party looks and bridal days, planned without the phone tag.', image: '/images/bridal-makeup.jpg' },
  { id: 'skin', title: 'Facials and skin care', text: 'Treatment times, packages and repeat visits kept neatly in order.', image: photo('1570172619644-dfd03ed5d881', 800) },
  { id: 'parlour', title: 'Beauty parlours', text: 'Threading, waxing, nails and more, all in one friendly schedule.', image: photo('1516975080664-ed2fc6a32937', 800) },
]

// Benefits. Jaan-boojhkar koi jhootha percentage/number nahi likha.
export const benefits = [
  { icon: 'clock', title: 'Less time on paperwork', text: 'Bookings, bills and customer notes live in one place instead of a register and three phones.' },
  { icon: 'shield', title: 'Fewer scheduling mistakes', text: 'Clashes and overlapping bookings are caught for you, so clients are not kept waiting.' },
  { icon: 'trending', title: 'Numbers you can trust', text: 'See daily collections and your best services without adding anything up by hand.' },
  { icon: 'users', title: 'Clients who return', text: 'Packages, memberships and customer history make it easy to look after regulars.' },
  { icon: 'rupee', title: 'Made for India', text: 'Prices in rupees and payments recorded the way your clients actually pay: cash, UPI or card.' },
  { icon: 'sparkle', title: 'Works on your phone', text: 'Open Galora in a browser on any phone. There is no app to install.' },
]

export const aboutFacts = [
  'Made for independent salons and beauty parlours',
  'Simple enough to learn in a day',
  'Your salon’s records stay separate and private',
]
