const DIDKit = require('@spruceid/didkit-wasm-node');
const axios = require('axios');

class Protocol {
  constructor(config) {
    this.axios_client  = axios.create({
      baseURL: "http://localhost:4000/"
    })
  }

  async generateDID(key) {
    var did = DIDKit.keyToDID('key', key);
    var doc = await DIDKit.resolveDID(did, "{}");

    console.log("generateDID for given key & return DID & DID doc")
    return {did: did, doc: doc}
  }

  async registerUser(did, doc) {
    await this.axios_client.post('/user', {did: did, doc: doc})
  }

  registerGraph() {

  }

  insertGraph() {

  }

  readGraph () {

  }
}

module.exports = Protocol
