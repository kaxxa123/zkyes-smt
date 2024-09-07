// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {MerkleProof} from "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";

contract TokenDrop {
    error ErrAlreadyClaimed();
    error InvalidProof();
    error TransferFailed();

    address public immutable token;
    bytes32 public immutable merkleRoot;

    mapping(address => bool) public isClaimed;

    constructor(address token_, bytes32 merkleRoot_) {
        token = token_;
        merkleRoot = merkleRoot_;
    }

    function claim(
        address account,
        uint256 amount,
        bytes32[] calldata merkleProof
    ) external {
        require(!isClaimed[account], ErrAlreadyClaimed());

        bytes32 node = keccak256(abi.encodePacked(account, amount));
        bool isValidProof = MerkleProof.verifyCalldata(
            merkleProof,
            merkleRoot,
            node
        );
        require(isValidProof, InvalidProof());

        isClaimed[account] = true;
        require(IERC20(token).transfer(account, amount), TransferFailed());
    }
}
