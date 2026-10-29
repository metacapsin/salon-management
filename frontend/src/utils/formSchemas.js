// Forms ke rules (zod). Server hamesha dobara check karta hai; ye sirf jaldi feedback ke liye hai.
import { z } from 'zod'
import { ADDRESS_ERROR, ADDRESS_PATTERN, EMAIL_MAX_LENGTH, NAME_ERROR, NAME_PATTERN, PASSWORD_MAX_LENGTH, PHONE_ERROR, PINCODE_ERROR, PINCODE_PATTERN, isValidPhone } from './validators'

export const emailField = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, 'Enter your email.')
  .max(EMAIL_MAX_LENGTH, 'Enter a valid email address.')
  .email('Enter a valid email address.')

// Naya shared fields (naam, phone, address, PIN). max = database ki limit.
export const nameField = (max = 100) =>
  z.string().trim().min(1, 'Enter the name.').max(max, `Name can be at most ${max} characters.`).regex(NAME_PATTERN, NAME_ERROR)

// Phone required hai; optional jagah par optionalPhoneField use karo
export const phoneField = z.string().trim().refine(isValidPhone, PHONE_ERROR)
export const optionalPhoneField = z.string().trim().refine((v) => v === '' || isValidPhone(v), PHONE_ERROR)

export const addressField = (max = 200) => z.string().trim().max(max, `At most ${max} characters.`).regex(ADDRESS_PATTERN, ADDRESS_ERROR)
// PIN optional hai: khaali chalega, bhara ho to 6 digit
export const pincodeField = z.string().trim().refine((v) => v === '' || PINCODE_PATTERN.test(v), PINCODE_ERROR)

// Password BANATE waqt: 12 se 128 characters (SRS section 19)
export const newPasswordField = z
  .string()
  .min(12, 'Password must be at least 12 characters.')
  .max(PASSWORD_MAX_LENGTH, `Password can be at most ${PASSWORD_MAX_LENGTH} characters.`)

export const registerSchema = z.object({
  name: nameField(100),
  email: emailField,
  password: newPasswordField,
})

export const forgotSchema = z.object({ email: emailField })
export const resetSchema = z.object({ password: newPasswordField })

export const acceptSchema = z.object({
  name: z.string().trim().max(100, 'Name can be at most 100 characters.').refine((v) => v === '' || NAME_PATTERN.test(v), NAME_ERROR),
  password: z.string().min(1, 'Enter your password.').max(PASSWORD_MAX_LENGTH),
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
    ownerName: nameField(100),
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
      .number({ error: 'Enter the duration in minutes.' })
      .int('Use whole minutes.')
      .min(5, 'At least 5 minutes.')
      .max(480, 'At most 480 minutes (8 hours).')
      .refine((v) => v % 5 === 0, 'Use 5 minute steps, like 30 or 45.'),
    atSalon: z.boolean(),
    atHome: z.boolean(),
  })
  .refine((v) => v.atSalon || v.atHome, { message: 'Choose at least one place.', path: ['atSalon'] })

const dayField = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Choose a date.')

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

const optionalDay = z.string().regex(/^(\d{4}-\d{2}-\d{2})?$/, 'Choose a date.')

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
  customerPhone: z.string().trim().regex(/^\d{10}$/, 'Enter a 10-digit mobile number.'),
  customerName: nameField(100),
  paymentStatus: z.enum(['paid', 'pending']),
  paymentMethod: z.enum(['cash', 'upi', 'card', 'other']),
  startsOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Choose a date.'),
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

// "Galora Demo!" -> "galora-demo"
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
