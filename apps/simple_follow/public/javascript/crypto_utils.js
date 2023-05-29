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

function createPasskey() {
  var challenge = "handle";
  var challenge = Uint8Array.from(window.atob(challenge), c=>c.charCodeAt(0))

  var userID = 'Kosv9fPtkDoh4Oz7Yq/pVgWHS8HhdlCto5cR0aBoVMw='
  var id = Uint8Array.from(window.atob(userID), c=>c.charCodeAt(0))

  var publicKey = {
    'challenge': challenge,

    'rp': {
      'name': 'Example Inc.',
    },

    'user': {
      'id': id,
      'name': 'alice@example.com',
      'displayName': 'Alice Liddell'
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
      let attestationObject = CBOR.decode(newCredentialInfo.response.attestationObject);
      console.log('AttestationObject: ', attestationObject);
      let authData = parseAuthData(attestationObject.authData);
      console.log('AuthData: ', authData);
      console.log('AuthData: ', authData);
      const credID = bufToHex(authData.credID);
      console.log('CredID: ', credID);
      console.log('AAGUID: ', bufToHex(authData.aaguid));
      console.log('PublicKey', CBOR.decode(authData.COSEPublicKey.buffer));
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


export { generateKeyAndDID, signChallenge, createPasskey, assertPasskey };
