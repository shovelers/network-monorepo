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

  var enc = new TextEncoder();
  var challenge = enc.encode(response.challenge)
  var id = enc.encode(response.user["id"])
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
    ],

    'authenticationSelection': {
      'residentKey': 'required'
    }
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

async function assertPasskey(form){
  var handle = document.getElementById('shandle').value;
  console.log('handle param: ', handle);
  var res = await fetch('/did?'+ new URLSearchParams({handle: handle}))
  var did_res = await res.json();
  var did = did_res.did;
  console.log(did);
  var doc = await resolveDID(did, "{}");
  var doc = JSON.parse(doc);
  console.log(doc.verificationMethod);
  var sigingKey = doc.verificationMethod[0].publicKeyJwk;
  console.log('sigingKey', sigingKey);
  const sigingKeyJWK = await window.crypto.subtle.importKey("jwk", sigingKey, {name: 'ECDSA', namedCurve: 'P-256'}, true, ['verify']);
  var res = await fetch('/auth/login_challenge');
  var response = await res.json();
  console.log("Got response: ",response);
  var enc = new TextEncoder();
  var challenge = enc.encode(response.challenge);
  console.log("Got challenge", challenge);

  var publicKey = {
    challenge: challenge,
    allowCredentials: [],
  }

  navigator.credentials.get({ 'publicKey': publicKey })
    .then((getAssertionResponse) => {
      (async () => {
        var assertationResponse = getAssertionResponse.response;
        console.log("ASSERTION Response", assertationResponse);

        // verify signature on server
        var signature = await assertationResponse.signature;
        console.log("SIGNATURE", signature);

        var clientDataJSON = await assertationResponse.clientDataJSON;
        console.log("clientDataJSON", clientDataJSON);

        var authenticatorData = new Uint8Array(await assertationResponse.authenticatorData);
        console.log("authenticatorData", authenticatorData);

        var clientDataHash = new Uint8Array(await window.crypto.subtle.digest("SHA-256", clientDataJSON));
        console.log("clientDataHash", clientDataHash);

        // concat authenticatorData and clientDataHash
        var signedData = new Uint8Array(authenticatorData.length + clientDataHash.length);
        signedData.set(authenticatorData);
        signedData.set(clientDataHash, authenticatorData.length);
        console.log("signedData", signedData);

        var usignature = new Uint8Array(signature);
        var rStart = usignature[4] === 0 ? 5 : 4;
        var rEnd = rStart + 32;
        var sStart = usignature[rEnd + 2] === 0 ? rEnd + 3 : rEnd + 2;
        var r = usignature.slice(rStart, rEnd);
        var s = usignature.slice(sStart);
        var rawSignature = new Uint8Array([...r, ...s]);

        // check signature with public key and signed data
        var verified = await window.crypto.subtle.verify(
          { name: "ECDSA", namedCurve: "P-256", hash: { name: "SHA-256" } },
          sigingKeyJWK,
          rawSignature,
          signedData.buffer
        );
        // verified is now true!
        console.log('verified', verified)
        window.location.href = `profiles?session=${handle}`
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
