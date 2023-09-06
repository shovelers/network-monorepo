const DIDKit = require('@spruceid/didkit-wasm-node');
const axios = require('axios');

class Protocol {
  constructor(config) {
    this.axios_client  = axios.create({
      baseURL: "http://localhost:4001/"
    })
    this.axios_client_old  = axios.create({
      baseURL: "http://localhost:4000/"
    })
  }

  async generateDID(key) {
    var did = DIDKit.keyToDID('key', key);
    var doc = await DIDKit.resolveDID(did, "{}");

    return {did: did, doc: doc}
  }

  async validateSign(vp, handle) {
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
    await this.axios_client_old.post('/user', {did: did, doc: doc, profile: profile})
  }

  async registerApp(did, doc) {
    await this.axios_client_old.post('/app', {did: did, doc: doc})
  }

  async registerGraph(name, publickey) {
    await this.axios_client.post('/registry', {name: name, publickey: publickey})
  }

  async readGraph(regID) {
    const response = await this.axios_client.get('/registry/' + regID)
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
    await this.axios_client.post('/event/',
      {regID: regID, to: to, from: from, state: state, sig: sig}
    )
  }

}

module.exports = Protocol
