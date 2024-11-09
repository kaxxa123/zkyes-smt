import * as fs from "fs";
import * as util from "util";

import { ethers } from "ethers";
import { Poseidon as SmartPoseidon } from "@iden3/js-crypto";

import {
    IMerkle,
    HashFn,
    buildSMTNaive,
    buildSMTHashZero,
    buildSMTSingleLeaf,
    buildSMTSingleLeafEx
} from "zkyes-smt"

export const CONFIG_JSON = "./tree_config.json";

export const TREE_TYPE_DEFAULT = "";
export const TREE_TYPE_NAIVE = "naive";
export const TREE_TYPE_H0 = "h0";
export const TREE_TYPE_SHORT = "short";
export const TREE_TYPE_SHORT_EX = "shortex";

export const HASH_DEFAULT = "";
export const HASH_KECCAK256 = "keccak256";
export const HASH_POSEIDON = "poseidon";

export type LeafConfig = {
    index: bigint | number | string,
    value: string
};

export type TreeConfig = {
    type: string,
    hash: string,
    level: number,
    sort_hash: boolean,
    leaves: LeafConfig[]
};

function isLeafConfig(obj: any): obj is LeafConfig {
    return (typeof obj.index === 'number' || typeof obj.index === 'string') &&
        typeof obj.value === 'string';
}

function isValidType(type: string): boolean {
    return (type === TREE_TYPE_DEFAULT) ||
        (type === TREE_TYPE_NAIVE) ||
        (type === TREE_TYPE_H0) ||
        (type === TREE_TYPE_SHORT) ||
        (type === TREE_TYPE_SHORT_EX);
}

function isValidHash(hash: string): boolean {
    return (hash === HASH_DEFAULT) ||
        (hash === HASH_KECCAK256) ||
        (hash === HASH_POSEIDON);
}

function isTreeConfig(obj: any): obj is TreeConfig {
    return typeof obj.type === 'string' &&
        isValidType(obj.type) &&
        typeof obj.hash === 'string' &&
        isValidHash(obj.hash) &&
        typeof obj.level === 'number' &&
        typeof obj.sort_hash === 'boolean' &&
        Array.isArray(obj.leaves) &&
        obj.leaves.every(isLeafConfig);
}

function normalizeIndex(config: LeafConfig): bigint {
    return BigInt(config.index);
}

export function normalizedTreeType(type: string): string {
    if ((type === TREE_TYPE_NAIVE) ||
        (type === TREE_TYPE_H0) ||
        (type === TREE_TYPE_SHORT) ||
        (type === TREE_TYPE_SHORT_EX))
        return type;

    if (type === TREE_TYPE_DEFAULT)
        return TREE_TYPE_H0;

    throw `Unknown tree type ${type}`;
}

export function normalizedHashType(hashType: string): string {
    if ((hashType === HASH_POSEIDON) ||
        (hashType === HASH_KECCAK256))
        return hashType;

    if (hashType === HASH_DEFAULT)
        return HASH_KECCAK256;

    throw `Unknown hash type ${hashType}`;
}

export function normalize32Bytes(input: string): string {
    if (input.length === 0)
        return "";

    if (input.length % 64 == 0)
        return input;

    // Add enough zeros to make the hash a multiple of 32-bytes
    return input.padStart(64 + input.length - (input.length % 64), '0')
}

export function getHashFn(hashType: string): HashFn {
    const HashKeccak256 = async (preimage: string) => ethers.keccak256("0x" + preimage).slice(2);

    const HashPoseidon = async (preimage: string) => {
        if ((preimage.length === 0) || (preimage.length % 64 !== 0))
            throw "preimage length must be multiple of 32-bytes";

        const chunks: bigint[] = [];
        for (let pos = 0; pos < preimage.length;) {
            chunks.push(BigInt("0x" + preimage.slice(pos, pos + 64)))
            pos += 64;
        }

        // The @iden3/js-crypto (unlike circomlibjs) generates the same 
        // hash as the EVM Poseidon libraries.
        let hash = SmartPoseidon.hash(chunks);

        return normalize32Bytes(hash.toString(16));
    }

    hashType = normalizedHashType(hashType)
    if (hashType === HASH_KECCAK256)
        return HashKeccak256;

    else if (hashType === HASH_POSEIDON)
        return HashPoseidon;

    throw `Unknown hash type ${hashType}`;
}

export async function loadConfig(path: string): Promise<TreeConfig> {
    let readFile = util.promisify(fs.readFile)

    let config_raw = await readFile(path, 'utf8')
    let config_data = JSON.parse(config_raw)
    if (!isTreeConfig(config_data))
        throw `Configuration Error: Incorrect json. ${path}`;

    let json = config_data as TreeConfig;
    if ((json.level < 2) || (json.level > 256))
        throw `Configuration error: Tree level must be within the range [2 to 256]`;

    // Check if leaf indexes are in range
    let MAX = 2n ** BigInt(json.level);
    json.leaves.forEach(leaf => {
        let idx = normalizeIndex(leaf);
        if ((idx < 0n) || (idx >= MAX))
            throw `Configuration error: Leaf index out of range ${leaf.index}`;
    })

    return json;
}

export async function loadConfigOR(path: string, defConfig: TreeConfig): Promise<TreeConfig> {
    try {
        return await loadConfig(path);
    }
    catch { }
    return defConfig;
}

export async function initTreeType(type: string, hashType: string, level: number, sort: boolean): Promise<IMerkle> {

    const hashfn = getHashFn(hashType);
    const treeType = normalizedTreeType(type);

    if (treeType === TREE_TYPE_NAIVE)
        return await buildSMTNaive(hashfn, BigInt(level), sort);

    else if (treeType === TREE_TYPE_H0)
        return await buildSMTHashZero(hashfn, BigInt(level), sort);

    else if (treeType === TREE_TYPE_SHORT)
        return await buildSMTSingleLeaf(hashfn, BigInt(level), sort);

    else if (treeType === TREE_TYPE_SHORT_EX)
        return await buildSMTSingleLeafEx(hashfn, BigInt(level), sort);

    throw `Unknown tree type ${treeType}`;
}

export async function initTreeByConfig(config: TreeConfig): Promise<IMerkle> {
    return await initTreeType(config.type, config.hash, config.level, config.sort_hash);
}