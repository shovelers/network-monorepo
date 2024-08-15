import { createClient } from 'redis';
import { FsBlockstore } from 'blockstore-fs'
import { FsDatastore } from 'datastore-fs'
import { createHelia } from 'helia';
import { car } from '@helia/car'
import { CarWriter } from '@ipld/car'
import { Readable } from 'node:stream'
import nodeFs from 'node:fs'
import { fileURLToPath } from 'url';
import path from 'path';
import { CID } from 'multiformats/cid'

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename).split("/").slice(0, -1).join("/");
const homeDir = path.join(__dirname, 'hub/protocol_db')
console.log("Connecting to Helia store:", homeDir)

const redisURL = process.env.REDIS_URL || "redis://localhost:6379"
const redisClient = createClient({ url: redisURL });
await redisClient.connect()

const accountDID = process.argv[2]
const head = await redisClient.hGet(`account:${accountDID}`, 'head')

if (head) {
  console.log(`Fetching ${head} for ${accountDID}`)

  const blockstore = new FsBlockstore(path.join(homeDir, 'blocks'))
  const datastore = new FsDatastore(path.join(homeDir, 'data'))

  const helia = await createHelia({datastore, blockstore})

  const c = car({blockstore, dagWalkers: helia.pins.dagWalkers})

  let parsedCid = CID.parse(head)
  const { writer, out } = CarWriter.create(parsedCid)
  const readableStream = Readable.from(out);
  readableStream.pipe(nodeFs.createWriteStream(`${accountDID}.car`));
  await c.export(parsedCid,writer)

  console.log(`published ${accountDID}.car file`)
} else {
  console.log("missing accountDID:", accountDID)
}
