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