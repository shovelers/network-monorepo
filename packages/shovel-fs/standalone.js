import { createNode, STANDALONE } from './helia_node.js';
import { FsBlockstore } from 'blockstore-fs'
import { FsDatastore } from 'datastore-fs'
import { prometheusMetrics } from '@libp2p/prometheus-metrics'

export async function createStandaloneNode(blockPath, filePath) {
  const blockstore = new FsBlockstore(blockPath)
  const datastore = new FsDatastore(filePath)

  const config = {metrics: prometheusMetrics()}
  return await createNode(STANDALONE, blockstore, datastore, config)
}