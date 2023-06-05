import init, { generateEd25519Key, keyToDID, resolveDID, keyToVerificationMethod, DIDAuth } from "./didkit_wasm.js";
import './didkit_wasm_bg.wasm'

await init();

async function generateDID(key) {
  var did = keyToDID('key', key);
  var doc = await resolveDID(did, "{}");

  return {did: did, doc: doc}
}

exports.generateDID = generateDID;

