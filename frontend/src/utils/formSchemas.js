// Forms ke rules (zod). Server hamesha dobara check karta hai; ye sirf jaldi feedback ke liye hai.
import { z } from 'zod'
import {
  ADDRESS_ERROR,
  ADDRESS_PATTERN,
  NAME_MAX_LENGTH,
  PINCODE_ERROR,
  PINCODE_PATTERN,
  cleanName,
  dateError,
  emailError,
  nameError,
  newPasswordError,
  phoneError,
} from './validators'

// Wraps one of the plain validators (value -> message or '') as a zod rule, so every form shows the same messages.
const checkWith = (fn) => (value, ctx) => {
  const message = fn(value)
  if (message) ctx.addIssue({ code: 'custom', message })
}

export const emailField = z.string().trim().toLowerCase().superRefine(checkWith(emailError))

// Names are trimmed and repeated spaces are collapsed before checking.
export const nameField = (max = NAME_MAX_LENGTH) => z.string().transform(cleanName).superRefine(checkWith((v) => nameError(v, max)))
export const optionalNameField = (max = NAME_MAX_LENGTH) => z.string().transform(cleanName).superRefine(checkWith((v) => (v === '' ? '' : nameError(v, max))))

// Mobile number: exactly 10 digits starting 6-9. Required by default; optionalPhoneField also accepts an empty value.
export const phoneField = z.string().trim().superRefine(checkWith((v) => phoneError(v)))
export const optionalPhoneField = z.string().trim().superRefine(checkWith((v) => phoneError(v, { required: false })))

export const addressField = (max = 200) => z.string().trim().max(max, `At most ${max} characters.`).regex(ADDRESS_PATTERN, ADDRESS_ERROR)
// PIN is optional: empty is fine, otherwise it must be 6 digits
export const pincodeField = z.string().trim().refine((v) => v === '' || PINCODE_PATTERN.test(v), PINCODE_ERROR)

// When a password is CREATED or CHANGED: 12 to 20 characters. Never trimmed.
export const newPasswordField = z.string().superRefine(checkWith(newPasswordError))

export const registerSchema = z.object({
  name: nameField(),
  email: emailField,
  password: newPasswordField,
})

export const forgotSchema = z.object({ email: emailField })
export const resetSchema = z.object({
  otp: z.string().trim().regex(/^\d{6}$/, 'Please enter the 6-digit code.'),
  password: newPasswordField,
})

// Accepting an invitation: existing users enter their current password (any length), new users create one (12-20,
// which the server checks). The name is optional here (existing accounts leave it empty).
export const acceptSchema = z.object({
  name: optionalNameField(),
  password: newPasswordField,
})

export const slugField = z
  .string()
  .regex(/^[a-z0-9-]{3,50}$/, 'Use 3 to 50 lowercase letters, digits or hyphens.')

export const FACILITIES = [
  { value: 'ac', label: 'AC' },
  { value: 'parking', label: 'Parking' },
  { value: 'wifi', label: 'Wi-Fi' },
  { value: 'wheelchair', label: 'Wheelchair access' },
  { value: 'card-payment', label: 'Card / UPI payment' },
  { value: 'waiting-area', label: 'Waiting area' },
  { value: 'tea-coffee', label: 'Tea / coffee' },
  { value: 'bridal-room', label: 'Bridal room' },
]

export const salonSchema = z
  .object({
    name: z.string().trim().min(2, 'Salon name must be at least 2 characters.').max(100),
    slug: slugField,
    ownerName: nameField(),
    phone: optionalPhoneField,
    about: z.string().trim().max(500, 'At most 500 characters.'),
    audience: z.enum(['women', 'men', 'unisex']),
    facilities: z.array(z.string()),
    line1: addressField(200),
    city: addressField(100),
    area: addressField(100),
    state: addressField(100),
    pincode: pincodeField,
    // Map location: dono khaali (nahi pata) ya dono sahi number
    lat: z.string().trim(),
    lng: z.string().trim(),
    timezone: z.string().min(1),
    receptionDiscountLimitPercent: z.coerce.number().min(0, 'Use 0 to 100.').max(100, 'Use 0 to 100.'),
  })
  .superRefine((v, ctx) => {
    const lat = v.lat === '' ? null : Number(v.lat)
    const lng = v.lng === '' ? null : Number(v.lng)
    if (lat !== null && !(Number.isFinite(lat) && lat >= -90 && lat <= 90)) ctx.addIssue({ code: 'custom', path: ['lat'], message: 'Latitude must be between -90 and 90.' })
    if (lng !== null && !(Number.isFinite(lng) && lng >= -180 && lng <= 180)) ctx.addIssue({ code: 'custom', path: ['lng'], message: 'Longitude must be between -180 and 180.' })
    if ((lat === null) !== (lng === null)) ctx.addIssue({ code: 'custom', path: [lat === null ? 'lat' : 'lng'], message: 'Fill both latitude and longitude, or leave both empty.' })
  })

// Form me price/duration text hota hai, isliye coerce se number banate hain
export const serviceSchema = z
  .object({
    name: z.string().trim().min(2, 'Service name must be at least 2 characters.').max(100),
    category: z.string().min(1),
    description: z.string().trim().max(500, 'At most 500 characters.'),
    price: z.coerce.number({ error: 'Enter a price.' }).int('Use whole rupees.').min(0, 'Price cannot be negative.').max(1000000, 'Price is too high.'),
    durationMin: z.coerce
      .number({ error: 'Enter a valid duration.' })
      .int('Use whole minutes.')
      .positive('Duration must be more than 0.')
      .min(5, 'At least 5 minutes.')
      .max(480, 'At most 8 hours.')
      .refine((v) => v % 5 === 0, 'Use 5 minute steps, like 30 or 45.'),
    atSalon: z.boolean(),
    atHome: z.boolean(),
  })
  .refine((v) => v.atSalon || v.atHome, { message: 'Choose at least one place.', path: ['atSalon'] })

const dayField = z.string().superRefine(checkWith((v) => dateError(v)))

export const offerSchema = z
  .object({
    title: z.string().trim().min(2, 'Title must be at least 2 characters.').max(80),
    description: z.string().trim().max(300, 'At most 300 characters.'),
    discountType: z.enum(['percent', 'flat']),
    discountValue: z.coerce.number({ error: 'Enter the discount.' }).int('Use whole numbers.').min(1, 'Discount must be at least 1.').max(1000000, 'Discount is too high.'),
    serviceIds: z.array(z.string()),
    startsOn: dayField,
    endsOn: dayField,
    oncePerCustomer: z.boolean(),
  })
  .refine((v) => v.discountType !== 'percent' || v.discountValue <= 100, { message: 'Percentage cannot be more than 100.', path: ['discountValue'] })
  .refine((v) => v.endsOn >= v.startsOn, { message: 'End date cannot be before the start date.', path: ['endsOn'] })

const optionalDay = z.string().superRefine(checkWith((v) => dateError(v, { required: false })))

export const packageSchema = z
  .object({
    name: z.string().trim().min(2, 'Name must be at least 2 characters.').max(100),
    description: z.string().trim().max(500, 'At most 500 characters.'),
    items: z
      .array(
        z.object({
          serviceId: z.string().min(1, 'Choose a service.'),
          sessions: z.coerce.number({ error: 'Enter sessions.' }).int('Use whole numbers.').min(1, 'At least 1.').max(100, 'At most 100.'),
        }),
      )
      .min(1, 'Add at least one service.'),
    packagePrice: z.coerce.number({ error: 'Enter the package price.' }).int('Use whole rupees.').min(0, 'Price cannot be negative.').max(10000000),
    validityDays: z.coerce.number({ error: 'Enter validity in days.' }).int('Use whole days.').min(1, 'At least 1 day.').max(1095, 'At most 3 years.'),
    saleStartsOn: optionalDay,
    saleEndsOn: optionalDay,
  })
  .refine((v) => !v.saleStartsOn || !v.saleEndsOn || v.saleEndsOn >= v.saleStartsOn, { message: 'End date cannot be before the start date.', path: ['saleEndsOn'] })

export const assignPackageSchema = z.object({
  packageId: z.string().min(1, 'Choose a package.'),
  customerPhone: phoneField,
  customerName: nameField(),
  paymentStatus: z.enum(['paid', 'pending']),
  paymentMethod: z.enum(['cash', 'upi', 'card', 'other']),
  startsOn: dayField,
})

export const membershipPlanSchema = z
  .object({
    name: z.string().trim().min(2, 'Name must be at least 2 characters.').max(80),
    description: z.string().trim().max(300, 'At most 300 characters.'),
    price: z.coerce.number({ error: 'Enter the price.' }).int('Use whole rupees.').min(0, 'Price cannot be negative.').max(10000000),
    durationDays: z.coerce.number({ error: 'Enter the duration in days.' }).int('Use whole days.').min(1, 'At least 1 day.').max(1095, 'At most 3 years.'),
    discountType: z.enum(['percent', 'flat']),
    discountValue: z.coerce.number({ error: 'Enter the discount.' }).int('Use whole numbers.').min(1, 'Discount must be at least 1.').max(10000000, 'Discount is too high.'),
    serviceIds: z.array(z.string()),
    benefits: z.string().max(1000, 'Too long.'), // har line ek benefit
  })
  .refine((v) => v.discountType !== 'percent' || v.discountValue <= 100, { message: 'Percentage cannot be more than 100.', path: ['discountValue'] })

export const assignMembershipSchema = assignPackageSchema.omit({ packageId: true }).extend({ planId: z.string().min(1, 'Choose a plan.') })

export const reasonSchema = z.object({ note: z.string().trim().min(3, 'Please give a reason (at least 3 characters).').max(300) })

export const inviteSchema = z.object({
  email: emailField,
  role: z.enum(['manager', 'receptionist']),
})

// "Glamora Demo!" -> "glamora-demo"
export function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50)
}

// Server ki fieldErrors ko react-hook-form me daalna
export function applyServerFieldErrors(fieldErrors, setError) {
  for (const [field, message] of Object.entries(fieldErrors ?? {})) setError(field, { type: 'server', message })
}
