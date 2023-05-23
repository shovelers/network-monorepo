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

    return {did: did, doc: doc}
  }


  async  validateKey(handle, did, key) {
    //create verificationMethod using key amd did method
    try {
      var verificationMethod = await DIDKit.keyToVerificationMethod("key", key);
    } catch(e) {
      console.log(e);
      return false;
    }

    //vp is the signed version of proofOptions which has the challenge string
    var proofOptions = {
      proofPurpose: "authentication",
      challenge: `${handle}`,
      verificationMethod: `${verificationMethod}`,
    };
    try {
      var vp = await DIDKit.DIDAuth(did, JSON.stringify(proofOptions), key);
    } catch (error) {
      console.error(error);
      return false;
    }

    //verify the signature in vp
    var verifyOptions = {
      proofPurpose: "authentication",
      challenge: `${handle}`,
    };
    try {
      var response = await DIDKit.verifyPresentation(vp, JSON.stringify(verifyOptions));
    } catch (e) {
      console.log(e);
      return false;
    }
    var result = JSON.parse(response);

    if (result["checks"][0] === "proof") {
      return true;
    } else {
      return false;
    }
  }

  async registerUser(did, doc, profile) {
    await this.axios_client.post('/user', {did: did, doc: doc, profile: profile})
  }

  async registerApp(did, doc) {
    await this.axios_client.post('/app', {did: did, doc: doc})
  }

  async registerGraph(did, doc, app_did) {
    await this.axios_client.post('/graph', {did: did, doc: doc, app_did: app_did})
  }

  async readGraph(graph_did) {
    const response = await this.axios_client.get('/graph/' + graph_did)
      .then(function (response) {
        return response;
      })
      .catch(function (error) {
        console.log(error);
        return error
      });

    return response.data;
  }

  async insertGraph(graph_did, from, to, timestamp) {
    await this.axios_client.post('/graph/' + graph_did , {from: from, to: to, timestamp: timestamp})
  }
}

module.exports = Protocol
