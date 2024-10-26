// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "./SmtLib.sol";
using SmtLib for SmtLib.Data;

contract TokenSnapshot {
    SmtLib.Data smt;

    constructor(uint256 level) {
        // Ethereum addresses are 20-byte (160-bit) long.
        // The SMT leaf address (index) will identify an
        // ethereum address, the value will store the token
        // balance.
        smt.initialize(level);
    }

    function getMaxDepth() public view returns (uint256) {
        return smt.getMaxDepth();
    }

    function getRoot() public view returns (uint256) {
        return smt.getRoot();
    }

    function recordBalance(address addr, uint256 balance) external {
        smt.addLeaf(uint256(uint160(addr)), balance);
    }

    function pom(address addr) public view returns (SmtLib.Proof memory) {
        return smt.getProof(uint256(uint160(addr)));
    }
}
