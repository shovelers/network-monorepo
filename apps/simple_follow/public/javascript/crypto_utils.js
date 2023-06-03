import init, { generateEd25519Key, keyToDID, resolveDID, keyToVerificationMethod, DIDAuth } from "./didkit_wasm.js";

await init();

async function createPasskey(form) {
  var handle = document.getElementById('phandle').value;
  var res = await fetch('/did?'+ new URLSearchParams({handle: handle}));
  var resJson = await res.json();
  var did = resJson.did;

  if (did === "undefined") {
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
  } else {
    form.submit();
  }
}

async function assertPasskey(form){
  var handle = document.getElementById('shandle').value;
  var res = await fetch('/did?'+ new URLSearchParams({handle: handle}));
  var resJson = await res.json();
  var did = resJson.did;

  if (did === "undefined") {
    document.getElementById('shandleAlreadyTaken').value = false;
    console.log("I am here");
    form.submit();
  } else {
    document.getElementById('shandleAlreadyTaken').value = true;
    var doc = await resolveDID(did, "{}");
    var doc = JSON.parse(doc);
    var sigingKey = doc.verificationMethod[0].publicKeyJwk;
    const sigingKeyJWK = await window.crypto.subtle.importKey("jwk", sigingKey, {name: 'ECDSA', namedCurve: 'P-256'}, true, ['verify']);
    var res = await fetch('/auth/login_challenge');
    var response = await res.json();
    var enc = new TextEncoder();
    var challenge = enc.encode(response.challenge);

    var publicKey = {
      challenge: challenge,
      allowCredentials: [],
    }

    navigator.credentials.get({ 'publicKey': publicKey })
      .then((getAssertionResponse) => {
        (async () => {
          var assertationResponse = getAssertionResponse.response;

          // verify signature on server
          var signature = await assertationResponse.signature;

          var clientDataJSON = await assertationResponse.clientDataJSON;

          var authenticatorData = new Uint8Array(await assertationResponse.authenticatorData);

          var clientDataHash = new Uint8Array(await window.crypto.subtle.digest("SHA-256", clientDataJSON));

          // concat authenticatorData and clientDataHash
          var signedData = new Uint8Array(authenticatorData.length + clientDataHash.length);
          signedData.set(authenticatorData);
          signedData.set(clientDataHash, authenticatorData.length);

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
          if (verified === true) {
            document.getElementById('svalidated').value = true;

            form.submit();
          } else {
            document.getElementById('svalidated').value = false;

            form.submit();
          }
        })()
      })
      .catch((error) => {
        alert('Open your browser console!')
        console.log('FAIL', error);
      })
  };
}

function base64urlEncode(array) {
  const base64 = btoa(String.fromCharCode(...array));
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export { generateKeyAndDID, signChallenge, createPasskey, assertPasskey };
