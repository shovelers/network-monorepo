import {keyToDID, resolveDID} from '@spruceid/didkit-wasm';

class ProtocolWeb {
  async generateDID(key) {
    var did = keyToDID('key', key);
    var doc = await resolveDID(did, "{}");

    return {did: did, doc: doc}
  }
}

module.exports = ProtocolWeb;
