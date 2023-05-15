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

  async registerGraph(did, doc) {
    await this.axios_client.post('/graph', {did: did, doc: doc})
  }

  async readGraph(graph_did) {
    await this.axios_client.get('/graph/' + graph_did)
  }

  async insertGraph(graph_did, from, to, timestamp) {
    await this.axios_client.post('/graph/' + graph_did , {from: from, to: to, timestamp: timestamp})
  }
}

module.exports = Protocol
