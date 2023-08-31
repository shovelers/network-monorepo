import { eventProcessor } from '../broadcast.js';
import { CID } from 'multiformats/cid'

//when no head is present for a relID, add the incoming cid to the heads map
test('add cid from incoming event to heads if head is empty', () => {
  var dag = {}
  var data = JSON.stringify({"relID":"did:key:z6MkfaeF275KQ5iDEM9GHAueLPYuvZcLeSfQfKMc6rd6yWP2did:1did:2","cid":{"/":"bafyreia54byuavvnvas5yo4omlqq5efivsvfz7aix34wegjcavb2evtf6a"}})
  var heads = new Map()

  eventProcessor(dag, data, heads);

  expect(heads.get("did:key:z6MkfaeF275KQ5iDEM9GHAueLPYuvZcLeSfQfKMc6rd6yWP2did:1did:2")).
    toEqual(CID.parse("bafyreia54byuavvnvas5yo4omlqq5efivsvfz7aix34wegjcavb2evtf6a"));
});

//when same cid is present as head, do nothing


//when different cids are present
////case 1: local dag is ahead
////case 2: local dag is behind
////case 3: local dag has different leaves
