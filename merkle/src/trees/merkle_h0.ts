import { ethers } from "ethers";
import { PoM, IMerkle } from "./IMerkle"

// A Sparse Merkle Tree with optimization
// Hash(zero | Zero) = Zero
export class SMTHashZero implements IMerkle {
    private _levels: bigint;
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
        this._tree = new Map();
        this._root = this.HASH_ZERO();
    }

    // =============================================
    //    Private helpers

    // Sort the two hash inputs, smallest first ready for 
    // "sorted" hashing mode.
    //
    // Inputs 
    //      left - left tree sibling
    //      right - right tree sibling
    //
    // Returns
    //      Array with sorted [left, right] siblings
    private _sortHashes(left: string, right: string): [string, string] {
        if (right.length === 0)
            return [left, right];

        if (left.length === 0)
            return [right, left];

        let ileft = BigInt("0x" + left);
        let iright = BigInt("0x" + right);

        return (iright < ileft) ? [right, left] : [left, right];
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
    //      Two values:
    //          1. Array of siblings starting from the highest level (the level 
    //          immidiately under the root) to the lowest (the leaf level).
    //
    //          2. Leaf hash at address
    private _extractSiblings(address: bigint, doDelete: boolean = false): [string[], string] {
        let node = this.ROOT();
        let bitmask = 1n << (this.LEVELS_TOTAL() - 1n)
        let zero = false;
        let toRead: string[] = [];

        if ((address < this.lowerIndex()) || (address > this.upperIndex()))
            throw "Invalid leaf address!";

        // Read adjecent nodes
        for (let pos = 0; pos < this.LEVELS_TOTAL(); ++pos) {

            zero = zero || (this.isZeroTree(node, pos));
            if (zero) {
                node = this.HASH_ZERO_TREE(pos + 1);
                toRead.push(node);
            }
            // 1 =>    Read Left, Change Right
            // 0 =>  Change Left,   Read Right
            else if (address & bitmask) {
                let subtree = this._tree.get(node);

                if (subtree === undefined)
                    throw `Node not found in tree! Level ${pos}, Hash: ${node}`;

                if (doDelete)
                    this._tree.delete(node);

                toRead.push(subtree[0])
                node = subtree[1]
            }
            else {
                let subtree = this._tree.get(node);

                if (subtree === undefined)
                    throw `Node not found in tree! Level ${pos}, Hash: ${node}`;

                if (doDelete)
                    this._tree.delete(node);

                toRead.push(subtree[1])
                node = subtree[0]
            }

            // next bit
            bitmask >>= 1n;
        }

        return [toRead, node];
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
        let newValue = this.hash(value)

        for (let pos = 0; pos < this.LEVELS_TOTAL(); ++pos) {

            toWrite.push(newValue)

            // 1 =>    Read Left, Change Right
            // 0 =>  Change Left,   Read Right
            if (address & bitmask) {
                newValue = this.hash(siblings[siblings.length - 1 - pos], newValue)
                // console.log(`Write Right: ${toWrite[toWrite.length - 1]}`)
            }
            else {
                newValue = this.hash(newValue, siblings[siblings.length - 1 - pos])
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
    //      siblings - array of sibling node values
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

    // =============================================
    //    IMerkle public interface

    LEVELS_TOTAL(): bigint {
        return this._levels;
    }

    SORTED_HASH(): boolean {
        return this._sorthash;
    }

    ZERO_LEAF_VALUE(): string {
        return this.HASH_ZERO() + this.HASH_ZERO();
    }

    HASH_ZERO(): string {
        return "0000000000000000000000000000000000000000000000000000000000000000";
    }

    HASH_ZERO_TREE(idx: number): string {
        return this.HASH_ZERO();
    }

    ROOT(): string {
        return this._root;
    }

    TREE(parent: string): string[] | undefined {
        return this._tree.get(parent);
    }

    // If the input string is not empty, front-pad it
    // with zeros to obtain 32-byte alignment.
    normalizePreimage(input: string): string {
        if (input.length === 0)
            return "";

        if (input.length % 64 == 0)
            return input;

        // Add enough zeros to make the hash a multiple of 32-bytes
        return input.padStart(64 + input.length - (input.length % 64), '0')
    }

    hash(left: string, right: string = ""): string {
        if (this._sorthash) {
            [left, right] = this._sortHashes(left, right);
        }

        let preimage = this.normalizePreimage(left) + this.normalizePreimage(right);

        // Will always generate a 256-bit hash with leading zeros (if needed)
        return (preimage == this.ZERO_LEAF_VALUE())
            ? this.HASH_ZERO()
            : ethers.keccak256("0x" + preimage).slice(2);
    }

    isZeroTree(hash: string, level: number): boolean {
        return (this.HASH_ZERO() == hash);
    }

    lowerIndex(): bigint {
        return 0n;
    }

    upperIndex(): bigint {
        return (2n ** this.LEVELS_TOTAL()) - 1n;
    }

    addLeaf(address: bigint, value: string): string {
        let [siblings,] = this._extractSiblings(address, true);
        let newNodes = this._computeUpdatedNodes(address, value, siblings);
        this._addLeafNodes(address, newNodes, siblings);

        return newNodes[newNodes.length - 1];
    }

    getProof(address: bigint): PoM {
        let [siblings, leaf] = this._extractSiblings(address);
        return { root: this.ROOT(), leaf, siblings };
    }
}