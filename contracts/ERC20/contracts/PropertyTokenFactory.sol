// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract HexERC20 is ERC20 {
    constructor(
        string memory name_,
        string memory symbol_,
        address recipient,
        uint256 initialAmount
    ) ERC20(name_, symbol_) {
        _mint(recipient, initialAmount);
    }
}

contract PropertyTokenFactory {
    error InvalidHexString();
    error AlreadyMinted();

    mapping(string => address) public tokenOf;
    string[] public ids;

    event TokenCreated(string indexed idHex6, address token, address indexed to, uint256 amount);

    function isValidHex6(string memory s) public pure returns (bool) {
        bytes memory b = bytes(s);
        if (b.length != 6) return false;
        for (uint256 i = 0; i < 6; i++) {
            bytes1 c = b[i];
            bool ok = (c >= 0x30 && c <= 0x39) // 0-9
                || (c >= 0x41 && c <= 0x46)    // A-F
                || (c >= 0x61 && c <= 0x66);   // a-f
            if (!ok) return false;
        }
        return true;
    }

    function _toUpper(string memory s) internal pure returns (string memory) {
        bytes memory b = bytes(s);
        for (uint256 i = 0; i < b.length; i++) {
            bytes1 c = b[i];
            if (c >= 0x61 && c <= 0x7A) {
                b[i] = bytes1(uint8(c) - 32);
            }
        }
        return string(b);
    }

    /// @notice Creates a new ERC20 named/symbol = hex string (uppercased),
    /// mints 100 * 10^18 to msg.sender, and stores the token address.
    function mintToken(string calldata idHex6) external returns (address token) {
        if (!isValidHex6(idHex6)) revert InvalidHexString();
        string memory key = _toUpper(idHex6);
        if (tokenOf[key] != address(0)) revert AlreadyMinted();

        uint256 amount = 100 * 10 ** 18;
        HexERC20 t = new HexERC20(key, key, msg.sender, amount);
        token = address(t);

        tokenOf[key] = token;
        ids.push(key);

        emit TokenCreated(key, token, msg.sender, amount);
    }

    function idsCount() external view returns (uint256) {
        return ids.length;
    }
}