import { IMerkle } from "./trees/IMerkle"
import { CONFIG_JSON, loadConfig, initTreeByConfig } from './config'

async function main() {
    let config = await loadConfig(CONFIG_JSON);
    console.log(config);
    console.log();

    let tree: IMerkle = initTreeByConfig(config);
    console.log(tree.NAME());
    console.log();

    config.leaves.forEach((leaf) => {
        let hash = tree.addLeaf(BigInt(leaf.index), leaf.value)
        console.log(`Added leaf #${leaf.index}`)
        console.log(`   Hash:  ${hash}`)
        console.log(`   Value: ${leaf.value}`)
        console.log()
    });

    config.leaves.forEach((leaf) => {
        let proof = tree.getProof(BigInt(leaf.index))

        console.log()
        console.log(`Proof for leaf ${leaf.index}:`)
        console.log(`   Root: ${proof.root}`)
        console.log(`   Leaf: ${proof.leaf}`)
        console.log("   Siblings: [(root+1) to leaf]");

        proof.siblings.forEach((hash, idx) => {
            if (!tree.isZeroTree(hash, idx + 1))
                console.log(`      hash[${idx}] = ${hash}`)
        })

        console.log()
    });
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
