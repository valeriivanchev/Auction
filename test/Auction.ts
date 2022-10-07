import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { BigNumber, constants } from "ethers";
import { ethers,network } from "hardhat";
const helpers = require("@nomicfoundation/hardhat-network-helpers");

describe("Auction contract", function () {
  let auctionFactory;
  let auction: any;
  let accounts: SignerWithAddress[];
  let nftFactory : any;
  let nftAddress:string;
  let nftContract: any;
  let auctionContractHelper:any;
  
  const startAuctionInterface = new ethers.utils.Interface([
    "event AuctionStarted(address collectionAddress,uint256 tokenId, uint256 price)",
  ]);
  const auctionBidInterface = new ethers.utils.Interface([
    "event AuctionBid(address collectionAddress,uint256 tokenId, address bidder,uint256 bid)",
  ]);
  const auctionEndInterface = new ethers.utils.Interface([
    "event  AuctionEnd(address collectionAddress,uint256 tokenId, address winner)",
  ]);
 
  before(async () => {
    auctionFactory = await ethers.getContractFactory("Auction");
    accounts = await ethers.getSigners();
    nftFactory = await ethers.getContractFactory(
      "NFTCollection"
    );
    nftContract = await nftFactory.deploy("MyToken", "Token");
    await nftContract.deployed();
    nftAddress = nftContract.address;

    await nftContract.mintToken();
    await nftContract.connect(accounts[1]).mintToken();
    for(let i=0;i<4;i++){
      await nftContract.mintToken();
    }

    auction = await auctionFactory.deploy();
    await auction.deployed();

    const auctionMockFactory = await ethers.getContractFactory(
      "AuctionMock"
    );

    auctionContractHelper = await auctionMockFactory.deploy(auction.address);
    await auctionContractHelper.deployed();
  });

  it('Should not start an auction', async () => {
    await expect(auction.startAuction(BigNumber.from("100000000000000"),0 , nftAddress))
      .to.be.revertedWith('Not approved');
  });

  it('Should not start an auction for not the owner of the nft', async () => {
    await  nftContract.approve(auction.address,0);
    await expect(auction.connect(accounts[1]).startAuction(BigNumber.from("100000000000000"),0 , nftAddress))
      .to.be.revertedWith('Not the owner');
  });

  it('Should start an auction', async () => { 
    const startAuctionTnx = await auction.startAuction(BigNumber.from("100000000000000"),0 , nftAddress);
    const receipt = await ethers.provider.getTransactionReceipt(startAuctionTnx.hash);
    
    const data = receipt.logs[receipt.logs.length - 1].data;
    const topics = receipt.logs[receipt.logs.length - 1].topics;
    const event = startAuctionInterface.decodeEventLog(
      "AuctionStarted",
      data,
      topics
    );
    
    const collectionAddress = event[0]
    const tokenId = event[1];
    const price = event[2];

    expect(collectionAddress).to.equal(nftAddress);
    expect(tokenId).to.equal(0)
    expect(price).to.equal(BigNumber.from("100000000000000"));
  });

  it('Should not bid for lower prices than the previous one', async () => {
    await expect(auction.connect(accounts[1]).auctionBid(0, nftAddress,{value: BigNumber.from("10000000000000")}))
      .to.be.revertedWith('The price is low');
  });

  it('Should not bid for unavailible auction', async () => {
    await expect(auction.connect(accounts[1]).auctionBid(1, nftAddress,{value: BigNumber.from("10000000000000")}))
      .to.be.revertedWith('Bid unavailible');
  });

  it('Should bid', async () => {
    const bidTnx = await auction.connect(accounts[1]).auctionBid(0 , nftAddress,{value: BigNumber.from("2000000000000000")});
    const receipt = await ethers.provider.getTransactionReceipt(bidTnx.hash);
    
    const data = receipt.logs[receipt.logs.length - 1].data;
    const topics = receipt.logs[receipt.logs.length - 1].topics;
    const event = auctionBidInterface.decodeEventLog(
      "AuctionBid",
      data,
      topics
    );
    
    const collectionAddress = event[0]
    const tokenId = event[1];
    const bidder = event[2];
    const bid = event[3];

    expect(collectionAddress).to.equal(nftAddress);
    expect(tokenId).to.equal(0);
    expect(bidder).to.equal(accounts[1].address);
    expect(bid).to.equal(BigNumber.from("2000000000000000"));
  });

  it('Should end auction', async () => {
    await expect(auction.auctionEnd(0 , nftAddress))
    .to.changeEtherBalance(accounts[0],BigNumber.from("1600000000000000"));

    const ownerOfTheSoldNFT = await nftContract.ownerOf(0);
    expect(ownerOfTheSoldNFT).to.equal(accounts[1].address);
  });

  it('Should not bid for unavailible auction', async () => {
    await nftContract.connect(accounts[1]).approve(auction.address,1);
    await auction.connect(accounts[1]).startAuction(BigNumber.from("100000000000000"),1 , nftAddress);
    await helpers.mine(100);
    await expect(auction.connect(accounts[1]).auctionBid(1, nftAddress,{value: BigNumber.from("200000000000000")}))
      .to.be.revertedWith('Auction ended');
  });

  it('Should not stop the auction for unavailible one', async () => {
    await expect(auction.auctionEnd(2, nftAddress))
      .to.be.revertedWith('Auction unavailible');
  });

  it('Should revert with not the owner', async () => {
    await nftContract.approve(auction.address,2);
    await auction.startAuction(BigNumber.from("100000000000000"),2 , nftAddress);
    await expect(auction.connect(accounts[1]).auctionEnd(2, nftAddress))
      .to.be.revertedWith('Not the owner');
  });

  it('Should rever with failed to send', async () => {
    await nftContract.approve(auction.address,3);
    await auction.startAuction(BigNumber.from("0"),3, nftAddress);
    await auctionContractHelper.connect(accounts[1]).bid(3,nftAddress,{value:BigNumber.from("2000000000000000")});
    
    await expect(auction.connect(accounts[1]).auctionBid(3 , nftAddress,{value: BigNumber.from("3000000000000000")}))
    .to.be.revertedWith('Failed to send');
  });

  it('Should rever with failed to send for owner', async () => {
    await nftContract["safeTransferFrom(address,address,uint256)"](accounts[0].address, auctionContractHelper.address, 4);
    await auctionContractHelper.approve(4,nftAddress);
    await auctionContractHelper.startAuction(4, nftAddress,BigNumber.from("0"));
    await auction.connect(accounts[1]).auctionBid(4 , nftAddress,{value: BigNumber.from("3000000000000000")});

    await expect(auctionContractHelper.endAuction(4, nftAddress))
    .to.be.revertedWith('Failed to send');
  });

  it('Should send the funds to the owner and transfer the ownership to the highest bidder', async () => {
    await nftContract.approve(auction.address,5);
    await auction.startAuction(BigNumber.from("100000000000000"),5 , nftAddress);
    
    for(let i=2;i<10;i++){
      await auction.connect(accounts[i]).auctionBid(5,nftAddress,{value:BigNumber.from(i+`00000000000000`)});
    }

    await expect(auction.auctionEnd(5 , nftAddress))
    .to.changeEtherBalance(accounts[0],BigNumber.from("720000000000000"));

    const ownerOfTheSoldNFT = await nftContract.ownerOf(5);
    expect(ownerOfTheSoldNFT).to.equal(accounts[9].address);
  });
});
