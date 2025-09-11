// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title TokenEscrow
 * @notice Escrows any ERC20. Seller lists amount + price (in TEST/native) + expiry (hours).
 *         Buyer pays exact price in native currency to receive the tokens.
 *         If expired before purchase, anyone can refund tokens back to the seller.
 */
contract TokenEscrow is ReentrancyGuard {
    using SafeERC20 for IERC20;

    error InvalidToken();
    error InvalidAmount();
    error InvalidPrice();
    error InvalidPeriod();
    error ListingNotFound();
    error ListingNotActive();
    error NotSeller();
    error PriceMismatch();
    error NotExpired();
    error TransferFailed();

    struct Listing {
        address seller;
        address token;
        uint256 amount;     // token units (respect decimals)
        uint256 priceWei;   // native price (TEST wei)
        uint64  createdAt;
        uint64  expiresAt;
        bool    active;
    }

    uint256 public nextListingId = 1;
    mapping(uint256 => Listing) public listings;         // listingId => Listing
    mapping(address => uint256[]) public listingsOf;     // seller => listingIds

    event Listed(
        uint256 indexed listingId,
        address indexed seller,
        address indexed token,
        uint256 amount,
        uint256 priceWei,
        uint64  expiresAt
    );

    event Purchased(
        uint256 indexed listingId,
        address indexed buyer,
        uint256 amount,
        uint256 priceWei
    );

    event Cancelled(uint256 indexed listingId);
    event Expired(uint256 indexed listingId);

    /// @notice Create a listing and deposit tokens into escrow.
    function listForSale(
        address token,
        uint256 amount,
        uint256 priceWei,
        uint256 periodHours
    ) external nonReentrant returns (uint256 listingId) {
        if (token == address(0)) revert InvalidToken();
        if (amount == 0) revert InvalidAmount();
        if (priceWei == 0) revert InvalidPrice();
        // up to 30 days
        if (periodHours == 0 || periodHours > 24 * 30) revert InvalidPeriod();

        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);

        listingId = nextListingId++;
        uint64 created = uint64(block.timestamp);
        uint64 expires = created + uint64(periodHours) * 1 hours;

        listings[listingId] = Listing({
            seller: msg.sender,
            token: token,
            amount: amount,
            priceWei: priceWei,
            createdAt: created,
            expiresAt: expires,
            active: true
        });

        listingsOf[msg.sender].push(listingId);
        emit Listed(listingId, msg.sender, token, amount, priceWei, expires);
    }

    /// @notice Purchase the full lot by paying the exact price in TEST.
    function buy(uint256 listingId) external payable nonReentrant {
        Listing storage L = listings[listingId];
        if (L.seller == address(0)) revert ListingNotFound();
        if (!L.active) revert ListingNotActive();
        if (block.timestamp > L.expiresAt) revert ListingNotActive();
        if (msg.value != L.priceWei) revert PriceMismatch();

        L.active = false; // close first

        IERC20(L.token).safeTransfer(msg.sender, L.amount);

        (bool ok, ) = payable(L.seller).call{value: msg.value}("");
        if (!ok) revert TransferFailed();

        emit Purchased(listingId, msg.sender, L.amount, L.priceWei);
    }

    /// @notice Seller cancels before a purchase.
    function cancel(uint256 listingId) external nonReentrant {
        Listing storage L = listings[listingId];
        if (L.seller == address(0)) revert ListingNotFound();
        if (!L.active) revert ListingNotActive();
        if (msg.sender != L.seller) revert NotSeller();

        L.active = false;
        IERC20(L.token).safeTransfer(L.seller, L.amount);
        emit Cancelled(listingId);
    }

    /// @notice Refund tokens to seller after expiry; callable by anyone.
    function withdrawExpired(uint256 listingId) external nonReentrant {
        Listing storage L = listings[listingId];
        if (L.seller == address(0)) revert ListingNotFound();
        if (!L.active) revert ListingNotActive();
        if (block.timestamp <= L.expiresAt) revert NotExpired();

        L.active = false;
        IERC20(L.token).safeTransfer(L.seller, L.amount);
        emit Expired(listingId);
    }

    // Views
    function getListing(uint256 listingId) external view returns (Listing memory) {
        return listings[listingId];
    }
    function listingsOfSeller(address seller) external view returns (uint256[] memory) {
        return listingsOf[seller];
    }

    receive() external payable {}
}