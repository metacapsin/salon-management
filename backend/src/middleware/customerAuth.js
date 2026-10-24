const jwt = require('jsonwebtoken')
const mongoose = require('mongoose')
const env = require('../config/env')
const ApiError = require('../utils/apiError')
const { Customer } = require('../models')

const CUSTOMER_COOKIE = 'glamora_ct'
const CUSTOMER_SESSION_MS = 30 * 24 * 60 * 60 * 1000
// Cookie sirf /api/v1 par jaati hai. SameSite=Lax: dusri site se POST ke saath cookie nahi jaati (CSRF se bachav).
const cookieOptions = { httpOnly: true, secure: env.cookieSecure, sameSite: 'lax', path: '/api/v1' }

function signCustomerToken(customer) {
  // typ: 'customer' -> salon staff ke token se alag, dono ek dusre ki jagah nahi chalte
  return jwt.sign({ sub: String(customer._id), typ: 'customer' }, env.JWT_ACCESS_SECRET, { algorithm: 'HS256', expiresIn: Math.floor(CUSTOMER_SESSION_MS / 1000) })
}

function setCustomerCookie(res, customer) {
  res.cookie(CUSTOMER_COOKIE, signCustomerToken(customer), { ...cookieOptions, maxAge: CUSTOMER_SESSION_MS })
}

function clearCustomerCookie(res) {
  res.clearCookie(CUSTOMER_COOKIE, cookieOptions)
}

// Customer login hona zaroori: cookie se pehchanta hai, req.customer set karta hai.
async function authenticateCustomer(req, res, next) {
  const token = req.cookies?.[CUSTOMER_COOKIE]
  const fail = () => new ApiError(401, 'CUSTOMER_LOGIN_REQUIRED', 'Please log in with your mobile number.')
  if (!token) throw fail()

  let claims
  try {
    claims = jwt.verify(token, env.JWT_ACCESS_SECRET, { algorithms: ['HS256'] })
  } catch {
    throw fail()
  }
  if (claims.typ !== 'customer' || !mongoose.isValidObjectId(claims.sub)) throw fail()

  const customer = await Customer.findById(claims.sub)
  if (!customer) throw fail()
  req.customer = customer
  next()
}

module.exports = { authenticateCustomer, setCustomerCookie, clearCustomerCookie, CUSTOMER_COOKIE }
