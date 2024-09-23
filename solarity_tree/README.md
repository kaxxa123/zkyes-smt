# Solarity Sparse Merkle Tree

In this project we review the Solarity Sparse Merkle Tree implementation.

This library is based on the Iden3 implementation, however it is meant for reuse. Thus it might be worth understanding to what extent the trade-off between reuse and gas optimization sacrificed gas, to enable use cases we might not be interested in.

Key references:

* [Docs: Solairty - Sparse Merkle Tree](https://docs.solarity.dev/docs/getting-started/guides/libs/data-structures/sparse-merkle-tree)

* [Solairty solidity-lib Github](https://github.com/dl-solarity/solidity-lib)

* [Iden3 Implementation](https://github.com/iden3/contracts/blob/master/contracts/lib/SmtLib.sol)

* [Iden3 SMT Research](https://docs.iden3.io/publications/pdfs/Merkle-Tree.pdf)

* [Voting Solution using this SMT](https://github.com/rarimo/voting-contracts)


Installation:
```BASH
npm install @solarity/solidity-lib
```

Importing:
```JS
import "@solarity/solidity-lib/libs/data-structures/SparseMerkleTree.sol";
```

## Conclusions

Some conclusions that standout follow. Note that this review is crudely written and further verification is required. The goal here is that of highlighting things to watchout for in case we choose to further adopt this SMT implementation. 

1. The library makes extensive use of recursion. This is not a good practice in Solidity programming, where the maximum stack size is limited. 

    For large SMTs, one should analyze the potential of an attack where leaf operations fails due to stack overflow. Can an attacker add leaves such that to block proof-of-ownership for other leaves?

1. Gas consumption is highly dependent on the current tree size. As new leaves are added, the traversal depth and storage access operations required to add a new leaf increases. Thus tree access becomes more expensive over time. 

1. The design is wasteful in storage. This is especially true for the `Node` struct which encapsulates different variables for `MIDDLE` and `LEAF` nodes.

1. The library includes a `getProof` function for creating a proof-of-membership/non-membership on-chain, which is unusual. Such an operation is usually carried out off-chain. This function returns a `Proof` struct. 

    What is more unusual, is the fact that there is no proof verification function that takes as input the same `Proof` struct.

1. The library supports distinct `add`, `update`, `remove` functions. However the opertions cannot be merged. `add` fails if a non-empty leaf with the same address already exists. `update` fails if the leaf is not already present. There is clearly gas savings opportunities in merging these operations.

    Unless we cache additional information, to correctly use these function we first need to search the leaf with `getNodeByKey` and then choose the appropriate function.

1. The hash of parent nodes is completely non-standard and hard to reproduce off-chain. 

    Instead of hashing together the child node hashes, the node ids are hashed. Ids are unique 64-bit numbers assigned to the node when created.

    ```JS 
    struct Node {
        // other fields...
        uint64 childLeft;
        uint64 childRight;
        // other fields...
    }

    hash2_(
        tree.nodes[node_.childLeft].nodeHash, 
        tree.nodes[node_.childRight].nodeHash);
    ```
## struct SMT 

Solarity stores the tree data in a struct of type `SMT`

```JS
struct SMT {
        mapping(uint256 => Node) nodes;
        uint64 merkleRootId;
        uint64 nodesCount;
        uint64 deletedNodesCount;
        uint32 maxDepth;
        bool isCustomHasherSet;
        function(bytes32, bytes32) view returns (bytes32) hash2;
        function(bytes32, bytes32, bytes32) view returns (bytes32) hash3;
    }
```

`nodes` - All tree nodes, are stored as a mapping of `id -> Node`, where the node could be at any level from root to leaf. The id is just a unique number assigned on adding the node. This is unlike the more intuitive `hash -> (left, right)` structure. The zero id is reserved.

`merkleRootId` - Stores the node id assigned to the current root node.

`nodesCount`, `deletedNodesCount` - Stores the total nodes created and the count of nodes deleted.

`maxDepth` - Stores the number of levels the tree supports this has a maximum of 256 reflecting the largest solidity integer size being 256-bits.

`isCustomHasherSet`, `hash2`, `hash3` - Allows for overriding the default keccak256 hashing function.

Note how `merkleRootId` and `nodesCount` are of type `uint64` desipte the node id at the mapping is of type `uint256`, which effectively limits the largest id to 64-bits.


## struct Node 

Each node is stored in a `Node` struct. Thus this struct has to handle different node types (`NodeType`).

```JS
enum NodeType {
    EMPTY,
    LEAF,
    MIDDLE
}

struct Node {
    NodeType nodeType;
    uint64 childLeft;
    uint64 childRight;
    bytes32 nodeHash;
    bytes32 key;
    bytes32 value;
}
```

`nodeType` - One of the`NodeType` enumerations.

`childLeft`, `childRight` - In case of a `MIDDLE` node, store the id of the left and right child nodes. This creates a link to the Node mapping within the SMT struct.

`nodeHash` - Node hash where for... <BR />
 `MIDDLE` nodes `nodeHash = Hash(Left_Hash | Right_Hash)` <BR />
 `LEAF` nodes `nodeHash = Hash(key | value | 1)`. The doc says _1 acts as a domain separator_ i.e. it separates leaves from intermediate nodes.

`key`, `value` - Node address and value in case of a `LEAF` node.

Note how nodes will have unused variables depending on the `nodeType`.

## struct Proof

```JS
struct Proof {
        bytes32 root;
        bytes32[] siblings;
        bool existence;
        bytes32 key;
        bytes32 value;
        bool auxExistence;
        bytes32 auxKey;
        bytes32 auxValue;
    }
```

`root` - Tree root.

`siblings` - An array of sibling hashes.

`existence` - Does the leaf has value or is it empty?

`key`, `value` - Address and value of leaf for which we are proving membership.

`auxExistence`, `auxKey`, `auxValue` - Similar to `existence`, `key` and `value` but help distinguish between node types. 

This structure is only used to generate proofs, which is not very useful since proof generation is normally done off-chain. 


## Other Notes

* [Doc](https://docs.solarity.dev/docs/getting-started/guides/libs/data-structures/sparse-merkle-tree) 
    describes an implementation similar to Vitalik's i.e. one that short-circuits sub-trees 
    that only contain a single non-zero leaf. Thus reading/adding nodes should normally require `log N` steps.

* Solution implements the `Hash(0 | 0) = 0` optimization.

* The core library is private. However 3 wrappers are provided. These only differ by the leaf value type:

    * `UintSMT` - Takes leaf values of type `uint256`.

    * `Bytes32SMT` - Takes leaf values of type `bytes32`.

    * `AddressSMT` - Takes leaf values of type `address`

## Adding a node

Code breakdown of how a new leaf node is added. 
This is especially helpful in understanding how the tree is stored.

```JS
function _add(
    SMT storage tree,
    bytes32 key_,
    bytes32 value_
) private onlyInitialized(tree) {
    // The leaf is initialized without setting
    // its hash this will be set by _add()
    Node memory node_ = Node({
        nodeType: NodeType.LEAF,
        childLeft: ZERO_IDX,
        childRight: ZERO_IDX,
        nodeHash: ZERO_HASH,
        key: key_,
        value: value_
    });

    tree.merkleRootId = uint64(_add(tree, node_, tree.merkleRootId, 0));
}

function _add(
    SMT storage tree,
    Node memory newLeaf_,
    uint256 nodeId_,
    uint16 currentDepth_
) private returns (uint256) {
    // Traverse the tree, getting the current node from its id
    Node memory currentNode_ = tree.nodes[nodeId_];

    // Hitting an EMPTY node ends the traversal. We just set
    // the node here. Note that we don't need to reach the lowest
    // tree level. This is similar to Vitalik's optimization.
    if (currentNode_.nodeType == NodeType.EMPTY) {
        return _setNode(tree, newLeaf_);
    }
    // Hitting a leaf does not mean that we reached the lowest level.
    // It indicates a sub-tree with a single non-zero leaf. Adding a leaf
    // to this subtree transforms it into a two leaf subtree.
    // We thus need to add nodes until again ending up with two single
    // leaf subtrees.
    else if (currentNode_.nodeType == NodeType.LEAF) {
        if (currentNode_.key == newLeaf_.key) {
            revert("SparseMerkleTree: the key already exists");
        }

        // Add new nodes replacing the single leaf sub-tree by
        // two single-leaf subtrees.
        return
            _pushLeaf(tree, newLeaf_, currentNode_, nodeId_, currentDepth_);
    }
    // We hit a MIDDLE node. Nodes in this path need replacing as their
    // hashes will change in order to add the new leaf...
    else {
        uint256 nextNodeId_;

        // Traverse the tree and on the way add new replacement nodes.
        if ((uint256(newLeaf_.key) >> currentDepth_) & 1 == 1) {
            nextNodeId_ = _add(
                tree,
                newLeaf_,
                currentNode_.childRight,
                currentDepth_ + 1
            );

            tree.nodes[nodeId_].childRight = uint64(nextNodeId_);
        } else {
            nextNodeId_ = _add(
                tree,
                newLeaf_,
                currentNode_.childLeft,
                currentDepth_ + 1
            );

            tree.nodes[nodeId_].childLeft = uint64(nextNodeId_);
        }

        tree.nodes[nodeId_].nodeHash = _getNodeHash(
            tree,
            tree.nodes[nodeId_]
        );

        return nodeId_;
    }
}

// Transforms a single non-zero leaf subtree by two such sub-trees.
function _pushLeaf(
    SMT storage tree,
    Node memory newLeaf_,
    Node memory oldLeaf_,
    uint256 oldLeafId_,
    uint16 currentDepth_
) private returns (uint256) {
    require(
        currentDepth_ < tree.maxDepth,
        "SparseMerkleTree: max depth reached"
    );

    Node memory newNodeMiddle_;

    // Extract the address bit that determines wether the new leaf and
    // the existing leaf paths will continue to overlap for this iteration.
    bool newLeafBitAtDepth_ = (uint256(newLeaf_.key) >> currentDepth_) &
        1 ==
        1;
    bool oldLeafBitAtDepth_ = (uint256(oldLeaf_.key) >> currentDepth_) &
        1 ==
        1;

    // Paths overlap! We need to add another level by adding a MIDDLE node
    // On one-side, this will have the two leaf subtree, on the other will
    // have a zero subtree.
    if (newLeafBitAtDepth_ == oldLeafBitAtDepth_) {
        uint256 nextNodeId_ = _pushLeaf(
            tree,
            newLeaf_,
            oldLeaf_,
            oldLeafId_,
            currentDepth_ + 1
        );

        if (newLeafBitAtDepth_) {
            // go right
            newNodeMiddle_ = Node({
                nodeType: NodeType.MIDDLE,
                childLeft: ZERO_IDX, // Zero subtree
                childRight: uint64(nextNodeId_), // Two leaf subtree
                nodeHash: ZERO_HASH, // Will be set shortly...
                key: ZERO_HASH,
                value: ZERO_HASH
            });
        } else {
            // go left
            newNodeMiddle_ = Node({
                nodeType: NodeType.MIDDLE,
                childLeft: uint64(nextNodeId_), // Two leaf subtree
                childRight: ZERO_IDX, // Zero subtree
                nodeHash: ZERO_HASH, // Will be set shortly...
                key: ZERO_HASH,
                value: ZERO_HASH
            });
        }

        return _setNode(tree, newNodeMiddle_);
    }

    // No more path overlap!
    // Add a MIDDLE node that on the left will have one single-leaf subtree
    // and on the right will have the other single-leaf subtree.
    uint256 newLeafId = _setNode(tree, newLeaf_);

    if (newLeafBitAtDepth_) {
        newNodeMiddle_ = Node({
            nodeType: NodeType.MIDDLE,
            childLeft: uint64(oldLeafId_),
            childRight: uint64(newLeafId),
            nodeHash: ZERO_HASH,
            key: ZERO_HASH,
            value: ZERO_HASH
        });
    } else {
        newNodeMiddle_ = Node({
            nodeType: NodeType.MIDDLE,
            childLeft: uint64(newLeafId),
            childRight: uint64(oldLeafId_),
            nodeHash: ZERO_HASH,
            key: ZERO_HASH,
            value: ZERO_HASH
        });
    }

    return _setNode(tree, newNodeMiddle_);
}

function _setNode(
    SMT storage tree,
    Node memory node_
) private returns (uint256) {
    // Computes the hash for nodes of different types LEAF or MIDDLE
    // MIDDLE: nodeHash = Hash(Left_Hash | Right_Hash)
    // LEAF:   nodeHash = Hash(key | value | 1)
    node_.nodeHash = _getNodeHash(tree, node_);

    // Assign a new unique node id and add to the id -> node mapping.
    uint256 newCount_ = ++tree.nodesCount;
    tree.nodes[newCount_] = node_;

    return newCount_;
}
```

## Testing

1. Start clean Reth node

    ```BASH
    rm ~/reth_data/dev -rfv
    rm ~/reth_data/logs -rfv
    reth node --dev  --datadir "~/reth_data/dev"  \
        --log.file.directory "~/reth_data/logs" \
        --dev.block-time 5s
    ```

1. Cleanup earlier deployment, deploy and open console...

    ```BASH
    cd solarity_tree
    rm ./ignition/deployments -rfv

    npx hardhat ignition deploy ./ignition/modules/deploy.ts  --network reth
    npx hardhat console --network reth
    ```

1. Run test

    ```JS
    // Load contract addresses
    const network = await ethers.provider.getNetwork()
    const chain_type = "chain-" + network.chainId.toString()

    fs = require("fs")
    util = require('util')
    readFile = util.promisify(fs.readFile)
    contract_data = await readFile(`./ignition/deployments/${chain_type}/deployed_addresses.json`, 'utf8')
    contract_addrs = JSON.parse(contract_data.split('#').join('_'))

    // Initialize contract instances
    let treeFactory = await ethers.getContractFactory("TokenSnapshot")
    let tree = await treeFactory.attach(contract_addrs.DeployModule_TokenSnapshot)

    // Create tree leaves...
    let accounts = await ethers.getSigners()
    await tree.getLeafValue(accounts[0])
    await tree.recordBalance(accounts[0], 5n*10n**18n)
    await tree.getLeafValue(accounts[0])

    await tree.recordBalance(accounts[1], 5n*10n**18n)
    await tree.recordBalance(accounts[2], 5n*10n**18n)
    await tree.recordBalance(accounts[3], 5n*10n**18n)

    let proof = await tree.pom(accounts[1])
    
    proof.siblings.forEach((hash, idx) => {
        if (hash != '0x0000000000000000000000000000000000000000000000000000000000000000' ) 
            console.log(`${idx} ` + hash)})
    ```