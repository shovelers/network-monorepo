import init, { generateEd25519Key, keyToDID, resolveDID, keyToVerificationMethod, DIDAuth } from "./didkit_wasm.js";

await init();

async function generateKeyAndDID(form) {
  const key = JSON.parse(generateEd25519Key());
  var did = document.getElementById('gdid').value;
  if (did.length == 0) {
    did = keyToDID('key', JSON.stringify(key));
    document.getElementById('gdid').value = did;
  }
  const doc = await resolveDID(did, "{}");
  document.getElementById('gdoc').value = doc;
  console.log(`did: ${did}, key:${JSON.stringify(key)}`);

  form.submit();
}

async function signChallenge(form) {
  const key = JSON.parse(document.getElementById('gkey').value);
  const handle = document.getElementById('ghandle').value;
  const did = keyToDID('key', JSON.stringify(key));

  //create verificationMethod using key amd did method
  try {
    var verificationMethod = await keyToVerificationMethod("key", JSON.stringify(key));
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
    var vp = await DIDAuth(did, JSON.stringify(proofOptions), JSON.stringify(key));
  } catch (error) {
    console.error(error);
    return false;
  }
  document.getElementById('gvp').value = vp;
  form.submit();
}

export { generateKeyAndDID, signChallenge };
