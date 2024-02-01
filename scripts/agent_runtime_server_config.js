/*
Sample
  node scripts/agent_create.js rolodex > apps/rolodex/agent_runtime_config.json

Steps for Messaging Agent
  Get user handle for which to create agent as user input - SHOVEL_ACCOUNT_HANDLE

  generate a key pair for agent - SHOVEL_AGENT_WRITE_KEYPAIR (required for making fullname of agent)
  add agent to a user handle - similar to device-linking
   * make api call to standalone node - requires to be made by an existing agent of handle
   * make an entry in redis - requires to be running on standalone, which has access to redis
  
  Create config file, with following JSON
  {
    SHOVEL_ACCOUNT_HANDLE
    SHOVEL_AGENT_WRITE_KEYPAIR
  }

  Rolodex on startup reads this config json and creates messaging agent runtime
  No config updates
*/

import { RSASigner } from 'iso-signatures/signers/rsa.js'
import { spki } from 'iso-signatures/spki'
import { DIDKey } from 'iso-did/key'

const handle = process.argv[2]

async function generate() {
  const cryptoKeyPair = await crypto.subtle.generateKey(
    {
      name: 'RSASSA-PKCS1-v1_5',
      modulusLength: 2048,
      publicExponent: new Uint8Array([0x01, 0x00, 0x01]),
      hash: { name: 'SHA-256' },
    },

    true,
    ['sign', 'verify']
  )

  const publicKey = await crypto.subtle.exportKey(
    'spki',
    cryptoKeyPair.publicKey
  )
  return new RSASigner(
    DIDKey.fromPublicKey('RSA', spki.decode(new Uint8Array(publicKey))),
    cryptoKeyPair
  )
}

const signer = await generate()
const jwk = await crypto.subtle.exportKey("jwk", signer.export().privateKey)
delete jwk.key_ops

//JWK to ENV -> from ENV

var configFile = {
  "SHOVEL_ACCOUNT_HANDLE": handle,
  "SHOVEL_AGENT_WRITE_KEYPAIR": jwk
}

// Print agent_runtime_config.json
console.log(JSON.stringify(configFile))