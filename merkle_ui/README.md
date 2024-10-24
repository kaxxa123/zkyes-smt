# Merkle UI

A Sparse Merkle Tree console UI, helping to visualize the changes taking place on adding leaves and proof construction.

![Merkle UI](../merkle_ui.png)


## Getting Started

To build the Merkle Tree UI follow these steps:

```BASH
npm install
npm run build
```

Run the Merkle Tree UI:

```BASH
npm run start
```

Merkle trees can be pre-populated by configuring [tree_config.json](./tree_config.json). This configuration also allows starting the UI with different SMT implementations.

The UI is limited to a maximum tree depth of 10. However one can compute the root of trees of up to depth 256, by configuring [tree_config.json](./tree_config.json) and running:

```BASH
npm run compute
```

<BR />

## tree_config.json

The [tree_config.json](./tree_config.json) is useful in both configuring the initial Merkle UI settings and in quickly computing Merkle roots for a given set of leaves. 

Important Notes:
* The Merkle tree `type` and `hash` function are only configurable from `tree_config.json`. Thus one must use this config file to switch the SMT displayed by the Merkle UI.

* The Merkle UI supports a maximum tree depth of 10. Setting `tree_config.json | "level"` to a greater value will cause the UI to reject the configuration completely and start with default settings.

<BR />

### tree_config.json | type

`tree_config.json | "type":` `"naive"` | `"h0"` | `"short"` | `"shortex"`

Select the type of Merkle tree to use. Each maps to a different Sparse Merkle tree implementation from within the [zkyes-smt library](../merkle/README.md).

|tree_config.json Type       | Library Type      |
|----------------------------|-------------------|
|`naive`                     | `SMTNaive`        |
|`h0`                        | `SMTHashZero`     |
|`short`                     | `SMTSingleLeaf`   |
|`shortex`                   | `SMTSingleLeafEx` |


<BR />

### tree_config.json | hash

`tree_config.json | "hash":` `"keccak256"` | `"poseidon"`

Select the hashing function to use between Keccak256 and Poseidon (over curve bn254).

<BR />

### tree_config.json | level

`tree_config.json | "level":` `2` to `256`

Specify the maximum tree depth. When computing Merkle roots with `npm run compute` levels up to `256` may be used. When running the Merkle UI the maximum allowed `level` is `10`.

<BR />

### tree_config.json | sort_hash

`tree_config.json | "sort_hash":` `true` | `false`

Specify whether the tree should sort sibling hashes when computing parent node hashes. In general it is recommanded to keep this setting to `false`, as it causes loss of information in terms of leaf position. However the OpenZeppelin proof-of-membership verifier requires sorting.

<BR />

### tree_config.json | leaves


`tree_config.json | "leaves": [leaf]` 

An array of leaves to add to the tree. Each leaf is defined by an `index` and `value` pair:

* `leaf | "index":` `0` to `max_leaf_index`

    The leaf index being set, where `max_leaf_index = 2^level - 1`.

* `leaf | "value":` `hex_string`

    The leaf value to be set at the specified index. This value must be a hex string without a leading `0x` prefix. Values will be normalized to 32-byte boundaries, and hashed before insertion into the tree. 


<BR />

## Merkle Tree Library

For details on the reusable Sparse Merkle Tree implmentations check [here](../merkle/README.md).