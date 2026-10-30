// Salon ki photos disk par rakhne ka chhota helper. Files backend/uploads/salons/<salonId>/ me jaati hain
// aur app.js unhe /uploads/... par dikhata he. Type "Content-Type" se nahi, file ke asli shuruaati bytes se pehchante hain.
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const ApiError = require('./apiError')

const UPLOAD_ROOT = path.join(__dirname, '..', '..', 'uploads')
const MAX_BYTES = 3 * 1024 * 1024

function detectType(buf) {
  if (buf.length > 12 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpg'
  if (buf.length > 12 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png'
  if (buf.length > 12 && buf.subarray(0, 4).toString('ascii') === 'RIFF' && buf.subarray(8, 12).toString('ascii') === 'WEBP') return 'webp'
  return null
}

// buffer ko <folder>/<id>/ me rakh kar public path lautata he (jaise "/uploads/salons/abc/1f2e.jpg")
function saveImage(folder, id, buf) {
  if (!Buffer.isBuffer(buf) || buf.length === 0) throw new ApiError(400, 'IMAGE_REQUIRED', 'Choose a photo to upload.')
  if (buf.length > MAX_BYTES) throw new ApiError(413, 'IMAGE_TOO_LARGE', 'Each photo can be at most 3 MB.')
  const ext = detectType(buf)
  if (!ext) throw new ApiError(400, 'IMAGE_INVALID', 'Only JPG, PNG or WebP photos are allowed.')
  const dir = path.join(UPLOAD_ROOT, folder, String(id))
  fs.mkdirSync(dir, { recursive: true })
  const name = `${crypto.randomBytes(12).toString('hex')}.${ext}`
  fs.writeFileSync(path.join(dir, name), buf)
  return `/uploads/${folder}/${id}/${name}`
}
const saveSalonImage = (salonId, buf) => saveImage('salons', salonId, buf)

// file disk se hata do (sirf apne uploads folder ke andar se)
function deleteUploadedFile(url) {
  const file = path.join(UPLOAD_ROOT, String(url).replace(/^\/uploads\//, ''))
  if (file.startsWith(UPLOAD_ROOT + path.sep)) fs.rm(file, { force: true }, () => {})
}

// DB me "/uploads/..." rakhte hain; mobile ko poora link chahiye, isliye request ke host se jodte hain
function publicUrl(req, stored) {
  if (!stored) return ''
  return stored.startsWith('/uploads/') ? `${req.protocol}://${req.get('host')}${stored}` : stored
}

const MAX_IMAGES = 5

// Photo list badalne ke baad cover hamesha pehli photo hoti he. Photo na bache to (apni upload ki hui) cover hat jaati he.
function syncCover(salon) {
  if (salon.images.length > 0) salon.coverUrl = salon.images[0]
  else if (String(salon.coverUrl).startsWith('/uploads/')) salon.coverUrl = ''
}

function addSalonImage(salon, buf) {
  if (salon.images.length >= MAX_IMAGES) throw new ApiError(409, 'IMAGE_LIMIT', `A salon can have at most ${MAX_IMAGES} photos.`)
  salon.images.push(saveSalonImage(salon._id, buf))
  syncCover(salon)
}

function removeSalonImage(salon, url) {
  if (!salon.images.includes(url)) throw new ApiError(404, 'NOT_FOUND', 'Photo not found.')
  salon.images = salon.images.filter((u) => u !== url)
  syncCover(salon)
  deleteUploadedFile(url)
}

function makeCoverImage(salon, url) {
  if (!salon.images.includes(url)) throw new ApiError(404, 'NOT_FOUND', 'Photo not found.')
  salon.images = [url, ...salon.images.filter((u) => u !== url)]
  syncCover(salon)
}

module.exports = { UPLOAD_ROOT, MAX_BYTES, MAX_IMAGES, saveSalonImage, deleteUploadedFile, addSalonImage, removeSalonImage, makeCoverImage, publicUrl }
