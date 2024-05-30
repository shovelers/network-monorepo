### Generating jwk for config file

Use the following commands in browser
1.  ```const keypair = await crypto.subtle.generateKey({name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([0x01, 0x00, 0x01]),  hash: {name: 'SHA-256'}}, true, ['sign', 'verify'])```
2. ```const jwk = await crypto.subtle.exportKey("jwk", keypair.privateKey)```
3. copy jwk to the file