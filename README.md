# protocol
DCN Protocol MonoRepo

### DID Doc Example

```
{
"@context":[
  "https://www.w3.org/ns/did/v1",
  {
    "Ed25519VerificationKey2018":"https://w3id.org/security#Ed25519VerificationKey2018",
    "publicKeyJwk":{"@id":"https://w3id.org/security#publicKeyJwk","@type":"@json"}
  }
  ],
"id":"did:key:z6MkgnFNPcaT9v6BrXTPFJhoYkgVtmSxJvovJpFDZji4xSfi",
"verificationMethod":[
  {
    "id":"did:key:z6MkgnFNPcaT9v6BrXTPFJhoYkgVtmSxJvovJpFDZji4xSfi#z6MkgnFNPcaT9v6BrXTPFJhoYkgVtmSxJvovJpFDZji4xSfi",
    "type":"Ed25519VerificationKey2018",
    "controller":"did:key:z6MkgnFNPcaT9v6BrXTPFJhoYkgVtmSxJvovJpFDZji4xSfi",
    "publicKeyJwk":{"kty":"OKP","crv":"Ed25519","x":"IpSlH61SvEWfK-khNh5VBUrzF3y8rR49f50rtv_5EDE"}
  }
],
"authentication":["did:key:z6MkgnFNPcaT9v6BrXTPFJhoYkgVtmSxJvovJpFDZji4xSfi#z6MkgnFNPcaT9v6BrXTPFJhoYkgVtmSxJvovJpFDZji4xSfi"],
"assertionMethod":["did:key:z6MkgnFNPcaT9v6BrXTPFJhoYkgVtmSxJvovJpFDZji4xSfi#z6MkgnFNPcaT9v6BrXTPFJhoYkgVtmSxJvovJpFDZji4xSfi"]
}
```
