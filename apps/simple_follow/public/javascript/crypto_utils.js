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

async function createPasskey(form) {
  var handle = document.getElementById('phandle').value;
  console.log('handle:', handle)
  var challenge = Uint8Array.from(window.atob(handle), c=>c.charCodeAt(0))

  var id = Uint8Array.from(window.atob(handle), c=>c.charCodeAt(0))

  var publicKey = {
    'challenge': challenge,

    'rp': {
      'name': 'Simple Follow',
    },

    'user': {
      'id': id,
      'name': handle,
      'displayName': handle,
    },

    'pubKeyCredParams': [
      { 'type': 'public-key', 'alg': -8  },
      { 'type': 'public-key', 'alg': -7  },
      { 'type': 'public-key', 'alg': -257  },
    ]
  }

  navigator.credentials.create({ 'publicKey': publicKey })
    .then((newCredentialInfo) => {
      console.log('SUCCESS', newCredentialInfo);
      const publicK = newCredentialInfo.response.getPublicKey();
      console.log('publicK', publicK);
      console.log('alg', newCredentialInfo.response.getPublicKeyAlgorithm());
      (async () => {
        const ek = await window.crypto.subtle.importKey("spki", publicK, {name: 'ECDSA', namedCurve: 'P-256'}, true, ['verify']);
        const ke = await window.crypto.subtle.exportKey('jwk', ek);
        console.log('ek', ek);
        console.log('ke', ke);
        const did = keyToDID('key', JSON.stringify(ke));
        console.log('did:', did);
        document.getElementById('pdid').value = did;
        const doc = await resolveDID(did, "{}");
        document.getElementById('gdoc').value = doc;
        form.submit();
      })()
    })
    .catch((error) => {
      console.log('FAIL', error)
    })
}

function assertPasskey(){
  var cha = "handle";
  var chall = Uint8Array.from(window.atob(cha), c=>c.charCodeAt(0))
  var publicKey = {
    challenge: chall,
    rpId: "localhost",
    allowCredentials: [
    ],
  }

  navigator.credentials.get({ 'publicKey': publicKey })
  .then((getAssertionResponse) => {
      alert('SUCCESSFULLY GOT AN ASSERTION! Open your browser console!')
      console.log('SUCCESSFULLY GOT AN ASSERTION!', getAssertionResponse)
  })
  .catch((error) => {
      alert('Open your browser console!')
      console.log('FAIL', error)
  })
}

function base64urlEncode(array) {
  const base64 = btoa(String.fromCharCode(...array));
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export { generateKeyAndDID, signChallenge, createPasskey, assertPasskey };
