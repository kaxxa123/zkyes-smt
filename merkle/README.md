# Merkle Tree

Implementation of a Sparse Merkle Tree helping to visualize the changes taking place on adding leaves and proof construction.

Multiple Implemenations are included, introducing different optimizations:

* [merkle_naive.ts](./src/trees/merkle_naive.ts) - Zero subtrees are not stored within the tree structure. Instead only the root hash of such a subtree is stored. Thereafter hashes of child nodes are read from a cache of pre-computed hashes.

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

* [merkle_h0.ts](./src/trees/merkle_h0.ts) - On top of `merkle_naive`, eliminates the computation of zero hashes by setting empty leaves to `H(0 | 0)` and defining this as: <BR /> 

    `H(0 | 0) = 0`

    Without this optimization each zero subtree would have a different hash. An empty leaf would have the value `Hash(0)` and a zero subtree one level up would have a  hash of `Hash( Hash(0) | Hash(0) )`


* [merkle_single_leaf.ts](./src/trees/merkle_single_leaf.ts) - On top of `merkle_h0`, implements the optimization described by Vitalik and implemented in python [here](../vitalik_merkle_optimizations/new_bintrie_optimized.py).

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

  Subtree for 7th leaf is replaced by a tripplet `(leaf_address, leaf_hash, 1)`. The `1` helps differentiating the special node encoding. 