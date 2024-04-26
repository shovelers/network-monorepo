import { WnfsBlockstore, Rng } from './helia_wnfs_blockstore_adaptor.js'
import { PrivateDirectory, PrivateForest, PrivateNode, AccessKey } from "wnfs";

export class PrivateFS {
  constructor(helia, appHandle) {
    this.store = new WnfsBlockstore(helia)
    // this.path = [appHandle]
    this.path = ["private"]
    this.rng = new Rng()
  }

  async initialise() {
    const initialForest = new PrivateForest(this.rng)
    const privateDir = new PrivateDirectory(initialForest.emptyName(), new Date(), this.rng)
  
    var { rootDir, forest } = await privateDir.mkdir(this.path, true, new Date(), initialForest, this.store, this.rng);

    this.rootDir = rootDir
    
    var [ accessKey, forest ]  = await this.rootDir.store(forest, this.store, this.rng)
    this.forest = forest
    return accessKey.toBytes()
  }

  async loadForest(accessKey, forestCID) {
    const key = AccessKey.fromBytes(accessKey)
    const forest = await PrivateForest.load(forestCID, this.store)
    console.log("loaded forest:", forest)

    //load private node from PrivateForest using Access key
    var node = await PrivateNode.load(key, forest, this.store)
    console.log("loaded node:", node)

    //find the latest revision of the node
    node = await node.searchLatest(forest, this.store)
    console.log("latest node:", node)

    //load the node as_dir to get the rootDir 
    var rootDir = await node.asDir(forest, this.store)
 
    this.forest = forest
    this.rootDir = rootDir
  }

  async compareWithRemote(remoteCID){
    let remoteForest = await PrivateForest.load(remoteCID, this.store)
    return await this.forest.diff(remoteForest, this.store)
  }

  async mergeWithRemote(remoteCID) {
    let remoteForest = await PrivateForest.load(remoteCID, this.store)
    let mergedForest = await this.forest.merge(remoteForest, this.store)
    this.forest = mergedForest
    console.log("remoteCID :", remoteCID, "mergedCID :", await mergedForest.store(this.store))
    return {mergedForest: mergedForest, mergedForestCID: await mergedForest.store(this.store)}
  }

  async write(filename, content) {
    let file = this.path.concat(filename)

    if (this.rootDir == null) {
      await this.initialise()
    }

    var { rootDir, forest } = await this.rootDir.write(
      file,
      true,
      new TextEncoder().encode(content),
      new Date(),
      this.forest,
      this.store,
      this.rng
    );
    console.log("root after write", rootDir)
    
    this.rootDir = rootDir
    this.forest = forest

    var [ accessKey, forest ]  = await this.rootDir.store(this.forest, this.store, this.rng)

    this.forest = forest

    var forestCID = await forest.store(this.store)
    return [accessKey.toBytes(), forestCID]
  }

  async read(filename) {
    let file = this.path.concat(filename)

    if (this.rootDir == null) {
      await this.initialise()
    }

    var content = await this.rootDir.read(file, true, this.forest, this.store)
    console.log("Files Content:", content);

    return new TextDecoder().decode(content.result)
  }

  async accessKeyForPrivateFile(filename) {
    let file = this.path.concat(filename)

    var node = await this.rootDir.getNode(file, true, this.forest, this.store)
    var [accessKey, forest ] = await node.store(this.forest, this.store, this.rng)

    return accessKey
  }
}

export class PrivateFile {
  constructor(node) {
    this.store = new WnfsBlockstore(node)
  }

  async read(accessKey, forestCID) {
    const key = AccessKey.fromBytes(accessKey)
    const forest = await PrivateForest.load(forestCID, this.store)

    var node = await PrivateNode.load(key, forest, this.store)
    node = await node.searchLatest(forest, this.store)
    var file = await node.asFile(forest, this.store)

    var content = await file.getContent(forest, this.store)
    return new TextDecoder().decode(content)
  }
}