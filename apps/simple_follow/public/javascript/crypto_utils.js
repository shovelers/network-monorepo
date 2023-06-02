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
  var res = await fetch('/auth/account_creation_challenge?' + new URLSearchParams({handle: handle}))
  var response = await res.json()

  var challenge = new Uint8Array(response.challenge)
  var id = new Uint8Array(response.user["id"])
  var rpName = response.rpName

  var publicKey = {
    'challenge': challenge,

    'rp': {
      'name': rpName,
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
      const publicK = newCredentialInfo.response.getPublicKey();

      (async () => {
        console.log('SUCCESSFULLY GOT A CREDENTIAL!', newCredentialInfo.response);
        const ek = await window.crypto.subtle.importKey("spki", publicK, {name: 'ECDSA', namedCurve: 'P-256'}, true, ['verify']);
        const ke = await window.crypto.subtle.exportKey('jwk', ek);
        const did = keyToDID('key', JSON.stringify(ke));
        document.getElementById('pdid').value = did;
        const doc = await resolveDID(did, "{}");
        document.getElementById('pdoc').value = doc;
        form.submit();
      })()
    })
    .catch((error) => {
      console.log('FAIL', error)
    })
}

async function assertPasskey(){
  var res = await fetch('/auth/login_challenge')
  var response = await res.json()
  var challenge = new Uint8Array(response.challenge)

  var publicKey = {
    challenge: challenge,
    allowCredentials: [],
  }

  navigator.credentials.get({ 'publicKey': publicKey })
  .then((getAssertionResponse) => {
    const assertionResponse = getAssertionResponse.response;
    console.log('signature', assertionResponse.signature);
    console.log('clientDataJSON', assertionResponse.clientDataJSON);
    console.log('userHandle', assertionResponse.userHandle);
    alert('SUCCESSFULLY GOT AN ASSERTION! Open your browser console!')
    console.log('SUCCESSFULLY GOT AN ASSERTION!', getAssertionResponse);
    (async () => {
      valid = await window.crypto.subtle.verify({name: 'ECDSA', namedCurve: 'P-256'}, key, assertionResponse.signature, challenge)
    })()
  })
  .catch((error) => {
    alert('Open your browser console!')
    console.log('FAIL', error);
  })
}

function base64urlEncode(array) {
  const base64 = btoa(String.fromCharCode(...array));
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export { generateKeyAndDID, signChallenge, createPasskey, assertPasskey };
