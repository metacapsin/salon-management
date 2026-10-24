// Local development ke liye MongoDB ko "replica set" ki tarah chalata hai (port 27018).
// Kyun: booking/billing ke transactions sirf replica set par chalte hain (SRS section 17).
// Ye aapke Windows wale MongoDB service ko nahi chhuta. Data project ke .data/mongo folder me rehta hai.
const { spawn } = require('child_process')
const fs = require('fs')
const path = require('path')
const mongoose = require('mongoose')

const PORT = 27018
const DB_PATH = path.join(__dirname, '..', '.data', 'mongo')
const CANDIDATES = [
  process.env.MONGOD_PATH,
  'C:/Program Files/MongoDB/Server/9.0/bin/mongod.exe',
  'C:/Program Files/MongoDB/Server/8.0/bin/mongod.exe',
  'C:/Program Files/MongoDB/Server/7.0/bin/mongod.exe',
  'mongod',
].filter(Boolean)

const mongodPath = CANDIDATES.find((p) => p === 'mongod' || fs.existsSync(p))
fs.mkdirSync(DB_PATH, { recursive: true })

const child = spawn(
  mongodPath,
  ['--replSet', 'rs0', '--port', String(PORT), '--dbpath', DB_PATH, '--bind_ip', '127.0.0.1'],
  { stdio: ['ignore', 'ignore', 'inherit'] },
)
child.on('error', (e) => {
  console.error('Could not start mongod:', e.message, '\nSet MONGOD_PATH to your mongod.exe path.')
  process.exit(1)
})
child.on('exit', (code) => process.exit(code ?? 0))
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => child.kill())

async function initiate() {
  for (let i = 0; i < 30; i++) {
    try {
      const conn = await mongoose
        .createConnection(`mongodb://127.0.0.1:${PORT}/?directConnection=true`, { serverSelectionTimeoutMS: 1000 })
        .asPromise()
      const admin = conn.db.admin()
      try {
        await admin.command({ replSetGetStatus: 1 })
      } catch {
        await admin.command({
          replSetInitiate: { _id: 'rs0', members: [{ _id: 0, host: `127.0.0.1:${PORT}` }] },
        })
      }
      await conn.close()
      console.log(`MongoDB replica set ready on mongodb://127.0.0.1:${PORT} (rs0). Keep this window open.`)
      return
    } catch {
      await new Promise((r) => setTimeout(r, 1000))
    }
  }
  console.error('MongoDB did not become ready in time.')
}
initiate()
