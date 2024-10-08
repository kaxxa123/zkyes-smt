import { ethers } from "ethers";
import { PoM, IMerkle, LOG_LEVEL } from "./IMerkle"

// A Sparse Merkle Tree with optimization for short-circuiting 
// the storage of single non-zero leaf subtrees. However the 
// short-circuiting is NOT transparent. 
//
// Assuming the right subtree is composed of a single non-zero 
// leaf, a regular parent hash is coputed as follows:
//    Parent = Hash(Hash(Left_Subtree) | Hash(Right_Subtree))
//
// In this implementation:
//    Parent = Hash(Hash(Left_Subtree) | Non_Zero_Leaf_Hash)
export class SMTSingleLeafEx implements IMerkle {
    // Number of tree levels under the root
    private _levels: bigint;

    // Mapping for parent nodes. This can have two formats: 
    // If the parent node has two child nodes:
    //    parent_hash -> [left_hash, right_hash]
    // 
    // If parent is the root of a subtree with one non-zero leaf:
    //    parent_hash -> [leaf_address, leaf_hash, 1]
    //
    //    where parent_hash = leaf_hash
    //          leaf_hash   = Hash(leaf_address | value | 1)
    private _tree: Map<string, string[]>;

    // Root hash
    private _root: string;

    // Parent hash should be computed over sorted child hashes
    private _sorthash: boolean;

    // false -> Root-to-Leaf traversal => Read address bits MSB-to-LSB
    // true ->  Root-to-Leaf traversal => Read address bits LSB-to-MSB
    private _reverseTraversal: boolean;

    private _logLevel: LOG_LEVEL;

    // Initilze Sparse Merkle Tree instance.
    //
    // Inputs 
    //      lvl - number of node levels under the root node.
    //
    //      sorthash - if true, hash(left, right) will first  
    //      sort the left and right values: 0x<Smallest><Largest>
    constructor(lvl: bigint, sorthash: boolean = false, log: LOG_LEVEL = LOG_LEVEL.NONE) {

        if ((lvl < 2) || (lvl > 256))
            throw `Tree level out of range ${lvl}!`;

        this._logLevel = log;
        this._levels = lvl;
        this._sorthash = sorthash;
        this._tree = new Map();
        this._root = this.HASH_ZERO();
        this._reverseTraversal = true;
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

    private _rootMask(): bigint {
        return this._reverseTraversal ?
            1n :
            (1n << (this.LEVELS_TOTAL() - 1n));
    }

    private _leafMask(): bigint {
        return this._reverseTraversal ?
            (1n << (this.LEVELS_TOTAL() - 1n)) :
            1n;
    }

    private _traverseFromRoot(bitmask: bigint, down: bigint): bigint {
        return this._reverseTraversal ?
            bitmask << down :
            bitmask >> down;
    }

    private _traverseFromLeaf(bitmask: bigint, up: bigint): bigint {
        return this._reverseTraversal ?
            bitmask >> up :
            bitmask << up;
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
    //          a subtree with two non-zero leaves. 
    // 
    //          This can in turn be broken into two subtrees, each with a
    //          single non-zero leaf. The auxiliary subtree is the one NOT 
    //          containing the leaf identified by the address parameter.
    private _extractSiblings(address: bigint, doDelete: boolean = false): [string[], string, string[]] {
        let node = this.ROOT();
        let bitmask = this._rootMask()
        let toRead: string[] = [];
        let auxTree: string[] = [];

        if ((address < this.lowerIndex()) || (address > this.upperIndex()))
            throw "Invalid leaf address!";

        // Read adjecent nodes, traversing from root to leaf
        for (let pos = 0; pos < this.LEVELS_TOTAL(); ++pos) {

            if (this.isZeroTree(node, pos)) {
                // All nodes are zero at this point.
                // Thus the leaf is empty.
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
                    // If YES we are done, node is already set to the leaf hash
                    // If NO continue traversing...
                    let leaf_address = BigInt("0x" + subtree[0]);
                    if (leaf_address != address) {
                        // As long as the paths for the two leaves overlap,
                        // the sibling hashes will be zero.
                        for (; pos < this.LEVELS_TOTAL(); ++pos) {
                            if ((address & bitmask) != (leaf_address & bitmask))
                                break;

                            toRead.push(this.HASH_ZERO())
                            bitmask = this._traverseFromRoot(bitmask, 1n);
                        }

                        // Should never happen. That would indicate both
                        // addresses were equal.
                        if (BigInt(pos) == this.LEVELS_TOTAL())
                            throw "Unexpected traversal level";

                        else {
                            toRead.push(node);
                            auxTree = [node, ...subtree];
                            node = this.HASH_ZERO();
                        }
                    }
                    break;
                }
                else throw `Unexpected subtree encoding length: ${subtree.length}`;
            }

            // next bit
            bitmask = this._traverseFromRoot(bitmask, 1n);
        }

        if (this._logLevel >= LOG_LEVEL.HIGH) {
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
    //      value - value component of leaf hash preimage
    //      where leaf_hash = Hash(address | value | 1)
    //
    //      siblings - array of siblings covering the path
    //      from the leaf being set to the root.
    //
    // Returns
    //      Array of hashes from root to leaf. Array is truncated 
    //      when tree updates are terminated by a single non-zero 
    //      leaf subtree.
    private _computeUpdatedNodes(address: bigint, value: string, siblings: string[]): string[] {
        let bitmask = this._leafMask();
        let toWrite = [];

        if (BigInt(siblings.length) > this.LEVELS_TOTAL())
            throw `Unexpected siblings array length: ${siblings.length}!`;

        if ((address < this.lowerIndex()) || (address > this.upperIndex()))
            throw "Invalid leaf address!";

        //Hash leaf as Hash(address | value | 1)
        let hashLevel = (value === this.ZERO_LEAF_VALUE()) ?
            this.HASH_ZERO() :
            this.hashLeaf(address.toString(16), value);

        // Push leaf value and hash. Leafs will always be 
        // terminated with the sequence:
        //
        // [ Hash(index, value, 1) ] <--- Leaf hash
        //             |
        //    [ index, value, 1 ]  <----- Leaf preimage
        toWrite.push(value)
        toWrite.push(hashLevel)

        // Compute hash from the leaf up to the subtree root where this
        // will be the only non-zero leaf.
        let lvlDiff = this.LEVELS_TOTAL() - BigInt(siblings.length);
        if (lvlDiff > 0)
            bitmask = this._traverseFromLeaf(bitmask, lvlDiff);

        // Traverse the remaining levels upwards until we reach the root 
        for (let pos = siblings.length; pos > 0; --pos) {
            // 1 =>    Read Left, Change Right
            // 0 =>  Change Left,   Read Right
            hashLevel = (address & bitmask) ?
                this.hash(siblings[pos - 1], hashLevel) :
                this.hash(hashLevel, siblings[pos - 1]);

            // next bit
            bitmask = this._traverseFromLeaf(bitmask, 1n);
            toWrite.push(hashLevel)
        }

        // Flip order to get the root at index zero.
        toWrite = toWrite.reverse()

        if (this._logLevel >= LOG_LEVEL.HIGH) {
            console.log()
            console.log("_computeUpdatedNodes | Nodes: ")
            console.log(toWrite)
            console.log()
        }

        return toWrite
    }

    // Add an entry to the tree structure given a parent hash and
    // ...either a pair of child hashes OR 
    // ...a triplet representing a leaf.
    private _tree_set(log: string, parent: string, children: string[]) {

        // Don't save an entry whose parent is zero.
        if (parent === this.HASH_ZERO())
            return;

        if ((children.length != 2) && (children.length != 3))
            throw "Invalid tree children array. Invalid length."

        if (this._logLevel >= LOG_LEVEL.LOW) {
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

        let bitmask = this._rootMask()

        if (BigInt(siblings.length) > this.LEVELS_TOTAL())
            throw `Unexpected siblings array length: ${siblings.length}!`;

        // The sibling list will always have two entries less than the node list.
        // The root and leaf_value have no siblings. 
        // nodes:    [root, lvl1 child,   ..., leaf_hash,    leaf_value]
        // siblings:       [lvl1 sibling, ..., leaf_sibling]
        if (nodes.length !== siblings.length + 2)
            throw `Unexpected nodes array length. Nodes: ${nodes.length}, Siblings: ${siblings.length}`;

        // Add parent nodes.
        for (let pos = 0; pos < siblings.length; ++pos) {
            // 1 =>    Read Left, Change Right
            // 0 =>  Change Left,   Read Right
            if (address & bitmask)
                this._tree_set("PARENT", nodes[pos], [siblings[pos], nodes[pos + 1]]);
            else this._tree_set("PARENT", nodes[pos], [nodes[pos + 1], siblings[pos]]);

            // next bit
            bitmask = this._traverseFromRoot(bitmask, 1n);
        }

        // Add leaf_hash -> leaf_value
        this._tree_set(
            "SHORT ",
            nodes[nodes.length - 2],
            [this.normalizePreimage(address.toString(16)),
            this.normalizePreimage(nodes[nodes.length - 1]),
            this.normalizePreimage("1")]);

        // Add node entry for auxiliary subtree
        if (aux.length > 0)
            this._tree_set("AUX   ", aux[0], aux.slice(1));

        this._root = nodes[0];
    }

    // =============================================
    //    IMerkle public interface
    NAME(): string {
        return "Single Leaf Subtree optimized Sparse Merkle Tree. Leaf hash used as sub-tree hash. LSB-to-MSB.";
    }

    LEVELS_TOTAL(): bigint {
        return this._levels;
    }

    SORTED_HASH(): boolean {
        return this._sorthash;
    }

    INVERTED_INDEX(): boolean {
        return this._reverseTraversal;
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

    hash(left: string, right: string): string {
        if (this._sorthash) {
            [left, right] = this._sortHashes(left, right);
        }

        let preimage = this.normalizePreimage(left) + this.normalizePreimage(right);

        // Will always generate a 256-bit hash with leading zeros (if needed)
        return (preimage == this.ZERO_LEAF_VALUE())
            ? this.HASH_ZERO()
            : ethers.keccak256("0x" + preimage).slice(2);
    }

    hashLeaf(address: string, value: string): string {
        let preimage = this.normalizePreimage(address) +
            this.normalizePreimage(value) +
            this.normalizePreimage("1");

        // Will always generate a 256-bit hash with leading zeros (if needed)
        return (value == this.ZERO_LEAF_VALUE())
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

        return newNodes[newNodes.length - 2];
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
