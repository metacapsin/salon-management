const mongoose = require('mongoose')
const ApiError = require('./apiError')

// Kai documents ek saath "sab ya kuch nahi" likhne ke liye (SRS section 17).
// Dhyan: transaction ke andar email/OTP jaise network calls mat karo (SRS 17.2).
async function withTransaction(work) {
  const session = await mongoose.startSession()
  try {
    let result
    await session.withTransaction(
      async () => {
        result = await work(session)
      },
      { readConcern: { level: 'majority' }, writeConcern: { w: 'majority' } },
    )
    return result
  } catch (error) {
    if (error?.codeName === 'IllegalOperation' || /replica set|Transaction numbers/i.test(error?.message || '')) {
      throw new ApiError(503, 'SERVER_ERROR', 'Database does not support transactions. Start the replica set with "npm run db".')
    }
    throw error
  } finally {
    await session.endSession()
  }
}

module.exports = { withTransaction }
