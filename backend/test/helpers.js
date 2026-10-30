// Tests alag database (galora_test) me chalte hain, aapke asli data ko nahi chhuate.
// Replica set chahiye: pehle `npm run db` chalu rakho.
process.env.NODE_ENV = 'test'
process.env.MONGO_URI = 'mongodb://127.0.0.1:27018/galora_test?replicaSet=rs0&directConnection=true'
process.env.JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'test-secret-test-secret-test-secret-123456'

const mongoose = require('mongoose')
const request = require('supertest')
const app = require('../src/app')
const models = require('../src/models')
const { outbox } = require('../src/utils/mailer')

const PASSWORD = 'correct-horse-battery'

async function connect() {
  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 5000 })
  await mongoose.connection.dropDatabase()
  await Promise.all(Object.values(models).map((m) => m.createIndexes()))
}

async function disconnect() {
  await mongoose.connection.dropDatabase()
  await mongoose.disconnect()
}

function lastMailTo(to) {
  const mail = [...outbox].reverse().find((m) => m.to === to)
  return mail
}

function tokenFromMail(to) {
  const mail = lastMailTo(to)
  const match = mail?.text.match(/token=([\w-]+)/)
  if (!match) throw new Error(`No token email found for ${to}`)
  return match[1]
}

// register -> email se token -> verify
async function createVerifiedUser(email, { name = 'Test User', password = PASSWORD } = {}) {
  const reg = await request(app).post('/api/v1/auth/register').send({ name, email, password })
  if (reg.status !== 201) throw new Error(`register failed: ${reg.status} ${JSON.stringify(reg.body)}`)
  // Naye owner ko Super Admin approve karta he; tests me seedha DB me approve karke link dobara mangwate hain.
  await models.User.updateOne({ normalizedEmail: email.toLowerCase() }, { approvalStatus: 'approved', approvedAt: new Date() })
  await request(app).post('/api/v1/auth/resend-verification').send({ email })
  const verify = await request(app).post('/api/v1/auth/verify-email').send({ token: tokenFromMail(email) })
  if (verify.status !== 200) throw new Error(`verify failed: ${JSON.stringify(verify.body)}`)
  return { email, password }
}

// agent = cookie yaad rakhta hai (refresh cookie)
async function loginAs(email, password = PASSWORD) {
  const agent = request.agent(app)
  const res = await agent.post('/api/v1/auth/login').send({ email, password })
  if (res.status !== 200) throw new Error(`login failed: ${res.status} ${JSON.stringify(res.body)}`)
  return { agent, token: res.body.data.accessToken, user: res.body.data.user }
}

async function createSalon(token, { name = 'Test Salon', slug = 'test-salon' } = {}) {
  const res = await request(app).post('/api/v1/salons').set('Authorization', `Bearer ${token}`).send({ name, slug })
  if (res.status !== 201) throw new Error(`createSalon failed: ${res.status} ${JSON.stringify(res.body)}`)
  return res.body.data.salon.id
}

// Ek poora owner + salon, ek line me.
async function ownerWithSalon(email, slug) {
  await createVerifiedUser(email)
  const session = await loginAs(email)
  const salonId = await createSalon(session.token, { name: `Salon ${slug}`, slug })
  return { ...session, salonId, email }
}

const bearer = (token, salonId) => {
  const h = { Authorization: `Bearer ${token}` }
  if (salonId) h['X-Salon-Id'] = String(salonId)
  return h
}

// Ek customer jo OTP se login ho chuka hai. agent cookie yaad rakhta hai.
// Test me OTP response ke devOtp se milta hai (SMS bheja nahi jaata).
async function customerAgent(phone = '9810000001', name = 'Test Customer') {
  const agent = request.agent(app)
  const asked = await agent.post('/api/v1/customer/auth/request-otp').send({ phone })
  if (asked.status !== 200) throw new Error(`request-otp failed: ${asked.status} ${JSON.stringify(asked.body)}`)
  const verified = await agent.post('/api/v1/customer/auth/verify-otp').send({ phone, otp: asked.body.data.devOtp, name })
  if (verified.status !== 200) throw new Error(`verify-otp failed: ${verified.status} ${JSON.stringify(verified.body)}`)
  return agent
}

module.exports = { lastMailTo, customerAgent, app, request, models, outbox, PASSWORD, connect, disconnect, tokenFromMail, createVerifiedUser, loginAs, createSalon, ownerWithSalon, bearer }
