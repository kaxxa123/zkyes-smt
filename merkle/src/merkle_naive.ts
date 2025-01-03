import { PoM, IMerkle, HashFn } from "./IMerkle"

// A Sparse Merkle Tree allowing to generate proofs-of-membership
// and proofs-of-non-membership.
export class SMTNaive implements IMerkle {
    // Is instance initialized?
    private _isInit: boolean;

    // Number of tree levels under the root
    private _levels: bigint;

    // Hash value for empty (zero) leaf.
    private _hashZero: string;

    // Hash values for empty (zero) subtrees
    // from root to leaf.
    private _hashZeroTree: string[];

    // Mapping for parent nodes: parent_hash -> [left_hash, right_hash]
    private _tree: Map<string, string[]>;

    // Root hash
    private _root: string;

    // Parent hash should be computed over sorted child hashes
    private _sorthash: boolean;

    // Function for computing hashes
    private _hash_func: HashFn;

    constructor() {
        this._isInit = false;
        this._hash_func = async (preimage: string) => "";
        this._levels = 0n;
        this._sorthash = false;
        this._hashZero = ""
        this._hashZeroTree = [];
        this._tree = new Map();
        this._root = "";
    }

    // Initilze Sparse Merkle Tree instance.
    //
    // Inputs 
    //      lvl - number of node levels under the root node.
    //
    //      sorthash - if true, hash(left, right) will first  
    //      sort the left and right values smallest first (left).
    async initialize(hashfn: HashFn, lvl: bigint, sorthash: boolean) {
        if (this._isInit)
            throw `Tree already initialized!`;

        if ((lvl < 2) || (lvl > 256))
            throw `Tree level out of range ${lvl}!`;

        this._isInit = true;
        this._hash_func = hashfn;
        this._levels = lvl;
        this._sorthash = sorthash;
        this._hashZero = await this.hash(this.ZERO_LEAF_VALUE());
        this._hashZeroTree = await this._computeZeroTree();
        this._root = this._hashZeroTree[0];
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

    // Compute the node hash for all possible
    // zero subtrees.
    //
    // Returns
    //      Array of hashes of all possible zero subtrees
    //      starting from a zero root and ending with a
    //      zero leaf. Returned array will be 
    //      (LEVELS_TOTAL+1) long.
    private async _computeZeroTree(): Promise<string[]> {
        const cache = []
        let lastHash = this.HASH_ZERO();

        // Zero Leaf
        cache.push(lastHash)
        for (let level = 0; level < this.LEVELS_TOTAL(); ++level) {
            lastHash = await this.hash(lastHash, lastHash)
            cache.push(lastHash)
        }

        return cache.reverse();
    }

    // Given a leaf address get the siblings forming the path
    // to the root. Optionaly delete all nodes that will be  
    // orphaned on writing the new leaf value.
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
            else {
                let subtree = this._tree.get(node);
                if (subtree === undefined)
                    throw `Node not found in tree! Level ${pos}, Hash: ${node}`;

                if (doDelete)
                    this._tree.delete(node);

                // 1 =>    Read Left, Change Right
                // 0 =>  Change Left,   Read Right
                if (address & bitmask) {
                    toRead.push(subtree[0])
                    node = subtree[1]
                }
                else {
                    toRead.push(subtree[1])
                    node = subtree[0]
                }
            }

            // next bit
            bitmask >>= 1n;
        }

        return [toRead, node];
    }

    // Compute the set of node hashes to be updated
    // on setting the leaf at the given address.
    //
    // Inputs
    //      address - address of leaf being set
    //
    //      value - leaf hash preimage
    //
    //      siblings - array of siblings covering the path
    //      from the leaf being set to the root.
    //
    // Returns
    //      Array of hashes from root to leaf.
    private async _computeUpdatedNodes(address: bigint, value: string, siblings: string[]): Promise<string[]> {
        let bitmask = 1n;
        let toWrite = [];

        if (BigInt(siblings.length) != this.LEVELS_TOTAL())
            throw "Unexpected length of siblings array!";

        if ((address < this.lowerIndex()) || (address > this.upperIndex()))
            throw "Invalid leaf address!";

        //Hash leaf value...
        let newValue = await this.hash(value)

        for (let pos = Number(this.LEVELS_TOTAL()); pos > 0; --pos) {
            toWrite.push(newValue)

            // 1 =>    Read Left, Change Right
            // 0 =>  Change Left,   Read Right
            newValue = (address & bitmask) ?
                await this.hash(siblings[pos - 1], newValue)
                : await this.hash(newValue, siblings[pos - 1]);

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

        if (nodes.length != siblings.length + 1)
            throw "Unexpected length of nodes array!";

        for (let pos = 0; pos < this.LEVELS_TOTAL(); ++pos) {
            // 1 =>    Read Left, Change Right
            // 0 =>  Change Left,   Read Right
            if (address & bitmask)
                this._tree.set(nodes[pos], [siblings[pos], nodes[pos + 1]]);
            else this._tree.set(nodes[pos], [nodes[pos + 1], siblings[pos]]);

            // next bit
            bitmask >>= 1n;
        }
        this._root = nodes[0];
    }

    // =============================================
    //    IMerkle public interface
    IS_INIT(): boolean {
        return this._isInit;
    }

    NAME(): string {
        return "Naive Sparse Merkle Tree";
    }

    LEVELS_TOTAL(): bigint {
        return this._levels;
    }

    SORTED_HASH(): boolean {
        return this._sorthash;
    }

    INVERTED_INDEX(): boolean {
        return false;
    }

    ZERO_LEAF_VALUE(): string {
        return Buffer.from("null", "utf8").toString('hex');
    }

    HASH_ZERO(): string {
        if (!this._isInit)
            throw `Tree NOT initialized!`;

        return this._hashZero;
    }

    HASH_ZERO_TREE(idx: number): string {
        if (!this._isInit)
            throw `Tree NOT initialized!`;

        return this._hashZeroTree[idx];
    }

    ROOT(): string {
        if (!this._isInit)
            throw `Tree NOT initialized!`;

        return this._root;
    }

    TREE(parent: string): string[] | undefined {
        if (!this._isInit)
            throw `Tree NOT initialized!`;

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

    async hash(left: string, right: string = ""): Promise<string> {
        if (!this._isInit)
            throw `Tree NOT initialized!`;

        if (this._sorthash) {
            [left, right] = this._sortHashes(left, right);
        }

        // Will always generate a 256-bit hash with leading zeros (if needed)
        return await this._hash_func(this.normalizePreimage(left) + this.normalizePreimage(right));
    }

    hashLeaf(data: string[]): Promise<string> {
        throw "Leaf data encoding not supported!"
    }

    isZeroTree(hash: string, level: number): boolean {
        if (!this._isInit)
            throw `Tree NOT initialized!`;

        return (this._hashZeroTree[level] == hash);
    }

    lowerIndex(): bigint {
        return 0n;
    }

    upperIndex(): bigint {
        return (2n ** this.LEVELS_TOTAL()) - 1n;
    }

    async addLeaf(address: bigint, value: string): Promise<string> {
        if (!this._isInit)
            throw `Tree NOT initialized!`;

        let [siblings,] = this._extractSiblings(address, true);
        let newNodes = await this._computeUpdatedNodes(address, value, siblings);
        this._addLeafNodes(address, newNodes, siblings);

        return newNodes[newNodes.length - 1];
    }

    async getProof(address: bigint): Promise<PoM> {
        if (!this._isInit)
            throw `Tree NOT initialized!`;

        let [siblings, leaf] = this._extractSiblings(address);
        return { compress: undefined, root: this.ROOT(), leaf, siblings };
    }
}

export async function buildSMTNaive(hashfn: HashFn, lvl: bigint, sorthash: boolean): Promise<SMTNaive> {
    let smt = new SMTNaive();
    await smt.initialize(hashfn, lvl, sorthash);
    return smt;
}