import * as fs from "fs";
import * as util from "util";

import { IMerkle } from "./trees/IMerkle"
import { SMTNaive } from './trees/merkle_naive'
import { SMTHashZero } from './trees/merkle_h0'
import { SMTSingleLeaf } from './trees/merkle_single_leaf'
import { SMTSingleLeafEx } from './trees/merkle_single_leaf_ex'

export const CONFIG_JSON = "./tree_config.json";

export const TREE_TYPE_DEFAULT = "";
export const TREE_TYPE_NAIVE = "naive";
export const TREE_TYPE_H0 = "h0";
export const TREE_TYPE_SHORT = "short";
export const TREE_TYPE_SHORT_EX = "shortex";

export type LeafConfig = {
    index: bigint | number | string,
    value: string
};

export type TreeConfig = {
    type: string,
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

function isTreeConfig(obj: any): obj is TreeConfig {
    return typeof obj.type === 'string' &&
        isValidType(obj.type) &&
        typeof obj.level === 'number' &&
        typeof obj.sort_hash === 'boolean' &&
        Array.isArray(obj.leaves) &&
        obj.leaves.every(isLeafConfig);
}

function normalizeIndex(config: LeafConfig): bigint {
    return BigInt(config.index);
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

export function initTreeType(type: string, level: number, sort: boolean): IMerkle {
    if (type === TREE_TYPE_NAIVE)
        return new SMTNaive(BigInt(level), sort);

    else if (type === TREE_TYPE_SHORT)
        return new SMTSingleLeaf(BigInt(level), sort);

    else if (type === TREE_TYPE_SHORT_EX)
        return new SMTSingleLeafEx(BigInt(level), sort);

    return new SMTHashZero(BigInt(level), sort);
}

export function initTreeByConfig(config: TreeConfig): IMerkle {
    return initTreeType(config.type, config.level, config.sort_hash);
}