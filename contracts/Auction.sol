//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/utils/ERC721Holder.sol";
import "./NFTCollection.sol";

contract Auction is ERC721Holder {
    event AuctionStarted(address collectionAddress,uint256 tokenId, uint256 price);
    event AuctionBid(address collectionAddress,uint256 tokenId, address bidder,uint256 bid);
    event AuctionEnd(address collectionAddress,uint256 tokenId, address winner);

    mapping(address => mapping(uint256 => bool)) auctionStarted;
    mapping(address => mapping(uint256 => uint256)) prices;
    mapping(address => mapping(uint256=> address)) biders;
    mapping(address => mapping(uint256 => address)) owners;
    mapping(address => mapping(uint256 => uint256)) timestamps;
    uint256 maxTime = 10;

    modifier onlyOwnerOfNFT(address collectionAddress,uint256 tokenId,address owner){
     require(ERC721(collectionAddress).ownerOf(tokenId) == owner,"Not the owner");
        _;
    }
 
   function startAuction(uint256 price,uint256 tokenId, address collectionAddress)public onlyOwnerOfNFT(collectionAddress,tokenId,msg.sender){
        require(ERC721(collectionAddress).getApproved(tokenId) == address(this),"Not approved");
        prices[collectionAddress][tokenId] = price * 4 / 5; // 80% of the price
        auctionStarted[collectionAddress][tokenId] = true;
        owners[collectionAddress][tokenId] = address(msg.sender);
        timestamps[collectionAddress][tokenId] = block.timestamp + maxTime;
        ERC721(collectionAddress).safeTransferFrom(msg.sender,address(this),tokenId);

        emit AuctionStarted(collectionAddress,tokenId,price);
    }

    function auctionBid(uint256 tokenId, address collectionAddress)public payable{
        require(prices[collectionAddress][tokenId] <  msg.value / 5 * 4,"The price is low");
        require(auctionStarted[collectionAddress][tokenId],"Bid unavailible");
        require(timestamps[collectionAddress][tokenId] >= block.timestamp,"Auction ended");
       
       if(prices[collectionAddress][tokenId] != 0){
            (bool success,) = biders[collectionAddress][tokenId].call{value:prices[collectionAddress][tokenId]}("");
            require(success,"Failed to send");
        }

        prices[collectionAddress][tokenId] = msg.value  * 4 / 5; // 80% of the bid
        biders[collectionAddress][tokenId] = address(msg.sender);

        emit AuctionBid(collectionAddress,tokenId,msg.sender,msg.value);
    }

    function auctionEnd(uint256 tokenId, address collectionAddress)public {
        require(auctionStarted[collectionAddress][tokenId],"Auction unavailible");
        require(owners[collectionAddress][tokenId] == address(msg.sender),"Not the owner");

        ERC721(collectionAddress).safeTransferFrom(address(this),biders[collectionAddress][tokenId],tokenId);

        (bool success,) = owners[collectionAddress][tokenId].call{value:prices[collectionAddress][tokenId]}("");
        require(success,"Failed to send");

        emit AuctionEnd(collectionAddress,tokenId,biders[collectionAddress][tokenId]);
        
        delete prices[collectionAddress][tokenId];
        delete auctionStarted[collectionAddress][tokenId];
        delete biders[collectionAddress][tokenId];
        delete owners[collectionAddress][tokenId];
        delete timestamps[collectionAddress][tokenId];
    }
}
