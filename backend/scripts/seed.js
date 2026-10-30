// Development ke liye demo data: 2 alag salon, har ek ka owner + manager + receptionist.
// Chalane ka tareeka: `npm run db` (alag terminal me chalu rakho), phir `npm run seed`.
// Dobara chalane par jo pehle se hai use chhodta hai (duplicate nahi banata).
// Production me chalne se mana hai (SRS section 24.1: production me test contacts kabhi nahi).
//
// Sab demo users ka password: Galora-Demo-2026
const mongoose = require('mongoose')
const env = require('../src/config/env')
const { User, Salon, Branch, Membership, Service } = require('../src/models')
const { hashPassword } = require('../src/modules/auth/auth.service')
const { placeKey } = require('../src/utils/placeKey')

const DEMO_PASSWORD = 'Galora-Demo-2026'

const SALONS = [
  {
    name: 'Galora Demo Salon',
    slug: 'galora-demo',
    city: 'Jaipur',
    people: [
      ['Asha Verma', 'owner@galora-demo.test', 'owner'],
      ['Meera Joshi', 'manager@galora-demo.test', 'manager'],
      ['Riya Singh', 'reception@galora-demo.test', 'receptionist'],
    ],
  },
  {
    name: 'Shine Beauty Parlour',
    slug: 'shine-beauty',
    city: 'Udaipur',
    people: [
      ['Kavita Sharma', 'owner@shine-beauty.test', 'owner'],
      ['Pooja Mehta', 'manager@shine-beauty.test', 'manager'],
      ['Nisha Rao', 'reception@shine-beauty.test', 'receptionist'],
    ],
  },
]

// Zomato-jaisi discovery dikhane ke liye poore India ke demo salons (har ek ka sirf owner).
// Row: [naam, slug, city, state, area, lat, lng, audience, homeService, rating, reviews, startingPrice, tags, cover]
const photo = (id) => `https://images.unsplash.com/photo-${id}?fm=jpg&q=65&w=800&auto=format&fit=crop`
const COVER_A = photo('1562322140-8baeececf3df')
const COVER_B = photo('1633681926022-84c23e8cb2d6')
// Tag ka naam -> service category (price list me group ke liye)
const CATEGORY_OF = { Facial: 'Skin', Bridal: 'Bridal', 'Hair spa': 'Hair', Haircut: 'Hair', Beard: 'Grooming', Grooming: 'Grooming', Colour: 'Hair', Spa: 'Spa & Massage', Waxing: 'Waxing', Nails: 'Nails', Threading: 'Skin', Makeup: 'Makeup', Mehendi: 'Bridal', Styling: 'Hair', Keratin: 'Hair', Shave: 'Grooming', Massage: 'Spa & Massage' }
const OWNER_NAMES = ['Anjali Kapoor', 'Rohit Malhotra', 'Neha Arora', 'Simran Kaur', 'Imran Khan', 'Priya Nair', 'Vikram Rao', 'Deepa Iyer', 'Sunil Das', 'Farah Ali', 'Karan Shah', 'Meenal Joshi', 'Arjun Reddy', 'Tanvi Sethi', 'Ritu Bose', 'Manish Gupta', 'Lata Menon']
const INDIA = [
  ['Lakme Glow Studio', 'glow-studio-cp', 'Delhi', 'Delhi', 'Connaught Place', 28.6315, 77.2167, 'women', true, 4.6, 312, 399, ['Facial', 'Bridal', 'Hair spa'], COVER_A],
  ['The Gentlemen Cut', 'gentlemen-cut-lajpat', 'Delhi', 'Delhi', 'Lajpat Nagar', 28.5677, 77.2433, 'men', false, 4.4, 188, 199, ['Haircut', 'Beard', 'Grooming'], COVER_B],
  ['Velvet Unisex Salon', 'velvet-saket', 'Delhi', 'Delhi', 'Saket', 28.5245, 77.2066, 'unisex', true, 4.7, 540, 299, ['Haircut', 'Colour', 'Spa'], COVER_A],
  ['Rosewood Beauty Lounge', 'rosewood-rohini', 'Delhi', 'Delhi', 'Rohini', 28.7495, 77.0565, 'women', true, 4.3, 96, 249, ['Waxing', 'Facial', 'Nails'], ''],
  ['Dwarka Hair & Beauty', 'hair-beauty-dwarka', 'Delhi', 'Delhi', 'Dwarka', 28.5921, 77.046, 'unisex', false, 4.1, 74, 149, ['Haircut', 'Threading'], COVER_B],
  ['Karol Bagh Bridal House', 'bridal-house-karolbagh', 'Delhi', 'Delhi', 'Karol Bagh', 28.6519, 77.1909, 'women', true, 4.8, 421, 1999, ['Bridal', 'Makeup', 'Mehendi'], COVER_A],
  ['Hauz Khas Studio 21', 'studio21-hauzkhas', 'Delhi', 'Delhi', 'Hauz Khas', 28.5494, 77.2001, 'unisex', true, 4.5, 260, 499, ['Colour', 'Styling', 'Keratin'], ''],
  ["Pitampura Men's Parlour", 'mens-parlour-pitampura', 'Delhi', 'Delhi', 'Pitampura', 28.7007, 77.1312, 'men', true, 4.2, 120, 179, ['Haircut', 'Shave', 'Massage'], COVER_B],
  ['Glow & Go Bandra', 'glow-go-bandra', 'Mumbai', 'Maharashtra', 'Bandra West', 19.0596, 72.8295, 'women', true, 4.6, 380, 499, ['Facial', 'Hair spa', 'Nails'], COVER_A],
  ['Andheri Cuts', 'andheri-cuts', 'Mumbai', 'Maharashtra', 'Andheri West', 19.1364, 72.8296, 'men', true, 4.3, 150, 249, ['Haircut', 'Beard'], COVER_B],
  ['Indiranagar Salon Co.', 'salon-co-indiranagar', 'Bengaluru', 'Karnataka', 'Indiranagar', 12.9784, 77.6408, 'unisex', true, 4.7, 610, 399, ['Colour', 'Haircut', 'Spa'], COVER_A],
  ['Koramangala Beauty Bar', 'beauty-bar-koramangala', 'Bengaluru', 'Karnataka', 'Koramangala', 12.9352, 77.6245, 'women', false, 4.4, 210, 299, ['Waxing', 'Facial'], ''],
  ['Pink City Parlour', 'pink-city-parlour', 'Jaipur', 'Rajasthan', 'C-Scheme', 26.9124, 75.8001, 'women', true, 4.5, 175, 249, ['Bridal', 'Mehendi', 'Facial'], COVER_B],
  ['Banjara Hills Luxe', 'luxe-banjara-hills', 'Hyderabad', 'Telangana', 'Banjara Hills', 17.4126, 78.4482, 'unisex', true, 4.6, 330, 549, ['Colour', 'Keratin', 'Spa'], COVER_A],
  ['Koregaon Park Studio', 'studio-koregaon-park', 'Pune', 'Maharashtra', 'Koregaon Park', 18.5362, 73.8938, 'unisex', false, 4.4, 140, 349, ['Haircut', 'Styling'], ''],
  ['Park Street Salon', 'park-street-salon', 'Kolkata', 'West Bengal', 'Park Street', 22.5535, 88.3528, 'women', true, 4.2, 98, 199, ['Haircut', 'Facial'], COVER_B],
  ['Sunrise Unisex Salon', 'sunrise-bijainagar', 'Bijainagar', 'Rajasthan', 'Station Road', 25.9304, 74.6513, 'unisex', false, 4.4, 52, 120, ['Haircut', 'Facial', 'Threading'], ''],
  ['Sakhi Beauty Parlour', 'sakhi-parlour-bijainagar', 'Bijainagar', 'Rajasthan', 'Sadar Bazar', 25.927, 74.649, 'women', true, 4.5, 38, 150, ['Facial', 'Waxing', 'Bridal'], COVER_A],
  ['Marine Drive Grooming', 'marine-drive-grooming', 'Chennai', 'Tamil Nadu', 'T. Nagar', 13.0418, 80.2341, 'men', false, 4.1, 64, 179, ['Haircut', 'Shave'], '']
].map(([name, slug, city, state, area, lat, lng, audience, home, _demoAverage, _demoCount, startingPrice, tags, coverUrl], index) => ({
  name,
  slug,
  city,
  state,
  people: [[OWNER_NAMES[index % OWNER_NAMES.length], `owner@${slug}.test`, 'owner']],
  // Demo ke liye banawati phone number (asli nahi)
  phone: `+91 98100 ${String(10000 + index * 137).slice(-5)}`,
  serviceMenu: tags.map((tag, i) => ({
    name: tag,
    category: CATEGORY_OF[tag] ?? 'Other',
    price: Math.round((startingPrice * (1 + i * 0.8)) / 10) * 10,
    durationMin: 30 + i * 15,
    atHome: home && i % 2 === 0,
  })),
  profile: {
    'address.area': area,
    'address.cityKey': placeKey(city),
    'address.location': { lat, lng },
    audience,
    serviceModes: { salonVisit: true, homeService: home },
    // Nakli rating nahi: rating sirf asli customer reviews se banti he (modules/reviews), isliye demo salon 0 se shuru hote hain
    rating: { average: 0, count: 0 },
    startingPrice,
    tags,
    coverUrl,
    about: `${name} in ${area}, ${city}. Trusted by regulars for ${tags.slice(0, 2).join(' and ').toLowerCase()}.`,
    publicBookingEnabled: true,
  },
}))

async function main() {
  if (env.isProduction) {
    console.error('Refusing to seed demo data in production.')
    process.exit(1)
  }
  await mongoose.connect(env.MONGO_URI, { serverSelectionTimeoutMS: 8000 })
  const passwordHash = await hashPassword(DEMO_PASSWORD)

  for (const s of [...SALONS, ...INDIA]) {
    const users = []
    for (const [name, email] of s.people) {
      const user =
        (await User.findOne({ normalizedEmail: email })) ??
        (await User.create({ name, email, normalizedEmail: email, passwordHash, verifiedAt: new Date() }))
      users.push(user)
    }
    let salon = await Salon.findOne({ slug: s.slug })
    if (!salon) {
      salon = await Salon.create({
        name: s.name,
        slug: s.slug,
        address: { city: s.city, state: s.state ?? 'Rajasthan' },
        ownerContact: { name: s.people[0][0], email: s.people[0][1] },
        ownerIds: [users[0]._id],
        createdBy: users[0]._id,
      })
      await Branch.create({
        salonId: salon._id,
        weeklyHours: Object.fromEntries(['mon', 'tue', 'wed', 'thu', 'fri', 'sat'].map((d) => [d, [{ start: '10:00', end: '20:00' }]])),
      })
    }
    // Public profile har baar update hota hai, taaki seed dobara chalane par naye fields bhi lag jayein
    if (s.profile) {
      await Salon.updateOne(
        { _id: salon._id },
        { $set: { ...s.profile, 'ownerContact.name': s.people[0][0], 'ownerContact.phone': s.phone } },
      )
      for (const item of s.serviceMenu) {
        await Service.updateOne(
          { salonId: salon._id, nameKey: item.name.toLowerCase(), active: true },
          { $set: { category: item.category }, $setOnInsert: { name: item.name, price: item.price, durationMin: item.durationMin, atSalon: true, atHome: item.atHome, createdBy: users[0]._id } },
          { upsert: true },
        )
      }
    }
    for (let i = 0; i < users.length; i++) {
      await Membership.updateOne(
        { salonId: salon._id, userId: users[i]._id },
        { $setOnInsert: { role: s.people[i][2], active: true } },
        { upsert: true },
      )
    }
    console.log(`Seeded ${s.name}: ${s.people.map((p) => p[1]).join(', ')}`)
  }
  console.log(`\nAll demo users share the password: ${DEMO_PASSWORD}`)
  await mongoose.disconnect()
}

main().catch((error) => {
  console.error('Seed failed:', error.message)
  process.exit(1)
})
