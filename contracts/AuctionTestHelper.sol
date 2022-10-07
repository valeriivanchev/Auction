//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;
import "./Auction.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/utils/ERC721Holder.sol";
import "./NFTCollection.sol";

// TODO: Implement all user stories and one of the feature request
contract AuctionMock is ERC721Holder {
    Auction auctionContract;

    constructor(address auctionAddress) {
        auctionContract = Auction(auctionAddress);
    }

    function bid(uint256 tokenId, address collectionAddress)
        external
        payable
    {
        auctionContract.auctionBid{value: msg.value}(
            tokenId,
            collectionAddress
        );
    }

    function approve(uint256 tokenId, address collectionAddress)
        external
    {
        NFTCollection(collectionAddress).approve(
            address(auctionContract),
            tokenId
        );
    }

    function startAuction(uint256 tokenId, address collectionAddress, uint256 price)
        external
    {
       auctionContract.startAuction(price, tokenId, collectionAddress);
    }

     function endAuction(uint256 tokenId, address collectionAddress)
        external
    {
        auctionContract.auctionEnd(
            tokenId,
            collectionAddress
        );
    }
}
