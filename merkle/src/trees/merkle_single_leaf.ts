import { ethers } from "ethers";
import { PoM, IMerkle } from "./IMerkle"

export const LOG_HI = 2;
export const LOG_LO = 1;
export const LOG_NO = 0;

// A Sparse Merkle Tree with optimization
// for short-circuiting the storage of single 
// non-zero leaf subtrees.
export class SMTSingleLeaf implements IMerkle {
    // Number of tree levels under the root
    private _levels: bigint;

    // Mapping for parent nodes. This can have two formats: 
    // If the parent node has two child nodes:
    //      parent_hash -> [left_hash, right_hash]
    // 
    // If parent is the root of a subtree with one non-zero leaf:
    //      parent_hash -> [leaf_address, leaf_hash, 1]
    //
    //      Note the parent_hash would still be computed normally as:
    //      parent_hash = Hash(left_subtree_hash, right_subtree_hash)
    //
    private _tree: Map<string, string[]>;

    // Root hash
    private _root: string;

    // Parent hash should be computed over sorted child hashes
    private _sorthash: boolean;

    private _logLevel: number;

    // Initilze Sparse Merkle Tree instance.
    //
    // Inputs 
    //      lvl - number of node levels under the root node.
    //
    //      sorthash - if true, hash(left, right) will first  
    //      sort the left and right values: 0x<Smallest><Largest>
    constructor(lvl: bigint, sorthash: boolean = false, log: number = LOG_NO) {

        if ((lvl < 2) || (lvl > 256))
            throw `Tree level out of range ${lvl}!`;

        this._logLevel = log;
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

    // Get the root hash for a single non-zero leaf subtree
    //
    // Inputs
    //      address - address of non-zero leaf
    //
    //      hashLeaf - hash of non-zero leaf
    //
    //      lvl - subtree root level, where zero is the tree 
    //      root and  LEVELS_TOTAL() is the leaf level.
    //
    // Returns
    //      subtree hash
    private _singleLeafSubtree(address: bigint, hashLeaf: string, lvl: bigint): string {
        let bitmask = 1n;
        let hashLevel = hashLeaf;

        if (hashLeaf != this.HASH_ZERO()) {

            // Repeatedly hash from leaf to subtree root
            for (let pos = Number(this.LEVELS_TOTAL()); pos > lvl; --pos) {
                // 1 =>    Read Left, Change Right
                // 0 =>  Change Left,   Read Right
                hashLevel = (address & bitmask) ?
                    this.hash(this.HASH_ZERO(), hashLevel) :
                    this.hash(hashLevel, this.HASH_ZERO());

                // next bit
                bitmask <<= 1n;
            }
        }

        if (this._logLevel >= LOG_HI) {
            console.log()
            console.log(`_singleLeafSubtree | Leaf: ${hashLevel}, Subtree/Level: (${lvl},${hashLevel})`)
            console.log()
        }

        return hashLevel;
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
    //          immidiately under the root) to the lowest (the leaf level). Array
    //          is truncated when trailing hashes are all zeros.
    //
    //          2. Leaf hash at address
    //
    //          3. Auxiliary single non-zero leaf subtree, if present. 
    //          This is encoded as [parent_hash, leaf_address, leaf_hash, 1].
    //          If not present, an empty array is returned.
    // 
    //          The auxiliary subtree is included when adding the requested 
    //          leaf would transform a single non-zero leaf subtree, into 
    //          a subtree with two non-zero leaf subtree. 
    // 
    //          This can in turn be broken into two subtrees, each with a
    //          single non-zero leaf. The auxiliary subtree is the one NOT 
    //          containing the leaf identified by the address parameter.
    private _extractSiblings(address: bigint, doDelete: boolean = false): [string[], string, string[]] {
        let node = this.ROOT();
        let bitmask = 1n << (this.LEVELS_TOTAL() - 1n)
        let toRead: string[] = [];
        let auxTree: string[] = [];

        if ((address < this.lowerIndex()) || (address > this.upperIndex()))
            throw "Invalid leaf address!";

        // Read adjecent nodes, traversing from root to leaf
        for (let pos = 0; pos < this.LEVELS_TOTAL(); ++pos) {

            if (this.isZeroTree(node, pos)) {
                // All nodes are zero at this point.
                // Thus the leaf is a empty.
                node = this.HASH_ZERO();
                break;
            }
            else {
                let subtree = this._tree.get(node);
                if (subtree === undefined)
                    throw `Node not found in tree! Level ${pos}, Hash: ${node}`;

                if (doDelete)
                    this._tree.delete(node);

                if (subtree.length == 2) {
                    //This a regular intermediate node with two child subtrees.
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
                else if (subtree.length == 3) {
                    // This is a special node for a subtree with 1 non-zero leaf.
                    //
                    // Determine if the requested leaf matches the non-zero leaf.
                    // In that case, all siblings would be zero. Otherwise this subtree 
                    // might be transitioning to two non-zero leaf subtrees.
                    //
                    //                             [ node ] . . . . . .  traversal level
                    //                                |
                    //             [ a ] -------------|---------------[ 0 ]
                    //               |                                  |
                    //     [ y ]-----|------[ b ]            [ 0 ]------|-----[ 0 ]
                    //       |                |                |                |
                    // [ 0 ]-|-[ x ]    [ c ]-|-[ 0 ]    [ 0 ]-|-[ 0 ]    [ 0 ]-|-[ 0 ]
                    //          New      Old

                    // Does the requested leaf match the non-zero leaf?
                    let leaf_address = BigInt("0x" + subtree[0]);
                    if (leaf_address == address) {
                        node = subtree[1];
                    }
                    else {
                        // As long as the paths for the two leaves overlap,
                        // the sibling hash will be zero.
                        for (; pos < this.LEVELS_TOTAL(); ++pos) {
                            if ((address & bitmask) != (leaf_address & bitmask))
                                break;

                            toRead.push(this.HASH_ZERO())
                            bitmask >>= 1n;
                        }

                        // We now have two sibling subtrees, both with a single
                        // non-zero leaf. Get the hash of the sibiling subtree.
                        // Here we need to handle a limit case where the two 
                        // leaves are siblings.
                        //
                        //             [ a ]                               [ z ]             
                        //               |                                   |               
                        //     [ b ]-----|------[ 0 ]       =>     [ y ]-----|------[ 0 ]    
                        //       |                |                  |                |      
                        // [ 0 ]-|-[ c ]    [ 0 ]-|-[ 0 ]      [ x ]-|-[ c ]    [ 0 ]-|-[ 0 ]

                        // Should never happen. That would indicate both
                        // addresses where equal.
                        if (BigInt(pos) == this.LEVELS_TOTAL())
                            throw "Unexpected traversal level";

                        // The two leaves are siblings.
                        else if (BigInt(pos + 1) == this.LEVELS_TOTAL()) {
                            toRead.push(subtree[1]);
                        }

                        else {
                            let auxHash = this._singleLeafSubtree(leaf_address, subtree[1], BigInt(pos + 1));
                            auxTree = [auxHash, ...subtree];

                            toRead.push(auxHash);
                            node = this.HASH_ZERO();
                        }
                    }
                    break;
                }
                else throw `Unexpected subtree encoding length: ${subtree.length}`;
            }

            // next bit
            bitmask >>= 1n;
        }

        if (this._logLevel >= LOG_HI) {
            console.log()
            console.log(" _extractSiblings | Siblings: ")
            console.log(toRead)
            console.log(" _extractSiblings | leaf: " + node)
            console.log(" _extractSiblings | Auxiliary: ")
            console.log(auxTree)
            console.log()
        }

        return [toRead, node, auxTree];
    }

    // Compute the set of node hashes to be updated
    // on setting the leaf at the given address.
    //
    // Inputs
    //      address - address of leaf being set
    //
    //      value - value of leaf hash preimage to be set
    //
    //      siblings - array of siblings covering the path
    //      from the leaf being set to the root.
    //
    // Returns
    //      Array of hashes from root to leaf. Array is truncated 
    //      when tree updates are terminated by a single non-zero 
    //      leaf subtree.
    private _computeUpdatedNodes(address: bigint, value: string, siblings: string[]): string[] {
        let bitmask = 1n;
        let toWrite = [];

        if (BigInt(siblings.length) > this.LEVELS_TOTAL())
            throw `Unexpected siblings array length: ${siblings.length}!`;

        if ((address < this.lowerIndex()) || (address > this.upperIndex()))
            throw "Invalid leaf address!";

        //Hash leaf value...
        let hashLeaf = this.hash(value);
        toWrite.push(hashLeaf)

        // Compute hash from the leaf up to the subtree root where this
        // will be the only non-zero leaf.
        let hashLevel = hashLeaf;
        let lvlDiff = this.LEVELS_TOTAL() - BigInt(siblings.length);

        if (lvlDiff > 0) {
            hashLevel = this._singleLeafSubtree(address, hashLeaf, BigInt(siblings.length));
            toWrite.push(hashLevel)

            bitmask <<= lvlDiff;
        }

        // Traverse the remaining levels upwards until we reach the root 
        for (let pos = siblings.length; pos > 0; --pos) {
            // 1 =>    Read Left, Change Right
            // 0 =>  Change Left,   Read Right
            hashLevel = (address & bitmask) ?
                this.hash(siblings[pos - 1], hashLevel) :
                this.hash(hashLevel, siblings[pos - 1]);

            // next bit
            bitmask <<= 1n;

            toWrite.push(hashLevel)
        }

        // Flip order to get the root at index zero.
        toWrite = toWrite.reverse()

        if (this._logLevel >= LOG_HI) {
            console.log()
            console.log("_computeUpdatedNodes | Nodes: ")
            console.log(toWrite)
            console.log()
        }

        return toWrite
    }

    private _tree_set(log: string, parent: string, children: string[]) {
        // Filter out entries whose parent is zero.
        // This happens because of the way we handle removal of leaves
        // which involves setting the leaf to a zero hash.
        if (parent === this.HASH_ZERO())
            return;

        if ((children.length != 2) && (children.length != 3))
            throw "Invalid tree children array. Invalid length"

        if (this._logLevel >= LOG_LO) {
            let shrink = children.map(str => {
                if (str.length <= 11) return str;
                return ` ${str.slice(0, 4)}...${str.slice(str.length - 4)}`;
            })

            console.log(`${log} | ${parent} ->` + shrink)
        }

        this._tree.set(parent, children);
    }

    // Add nodes to the tree structure for setting a leaf.
    //
    // Inputs
    //      address - address of leaf being set.
    //
    //      nodes - array of node value to be set covering
    //      the address path.
    //
    //      siblings - array of sibling node values
    //      that won't change but form the path to the root.
    //
    //      aux - (Optional) An additional tree entry for the 
    //      auxiliary subtree. Empty array otherwise.
    private _addLeafNodes(address: bigint, nodes: string[], siblings: string[], aux: string[]) {

        let bitmask = 1n << (this.LEVELS_TOTAL() - 1n)

        if (BigInt(siblings.length) > this.LEVELS_TOTAL())
            throw `Unexpected siblings array length: ${siblings.length}!`;

        // When an auxiliary node IS included, the sibling list will always have missing 
        // entries. We expect the nodes array to be terminated with two extra hashes: 
        // [..., single_leaf_subtree_hash, leaf_hash]
        if ((aux.length !== 0) && (nodes.length !== siblings.length + 2))
            throw `Unexpected nodes array length, with auxiliary node! Nodes: ${nodes.length}, Siblings: ${siblings.length}`;

        // When an auxiliary node IS NOT included, we may either have a full set of
        // siblings or we may have a difference of 2 entries as we still short-circuit
        // the leaf being added without getting to the bottom level.
        if (aux.length === 0) {
            if ((nodes.length !== siblings.length + 1) &&
                (nodes.length !== siblings.length + 2))
                throw `Unexpected nodes array length, WITHOUT auxiliary node! Nodes: ${nodes.length}, Siblings: ${siblings.length}`;
        }

        // Add all parent nodes.
        for (let pos = 0; pos < siblings.length; ++pos) {
            // 1 =>    Read Left, Change Right
            // 0 =>  Change Left,   Read Right
            if (address & bitmask)
                this._tree_set("PARENT", nodes[pos], [siblings[pos], nodes[pos + 1]]);
            else this._tree_set("PARENT", nodes[pos], [nodes[pos + 1], siblings[pos]]);

            // next bit
            bitmask >>= 1n;
        }

        // Special single non-zero leaf subtree encoding
        if (nodes.length === siblings.length + 2)
            this._tree_set(
                "SHORT ",
                nodes[nodes.length - 2],
                [this.normalizePreimage(address.toString(16)),
                nodes[nodes.length - 1],
                this.normalizePreimage("1")]);

        // Add node entry for auxiliary subtree
        if (aux.length > 0)
            this._tree_set("AUX   ", aux[0], aux.slice(1));

        this._root = nodes[0];
    }

    // =============================================
    //    IMerkle public interface
    NAME(): string {
        return "Single Leaf Subtree optimized Sparse Merkle Tree";
    }

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
        let [siblings, _, aux] = this._extractSiblings(address, true);
        let newNodes = this._computeUpdatedNodes(address, value, siblings);
        this._addLeafNodes(address, newNodes, siblings, aux);

        return newNodes[newNodes.length - 1];
    }

    getProof(address: bigint): PoM {
        let [siblings, leaf, _] = this._extractSiblings(address);

        // Siblings array is truncated leaving out 
        // trailing zero hashes. For consistency 
        // with other implementations we add the
        // missing entries.
        for (let pos = siblings.length; pos < this.LEVELS_TOTAL(); ++pos)
            siblings.push(this.HASH_ZERO());

        return { root: this.ROOT(), leaf, siblings };
    }
}
