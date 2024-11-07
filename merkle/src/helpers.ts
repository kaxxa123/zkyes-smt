import { PoM, IMerkle } from "./IMerkle"

// A thin wrapper that helps classes to merge the
// public interface of a tree instance to their 
// own interface by just inheriting from MerkleWrapper.
export class MerkleWrapper implements IMerkle {
    private _tree: IMerkle;

    constructor(tree: IMerkle) {
        this._tree = tree;
    }

    IS_INIT(): boolean {
        return this._tree.IS_INIT();
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

    async hash(left: string, right: string): Promise<string> {
        return await this._tree.hash(left, right);
    }

    async hashLeaf(data: string[]): Promise<string> {
        return await this._tree.hashLeaf(data);
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

    async addLeaf(address: bigint, value: string): Promise<string> {
        return await this._tree.addLeaf(address, value);
    }

    async getProof(address: bigint): Promise<PoM> {
        return await this._tree.getProof(address);
    }
}

// Compresses PoM siblings array by removing zero elements.
//
// Inputs
//      smt - IMerkle tree instance that generated this PoM.
//
//      decompressed - Decompressed PoM to be compressed.
//
// Returns
//      A new PoM with the compression flags set and the 
//      siblings array stripped of the zero elements.
export function compressPoM(smt: IMerkle, decompressed: PoM): PoM {
    let mask = 0n;
    let compressed: string[] = [];

    if (decompressed.compress !== undefined)
        throw "PoM is already compressed";

    if (smt.LEVELS_TOTAL() != BigInt(decompressed.siblings.length))
        throw "Invalid siblings array in decompressed PoM";

    decompressed.siblings.forEach((hash, idx) => {
        if (!smt.isZeroTree(hash, idx + 1)) {
            compressed.push(hash)
            mask |= (1n << BigInt(idx));
        }
    })

    return {
        compress: mask,
        root: decompressed.root,
        leaf: decompressed.leaf,
        siblings: compressed
    };
}

// Decompresses PoM siblings array by re-inserting zero elements.
//
// Inputs
//      smt - IMerkle tree instance that generated this PoM.
//
//      compressed - Compressed PoM to be decompressed.
//
// Returns
//      A new PoM with the decompression flags removed and the 
//      siblings array restored to include one element for each 
//      tree level.
export function decompressPoM(smt: IMerkle, compressed: PoM): PoM {

    if (compressed.compress === undefined)
        throw "PoM is already decompressed";

    if (compressed.siblings.length > smt.LEVELS_TOTAL())
        throw "Too many compressed siblings";

    let decompressed: string[] = [];
    let posComp = 0;

    for (let posMask = 0n; posMask < smt.LEVELS_TOTAL(); ++posMask) {

        if ((compressed.compress & (1n << posMask)) != 0n) {
            if (posComp >= compressed.siblings.length)
                throw "Inconsistent siblings/compression mask (missing siblings).";

            decompressed.push(compressed.siblings[posComp++])
        }
        else
            decompressed.push(smt.HASH_ZERO_TREE(Number(posMask + 1n)))
    }

    if (posComp !== compressed.siblings.length)
        throw "Inconsistent siblings/compression mask (too many siblings).";

    return {
        compress: undefined,
        root: compressed.root,
        leaf: compressed.leaf,
        siblings: decompressed
    };
}
