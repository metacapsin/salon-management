const jwt = require('jsonwebtoken')
const mongoose = require('mongoose')
const env = require('../config/env')
const ApiError = require('../utils/apiError')
const { roleCan } = require('../config/permissions')
const { User, Session, Membership, Salon } = require('../models')

// Step 1: kaun hai? Authorization: Bearer <accessToken> padhta hai.
// Har request par DB se bhi dekhta hai ki user abhi active hai aur uska login (session family) revoke to nahi hua
// (SRS FR-AUTH-02, AT-03). Isliye deactivate/logout turant asar karta hai, token ke 15 minute ka intezaar nahi.
async function authenticate(req, res, next) {
  const header = req.get('authorization') || ''
  const [scheme, token] = header.split(' ')
  if (scheme !== 'Bearer' || !token) {
    throw new ApiError(401, 'TOKEN_REQUIRED', 'Please sign in.')
  }

  let claims
  try {
    claims = jwt.verify(token, env.JWT_ACCESS_SECRET, { algorithms: ['HS256'] })
  } catch {
    throw new ApiError(401, 'TOKEN_INVALID', 'Your session has expired. Please sign in again.')
  }

  if (!mongoose.isValidObjectId(claims.sub)) {
    throw new ApiError(401, 'TOKEN_INVALID', 'Your session has expired. Please sign in again.')
  }

  // "family" = ek login ke refresh sessions ki poori chain. Refresh par purani row revoke hoti hai aur nayi banti hai,
  // isliye access token family se bandha hai; family me koi bhi chalti session ho to token valid hai.
  const [user, familyAlive] = await Promise.all([
    User.findById(claims.sub),
    Session.exists({ familyId: claims.fam, userId: claims.sub, revokedAt: null, expiresAt: { $gt: new Date() } }),
  ])
  if (!user || !user.active || !familyAlive) {
    throw new ApiError(401, 'TOKEN_INVALID', 'Your session has expired. Please sign in again.')
  }

  req.user = user
  req.familyId = claims.fam
  next()
}

// Step 2: kis salon ke andar kaam? Header X-Salon-Id sirf "maanga gaya salon" hai, saboot nahi.
// Server khud membership dekhta hai. Na milne par 404 (salon ka wajood bhi nahi batate) (SRS section 2, AT-02).
async function requireSalon(req, res, next) {
  const salonId = req.get('x-salon-id')
  if (!salonId || !mongoose.isValidObjectId(salonId)) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Select a salon first.', { fieldErrors: { 'X-Salon-Id': 'Required' } })
  }
  const membership = await Membership.findOne({ salonId, userId: req.user._id, active: true })
  const salon = membership ? await Salon.findById(salonId) : null
  if (!membership || !salon) {
    throw new ApiError(404, 'NOT_FOUND', 'Salon not found.')
  }

  // Suspended salon me likhna band, padhna chalega (SRS FR-ORG-03).
  if (salon.status === 'suspended' && !['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    throw new ApiError(403, 'SALON_SUSPENDED', 'This salon is suspended. Changes are not allowed.')
  }

  req.salon = salon
  req.membership = membership
  req.role = membership.role
  next()
}

// Step 3: kya is role ko ye kaam allowed hai? Button chhupana kaafi nahi, server hi asli check hai (FR-ACC-01).
function can(capability) {
  return (req, res, next) => {
    if (!roleCan(req.role, capability)) {
      throw new ApiError(403, 'PERMISSION_DENIED', 'You do not have permission to do this.')
    }
    next()
  }
}

// Platform (Super Admin) ke kaam: salon ki membership se kuch lena-dena nahi, sirf User.platformRole === 'admin'.
// Salon ka owner bhi yahan 403 pata hai. Pehle authenticate chalana zaroori hai.
function requirePlatformAdmin(req, res, next) {
  if (req.user?.platformRole !== 'admin') {
    throw new ApiError(403, 'PERMISSION_DENIED', 'You do not have permission to do this.')
  }
  next()
}

module.exports = { authenticate, requireSalon, can, requirePlatformAdmin }
