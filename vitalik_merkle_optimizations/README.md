# Sparse Merkle Tree
## Client Side Optimizations (Vitalik Buterin)

This code was copied from Vitalik's research [github repo](https://github.com/ethereum/research/tree/master/sparse_merkle_tree/) on September 2024.

The code demonstrates a number of optimizations applicable to the client-side Sparse Merkle Tree implementation. These optimizations are discussed in Vitalik's post [here](https://ethresear.ch/t/optimizing-sparse-merkle-trees/3751/5).

The only changes made are cosmetic (mostly comments) that describe the optimization logic.

In all the folder includes 3 SMT implementations:
* [new_bintrie.py](./new_bintrie.py) - This is a naive SMT implementation with a compress/decompress function. This replaces zero subtree hashes from the proof with a set of flags, recording the tree levels from which the hashes where removed.

* [new_bintrie_optimized.py](./new_bintrie_optimized.py) - Implements the optimization discussed in Vitalik's post. This primarily involves short-cutting the tree storage as soon as a sub-tree is exclusivly composed of a single non-zero leaf. Whereas normally a tree is stored as a list of mappings: <BR />
    `parent -> (left_hash, right_hash)`

    ...with this optimization a sub-tree having a single non-zero leaf is terminated with an entry of this type: <BR />
    `parent -> (flag, path, hash)`

    `flag` - identifies that this is a special "tree termination" encoding. <BR />
    `path` - identifies the address/index of the non-zero leaf within the subtree. <BR />
    `hash` - the hash of the non-zero leaf

    This information allows us to stop traversing the tree and immidiately determine whether or not the traversal will hit the non-zero leaf.

* [new_bintrie_hex.py](./new_bintrie_hex.py) - Implements the single non-zero leaf short-cut optimization just discussed, plus a compression trick. The compression reduces the number of levels sotred by a factor of 4. Instead of storing a full binary tree stucture, a parent is made to point at the set of child-nodes found 4 levels underneath it. So the root will point at the nodes at level 4. Level 4 nodes would then point at their child nodes 4 levels underneath them (found at level 8 of the main tree).

    This means that a parent node will point at `2^4 = 16` child-node hashes.

    This is only a client-side optimization. We still assume operation against a regular 256-level Sparse Merkle Tree. The only difference is the change in storage stucture. The parent node hash is still computed by recursively hashing sibling pairs. However this is done for four levels.