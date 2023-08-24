import { createHelia } from 'helia'
import { dagCbor } from '@helia/dag-cbor'

const helia = await createHelia()
const d = dagCbor(helia)

const object1 = { to: 'did:1', from: 'did:2', state:'absent' }
const myImmutableAddress1 = await d.add(object1)

const object2 = { to:'did:1', from:'did:2', state:'requested', link: myImmutableAddress1 }
const myImmutableAddress2 = await d.add(object2)

const object3 = { to:'did:1', from:'did:2', state:'present', link: myImmutableAddress2 }
const myImmutableAddress3 = await d.add(object3)

const retrievedObject3 = await d.get(myImmutableAddress3)
console.log('Object3:',  retrievedObject3)

const retrievedObject2 = await d.get(myImmutableAddress2)
console.log(`Object2: ${retrievedObject2}`)

const retrievedObject1 = await d.get(myImmutableAddress1)
console.log(`Object1: ${retrievedObject1}`)
// { link: CID(baguqeerasor...) }

console.log(await d.get(retrievedObject3.link))
console.log(await d.get(retrievedObject2.link))
// { hello: 'world' }
