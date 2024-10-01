# Merkle Tree Library

This library explores different Spare Merkle tree optimizations. 

One coding goal was the avoidance of recursion. The reason to this is that in Smart Contracts, recursion is discouraged because of stack limitations. Thus, we wanted a typescript implementation that could later serve as a basis for smart contract implementation.
 
## Getting Started

All SMT implemetations expose the IMerkle public interface. Refer to the function documentation [here](https://github.com/kaxxa123/zkyes-smt/blob/main/merkle/src/trees/IMerkle.ts).

1. Install the node package:
    ```BASH
    npm install zkyes-smt
    ```

1. Import the required merkle tree implementation.
    ```JS
    import { SMTSingleLeafEx } from 'zkyes-smt';
    ```

1. Create a tree instance, all SMTs require the same constructor parameters:
    ```JS
    const smt = new SMTSingleLeafEx(
        BigInt(160),     // Number of tree levels
        false);          // Should sibling hashes be sorted? Use false if in doubt
    ```

1. Add leaves, retrieve root and a proof-of-membership:
    ```JS
    smt.addLeaf(BigInt("0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"), (5n * 10n ** 18n).toString(16))
    smt.addLeaf(BigInt("0x70997970C51812dc3A010C7d01b50e0d17dc79C8"), (6n * 10n ** 18n).toString(16))
    smt.addLeaf(BigInt("0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC"), (7n * 10n ** 18n).toString(16))
    smt.addLeaf(BigInt("0x90F79bf6EB2c4f870365E785982E1f101E93b906"), (8n * 10n ** 18n).toString(16))

    let smtRoot = "0x" + smt.ROOT()

    let pom = smt.getProof(BigInt("0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC"))
    ```

<BR />

## SMTNaive

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

<BR />

## SMTHashZero

On top of `SMTNaive`, eliminates the computation of zero hashes by setting empty leaves to `H(0 | 0)` and defining this as: <BR /> 

`H(0 | 0) = 0`

Without this optimization each zero subtree would have a different hash. An empty leaf would have the value `Hash(0)` and a zero subtree one level up would have a  hash of `Hash( Hash(0) | Hash(0) )`

<BR />

## SMTSingleLeaf

On top of `SMTHashZero`, implements the optimization described by Vitalik and implemented in python [here](https://github.com/ethereum/research/tree/master/sparse_merkle_tree/).

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

<BR />

## SMTSingleLeafEx

On top of `SMTSingleLeaf`, changes the following:

|                   | SMTSingleLeaf  | SMTSingleLeafEx   |
|-------------------|---------------------|-------------------------|
| Index reading root-to-leaf traversal  | MSB-to-LSB | LSB-to-MSB   |
| Leaf element hash | `Hash(value)`       | `Hash(index, value, 1)` |
| Hash for single non-zero leaf subtree | `Hash(Hash(Hash(value), 0), 0)` | `Hash(index, value, 1)` |

* Including the `index` at the leaf preimage ensure all leaf preimages are unique.

* Including the `1` at the leaf preimage separates the domains for leaf and parent hashes.

This eliminates the need to iteratively compute the root of short-circuited subtrees. The downside is that the two trees are not compatible and will produce different root hashes.

This construction requires tree pruning on leaf removal. In a naive implementation, a leaf may be removed simply by setting the leaf hash to the reserved zero hash. This won't be enough here. Consider the following two trees, both having an identical single non-zero leaf. Yet their roots won't match.

```
          [ parent ] = leaf_hash                  [ parent ] = Hash(0 | leaf_hash)
               |                                  /          \                    
               |                            [ 0 ]           [ leaf_hash ]         
               |                                                  |               
  [leaf_address, leaf_hash, 1]                       [leaf_address, leaf_hash, 1] 
```

Tree pruning ensures a single rapresentation for identical subtrees no matter the order of leaf addition/removal operations.

The need for leaf removal is application specific. We do not predict the need for leaf removal in zkYes and will not support tree pruning at this stage. 

__WARNING: SMTSingleLeafEx does not implement tree pruning. The problem described above can be reproduced using the Merkle UI available when building from code.__

Reproduce this problem in Merkle UI as follows:

1. Start with an unsorted 3 level tree with `"type": "shortex"`.
1. Add leaf index 5. Note how the tree root has the same hash as leaf at index 5.
1. Add leaf index 2.
1. Remove leaf at index 2.
1. The new hash will be different from that in step 2.
