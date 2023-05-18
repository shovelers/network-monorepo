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
### Demo Instructions

Requirements: 
1. This demo requires node.js to run. 
2. Create a copy of this folder on your local device. 

Steps:

1. Power up the protocol from the protocol repo from terminal. Protocol dashboard can be viewed at localhost:4000
```
npm start -w protocol
```

2. Start the "Rolodex" application on the protocol, providing the required Twt API token. App can be accessed at localhost:3000
```
BEARER_TOKEN= <replace_with_token> npm start -w rolodex
```

3. Import your social graph of followers and following by entering your Twt handle
  a. Your profile should be displayed along with a list of followers and following, your social graph
  b. You should be able to download a .csv file of the social graph for your storage

4. Start the "Simple Follow" application on the protocol. App can be accessed at localhost:3002
```
npm start -w simple_follow
```

5. Create a user on Simple Follow app by entering a desired handle
  a. Search for the handle of a profile you want to follow
  b. Enter your handle on their profile to follow them
  c. View your profile to see updated follow list
  
6. The protocol dashboard should display at all steps all the unique users, apps and relationships available on the protocol
  a. Restarting the protocol refreshes the dashboard. 
  b. Restarting applications does not refresh the dashboard. 

Notes:
1. Users are uniquely mapped from app <> protocol
2. Each app's graph is stored independently
3. Relationships are stored based on the app context
