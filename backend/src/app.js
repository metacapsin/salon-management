const express = require('express')
const helmet = require('helmet')
const cors = require('cors')
const cookieParser = require('cookie-parser')
const mongoose = require('mongoose')
const env = require('./config/env')
const { requestContext, notFound, errorHandler } = require('./middleware/common')
const { authRouter, meRouter } = require('./modules/auth/auth.routes')
const mobileAuthRoutes = require('./modules/auth/mobileAuth.routes')
const salonRoutes =require('./modules/salons/salons.routes')
const userRoutes = require('./modules/users/users.routes')
const auditRoutes = require('./modules/audit/audit.routes')
const publicRoutes = require('./modules/public/public.routes')
const serviceRoutes = require('./modules/services/services.routes')
const staffRoutes = require('./modules/staff/staff.routes')
const offerRoutes = require('./modules/offers/offers.routes')
const packageRoutes = require('./modules/packages/packages.routes')
const customerPackageRoutes = require('./modules/packages/customerPackages.routes')
const membershipPlanRoutes = require('./modules/memberships/membershipPlans.routes')
const customerMembershipRoutes = require('./modules/memberships/customerMemberships.routes')
const customerRoutes = require('./modules/customers/customer.routes')
const salonCustomerRoutes = require('./modules/customers/salonCustomers.routes')
const bookingRoutes = require('./modules/bookings/bookings.routes')
const invoiceRoutes = require('./modules/billing/invoices.routes')
const notificationRoutes = require('./modules/notifications/notifications.routes')
const platformRoutes = require('./modules/platform/platform.routes')
const { publicRouter: contactRoutes } = require('./modules/contact/contact.routes')

const app = express()

app.disable('x-powered-by')
app.use(requestContext)
app.use(helmet())
// Cookies use hoti hain, isliye sirf hamara frontend allowed hai (wildcard nahi) (SEC-01).
app.use(
  cors({
    origin: env.CLIENT_ORIGIN,
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Salon-Id', 'Idempotency-Key'],
  }),
)
app.use(express.json({ limit: '100kb' }))
app.use(cookieParser())

// Liveness: process chal raha hai. Readiness: database bhi mil raha hai (OPS / section 24.3).
app.get('/health', (req, res) => res.json({ status: 'ok' }))
app.get('/ready', (req, res) => {
  const ready = mongoose.connection.readyState === 1
  res.status(ready ? 200 : 503).json({ status: ready ? 'ready' : 'database_unavailable' })
})

app.use('/api/v1/auth/mobile', mobileAuthRoutes)
app.use('/api/v1/auth', authRouter)
app.use('/api/v1', meRouter)
app.use('/api/v1/customer', customerRoutes)
app.use('/api/v1/public', publicRoutes)
app.use('/api/v1/salons', salonRoutes)
app.use('/api/v1/users', userRoutes)
app.use('/api/v1/services', serviceRoutes)
app.use('/api/v1/staff', staffRoutes)
app.use('/api/v1/offers', offerRoutes)
app.use('/api/v1/packages', packageRoutes)
app.use('/api/v1/membership-plans', membershipPlanRoutes)
app.use('/api/v1/customer-memberships', customerMembershipRoutes)
app.use('/api/v1/customer-packages', customerPackageRoutes)
app.use('/api/v1/customers', salonCustomerRoutes)
app.use('/api/v1/bookings', bookingRoutes)
app.use('/api/v1/invoices', invoiceRoutes)
app.use('/api/v1/notifications', notificationRoutes)
app.use('/api/v1/audit-events', auditRoutes)
app.use('/api/v1/platform', platformRoutes)
app.use('/api/v1/contact', contactRoutes)

app.use(notFound)
app.use(errorHandler)

module.exports = app
