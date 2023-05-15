const DIDKit = require('@spruceid/didkit-wasm-node');

class Protocol {
  constructor(config) {
    this.base_url = "http://localhost:4000"
  }

  registerUser() {
    console.log("registerUser")

  }

  async generateDID(key) {
    var did = DIDKit.keyToDID('key', key);
    var doc = await DIDKit.resolveDID(did, "{}");

    console.log("generateDID for given key & return DID & DID doc")
    return {did: did, doc: doc}
  }

  registerGraph() {

  }

  insertGraph() {

  }

  readGraph () {

  }
}

module.exports = Protocol
