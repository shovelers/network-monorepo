import { createNode, STANDALONE } from './fs/helia_node.js';
import { FsBlockstore } from 'blockstore-fs'
import { FsDatastore } from 'datastore-fs'
//import { prometheusMetrics } from '@libp2p/prometheus-metrics'

export async function createStandaloneNode(blockPath, filePath) {
  const blockstore = new FsBlockstore(blockPath)
  const datastore = new FsDatastore(filePath)

  // const config = {metrics: prometheusMetrics()}
  const config = {}
  return await createNode(STANDALONE, blockstore, datastore, config)
}