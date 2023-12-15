### Testing multinode read-write
1. Public file
* Run `node index.js`
* Copy the Public rootDirCID from backend terminal and run `await readFile(node, <value>)`
* it should print `Hello World 101` 

2. Private File
* Run `node index.js`
* Copy the Access Key byte array from backend terminal and run `var key = new Uint8Array(<value>)` on browser console
* Copy the Forest CID string from backend terminal and run `var forestcid = CID.parse(<value>).bytes` on browser console
* On broswer console run: `await readPrivateFile(node, key, forestcid)`
* it should print `Hello Private World 101`

3. Share Private File
* Run `npm run start`
* Open `localhost:3000` and open console
* copy the server multiaddr from backend terminal logs & run `dial(node, <value>)` on the browser console
* On browser console run `await createExchangeRoot(node)`. this will return Array of 2 values these will be used in next step
* Make a POST request using postman on `localhost:3000/generate_share_label` with body {key: <first value from above array>, cid: <second value from above array>}. As response you will get {shareLabel: <>, forestCid: <>}
* On broswer console run `await acceptShare(node, keypair, <shareLabel>, <forestCid>)`
* it should print `Hello Private World 101` 