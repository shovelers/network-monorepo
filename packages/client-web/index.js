const DIDKit = require('@spruceid/didkit-wasm-node');

class ProtocolWeb {
  async generateDID(key) {
    var did = DIDKit.keyToDID('key', key);
    var doc = await DIDKit.resolveDID(did, "{}");

    return {did: did, doc: doc}
  }
}

module.exports = ProtocolWeb;
