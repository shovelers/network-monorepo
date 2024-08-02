import { createClient } from 'redis';

const redisURL = process.env.REDIS_URL || "redis://localhost:6379"
const redisClient =  createClient({ url: redisURL });
await redisClient.connect()

const accounts = await redisClient.keys("account:*")

let didToFid = {}

for (let account of accounts) {
  const names = await redisClient.hGet(account, "names")
  if (names.split('@').pop() == 'farcaster') {
    didToFid[account.substring(8)] = parseInt(names.split('@')[0], 10)
  }
}

console.log(`Processing total ${accounts.length}. Farcaster accounts - ${Object.keys(didToFid).length}`)
console.log(didToFid)