// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

// Uncomment this line to use console.log
// import "hardhat/console.sol";

contract DecentralizedAuction {
    // Auction state
    enum AuctionState { Active, Ended, Cancelled }
    
    struct Auction {
        uint256 auctionId;
        address payable seller;
        string itemName;
        string itemDescription;
        uint256 startingPrice;
        uint256 currentHighestBid;
        address payable currentHighestBidder;
        uint256 endTime;
        AuctionState state;
        bool exists;
    }
    
    struct Bid {
        address bidder;
        uint256 amount;
        uint256 timestamp;
    }
    
    // State variables
    uint256 public auctionCounter;
    mapping(uint256 => Auction) public auctions;
    mapping(uint256 => Bid[]) public auctionBids;
    mapping(uint256 => mapping(address => uint256)) public bidderRefunds;
    
    // Events
    event NewAuction(uint256 indexed auctionId, address indexed seller, string itemName, uint256 startingPrice, uint256 endTime);
    event NewBid(uint256 indexed auctionId, address indexed bidder, uint256 amount, uint256 timestamp);
    event AuctionEnded(uint256 indexed auctionId, address indexed winner, uint256 finalBid, uint256 timestamp);
    event AuctionCancelled(uint256 indexed auctionId, address indexed seller, uint256 timestamp);
    event BidRefunded(uint256 indexed auctionId, address indexed bidder, uint256 amount, uint256 timestamp);
    event FundsWithdrawn(uint256 indexed auctionId, address indexed seller, uint256 amount, uint256 timestamp);
    
    // Modifiers
    modifier auctionExists(uint256 _auctionId) {
        require(auctions[_auctionId].exists, "Auction does not exist");
        _;
    }
    
    modifier auctionActive(uint256 _auctionId) {
        require(auctions[_auctionId].state == AuctionState.Active, "Auction is not active");
        _;
    }
    
    modifier auctionNotEnded(uint256 _auctionId) {
        require(block.timestamp < auctions[_auctionId].endTime, "Auction has ended");
        _;
    }
    
    modifier onlySeller(uint256 _auctionId) {
        require(msg.sender == auctions[_auctionId].seller, "Only seller can perform this action");
        _;
    }
    
    modifier onlyWinner(uint256 _auctionId) {
        require(msg.sender == auctions[_auctionId].currentHighestBidder, "Only winner can perform this action");
        _;
    }
    
    // Create a new auction
    function createAuction(
        string memory _itemName,
        string memory _itemDescription,
        uint256 _startingPrice,
        uint256 _durationInMinutes
    ) external returns (uint256) {
        require(_startingPrice > 0, "Starting price must be greater than 0");
        require(_durationInMinutes > 0, "Duration must be greater than 0");
        require(_durationInMinutes <= 10080, "Duration cannot exceed 1 week"); // Max 1 week
        
        auctionCounter++;
        uint256 auctionId = auctionCounter;
        
        auctions[auctionId] = Auction({
            auctionId: auctionId,
            seller: payable(msg.sender),
            itemName: _itemName,
            itemDescription: _itemDescription,
            startingPrice: _startingPrice,
            currentHighestBid: 0,
            currentHighestBidder: payable(address(0)),
            endTime: block.timestamp + (_durationInMinutes * 1 minutes),
            state: AuctionState.Active,
            exists: true
        });
        
        emit NewAuction(auctionId, msg.sender, _itemName, _startingPrice, auctions[auctionId].endTime);
        
        return auctionId;
    }
    
    // Place a bid on an auction
    function placeBid(uint256 _auctionId) external payable auctionExists(_auctionId) auctionActive(_auctionId) auctionNotEnded(_auctionId) {
        Auction storage auction = auctions[_auctionId];
        
        require(msg.value > auction.currentHighestBid, "Bid must be higher than current highest bid");
        require(msg.sender != auction.seller, "Seller cannot bid on their own auction");
        
        // Refund the previous highest bidder
        if (auction.currentHighestBidder != address(0)) {
            bidderRefunds[_auctionId][auction.currentHighestBidder] += auction.currentHighestBid;
        }
        
        // Update auction state
        auction.currentHighestBid = msg.value;
        auction.currentHighestBidder = payable(msg.sender);
        
        // Record the bid
        auctionBids[_auctionId].push(Bid({
            bidder: msg.sender,
            amount: msg.value,
            timestamp: block.timestamp
        }));
        
        emit NewBid(_auctionId, msg.sender, msg.value, block.timestamp);
    }
    
    // End auction (can be called by anyone after end time)
    function endAuction(uint256 _auctionId) external auctionExists(_auctionId) auctionActive(_auctionId) {
        Auction storage auction = auctions[_auctionId];
        
        require(block.timestamp >= auction.endTime, "Auction has not ended yet");
        
        auction.state = AuctionState.Ended;
        
        if (auction.currentHighestBidder != address(0)) {
            // Transfer funds to seller
            auction.seller.transfer(auction.currentHighestBid);
            emit FundsWithdrawn(_auctionId, auction.seller, auction.currentHighestBid, block.timestamp);
            emit AuctionEnded(_auctionId, auction.currentHighestBidder, auction.currentHighestBid, block.timestamp);
        } else {
            emit AuctionEnded(_auctionId, address(0), 0, block.timestamp);
        }
    }
    
    // Cancel auction (only seller can cancel before any bids)
    function cancelAuction(uint256 _auctionId) external auctionExists(_auctionId) auctionActive(_auctionId) onlySeller(_auctionId) {
        Auction storage auction = auctions[_auctionId];
        
        require(auction.currentHighestBidder == address(0), "Cannot cancel auction with bids");
        
        auction.state = AuctionState.Cancelled;
        
        emit AuctionCancelled(_auctionId, auction.seller, block.timestamp);
    }
    
    // Allow bidders to withdraw their refunds
    function withdrawRefund(uint256 _auctionId) external {
        uint256 refundAmount = bidderRefunds[_auctionId][msg.sender];
        require(refundAmount > 0, "No refund available");
        
        bidderRefunds[_auctionId][msg.sender] = 0;
        
        payable(msg.sender).transfer(refundAmount);
        
        emit BidRefunded(_auctionId, msg.sender, refundAmount, block.timestamp);
    }
    
    // Get auction details
    function getAuction(uint256 _auctionId) external view auctionExists(_auctionId) returns (
        uint256 auctionId,
        address seller,
        string memory itemName,
        string memory itemDescription,
        uint256 startingPrice,
        uint256 currentHighestBid,
        address currentHighestBidder,
        uint256 endTime,
        AuctionState state
    ) {
        Auction storage auction = auctions[_auctionId];
        return (
            auction.auctionId,
            auction.seller,
            auction.itemName,
            auction.itemDescription,
            auction.startingPrice,
            auction.currentHighestBid,
            auction.currentHighestBidder,
            auction.endTime,
            auction.state
        );
    }
    
    // Get all bids for an auction (for historical display)
    function getAuctionBids(uint256 _auctionId) external view auctionExists(_auctionId) returns (Bid[] memory) {
        return auctionBids[_auctionId];
    }
    
    // Get bidder's refund amount
    function getBidderRefund(uint256 _auctionId, address _bidder) external view returns (uint256) {
        return bidderRefunds[_auctionId][_bidder];
    }
    
    // Get auction leaderboard (top 10 bids)
    function getAuctionLeaderboard(uint256 _auctionId) external view auctionExists(_auctionId) returns (Bid[] memory) {
        Bid[] storage allBids = auctionBids[_auctionId];
        uint256 bidCount = allBids.length;
        
        if (bidCount == 0) {
            return new Bid[](0);
        }
        
        // Create a copy to sort
        Bid[] memory sortedBids = new Bid[](bidCount);
        for (uint256 i = 0; i < bidCount; i++) {
            sortedBids[i] = allBids[i];
        }
        
        // Simple bubble sort for top bids (in practice, you might want a more efficient algorithm)
        for (uint256 i = 0; i < bidCount - 1; i++) {
            for (uint256 j = 0; j < bidCount - i - 1; j++) {
                if (sortedBids[j].amount < sortedBids[j + 1].amount) {
                    Bid memory temp = sortedBids[j];
                    sortedBids[j] = sortedBids[j + 1];
                    sortedBids[j + 1] = temp;
                }
            }
        }
        
        // Return top 10 or all if less than 10
        uint256 returnCount = bidCount < 10 ? bidCount : 10;
        Bid[] memory topBids = new Bid[](returnCount);
        
        for (uint256 i = 0; i < returnCount; i++) {
            topBids[i] = sortedBids[i];
        }
        
        return topBids;
    }
    
    // Get active auctions
    function getActiveAuctions() external view returns (uint256[] memory) {
        uint256[] memory activeAuctionIds = new uint256[](auctionCounter);
        uint256 activeCount = 0;
        
        for (uint256 i = 1; i <= auctionCounter; i++) {
            if (auctions[i].exists && auctions[i].state == AuctionState.Active) {
                activeAuctionIds[activeCount] = i;
                activeCount++;
            }
        }
        
        // Resize array to actual count
        uint256[] memory result = new uint256[](activeCount);
        for (uint256 i = 0; i < activeCount; i++) {
            result[i] = activeAuctionIds[i];
        }
        
        return result;
    }
    
    // Emergency function to withdraw stuck funds (only in emergency)
    function emergencyWithdraw() external {
        require(msg.sender == address(this), "Only contract can call this");
        payable(msg.sender).transfer(address(this).balance);
    }
}
