# Merkle Tree

Implementation of a Sparse Merkle Tree helping to visualize the changes taking place on adding leaves and proof construction.

Multiple Implemenations are included, introducing different optimizations:

## [merkle_naive.ts](./src/trees/merkle_naive.ts)

Zero subtrees are not stored within the tree structure. Instead only the root hash of such a subtree is stored. Thereafter hashes of child nodes are read from a cache of pre-computed hashes.

    ```
                                    [ f ]
                                  /
                            [ e ]
                          /       \
                    [ d ]           [ 0 ] <-- No child leaves
                  /       \
            [ c ]           [ 0 ] <-- No child leaves
          /       \
    [ a ]           [ b ]
                                    
    ```

## [merkle_h0.ts](./src/trees/merkle_h0.ts)

On top of `merkle_naive`, eliminates the computation of zero hashes by setting empty leaves to `H(0 | 0)` and defining this as: <BR /> 

`H(0 | 0) = 0`

Without this optimization each zero subtree would have a different hash. An empty leaf would have the value `Hash(0)` and a zero subtree one level up would have a  hash of `Hash( Hash(0) | Hash(0) )`


## [merkle_single_leaf.ts](./src/trees/merkle_single_leaf.ts)

On top of `merkle_h0`, implements the optimization described by Vitalik and implemented in python [here](../vitalik_merkle_optimizations/new_bintrie_optimized.py).

The idea is to short-circuit the storage of a subtree with a single non-zero leaf, replacing the subtree with a node that identifies the only non-zero leaf. This information is enough to determine membership/non-membership without persisting all the intermidiate nodes.

This is only a storage-level optimization, the root hash doesn't change when compared to an implementation that does not include such an optimization.

```
                                [ e ]                                          [ e ]
                              /     \                                        /     \
                          [ d ]       [ 0 ]                              [ d ]       [ 0 ]
                  _______/     \                                     ___/     \
            [ c ]              [ i ]            ==>            [ c ]          [ i ]              
            /     \            /     \                         /     \           |
      [ b ]       [ 0 ]  [ 0 ]       [ h ]               [ b ]       [ 0 ]  [7, g, 1] 
      /     \                              \             /     \
[ a ]       [ f ]                          [ g ]   [ a ]       [ f ]
  0           1                              7       0           1 
```

Subtree for 7th leaf is replaced by a tripplet `(leaf_address, leaf_hash, 1)`. The `1` helps identifying the special node encoding.


## [merkle_single_leaf_ex.ts](./src/trees/merkle_single_leaf_ex.ts)

On top of `merkle_single_leaf`, changes the following:

|                   | merkle_single_leaf  | merkle_single_leaf_ex   |
|-------------------|---------------------|-------------------------|
| Leaf element hash | `Hash(value)`       | `Hash(index, value, 1)` |
| Hash for single non-zero leaf subtree | `Hash(Hash(Hash(value), 0), 0)` | `Hash(index, value, 1)` |

* Including the `index` at the leaf preimage ensure all leaf preimages are unique.

* Including the `1` at the leaf preimage separates the domains for leaf and parent hashes.

This eliminates the need to iteratively compute the root of short-circuited subtrees. The downside is that the two trees are not compatible and will produce different root hashes.

This construction requires tree pruning on leaf removal. In a naive tree a leaf 
may be removed simply by setting the leaf hash to the reserved zero hash. This won't be enough here.

Consider the following two trees, both having an identical single non-zero leaf. Yet their roots won't match.

```
          [ parent ] = leaf_hash                  [ parent ] = Hash(0 | leaf_hash)
               |                                  /          \                    
               |                            [ 0 ]           [ leaf_hash ]         
               |                                                  |               
  [leaf_address, leaf_hash, 1]                       [leaf_address, leaf_hash, 1] 
```

Tree pruning ensures a single rapresentation for identical subtrees no matter the order of leaf addition/removal operations.

The need for leaf removal is application specific. We do not predict the need for leaf removal in zkYes and will not support tree pruning. 

__WARNING: merkle_single_leaf_ex does not implement tree pruning. The problem described above can be__
__reproduced using the merkle ui.__

Reproduce this problem as follows:

1. Start with an unsorted 3 level tree.
1. Add leaf index 5. Note how the tree root has the same hash as leaf at index 5.
1. Add leaf index 2.
1. Remove leaf at index 2.
1. The new hash will be different from that in step 2.
