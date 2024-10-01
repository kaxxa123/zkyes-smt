export type PoM = {
    // Tree root hash
    root: string,

    // Leaf node hash for which membership 
    // is being proven
    leaf: string,

    // Sibling list from levels (root-1) to leaf
    siblings: string[]
};

export interface IMerkle {

    // A descriptive name for the tree type.
    NAME(): string;

    // Get total level count under the root.
    LEVELS_TOTAL(): bigint;

    // Will the tree sort child leaf hashes before 
    // generating the parent's hash
    SORTED_HASH(): boolean;

    // How does this tree read indexes on traversal?
    // true  => LSB-to-MSB
    // false => MSB-to-LSB
    INVERTED_INDEX(): boolean;

    // Empty (zero) leaf preimage.
    ZERO_LEAF_VALUE(): string;

    // Empty (zero) leaf hash.
    HASH_ZERO(): string;

    // Get hash for an empty subtree node at a
    // given level, where level 0 is the root.
    //
    // Inputs 
    //      idx - subtree level
    HASH_ZERO_TREE(idx: number): string;

    // Get root node hash.
    ROOT(): string;

    // Get siblings for a given parent node hash. 
    //
    // Inputs 
    //      parent - parent node hash
    //
    // Returns
    //      array with sibling hashes [left, right]
    //
    //      undefined if parent does not exist or references
    //      a leaf node.
    TREE(parent: string): string[] | undefined;

    // Apply any normalization to preimage values
    //
    // Inputs 
    //      input - hex string to be hashed
    //
    // Returns
    //      normalized hex string 
    normalizePreimage(input: string): string;

    // Hash left and right (optional) sibling values.
    //
    // Inputs 
    //      left - left tree sibling
    //      right - right tree sibling
    //
    // Returns
    //      hash(left | right)
    hash(left: string, right: string): string;

    // Check if the input hash is an "all zero" subtree.
    //
    // Inputs
    //      hash - hash to be checked
    //
    // Returns
    //      true if the hash is one of the zero subtree hashes
    isZeroTree(hash: string, level: number): boolean;

    // Get leaf lowest index/address.
    lowerIndex(): bigint;

    // Get leaf highest index/address.
    upperIndex(): bigint;

    // Add/Remove leaf to/from the tree.
    //
    // Inputs
    //      address - address of leaf to be added.
    //
    //      value - preimage of leaf hash being added.
    //      To remove a leaf set its value to ZERO_LEAF_VALUE.
    //
    // Returns
    //      Hash of added leaf
    addLeaf(address: bigint, value: string): string;

    // Get proof-of-membership or non-membership for the 
    // given leaf address
    //
    // Inputs
    //      address - address of leaf whose proof is to be generated
    // 
    // Returns
    //      PoM stuct containing all the proof elements.
    getProof(address: bigint): PoM;
};

// A thin wrapper that helps classes to merge the
// public interface of a tree instance to their 
// own interface by just inheriting from MerkleWrapper.
export class MerkleWrapper {
    private _tree: IMerkle;

    constructor(tree: IMerkle) {
        this._tree = tree;
    }

    NAME(): string {
        return this._tree.NAME();
    }

    LEVELS_TOTAL(): bigint {
        return this._tree.LEVELS_TOTAL();
    }

    SORTED_HASH(): boolean {
        return this._tree.SORTED_HASH();
    }

    INVERTED_INDEX(): boolean {
        return this._tree.INVERTED_INDEX();
    }

    ZERO_LEAF_VALUE(): string {
        return this._tree.ZERO_LEAF_VALUE();
    }

    HASH_ZERO(): string {
        return this._tree.HASH_ZERO();
    }

    HASH_ZERO_TREE(idx: number): string {
        return this._tree.HASH_ZERO_TREE(idx);
    }

    ROOT(): string {
        return this._tree.ROOT();
    }

    TREE(parent: string): string[] | undefined {
        return this._tree.TREE(parent);
    }

    normalizePreimage(input: string): string {
        return this._tree.normalizePreimage(input);
    }

    hash(left: string, right: string): string {
        return this._tree.hash(left, right);
    }

    isZeroTree(hash: string, level: number): boolean {
        return this._tree.isZeroTree(hash, level);
    }

    lowerIndex(): bigint {
        return this._tree.lowerIndex();
    }

    upperIndex(): bigint {
        return this._tree.upperIndex();
    }

    addLeaf(address: bigint, value: string): string {
        return this._tree.addLeaf(address, value);
    }

    getProof(address: bigint): PoM {
        return this._tree.getProof(address);
    }
}

export enum LOG_LEVEL {
    NONE = 0,
    LOW = 1,
    HIGH = 2,
}