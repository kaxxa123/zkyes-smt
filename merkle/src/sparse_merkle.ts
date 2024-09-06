import { ethers } from "ethers";

export const EMPTY_LEAF = Buffer.from("null", "utf8").toString('hex');

// A Sparse Merkle Tree allowing to generate proofs-of-membership
// and proofs-of-non-membership.
export class SMT {
    private _levels: bigint;
    private _hashZero: string;
    private _hashZeroTree: string[];
    private _tree: Map<string, string[]>;
    private _root: string;
    private _sorthash: boolean;

    // Initilze Sparse Merkle Tree instance.
    //
    // Inputs 
    //      lvl - number of node levels under the root node.
    //
    //      sorthash - if true, hash(left, right) will first  
    //      sort the left and right values smallest first (left).
    constructor(lvl: bigint, sorthash: boolean = false) {
        this._levels = lvl;
        this._sorthash = sorthash;
        this._hashZero = this._hash(EMPTY_LEAF);
        this._hashZeroTree = this._computeZeroTree();
        this._tree = new Map();
        this._root = this._hashZeroTree[0];
    }

    // Get total level count under the root.
    LEVELS_TOTAL(): bigint {
        return this._levels;
    }

    // Get hash for an empty leaf.
    HASH_ZERO(): string {
        return this._hashZero;
    }

    // Get hash for an empty subtree node at a
    // given level, where level 0 is the root.
    //
    // Inputs 
    //      idx - subtree level
    HASH_ZERO_TREE(idx: number): string {
        return this._hashZeroTree[idx];
    }

    // Get root node hash.
    ROOT(): string {
        return this._root;
    }

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
    TREE(parent: string): string[] | undefined {
        return this._tree.get(parent);
    }

    // If the input string is not empty, front-pad the string
    // with zeros to reach a length of 64.
    //
    // Inputs 
    //      input - input to be hashed
    private _pad32bytes(input: string): string {
        if (input.length > 64)
            throw "Input hex string too long.";

        if (input.length === 0)
            return "";

        return input.padStart(64, '0')
    }

    // Sort the two inputs, smallest first ready for 
    // "sorted" hashing mode.
    //
    // Inputs 
    //      left - left tree sibling
    //      right - right tree sibling
    //
    // Returns
    //      Array with sorted [left, right] siblings
    private _sortHashInputs(left: string, right: string): [string, string] {
        if (right.length === 0)
            return [left, right];

        if (left.length === 0)
            return [right, left];

        let ileft = BigInt("0x" + left);
        let iright = BigInt("0x" + right);

        return (iright < ileft) ? [right, left] : [left, right];
    }

    // Hash left and right (optional) sibling values.
    //
    // Inputs 
    //      left - left tree sibling
    //      right - right tree sibling
    //
    // Returns
    //      hash(left | right)
    private _hash(left: string, right: string = ""): string {
        if (this._sorthash) {
            [left, right] = this._sortHashInputs(left, right);
        }

        // Will always generate a 256-bit hash with leading zeros (if needed)
        return ethers.keccak256("0x" + this._pad32bytes(left) + this._pad32bytes(right)).slice(2);
    }

    // Computes the node hash for all possible
    // "all zero" subtrees.
    //
    // Returns
    //      Array of hashes of all possible zero subtrees
    //      starting from a zero root and ending with a
    //      zero leaf.
    private _computeZeroTree(): string[] {
        const cache = []
        let lastHash = this.HASH_ZERO();

        // Zero Leaf
        cache.push(lastHash)
        for (let level = 0; level < this.LEVELS_TOTAL(); ++level) {
            lastHash = this._hash(lastHash, lastHash)
            cache.push(lastHash)
        }

        return cache.reverse();
    }

    // Check if the input hash is an "all zero" subtree.
    //
    // Inputs
    //      hash - hash to be checked
    //
    // Returns
    //      true if the hash is one of the zero subtree hashes
    isZeroTree(hash: string): boolean {
        return (this._hashZeroTree.indexOf(hash) != -1);
    }

    // Get leaf lowest index/address.
    lowerIndex(): bigint {
        return 0n;
    }

    // Get leaf highest index/address.
    upperIndex(): bigint {
        return (2n ** this.LEVELS_TOTAL()) - 1n;
    }

    // Given a leaf address get the siblings
    // forming the path to the root. Optionaly 
    // delete all nodes that will be replaced on 
    // writing the new leaf value.
    //
    // Inputs
    //      address - leaf address
    //
    //      doDelete - if true, delete nodes that are to be replaced
    //      on setting the leaf.
    //
    // Returns
    //      Array of siblings starting from the highest level (the level 
    //      immidiately under the root) to the lowest (the leaf level).
    private _extractSiblings(address: bigint, doDelete: boolean = false): string[] {
        let node = this.ROOT();
        let bitmask = 1n << (this.LEVELS_TOTAL() - 1n)
        let zero = false;
        let toRead: string[] = [];

        if ((address < this.lowerIndex()) || (address > this.upperIndex()))
            throw "Invalid leaf address!";

        // Read adjecent nodes
        for (let pos = 0; pos < this.LEVELS_TOTAL(); ++pos) {
            zero = zero || (this.isZeroTree(node));

            // 1 =>    Read Left, Change Right
            // 0 =>  Change Left,   Read Right
            if (address & bitmask) {
                if (zero) {
                    toRead.push(this.HASH_ZERO_TREE(pos + 1))
                } else {
                    let subtree = this._tree.get(node);

                    if (subtree === undefined)
                        throw `Node not found in tree! ${node}`;

                    if (doDelete)
                        this._tree.delete(node);

                    toRead.push(subtree[0])
                    node = subtree[1]
                }
            }
            else {
                if (zero) {
                    toRead.push(this.HASH_ZERO_TREE(pos + 1));
                } else {
                    let subtree = this._tree.get(node);

                    if (subtree === undefined)
                        throw `Node not found in tree! ${node}`;

                    if (doDelete)
                        this._tree.delete(node);

                    toRead.push(subtree[1])
                    node = subtree[0]
                }
            }

            // next bit
            bitmask >>= 1n;
        }

        return toRead
    }

    // Compute the set of node values to be updated
    // on setting the leaf at the given address.
    //
    // Inputs
    //      address - address of leaf being set
    //
    //      value - value of leaf hash preimage or be set
    //
    //      siblings - array of siblings covering the path
    //      from the leaf being set to the root.
    //
    // Returns
    //      Array of hashes from root to leaf.
    private _computeUpdatedNodes(address: bigint, value: string, siblings: string[]): string[] {
        let bitmask = 1n;
        let toWrite = [];

        if (BigInt(siblings.length) != this.LEVELS_TOTAL())
            throw "Unexpected length of siblings array!";

        if ((address < this.lowerIndex()) || (address > this.upperIndex()))
            throw "Invalid leaf address!";

        //Hash of leaf value...
        let newValue = this._hash(value)

        for (let pos = 0; pos < this.LEVELS_TOTAL(); ++pos) {

            toWrite.push(newValue)

            // 1 =>    Read Left, Change Right
            // 0 =>  Change Left,   Read Right
            if (address & bitmask) {
                newValue = this._hash(siblings[siblings.length - 1 - pos], newValue)
                // console.log(`Write Right: ${toWrite[toWrite.length - 1]}`)
            }
            else {
                newValue = this._hash(newValue, siblings[siblings.length - 1 - pos])
                // console.log(`Write Left: ${toWrite[toWrite.length - 1]}`)
            }

            // next bit
            bitmask <<= 1n;
        }

        // New root
        toWrite.push(newValue)

        return toWrite.reverse()
    }

    // Add nodes to the tree structure for setting a leaf.
    //
    // Inputs
    //      address - address of leaf being set.
    //
    //      nodes - array of node value to be set
    //
    //      siblings - array of sibbling node values
    //      that won't change but form the path to the root.
    private _addLeafNodes(address: bigint, nodes: string[], siblings: string[]) {

        let bitmask = 1n << (this.LEVELS_TOTAL() - 1n)

        if (BigInt(siblings.length) != this.LEVELS_TOTAL())
            throw "Unexpected length of siblings array!";

        if (BigInt(nodes.length) != this.LEVELS_TOTAL() + 1n)
            throw "Unexpected length of nodes array!";

        for (let pos = 0; pos < this.LEVELS_TOTAL(); ++pos) {

            // 1 =>    Read Left, Change Right
            // 0 =>  Change Left,   Read Right
            if (address & bitmask) {
                this._tree.set(nodes[pos], [siblings[pos], nodes[pos + 1]]);
            }
            else {
                this._tree.set(nodes[pos], [nodes[pos + 1], siblings[pos]]);
            }

            // next bit
            bitmask >>= 1n;
        }
        this._root = nodes[0];
    }

    // Add/Remove leaf to/from the tree.
    //
    // Inputs
    //      address - address of leaf to be added.
    //
    //      value - preimage of leaf hash being added.
    //      To remove a leaf set its value to EMPTY_LEAF.
    //
    // Returns
    //      Hash of added leaf
    addLeaf(address: bigint, value: string): string {
        let siblings = this._extractSiblings(address, true);
        let newNodes = this._computeUpdatedNodes(address, value, siblings);
        this._addLeafNodes(address, newNodes, siblings);

        return newNodes[newNodes.length - 1];
    }
}
