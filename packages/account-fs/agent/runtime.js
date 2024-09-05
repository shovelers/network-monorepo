import { RSASigner } from 'iso-signatures/signers/rsa.js'
import { DIDKey } from 'iso-did/key';
import { spki } from 'iso-signatures/spki'
import { CID } from 'multiformats/cid'
import * as uint8arrays from 'uint8arrays';
import localforage from "localforage";

const SHOVEL_FS_ACCESS_KEY = "SHOVEL_FS_ACCESS_KEY"
const SHOVEL_FS_FOREST_CID = "SHOVEL_FS_FOREST_CID"
const SHOVEL_AGENT_WRITE_KEYPAIR = "SHOVEL_AGENT_WRITE_KEYPAIR"

export const BROWSER_RUNTIME=1
export const SERVER_RUNTIME=2
// localforage vs config json, Unknown device-linking/Agent add - assuming config file as given

export class Runtime {
  constructor(type, config, redisClient = null) {
    this.type = type
    this.config = config
    if(this.type === SERVER_RUNTIME) {
      this.redisClient = redisClient
    }
  }

  // Read config from file
  // SERVER_RUNTIME - Keypair importJWK and fail on missing
  async signer(){
    switch(this.type){
      case BROWSER_RUNTIME: 
        let keypair = await this.getItem(SHOVEL_AGENT_WRITE_KEYPAIR)
        if (keypair) {
          return RSASigner.import(keypair)
        }

        const signer = await RSASigner.generate()
        await this.setItem(SHOVEL_AGENT_WRITE_KEYPAIR, signer.export())
        
        return signer
      case SERVER_RUNTIME:
        const jwk = await this.getItem(SHOVEL_AGENT_WRITE_KEYPAIR)
        if (!jwk) {
          throw "MissingAgentKeyPair"
        }
        const publicKeyJWK = await crypto.subtle.importKey(
          'jwk',
          { ...jwk, d: undefined },
          {
            name: 'RSASSA-PKCS1-v1_5',
            hash: 'SHA-256',
          },
          true,
          ['verify']
        )
    
        const publicKey = await crypto.subtle.exportKey('spki', publicKeyJWK)
        const decodedPublicKey = spki.decode(new Uint8Array(publicKey))

        const did = DIDKey.fromPublicKey('RSA', decodedPublicKey)

        return await RSASigner.importJwk(jwk, did)
      default:
        throw "InvalidRuntime from signer"
    }
  }

  async getItem(key) {
    switch(this.type){
      case BROWSER_RUNTIME:
        return await localforage.getItem(key)
      case SERVER_RUNTIME:
          if (key == SHOVEL_AGENT_WRITE_KEYPAIR) {
            return this.config[SHOVEL_AGENT_WRITE_KEYPAIR]
          }
          const signer = await this.signer();
          const fullKey = `agent:${signer.did}:${key}`
          let value = await this.redisClient.get(fullKey);
          if(!value) {
              //return value from config if absent in redis to avoid issues
              value = this.config[key];
              await this.redisClient.set(fullKey, value);
          }
          if (key == SHOVEL_FS_ACCESS_KEY) {
            // convert string to Uint8array
            return uint8arrays.fromString(value, 'base64url')
          } else if (key == SHOVEL_FS_FOREST_CID) {
            //convert string to Uinst8array
            return CID.parse(value).bytes
          }
          else {
            return value
          }
      default:
        throw "InvalidRuntime from getItem"
    }
  }
 
  async setItem(key, value) {
    switch(this.type){
      case BROWSER_RUNTIME:
        return await localforage.setItem(key, value)
      case SERVER_RUNTIME:
          if (key == SHOVEL_AGENT_WRITE_KEYPAIR) {
            return this.config[key] = value
          }
          const signer = await this.signer();
          const fullKey = `agent:${signer.did}:${key}`
          //convert uint8arrays to string before save to file
          let valueString;
          if (key == SHOVEL_FS_ACCESS_KEY) {
            valueString = uint8arrays.toString(value, 'base64url')
          } else if (key == SHOVEL_FS_FOREST_CID) {
            valueString = CID.decode(value).toString()
          }
          else {
            valueString = value
          }
          return await this.redisClient.set(fullKey, valueString);
      default:
        throw "InvalidRuntime from setItem"
    }
  }

  async removeItem(key) {
    switch(this.type){
      case BROWSER_RUNTIME:
        return await localforage.removeItem(key)
      case SERVER_RUNTIME:
        throw "NotImplementedInRuntime"
      default:
        throw "InvalidRuntime for removeItem"
    }
  }
}