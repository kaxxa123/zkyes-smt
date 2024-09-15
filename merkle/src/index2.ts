import { IMerkle } from "./trees/IMerkle"
import { SMTNaive } from './trees/merkle_naive'
import { CONFIG_JSON, loadConfig } from './config'

async function main() {
    let config = await loadConfig(CONFIG_JSON);
    console.log(config);

    let tree: IMerkle = new SMTNaive(BigInt(config.level), config.sort_hash);

    config.leafs.forEach((leaf) => {
        let hash = tree.addLeaf(BigInt(leaf.index), leaf.value)
        console.log(`Added leaf #${leaf.index}`)
        console.log(`   Hash:  ${hash}`)
        console.log(`   Value: ${leaf.value}`)
        console.log()
    });

    config.leafs.forEach((leaf) => {
        let proof = tree.getProof(BigInt(leaf.index))
        console.log()
        console.log(`Proof for leaf ${leaf.index}:`)
        console.log(`   Root: ${proof.root}`)
        console.log(`   Leaf: ${proof.leaf}`)
        console.log("   Siblings: [leaf to (root-1)]");
        console.log(proof.siblings.reverse())
        console.log()
    });
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
