import * as fs from "fs";
import * as util from "util";

export const CONFIG_JSON = "./tree_config.json";

export type LeafConfig = {
    index: number,
    value: string
};

export type TreeConfig = {
    level: number,
    sort_hash: boolean,
    leafs: LeafConfig[]
};

function isLeafConfig(obj: any): obj is LeafConfig {
    return typeof obj.index === 'number' &&
        typeof obj.value === 'string';
}

function isTreeConfig(obj: any): obj is TreeConfig {
    return typeof obj.level === 'number' &&
        typeof obj.sort_hash === 'boolean' &&
        Array.isArray(obj.leafs) &&
        obj.leafs.every(isLeafConfig);
}

export async function loadConfig(path: string): Promise<TreeConfig> {
    let readFile = util.promisify(fs.readFile)

    let config_raw = await readFile(path, 'utf8')
    let config_data = JSON.parse(config_raw)
    if (!isTreeConfig(config_data))
        throw `Configuration Error: Incorrect json. ${path}`;

    let json = config_data as TreeConfig;
    if (json.level < 2)
        throw `Configuration error: Tree level must be 2 or greater`;

    // Check if leaf indexes are in range
    let MAX = 2 ** json.level;
    json.leafs.forEach(leaf => {
        if ((leaf.index < 0) || (leaf.index >= MAX))
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