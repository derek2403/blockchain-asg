// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract FractionalProperty is ERC721 {
    uint256 public nextPropertyId;
    mapping(uint256 => address) public propertyFractionToken; // propertyId => ERC20 address

    event PropertyListed(uint256 indexed propertyId, address indexed lister, address fractionToken, uint256 totalFractions);
    event DividendsDeposited(uint256 indexed propertyId, uint256 amount);

    constructor() ERC721("RealEstateProperty", "RPROP") {}

    // Anyone can list a property and fractionalize it
    function listProperty(string memory tokenURI, string memory name, string memory symbol, uint256 totalFractions) external {
        require(totalFractions > 0, "Fractions must be > 0");
        uint256 propertyId = nextPropertyId++;
        _mint(msg.sender, propertyId);

        // Deploy a new ERC20 for this property
        FractionToken fraction = new FractionToken(name, symbol, totalFractions, msg.sender);
        propertyFractionToken[propertyId] = address(fraction);

        emit PropertyListed(propertyId, msg.sender, address(fraction), totalFractions);
    }

    // Get the ERC20 address for a property
    function getFractionToken(uint256 propertyId) external view returns (address) {
        return propertyFractionToken[propertyId];
    }

    // Deposit dividends to be distributed to fractional holders
    function depositDividends(uint256 propertyId) external payable {
        require(propertyFractionToken[propertyId] != address(0), "Invalid property");
        require(msg.value > 0, "No ETH sent");
        FractionToken fraction = FractionToken(payable(propertyFractionToken[propertyId]));
        fraction.distributeDividends{value: msg.value}();
        emit DividendsDeposited(propertyId, msg.value);
    }
}

// Minimal ERC20 with dividend distribution
contract FractionToken is ERC20, Ownable {
    uint256 public totalDividends;
    mapping(address => uint256) public withdrawnDividends;
    mapping(address => uint256) public lastDividends;

    uint256 public lastTotalDividends;

    constructor(string memory name, string memory symbol, uint256 totalSupply, address propertyOwner)
        ERC20(name, symbol)
        Ownable(propertyOwner)
    {
        _mint(propertyOwner, totalSupply * 1e18);
    }

    // Accept ETH and update dividend pool
    receive() external payable {
        distributeDividends();
    }

    function distributeDividends() public payable {
        require(totalSupply() > 0, "No fractions");
        if (msg.value > 0) {
            totalDividends += msg.value;
        }
    }

    // Withdraw your share of dividends
    function withdrawDividends() external {
        uint256 owed = dividendsOwed(msg.sender);
        require(owed > 0, "No dividends");
        withdrawnDividends[msg.sender] += owed;
        payable(msg.sender).transfer(owed);
    }

    // View how much dividends you can withdraw
    function dividendsOwed(address user) public view returns (uint256) {
        uint256 newDividends = totalDividends - withdrawnDividends[user];
        uint256 userShare = (balanceOf(user) * newDividends) / totalSupply();
        return userShare;
    }
}