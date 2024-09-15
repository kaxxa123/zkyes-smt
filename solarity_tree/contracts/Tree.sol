// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@solarity/solidity-lib/libs/data-structures/SparseMerkleTree.sol";
using SparseMerkleTree for SparseMerkleTree.UintSMT;

contract TokenSnapshot {
    SparseMerkleTree.UintSMT smt;

    constructor() {
        // Ethereum addresses are 20-byte (160-bit) long.
        // The SMT leaf address (index) will identify an
        // ethereum address, the value will store the token
        // balance.
        smt.initialize(160);
    }

    function recordBalance(address addr, uint256 balance) external {
        uint256 mstKey = uint256(uint160(addr));
        SparseMerkleTree.Node memory node = smt.getNodeByKey(mstKey);

        // All good zero balance is already recorded
        if (
            (node.nodeType == SparseMerkleTree.NodeType.EMPTY) && (balance == 0)
        ) return;
        else if (balance == 0) smt.remove(bytes32(mstKey));
        else smt.add(bytes32(uint256(uint160(addr))), balance);
    }

    function getLeafValue(address addr) public view returns (uint256) {
        uint256 mstKey = uint256(uint160(addr));
        SparseMerkleTree.Node memory node = smt.getNodeByKey(mstKey);

        return
            (node.nodeType == SparseMerkleTree.NodeType.EMPTY)
                ? 0
                : uint256(node.value);
    }
}
