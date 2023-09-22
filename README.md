# protocol
DCN Protocol MonoRepo

### Deployment
We are using fly.io for deployment

In order to do a new deployment
1. In the app repo, generate the dockerfile by calling `npx --yes @flydotio/dockerfile@latest`
2. In the app repo run below command to create app on fly & generate fly.toml
  `flyctl launch --remote-only --ha=false --name=<name> --region=sin`
3. In fly.toml change `auto_stop_machines = false` to prevent restarts when idle
4. Deploy `flyctl deploy --remote-only --ha=false -a=<name>`
Note: the default port exposed in the docker file is 3000

5. For CD
* from the <app> directory generate deployment token using `fly tokens create deploy -x 999999h`
* add this token as a new secret in github repo
* add the deploy step in github workflow file

6. For Custom domain
* Obtain IPs of the App: `flyctl ips list -a <name>`
* Make entry for A, AAAA & CNAme in namecheap
* Cretae Certs: `flyctl certs create -a <name> <custom domain>`
* Cert status: `flyctl certs show -a <name> <custom domain>`, once this succeed you can access the app on <custom domain>


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

### Passkeys/Webauthn resources
* https://medium.com/webauthnworks/introduction-to-webauthn-api-5fd1fb46c285
* https://medium.com/webauthnworks/verifying-fido2-responses-4691288c8770
* https://webauthnworks.github.io/FIDO2WebAuthnSeries/WebAuthnIntro/makeCredExample.html
* https://github.com/WebauthnWorks/FIDO2WebAuthnSeries/blob/master/WebAuthnIntro/makeCredExample.html
* https://simplewebauthn.dev/docs/packages/server#registration

### Demo Instructions

Requirements: 
1. This demo requires node.js to run. 
2. Create a copy of this folder on your local device. 

Steps:

1. Power up the protocol from the protocol repo from terminal and checkout the demo version. Protocol dashboard can be viewed at localhost:4000
```
npm start -w protocol

git checkout demo-0.1
```

2. Start the "Rolodex" application on the protocol, providing the required Twt API token. App can be accessed at localhost:3000
```
npm start -w rolodex
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
4. Creating a user with an existing DID from Rolodex (or other apps on the protocol) allows apps to pull existing relationships for user
