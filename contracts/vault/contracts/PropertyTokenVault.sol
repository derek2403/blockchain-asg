// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";

/// @title PropertyTokenVault
/// @notice Sellers deposit their property ERC20 into this vault; buyers pay native TEST (ROSE) to purchase.
/// Pricing rule: if housingValue = 650000, price for 100 tokens = 65 TEST (so 0.65 TEST per token).
/// Computation: expectedPriceWei = housingValue * 1e18 * amountTokens / 1_000_000
contract PropertyTokenVault is ReentrancyGuard {
    using SafeERC20 for IERC20;

    error InvalidAmount();
    error InvalidToken();
    error InvalidOwner();
    error NotOwner();
    error InsufficientInventory();
    error ListingInactive();
    error PriceMismatch();
    error TransferFailed();

    event Deposited(address indexed owner, address indexed token, uint8 decimals, uint256 housingValue, uint256 amountTokens, uint256 amountUnits);
    event Purchased(address indexed buyer, address indexed owner, address indexed token, uint256 amountTokens, uint256 paidWei);

    struct Listing {
        address owner;
        address token;
        uint8   decimals;        // ERC20 decimals (read at deposit)
        uint256 housingValue;    // e.g. 650000 means 65 TEST for 100 tokens
        uint256 remaining;       // remaining units in smallest ERC20 units
        bool    active;
    }

    // One active listing per owner (simplifies buy signature as requested)
    mapping(address => address) public tokenOfOwner;   // owner => token
    mapping(address => Listing) public listingOfToken; // token => listing

    /// @notice Deposit tokens into the vault and (re)register the listing.
    /// @dev If amountTokens == 0, we default to 100 tokens.
    /// @param owner The seller address (must be msg.sender).
    /// @param token The ERC20 token address to list.
    /// @param housingValue The full property value used for price calc (e.g. 650000).
    /// @param amountTokens Whole-token amount (NOT wei). 0 means default 100.
    function depositTokens(
        address owner,
        address token,
        uint256 housingValue,
        uint256 amountTokens
    ) external nonReentrant {
        if (owner == address(0)) revert InvalidOwner();
        if (token == address(0)) revert InvalidToken();
        if (msg.sender != owner) revert NotOwner();

        // Default to 100 tokens if 0 provided
        if (amountTokens == 0) amountTokens = 100;
        if (amountTokens > type(uint256).max / 1e18) revert InvalidAmount();

        uint8 decs = 18;
        // Read token decimals if available (all your HexERC20 use 18)
        try IERC20Metadata(token).decimals() returns (uint8 d) {
            decs = d;
        } catch {
            // fallback to 18
        }

        uint256 units = amountTokens * (10 ** decs);
        if (units == 0) revert InvalidAmount();

        // Pull from owner (owner must approve this vault beforehand)
        IERC20(token).safeTransferFrom(owner, address(this), units);

        // Register/Update listing
        Listing storage L = listingOfToken[token];
        if (L.token == address(0)) {
            // New listing
            L.owner = owner;
            L.token = token;
            L.decimals = decs;
            L.housingValue = housingValue;
            L.remaining = units;
            L.active = true;
        } else {
            // Existing listing for this token: must match same owner
            if (L.owner != owner) revert NotOwner();
            L.housingValue = housingValue; // allow updating the price anchor
            L.remaining += units;
            L.active = true;
        }

        // One token per owner for simplicity (as per requested buy signature)
        if (tokenOfOwner[owner] != address(0) && tokenOfOwner[owner] != token) {
            // Overwrite to latest token; previous listing is still accessible by token address
            tokenOfOwner[owner] = token;
        } else {
            tokenOfOwner[owner] = token;
        }

        emit Deposited(owner, token, decs, housingValue, amountTokens, units);
    }

    /// @notice Buy N tokens from an owner's listing, paying native TEST (ROSE).
    /// @dev Price is computed from stored housingValue; `priceWei` must match exactly to prevent UI mistakes.
    ///      Price formula: expectedPriceWei = housingValue * 1e18 * amountTokens / 1_000_000.
    /// @param amountTokens Whole-token amount to buy (1..100).
    /// @param priceWei The buyer's computed price in wei (must equal contract's expected).
    /// @param ownerAddress The listing owner (used to find the token).
    function buyToken(
        uint256 amountTokens,
        uint256 priceWei,
        address ownerAddress
    ) external payable nonReentrant {
        if (ownerAddress == address(0)) revert InvalidOwner();
        if (amountTokens == 0 || amountTokens > 100) revert InvalidAmount();

        address token = tokenOfOwner[ownerAddress];
        if (token == address(0)) revert InvalidToken();

        Listing storage L = listingOfToken[token];
        if (!L.active || L.owner != ownerAddress) revert ListingInactive();

        uint256 expectedWei = (L.housingValue * 1e18 * amountTokens) / 1_000_000; // 650000 -> 0.65 per token
        if (priceWei != expectedWei || msg.value != expectedWei) revert PriceMismatch();

        uint256 units = amountTokens * (10 ** L.decimals);
        if (units > L.remaining) revert InsufficientInventory();

        // Effects
        L.remaining -= units;
        if (L.remaining == 0) {
            L.active = false;
        }

        // Interactions
        IERC20(token).safeTransfer(msg.sender, units);

        (bool ok, ) = payable(L.owner).call{value: msg.value}("");
        if (!ok) revert TransferFailed();

        emit Purchased(msg.sender, L.owner, token, amountTokens, msg.value);
    }

    // ---------- Helpers / Views ----------

    function getListing(address token)
        external
        view
        returns (
            address owner,
            uint8 decimals_,
            uint256 housingValue,
            uint256 remainingUnits,
            bool active
        )
    {
        Listing memory L = listingOfToken[token];
        return (L.owner, L.decimals, L.housingValue, L.remaining, L.active);
    }

    function listedTokenOf(address owner) external view returns (address) {
        return tokenOfOwner[owner];
    }

    receive() external payable {}
}