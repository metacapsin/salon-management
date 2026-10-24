const mongoose = require('mongoose')
const env = require('./config/env')
const app = require('./app')
const { User, Salon, Branch, Membership, Session, VerificationToken, AuditEvent } = require('./models')

async function main() {
  await mongoose.connect(env.MONGO_URI, { serverSelectionTimeoutMS: 8000 })
  console.log('MongoDB connected')
  // Unique indexes (slug, email, membership...) production me bhi hamesha rahein: pehle bana lo, phir traffic lo.
  await Promise.all([User, Salon, Branch, Membership, Session, VerificationToken, AuditEvent].map((m) => m.init()))

  // Purane salons ki city-kunji bhar do (naam se jagah milane ke liye); save() se pre-validate hook kunji banata hai
  const stale = await Salon.find({ 'address.city': { $nin: ['', null] }, 'address.cityKey': { $in: ['', null] } })
  for (const salon of stale) await salon.save()
  if (stale.length > 0) console.log(`Filled city keys for ${stale.length} salon(s)`)

  app.listen(env.PORT, () => console.log(`Glamora API running on http://localhost:${env.PORT}`))
}

main().catch((error) => {
  console.error('Could not start the server:', error.message)
  process.exit(1)
})
