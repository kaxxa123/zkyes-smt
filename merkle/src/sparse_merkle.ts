import * as crypto from 'crypto';

export class SMT {
    private _levels: bigint;
    private _hashZero: string;
    private _hashZeroTree: string[];
    private _tree: Map<string, string[]>;
    private _root: string;

    constructor(lvl: bigint) {
        this._levels = lvl;
        this._hashZero = this.hash("0");
        this._hashZeroTree = this._computeZeroTree();
        this._tree = new Map();
        this._root = this._hashZeroTree[0];
    }

    LEVELS_TOTAL(): bigint {
        return this._levels;
    }

    HASH_ZERO(): string {
        return this._hashZero;
    }

    HASH_ZERO_TREE(idx: number): string {
        return this._hashZeroTree[idx];
    }

    ROOT(): string {
        return this._root;
    }

    TREE(parent: string): string[] | undefined {
        return this._tree.get(parent);
    }

    hash(left: string, right: string = ""): string {
        // Will always generate a 256-bit hash with leading zeros (if needed)
        return crypto.createHash("sha256").update(left + right).digest('hex')
    }

    // Compute the node hash for all possible
    // "all zero" subtrees.
    private _computeZeroTree(): string[] {
        const cache = []
        let lastHash = this.HASH_ZERO();

        // Zero Leaf
        cache.push(lastHash)
        for (let level = 0; level < this.LEVELS_TOTAL(); ++level) {
            lastHash = this.hash(lastHash, lastHash)
            cache.push(lastHash)
        }

        return cache.reverse();
    }

    // Is the input hash an "all zero" subtree?
    isZeroTree(hash: string): boolean {
        return (this._hashZeroTree.indexOf(hash) != -1);
    }

    // Get leaf lowest index/address
    lowerIndex(): bigint {
        return 0n;
    }

    // Get leaf highest index/address
    upperIndex(): bigint {
        return (2n ** this.LEVELS_TOTAL()) - 1n;
    }

    // 1. Given a leaf address get the siblings
    //    forming the path to the root.
    //    Order these from root to leaf.
    //
    // 2. doDelete == true
    //    Delete all nodes that will be replaced
    //    on writing the new leaf value.
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

                // console.log(`Read Left: ${toRead[toRead.length - 1]}`)
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

                // console.log(`Read Right: ${toRead[toRead.length - 1]}`)
            }

            // next bit
            bitmask >>= 1n;
        }

        return toRead
    }

    // Compute the set of node values to update
    // on setting the leaf at the given address
    // Order these from root to leaf.
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

    // Add set of nodes for setting a leaf
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

    addLeaf(address: bigint, value: string) {
        let siblings = this._extractSiblings(address, true);
        let newNodes = this._computeUpdatedNodes(address, value, siblings);
        this._addLeafNodes(address, newNodes, siblings);
    }
}
