import { createNode, STANDALONE } from './helia_node.js';
import { FsBlockstore } from 'blockstore-fs'
import { FsDatastore } from 'datastore-fs'

export async function createStandaloneNode(blockPath, filePath) {
  const blockstore = new FsBlockstore(blockPath)
  const datastore = new FsDatastore(filePath)

  return await createNode(STANDALONE, blockstore, datastore)
}