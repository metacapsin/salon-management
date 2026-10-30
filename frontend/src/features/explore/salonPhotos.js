// Salon ki sab photos: uploaded list, na ho to purani single cover photo. Cover hamesha pehli.
export function photosOf(salon) {
  if (salon.images?.length) return salon.images
  return salon.coverUrl ? [salon.coverUrl] : []
}
