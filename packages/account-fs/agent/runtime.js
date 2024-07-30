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
  constructor(type, config) {
    this.type = type
    this.config = config
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
        if (key == SHOVEL_FS_ACCESS_KEY) {
          // convert string to Uint8array
          return uint8arrays.fromString(this.config[key], 'base64url')
        } else if (key == SHOVEL_FS_FOREST_CID) {
          //convert string to Uinst8array
          return CID.parse(this.config[key]).bytes
        }
        else {
          return this.config[key]
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
        //convert uint8arrays to string before save to file
        //TODO: Make the config persist on the config file 
        if (key == SHOVEL_FS_ACCESS_KEY) {
          var valueString = uint8arrays.toString(value, 'base64url')
          return this.config[key] = valueString
        } else if (key == SHOVEL_FS_FOREST_CID) {
          var valueString = CID.decode(value).toString()
          return this.config[key] = valueString
        }
        else {
          return this.config[key] = value
        }
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