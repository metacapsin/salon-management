// SRS section 16 ke collections (TASK-01 wale hisse). Har tenant-scoped document me salonId hota hai.
const mongoose = require('mongoose')
const { Schema } = mongoose
const { ROLES } = require('../config/permissions')
const { SERVICE_CATEGORIES } = require('../config/serviceCategories')
const { placeKey } = require('../utils/placeKey')
const { INQUIRY_STATUSES } = require('../config/inquiry')

const baseOptions = { timestamps: true }

// ---------- users: login credentials (public profile se alag rakhte hain) ----------
const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    email: { type: String, required: true, trim: true, maxlength: 254 },
    normalizedEmail: { type: String, required: true, unique: true },
    passwordHash: { type: String, required: true },
    verifiedAt: { type: Date, default: null },
    // Naya owner register karta he to 'pending' rehta he; Super Admin approve kare tab hi verification email jaati he.
    // Default 'approved' isliye ki purane users (seed, invitation se bane) pe koi asar na pade.
    approvalStatus: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'approved' },
    approvedAt: { type: Date, default: null },
    active: { type: Boolean, default: true },
    platformRole: { type: String, enum: ['admin', null], default: null },
    // login lockout (FR-AUTH-03)
    failedLoginCount: { type: Number, default: 0 },
    firstFailedAt: { type: Date, default: null },
    lockUntil: { type: Date, default: null },
    schemaVersion: { type: Number, default: 1 },
  },
  baseOptions,
)

// ---------- salons (tenant) ----------
const salonSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 100 },
    slug: { type: String, required: true, unique: true },
    status: { type: String, enum: ['active', 'suspended'], default: 'active' },
    timezone: { type: String, required: true, default: 'Asia/Kolkata' },
    currency: { type: String, enum: ['INR'], default: 'INR' },
    ownerContact: {
      name: String,
      email: String,
      phone: { type: String, default: '' },
    },
    address: {
      line1: { type: String, default: '' },
      city: { type: String, default: '' },
      state: { type: String, default: '' },
      pincode: { type: String, default: '' },
      // Zomato jaisi discovery ke liye: locality (jaise Rohini) aur map coordinates
      area: { type: String, default: '' },
      // city ki pehchaan-kunji (spelling ka farq mitakar): customer ki location se salon dhundhne me kaam aati hai
      cityKey: { type: String, default: '' },
      location: {
        lat: { type: Number, default: null },
        lng: { type: Number, default: null },
      },
    },
    // Public (customer ko dikhne wala) profile
    about: { type: String, default: '', maxlength: 500 },
    coverUrl: { type: String, default: '' },
    audience: { type: String, enum: ['women', 'men', 'unisex'], default: 'unisex' },
    serviceModes: {
      salonVisit: { type: Boolean, default: true },
      homeService: { type: Boolean, default: false },
    },
    tags: [{ type: String, maxlength: 40 }],
    // Salon me kya-kya suvidha hai (AC, parking, wifi...)
    facilities: [{ type: String, maxlength: 40 }],
    startingPrice: { type: Number, default: null, min: 0 },
    // TASK baad me: reviews module ban jaane par ye apne-aap bharenge
    rating: {
      average: { type: Number, default: 0, min: 0, max: 5 },
      count: { type: Number, default: 0, min: 0 },
    },
    logoUrl: { type: String, default: '' },
    publicBookingEnabled: { type: Boolean, default: false },
    settings: {
      receptionDiscountLimitPercent: { type: Number, default: 10, min: 0, max: 100 },
    },
    ownerIds: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    version: { type: Number, default: 1 },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    schemaVersion: { type: Number, default: 1 },
  },
  baseOptions,
)

salonSchema.index({ status: 1, publicBookingEnabled: 1, 'address.cityKey': 1, 'address.area': 1 })
// city badalte hi kunji apne-aap badal jaati hai
salonSchema.pre('validate', function setCityKey() {
  this.address.cityKey = placeKey(this.address?.city)
})

// ---------- branches: v1 me har salon ka sirf ek branch ----------
const intervalSchema = new Schema({ start: String, end: String }, { _id: false })
const branchSchema = new Schema(
  {
    salonId: { type: Schema.Types.ObjectId, ref: 'Salon', required: true, unique: true },
    name: { type: String, default: 'Main' },
    // keys: mon tue wed thu fri sat sun; value: [{start:'09:00', end:'20:00'}]
    weeklyHours: {
      type: Map,
      of: [intervalSchema],
      default: () => new Map(),
    },
    holidays: [new Schema({ date: String, name: { type: String, default: '' } }, { _id: false })],
    active: { type: Boolean, default: true },
    schemaVersion: { type: Number, default: 1 },
  },
  baseOptions,
)

// ---------- services: salon ki price list (SRS section 16, TASK-02) ----------
const serviceSchema = new Schema(
  {
    salonId: { type: Schema.Types.ObjectId, ref: 'Salon', required: true },
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 100 },
    category: { type: String, enum: SERVICE_CATEGORIES, default: 'Other' },
    description: { type: String, default: '', maxlength: 500 },
    price: { type: Number, required: true, min: 0, max: 1000000 }, // INR, poore rupaye
    durationMin: { type: Number, required: true, min: 5, max: 480 },
    // Ye service kahan di jaati hai: salon me, ghar par, ya dono
    atSalon: { type: Boolean, default: true },
    atHome: { type: Boolean, default: false },
    active: { type: Boolean, default: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    schemaVersion: { type: Number, default: 1 },
  },
  baseOptions,
)
serviceSchema.index({ salonId: 1, active: 1, category: 1, name: 1 })
// Ek salon me ek hi naam ki do active services nahi (chhote/bade akshar ka fark nahi)
serviceSchema.index(
  { salonId: 1, nameKey: 1 },
  { unique: true, partialFilterExpression: { active: true } },
)
serviceSchema.add({ nameKey: { type: String, default: '' } })
serviceSchema.pre('validate', function setNameKey() {
  this.nameKey = (this.name ?? '').trim().toLowerCase()
})

// ---------- offers: salon ke discount offers (owner side) ----------
const offerSchema = new Schema(
  {
    salonId: { type: Schema.Types.ObjectId, ref: 'Salon', required: true },
    title: { type: String, required: true, trim: true, minlength: 2, maxlength: 80 },
    description: { type: String, default: '', maxlength: 300 },
    discountType: { type: String, enum: ['percent', 'flat'], required: true },
    discountValue: { type: Number, required: true, min: 1, max: 1000000 }, // percent ho to 1-100, flat ho to rupaye
    // khaali = poore salon ki saari services par
    serviceIds: [{ type: Schema.Types.ObjectId, ref: 'Service' }],
    startsOn: { type: String, required: true }, // 'YYYY-MM-DD'
    endsOn: { type: String, required: true },
    oncePerCustomer: { type: Boolean, default: false },
    active: { type: Boolean, default: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    schemaVersion: { type: Number, default: 1 },
  },
  baseOptions,
)
offerSchema.index({ salonId: 1, active: 1, endsOn: 1 })

// ---------- staff: salon ke beautician (login zaroori nahi). Slots inhi ke hisaab se banenge ----------
const staffSchema = new Schema(
  {
    salonId: { type: Schema.Types.ObjectId, ref: 'Salon', required: true },
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 100 },
    phone: { type: String, default: '', trim: true, maxlength: 20 },
    title: { type: String, default: '', trim: true, maxlength: 60 }, // jaise "Senior Stylist"
    skills: [{ type: String, trim: true, maxlength: 40 }],
    // Kaun si services ye de sakta/sakti hai
    serviceIds: [{ type: Schema.Types.ObjectId, ref: 'Service' }],
    // Branch ke weeklyHours jaisa: { mon: [{start:'10:00', end:'19:00'}], ... }. Khaali din = chhutti
    weeklyHours: { type: Map, of: [intervalSchema], default: () => new Map() },
    bookingSeq: { type: Number, default: 0 }, // har naayi booking par badhta hai: ek hi staff ki do booking ek saath aaye to ek fail ho
    active: { type: Boolean, default: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    schemaVersion: { type: Number, default: 1 },
  },
  baseOptions,
)
staffSchema.index({ salonId: 1, active: 1, name: 1 })

// ---------- memberships: kaun user kis salon me kis role me ----------
const membershipSchema = new Schema(
  {
    salonId: { type: Schema.Types.ObjectId, ref: 'Salon', required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    role: { type: String, enum: ROLES, required: true },
    active: { type: Boolean, default: true },
    staffId: { type: Schema.Types.ObjectId, default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    schemaVersion: { type: Number, default: 1 },
  },
  baseOptions,
)
membershipSchema.index({ salonId: 1, userId: 1 }, { unique: true })
membershipSchema.index({ userId: 1, active: 1 })

// ---------- sessions: rotating refresh tokens ----------
const sessionSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    tokenHash: { type: String, required: true, unique: true },
    familyId: { type: String, required: true, index: true },
    expiresAt: { type: Date, required: true },
    revokedAt: { type: Date, default: null },
    userAgent: { type: String, default: '' },
  },
  baseOptions,
)
// Purane sessions DB se saaf ho jaate hain, par expiry ka check code me bhi hota hai (TTL bharose ka nahi).
sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 7 * 24 * 3600 })

// ---------- verificationTokens: email verify, password reset, invitation ----------
const verificationTokenSchema = new Schema(
  {
    purpose: { type: String, enum: ['verify_email', 'password_reset', 'invitation'], required: true },
    tokenHash: { type: String, required: true, unique: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    salonId: { type: Schema.Types.ObjectId, ref: 'Salon', default: null },
    // invitation ke liye: email, role, staffId
    payload: { type: Schema.Types.Mixed, default: {} },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    expiresAt: { type: Date, required: true },
    usedAt: { type: Date, default: null },
  },
  baseOptions,
)
verificationTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 24 * 3600 })

// ---------- customers: salon me aane wale log (mobile number + OTP se login, password nahi) ----------
const customerSchema = new Schema(
  {
    phone: { type: String, required: true, unique: true }, // hamesha 10 digit (91 hata kar)
    name: { type: String, required: true, trim: true, maxlength: 100 },
    lastLoginAt: { type: Date, default: null },
    schemaVersion: { type: Number, default: 1 },
  },
  baseOptions,
)

// ---------- customerOtps: ek baar ka code. DB me sirf hash, asli code SMS me jaata hai ----------
const customerOtpSchema = new Schema(
  {
    phone: { type: String, required: true, index: true },
    codeHash: { type: String, required: true },
    attempts: { type: Number, default: 0 },
    usedAt: { type: Date, default: null },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
)
// Purane codes DB se apne-aap hat jaate hain (expiry ka check code me bhi hota hai)
customerOtpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 3600 })

// ---------- bookings: customer ki appointment request ----------
const BOOKING_STATUSES = ['pending', 'confirmed', 'completed', 'cancelled']
const bookingSchema = new Schema(
  {
    salonId: { type: Schema.Types.ObjectId, ref: 'Salon', required: true },
    customerId: { type: Schema.Types.ObjectId, ref: 'Customer', default: null },
    // Salon-side booking me chuna hua staff (customer ki booking me khaali). Naam copy hota hai, staff hatne par bhi list me dikhe.
    staffId: { type: Schema.Types.ObjectId, ref: 'Staff', default: null },
    staffName: { type: String, default: '' },
    customerName: { type: String, required: true, trim: true, maxlength: 100 },
    customerPhone: { type: String, required: true, trim: true, maxlength: 20 },
    mode: { type: String, enum: ['salon', 'home'], default: 'salon' },
    address: { type: String, default: '', maxlength: 300 }, // sirf home service me
    note: { type: String, default: '', maxlength: 300 },
    date: { type: String, required: true }, // YYYY-MM-DD (salon ke timezone me)
    startTime: { type: String, required: true }, // HH:mm
    durationMin: { type: Number, required: true },
    // Booking ke waqt ka naam/price copy karte hain, taaki baad me price badle to purani booking na badle
    services: [
      new Schema({ serviceId: Schema.Types.ObjectId, name: String, price: Number, durationMin: Number }, { _id: false }),
    ],
    subtotal: { type: Number, min: 0 }, // offer lagne se pehle ka total (purani bookings me nahi hota)
    // Lagaya gaya offer: naam aur discount copy hota hai, taaki offer badalne par purani booking na badle
    offer: {
      type: new Schema({ offerId: Schema.Types.ObjectId, title: String, discount: Number }, { _id: false }),
      default: null,
    },
    // Membership ka discount (offer ke baad). Naam aur rakam copy hoti hai.
    membership: {
      type: new Schema({ customerMembershipId: Schema.Types.ObjectId, planName: String, discount: Number }, { _id: false }),
      default: null,
    },
    total: { type: Number, required: true, min: 0 }, // discount ke baad ka total
    status: { type: String, enum: BOOKING_STATUSES, default: 'pending' },
    schemaVersion: { type: Number, default: 1 },
  },
  baseOptions,
)
bookingSchema.index({ salonId: 1, date: 1, startTime: 1 })
bookingSchema.index({ salonId: 1, createdAt: -1 })

// ---------- packages: salon ke bundle (jaise "Bridal 5 sessions"). Ye sirf template hai, bikri CustomerPackage me hoti hai ----------
const packageSchema = new Schema(
  {
    salonId: { type: Schema.Types.ObjectId, ref: 'Salon', required: true },
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 100 },
    nameKey: { type: String, default: '' },
    description: { type: String, default: '', maxlength: 500 },
    items: [
      new Schema(
        {
          serviceId: { type: Schema.Types.ObjectId, ref: 'Service', required: true },
          serviceName: String, // copy: service ka naam badle to bhi list me dikhe
          unitPrice: Number, // banate waqt service ka price (server ne bhara)
          sessions: { type: Number, required: true, min: 1, max: 100 },
        },
        { _id: false },
      ),
    ],
    originalPrice: { type: Number, required: true, min: 0 }, // sum(unitPrice * sessions), hamesha server nikalta hai
    packagePrice: { type: Number, required: true, min: 0 },
    validityDays: { type: Number, required: true, min: 1, max: 1095 }, // kharidne ke din se kitne din chalega
    saleStartsOn: { type: String, default: null }, // optional: kab se bik sakta hai (YYYY-MM-DD)
    saleEndsOn: { type: String, default: null },
    active: { type: Boolean, default: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    schemaVersion: { type: Number, default: 1 },
  },
  baseOptions,
)
packageSchema.index({ salonId: 1, active: 1, name: 1 })
packageSchema.index({ salonId: 1, nameKey: 1 }, { unique: true, partialFilterExpression: { active: true } })
packageSchema.pre('validate', function setNameKey() {
  this.nameKey = (this.name ?? '').trim().toLowerCase()
})

// ---------- customerPackages: kisi customer ne kharida hua package. Sessions ka balance yahin rehta hai ----------
const customerPackageSchema = new Schema(
  {
    salonId: { type: Schema.Types.ObjectId, ref: 'Salon', required: true },
    packageId: { type: Schema.Types.ObjectId, ref: 'Package', required: true },
    packageName: { type: String, required: true },
    customerId: { type: Schema.Types.ObjectId, ref: 'Customer', default: null },
    customerPhone: { type: String, required: true },
    customerName: { type: String, required: true, trim: true, maxlength: 100 },
    // Kharidne ke waqt ki copy: baad me package edit ho to ye nahi badalta
    items: [
      new Schema(
        {
          serviceId: { type: Schema.Types.ObjectId, required: true },
          serviceName: String,
          total: { type: Number, required: true, min: 1 },
          remaining: { type: Number, required: true, min: 0 }, // kabhi negative nahi (DB-level filter se bhi bachaya jaata hai)
        },
        { _id: false },
      ),
    ],
    originalPrice: { type: Number, required: true, min: 0 },
    pricePaid: { type: Number, required: true, min: 0 },
    paymentStatus: { type: String, enum: ['paid', 'pending'], required: true },
    paymentMethod: { type: String, enum: ['cash', 'upi', 'card', 'other'], default: 'cash' },
    purchasedOn: { type: String, required: true }, // YYYY-MM-DD
    startsOn: { type: String, required: true },
    expiresOn: { type: String, required: true },
    cancelled: { type: Boolean, default: false },
    // Ek hi click do baar chale to double bikri na ho (idempotency)
    requestKey: { type: String, required: true, maxlength: 80 },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    schemaVersion: { type: Number, default: 1 },
  },
  baseOptions,
)
customerPackageSchema.index({ salonId: 1, requestKey: 1 }, { unique: true })
customerPackageSchema.index({ salonId: 1, customerPhone: 1, createdAt: -1 })

// ---------- packageLedger: append-only itihaas (khareed, session use, adjustment, payment, cancel) ----------
const packageLedgerSchema = new Schema(
  {
    salonId: { type: Schema.Types.ObjectId, ref: 'Salon', required: true },
    customerPackageId: { type: Schema.Types.ObjectId, ref: 'CustomerPackage', required: true },
    type: { type: String, enum: ['purchase', 'redemption', 'adjustment', 'payment', 'cancel'], required: true },
    serviceId: { type: Schema.Types.ObjectId, default: null },
    serviceName: { type: String, default: '' },
    sessions: { type: Number, default: 0 }, // redemption me -1, adjustment me +/-
    amount: { type: Number, default: 0 }, // purchase/payment me rupaye
    bookingId: { type: Schema.Types.ObjectId, ref: 'Booking', default: null },
    invoiceId: { type: Schema.Types.ObjectId, ref: 'Invoice', default: null },
    note: { type: String, default: '', maxlength: 300 },
    actorId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
)
packageLedgerSchema.index({ salonId: 1, customerPackageId: 1, createdAt: 1 })
// Ek booking ki ek service ka session sirf ek baar kat sakta hai
packageLedgerSchema.index(
  { customerPackageId: 1, bookingId: 1, serviceId: 1 },
  { unique: true, partialFilterExpression: { type: 'redemption' } },
)

// ---------- membershipPlans: Silver/Gold jaise plan (template). Bikri CustomerMembership me hoti hai ----------
const membershipPlanSchema = new Schema(
  {
    salonId: { type: Schema.Types.ObjectId, ref: 'Salon', required: true },
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 80 },
    nameKey: { type: String, default: '' },
    description: { type: String, default: '', maxlength: 300 },
    price: { type: Number, required: true, min: 0, max: 10000000 },
    durationDays: { type: Number, required: true, min: 1, max: 1095 },
    discountType: { type: String, enum: ['percent', 'flat'], required: true },
    discountValue: { type: Number, required: true, min: 1, max: 10000000 }, // percent ho to 1-100
    serviceIds: [{ type: Schema.Types.ObjectId, ref: 'Service' }], // khaali = saari services
    benefits: [{ type: String, trim: true, maxlength: 100 }],
    active: { type: Boolean, default: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    schemaVersion: { type: Number, default: 1 },
  },
  baseOptions,
)
membershipPlanSchema.index({ salonId: 1, active: 1, name: 1 })
membershipPlanSchema.index({ salonId: 1, nameKey: 1 }, { unique: true, partialFilterExpression: { active: true } })
membershipPlanSchema.pre('validate', function setNameKey() {
  this.nameKey = (this.name ?? '').trim().toLowerCase()
})

// ---------- customerMemberships: customer ne kharida hua membership. Discount ki shartein kharidte waqt copy hoti hain ----------
const customerMembershipSchema = new Schema(
  {
    salonId: { type: Schema.Types.ObjectId, ref: 'Salon', required: true },
    planId: { type: Schema.Types.ObjectId, ref: 'MembershipPlan', required: true },
    planName: { type: String, required: true },
    customerId: { type: Schema.Types.ObjectId, ref: 'Customer', default: null },
    customerPhone: { type: String, required: true },
    customerName: { type: String, required: true, trim: true, maxlength: 100 },
    discountType: { type: String, enum: ['percent', 'flat'], required: true },
    discountValue: { type: Number, required: true, min: 1 },
    serviceIds: [{ type: Schema.Types.ObjectId }],
    benefits: [{ type: String }],
    pricePaid: { type: Number, required: true, min: 0 },
    paymentStatus: { type: String, enum: ['paid', 'pending'], required: true },
    paymentMethod: { type: String, enum: ['cash', 'upi', 'card', 'other'], default: 'cash' },
    purchasedOn: { type: String, required: true },
    startsOn: { type: String, required: true },
    expiresOn: { type: String, required: true },
    cancelled: { type: Boolean, default: false },
    requestKey: { type: String, required: true, maxlength: 80 },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    schemaVersion: { type: Number, default: 1 },
  },
  baseOptions,
)
customerMembershipSchema.index({ salonId: 1, requestKey: 1 }, { unique: true })
customerMembershipSchema.index({ salonId: 1, customerPhone: 1, startsOn: -1 })

// ---------- membershipLedger: append-only itihaas (khareed, payment, discount lagna, cancel) ----------
const membershipLedgerSchema = new Schema(
  {
    salonId: { type: Schema.Types.ObjectId, ref: 'Salon', required: true },
    customerMembershipId: { type: Schema.Types.ObjectId, ref: 'CustomerMembership', required: true },
    // 'discount' = booking par laga (booking ke saath unique); 'invoice_discount' = bina booking ke bill par laga
    type: { type: String, enum: ['purchase', 'payment', 'discount', 'invoice_discount', 'cancel'], required: true },
    amount: { type: Number, default: 0 }, // purchase/payment me price, discount me bachat
    bookingId: { type: Schema.Types.ObjectId, ref: 'Booking', default: null },
    invoiceId: { type: Schema.Types.ObjectId, ref: 'Invoice', default: null },
    note: { type: String, default: '', maxlength: 300 },
    actorId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
)
membershipLedgerSchema.index({ salonId: 1, customerMembershipId: 1, createdAt: 1 })
// Ek booking par ek membership ka discount sirf ek baar
membershipLedgerSchema.index(
  { customerMembershipId: 1, bookingId: 1 },
  { unique: true, partialFilterExpression: { type: 'discount' } },
)

// ---------- invoices: finalized bill. Paisa INTEGER PAISE me (modules/billing/money.js). Bann jaane ke baad edit nahi hota ----------
// Galti ho to refund/void record banta hai (Payment type 'refund', status 'void'), bill ke amount kabhi chupke se nahi badalte.
const moneyField = { type: Number, required: true, min: 0, validate: Number.isSafeInteger }
const invoiceSchema = new Schema(
  {
    salonId: { type: Schema.Types.ObjectId, ref: 'Salon', required: true },
    invoiceNumber: { type: String, required: true }, // jaise GLM-2026-000001, salon ke andar unique
    bookingId: { type: Schema.Types.ObjectId, ref: 'Booking', default: null },
    customerId: { type: Schema.Types.ObjectId, ref: 'Customer', default: null },
    customerPhone: { type: String, required: true },
    customerName: { type: String, required: true, trim: true, maxlength: 100 },
    // Bill ke waqt ki copy (naam/price baad me badle to bill na badle)
    lines: [
      new Schema(
        {
          serviceId: { type: Schema.Types.ObjectId, required: true },
          name: { type: String, required: true },
          unitPrice: moneyField,
          quantity: { type: Number, required: true, min: 1, max: 20, validate: Number.isInteger },
          lineTotal: moneyField,
          // Package se covered ho to is line ka paisa nahi lagta; session kat chuka hai
          package: {
            type: new Schema({ customerPackageId: Schema.Types.ObjectId, packageName: String, sessions: Number }, { _id: false }),
            default: null,
          },
        },
        { _id: false },
      ),
    ],
    subtotal: moneyField, // sirf charge hone wali lines ka (package-covered nahi)
    offer: {
      type: new Schema({ offerId: Schema.Types.ObjectId, title: String, discount: Number }, { _id: false }),
      default: null,
    },
    membership: {
      type: new Schema({ customerMembershipId: Schema.Types.ObjectId, planName: String, discount: Number }, { _id: false }),
      default: null,
    },
    discountTotal: moneyField,
    taxableAmount: moneyField,
    tax: {
      ratePercent: { type: Number, required: true },
      cgst: moneyField,
      sgst: moneyField,
      total: moneyField,
    },
    total: moneyField,
    // Payments se badalne wale (sirf Payment records ke saath ek hi transaction me)
    amountPaid: { type: Number, default: 0, min: 0, validate: Number.isSafeInteger },
    amountRefunded: { type: Number, default: 0, min: 0, validate: Number.isSafeInteger },
    paymentStatus: { type: String, enum: ['unpaid', 'partial', 'paid'], default: 'unpaid' },
    status: { type: String, enum: ['final', 'void'], default: 'final' },
    voidReason: { type: String, default: '', maxlength: 300 },
    requestKey: { type: String, required: true, maxlength: 80 }, // double-click par do bill na bane
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    schemaVersion: { type: Number, default: 1 },
  },
  baseOptions,
)
invoiceSchema.index({ salonId: 1, invoiceNumber: 1 }, { unique: true })
invoiceSchema.index({ salonId: 1, requestKey: 1 }, { unique: true })
invoiceSchema.index({ salonId: 1, createdAt: -1 })
invoiceSchema.index({ salonId: 1, customerPhone: 1, createdAt: -1 })
// Ek appointment ka ek hi (void na hua) bill
invoiceSchema.index({ bookingId: 1 }, { unique: true, partialFilterExpression: { bookingId: { $type: 'objectId' }, status: 'final' } })

// ---------- payments: append-only. Payment aur refund dono; invoice ka paid/due inhi se nikalta hai ----------
const paymentSchema = new Schema(
  {
    salonId: { type: Schema.Types.ObjectId, ref: 'Salon', required: true },
    invoiceId: { type: Schema.Types.ObjectId, ref: 'Invoice', required: true },
    type: { type: String, enum: ['payment', 'refund'], required: true },
    method: { type: String, enum: ['cash', 'upi', 'card'], required: true },
    amount: { type: Number, required: true, min: 1, validate: Number.isSafeInteger }, // paise, hamesha positive
    reference: { type: String, default: '', maxlength: 80 }, // UPI txn id / card last-4 jaisa
    note: { type: String, default: '', maxlength: 300 }, // refund me reason zaroori (route check karega)
    requestKey: { type: String, required: true, maxlength: 80 }, // duplicate payment rokne ke liye
    actorId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
)
paymentSchema.index({ salonId: 1, requestKey: 1 }, { unique: true })
paymentSchema.index({ salonId: 1, invoiceId: 1, createdAt: 1 })

// ---------- invoiceCounters: salon + saal ka agla number (atomic $inc se, do bill ka same number nahi) ----------
const invoiceCounterSchema = new Schema({
  salonId: { type: Schema.Types.ObjectId, required: true },
  year: { type: Number, required: true },
  seq: { type: Number, default: 0 },
})
invoiceCounterSchema.index({ salonId: 1, year: 1 }, { unique: true })

// ---------- notifications: salon ke owner/manager ke liye bell wali khabrein ----------
const notificationSchema = new Schema(
  {
    salonId: { type: Schema.Types.ObjectId, ref: 'Salon', required: true },
    type: { type: String, enum: ['salon_viewed', 'booking_created'], required: true },
    title: { type: String, required: true, maxlength: 200 },
    body: { type: String, default: '', maxlength: 500 },
    // salon_viewed: anonymous viewer ki id, taaki ek hi customer baar-baar notification na bheje
    viewerKey: { type: String, default: '' },
    readAt: { type: Date, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
)
notificationSchema.index({ salonId: 1, createdAt: -1 })
notificationSchema.index({ salonId: 1, type: 1, viewerKey: 1, createdAt: -1 })
// 60 din baad purani khabrein apne-aap hat jaati hain
notificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 24 * 3600 })

// ---------- contactInquiries: website ke Contact Us form se aaye sawaal. Salon se nahi jude (platform level), sirf Super Admin dekhta hai ----------
const contactInquirySchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    email: { type: String, required: true, trim: true, lowercase: true, maxlength: 254 },
    phone: { type: String, required: true, trim: true, maxlength: 20 },
    message: { type: String, required: true, trim: true, maxlength: 2000 },
    status: { type: String, enum: INQUIRY_STATUSES, default: 'new' },
    // Admin ke andar ke notes (customer ko kabhi nahi dikhte). Naam copy hota hai, admin hatne par bhi dikhe.
    adminNotes: [
      new Schema(
        {
          text: { type: String, required: true, maxlength: 1000 },
          authorId: { type: Schema.Types.ObjectId, ref: 'User' },
          authorName: { type: String, default: '' },
        },
        { timestamps: { createdAt: true, updatedAt: false } },
      ),
    ],
    handledBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    // email + message ka hash: wahi sawaal baar-baar bheja jaye to naya record nahi banta
    contentHash: { type: String, required: true },
    schemaVersion: { type: Number, default: 1 },
  },
  baseOptions,
)
contactInquirySchema.index({ status: 1, createdAt: -1 })
contactInquirySchema.index({ createdAt: -1 })
contactInquirySchema.index({ contentHash: 1, createdAt: -1 })

// ---------- auditEvents: append-only record ----------
const auditEventSchema = new Schema(
  {
    salonId: { type: Schema.Types.ObjectId, default: null },
    actorId: { type: Schema.Types.ObjectId, default: null },
    action: { type: String, required: true },
    entityType: { type: String, default: '' },
    entityId: { type: String, default: '' },
    redactedChanges: { type: Schema.Types.Mixed, default: {} },
    correlationId: { type: String, default: '' },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
)
auditEventSchema.index({ salonId: 1, createdAt: -1 })

module.exports = {
  User: mongoose.model('User', userSchema),
  Salon: mongoose.model('Salon', salonSchema),
  Branch: mongoose.model('Branch', branchSchema),
  Service: mongoose.model('Service', serviceSchema),
  Staff: mongoose.model('Staff', staffSchema),
  Offer: mongoose.model('Offer', offerSchema),
  Customer: mongoose.model('Customer', customerSchema),
  CustomerOtp: mongoose.model('CustomerOtp', customerOtpSchema),
  Booking: mongoose.model('Booking', bookingSchema),
  Package: mongoose.model('Package', packageSchema),
  CustomerPackage: mongoose.model('CustomerPackage', customerPackageSchema),
  PackageLedger: mongoose.model('PackageLedger', packageLedgerSchema),
  MembershipPlan: mongoose.model('MembershipPlan', membershipPlanSchema),
  CustomerMembership: mongoose.model('CustomerMembership', customerMembershipSchema),
  MembershipLedger: mongoose.model('MembershipLedger', membershipLedgerSchema),
  Invoice: mongoose.model('Invoice', invoiceSchema),
  Payment: mongoose.model('Payment', paymentSchema),
  InvoiceCounter: mongoose.model('InvoiceCounter', invoiceCounterSchema),
  Notification: mongoose.model('Notification', notificationSchema),
  Membership: mongoose.model('Membership', membershipSchema),
  Session: mongoose.model('Session', sessionSchema),
  VerificationToken: mongoose.model('VerificationToken', verificationTokenSchema),
  AuditEvent: mongoose.model('AuditEvent', auditEventSchema),
  ContactInquiry: mongoose.model('ContactInquiry', contactInquirySchema),
}
