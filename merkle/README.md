# Merkle Tree Library

This library explores different Spare Merkle tree optimizations. 

One coding goal was the avoidance of recursion. The reason to this is that in Smart Contracts, recursion is discouraged because of stack limitations. Thus, we wanted a typescript implementation that could later serve as a basis for smart contract implementation.
 
## Getting Started

All SMT implemetations expose the IMerkle public interface. Refer to the function documentation [here](https://github.com/kaxxa123/zkyes-smt/blob/main/merkle/src/IMerkle.ts).

1. Install the node package:
    ```BASH
    npm install zkyes-smt
    ```

1. Import the required merkle tree implementation.
    ```JS
    import { SMTSingleLeafEx } from 'zkyes-smt';
    ```

1. Import some hashing function library.
    ```JS
    import { ethers } from "ethers";
    ```

1. Create a tree instance, all SMTs require the same constructor parameters:
    ```JS
    const HashKeccak256 = (preimage: string) => ethers.keccak256("0x" + preimage).slice(2);    
    const smt = new SMTSingleLeafEx(
        HashKeccak256,    // Hash function
        BigInt(160),      // Number of tree levels
        false);           // Should sibling hashes be sorted? Use false if in doubt
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

|                   | SMTSingleLeaf       | SMTSingleLeafEx   |
|-------------------|---------------------|-------------------------|
| Index reading root-to-leaf traversal    | MSB-to-LSB | LSB-to-MSB |
| Leaf element hash | `Hash(value)`       | `Hash(index, value, 1)` |
| Hash for single non-zero leaf subtree   | `Hash(Hash(Hash(value), 0), 0)` | `Hash(index, value, 1)` |
| Leave are stored as...                  | `(leaf_address, leaf_hash, 1)`  | `(leaf_address, value, 1)` |

* Including the `index` within the leaf preimage ensure leaf preimage uniqueness/collision reistance.

* Including the `1` at the leaf preimage separates the domains for leaf and parent hashes.

* Storing leaf `values` rather than leaf hashes is necessary for proof-of-non-membership.

`SMTSingleLeafEx` eliminates the need to iteratively compute the root of single-leaf subtrees. As a result, `SMTSingleLeafEx` and `SMTSingleLeaf` are not compatible and produce different root hashes.

### Tree Structure

Unlike other SMT implementations the tree includes an additional level for stroring the leaf preimage. The following depicts what a full 2 level tree looks like (ignoring optimizations).

```
             ___[ R ]___                   Level 0 - Root
           /             \    
      [   ]               [   ]            Level 1
     /     \             /     \
  [   ]   [   ]       [   ]   [   ]        Level 2 - Hash(leaf)
    |       |           |       |
 [0,a,1] [1,b,1]     [2,c,1]   [3,d,1]     Leaf preimage
    0       1           2         3

Note that for simplicity we are assuming leaves have
sequential indexes which is not the case in SMTSingleLeafEx    
```

### Leaf Removal

`SMTSingleLeafEx` requires tree pruning on leaf removal. In a naive implementation, a leaf may be removed simply by setting the leaf hash to the reserved zero hash. This won't be enough here. Consider the following two trees, both having identical leaves. Yet their roots won't match.

```
          [ parent ] = leaf_hash                  [ parent ] = Hash(0 | leaf_hash)
               |                                  /          \                    
               |                            [ 0 ]           [ leaf_hash ]         
               |                                                  |               
   [leaf_address, value, 1]                           [leaf_address, value, 1] 
```

Tree pruning ensures a single rapresentation for identical trees no matter the order of leaf addition/removal operations.

The need for leaf removal is application specific.  

__WARNING: SMTSingleLeafEx does not implement tree pruning. The problem described above can be reproduced using the Merkle UI (available when building from code).__

Reproduce this problem in Merkle UI as follows:

1. Start with an unsorted 3 level tree with `"type": "shortex"`.
1. Add leaf index 5. Note how the tree root has the same hash as leaf at index 5.
1. Add leaf index 2.
1. Remove leaf at index 2.
1. The new hash will be different from that in step 2.


### Proof-of-Non-membership

In `SMTSingleLeafEx` proof-of-non-membership can take two forms, depending on where the empty leaf is located.

#### Proof-of-Empty-Leaf-Membership
```
             ___[ R ]___
           /             \    
      [ c ]               [ 0 ] 
     /     \             /     \
  [ b ]   [ e ]        [ x ]  [ x ]
    |       |            |      |
 [0,a,1] [1,d,1]       [ x ]  [ x ]
    0       1            2      3

Note that for simplicity we are assuming leaves have
sequential indexes which is not the case in SMTSingleLeafEx
```

In this example proof-of-non-membership, for leaf 2 or 3, requires a proof-of-membership for the empty leaf hash at the desired leaf position. This is identical to proof-of-non-membership in a standard sparse merkle tree.


#### Proof-of-Auxiliary-Membership
```
                           [ R ]
                          /     \
                      [ e ]       [ 0 ]
                  ___/     \
            [ d ]          [ i ]              
           /     \           |
      [ c ]       [ 0 ]  [7, h, 1] 
     /     \
 [ b ]     [ g ]
   |         |
[0,a,1]   [1,f,1]
   0         1 

Note that for simplicity we are assuming leaves have
sequential indexes which is not the case in SMTSingleLeafEx
```

Node `i` is the parent for leaf index range `[4,7]`, out of which only `7` is set.
To prove non-membership of any of the leaves `[4,6]`:

1. Prove that the auxiliary leaf hash matches `Hash(7 | h | 1)`. 
1. Prove membership of auxiliary leaf.
1. Prove that the auxiliary leaf is the root of a subtree that includes the required empty leaf.

The above in necessary since we are proving non-membership of one leaf by proving membership of another leaf. Hence we also need to prove the relative positions of the two leaves. 

To perform these proofs the auxiliary leaf `value` is required. This allows us to recompute the leaf hash ensuring the auxiliary leaf truly has the claimed `index`.

__Note: `SMTSingleLeafEx::getProof` returns a `PoM` stucture that lacks auxiliary node information. Hence one cannot perform proof-of-non-membership.__