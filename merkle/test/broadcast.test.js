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
test('do nothing if cid from incoming event is same as head', () => {
  var dag = {}
  var data = JSON.stringify({"relID":"did:key:z6MkfaeF275KQ5iDEM9GHAueLPYuvZcLeSfQfKMc6rd6yWP2did:1did:2","cid":{"/":"bafyreia54byuavvnvas5yo4omlqq5efivsvfz7aix34wegjcavb2evtf6a"}})
  var heads = new Map()
  heads.set("did:key:z6MkfaeF275KQ5iDEM9GHAueLPYuvZcLeSfQfKMc6rd6yWP2did:1did:2", CID.parse("bafyreia54byuavvnvas5yo4omlqq5efivsvfz7aix34wegjcavb2evtf6a"))

  eventProcessor(dag, data, heads);

  expect(heads.get("did:key:z6MkfaeF275KQ5iDEM9GHAueLPYuvZcLeSfQfKMc6rd6yWP2did:1did:2")).
    toEqual(CID.parse("bafyreia54byuavvnvas5yo4omlqq5efivsvfz7aix34wegjcavb2evtf6a"));
});

//when different cids are present
describe('when cid and head both are distict', () => {
////case 1: local dag is ahead
  test('local dag is ahead, keep local head', () => {
    var dag = {}
    var data = JSON.stringify({"relID":"did:key:z6MkfaeF275KQ5iDEM9GHAueLPYuvZcLeSfQfKMc6rd6yWP2did:1did:2","cid":{"/":"bafyreifqo2l53siceyx47j77zrgd6rzzwzxp7qmlj6o5y2tdp3pcqbv35e"}})
    var heads = new Map()
    heads.set("did:key:z6MkfaeF275KQ5iDEM9GHAueLPYuvZcLeSfQfKMc6rd6yWP2did:1did:2", CID.parse("bafyreig7wf3ph4o3c5bwth5pmzja53kzpk3ihzc5bxjc7h3qmnvjchmnpi"))

    eventProcessor(dag, data, heads);

    expect(heads.get("did:key:z6MkfaeF275KQ5iDEM9GHAueLPYuvZcLeSfQfKMc6rd6yWP2did:1did:2")).
      toEqual(CID.parse("bafyreig7wf3ph4o3c5bwth5pmzja53kzpk3ihzc5bxjc7h3qmnvjchmnpi"));
  })
////case 2: local dag is behind
  test('local dag is behind, set event cid as head', () => {
    var dag = {}
    var data = JSON.stringify({"relID":"did:key:z6MkfaeF275KQ5iDEM9GHAueLPYuvZcLeSfQfKMc6rd6yWP2did:1did:2","cid":{"/":"bafyreig7wf3ph4o3c5bwth5pmzja53kzpk3ihzc5bxjc7h3qmnvjchmnpi"}})
    var heads = new Map()
    heads.set("did:key:z6MkfaeF275KQ5iDEM9GHAueLPYuvZcLeSfQfKMc6rd6yWP2did:1did:2", CID.parse("bafyreifqo2l53siceyx47j77zrgd6rzzwzxp7qmlj6o5y2tdp3pcqbv35e"))

    eventProcessor(dag, data, heads);

    expect(heads.get("did:key:z6MkfaeF275KQ5iDEM9GHAueLPYuvZcLeSfQfKMc6rd6yWP2did:1did:2")).
      toEqual(CID.parse("bafyreig7wf3ph4o3c5bwth5pmzja53kzpk3ihzc5bxjc7h3qmnvjchmnpi"));
  })
});
////case 3: local dag has different leaves, merge to create new node
