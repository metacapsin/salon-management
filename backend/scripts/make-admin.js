// Kisi ko Glamora Super Admin banata hai (ya hata deta hai). Ye sirf server par command se hota hai, kisi API se kabhi nahi.
// Pehle us email se normal register karke email verify kar lo (password wahi se milta hai, yahan koi password nahi maanga jaata).
//
// Chalane ka tareeka:
//   npm run make-admin -- twinkalsen1@gmail.com            (admin banao)
//   npm run make-admin -- twinkalsen1@gmail.com --remove   (admin hatao)
const mongoose = require('mongoose')
const env = require('../src/config/env')
const { User } = require('../src/models')

async function main() {
  const args = process.argv.slice(2)
  const email = args.find((a) => !a.startsWith('--'))?.trim().toLowerCase()
  const remove = args.includes('--remove')
  if (!email) {
    console.error('Email do. Example: npm run make-admin -- you@example.com')
    process.exit(1)
  }

  await mongoose.connect(env.MONGO_URI, { serverSelectionTimeoutMS: 8000 })
  const user = await User.findOne({ normalizedEmail: email })
  if (!user) {
    console.error(`"${email}" se koi user nahi mila. Pehle /register se account banao aur email verify karo.`)
    await mongoose.disconnect()
    process.exit(1)
  }
  if (!remove && !user.verifiedAt) {
    console.error('Is user ka email verify nahi hua. Pehle verify karo, phir dobara chalao.')
    await mongoose.disconnect()
    process.exit(1)
  }

  user.platformRole = remove ? null : 'admin'
  await user.save()
  console.log(remove ? `${email} ab Super Admin nahi hai.` : `${email} ab Super Admin hai.`)
  await mongoose.disconnect()
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
