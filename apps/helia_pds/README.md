### Testing multinode read-write

Test-cases
1. Public file
2. Private file
3. Share private file

Networking scenarios
1. Browser 
2. Standalone
3. Browser -> Standalone
4. Standalone -> Browser
5. Browser -> Standalone -> Browser

### Navigating repo

`src/server`
* runs a nodejs + express server
* runs a helia node, listening over websockets
* creates a Public file using `src/ExamplePulbicFile`
* creates a Private file using `src/ExamplePrivateFile`
* exposes `POST /generate_share` API for the shareing the above example private file

`src/browser`
* Exposes methods in browser to run through console
* `createBrowserNode()` method to create a helia node and `dial()` method to connect with server
* `new ExamplePublicFile(node).write()` methods allows to create a public file, and `read()` to read content
* `ExamplePublicFile.load()` methods allows loading PublicDiretory created on other nodes in network
* Similar methods are available for `ExamplePrivateFile`
* `new Recipient(node)` create a receipient object through which shared files can be accepted.