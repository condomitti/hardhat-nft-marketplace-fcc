const { assert, expect } = require("chai");
const { network, deployments, ethers } = require("hardhat");
const { developmentChains } = require("../../helper-hardhat-config");
const { getNamedAccounts } = require("hardhat");
const { describe } = require("node:test");

!developmentChains.includes(network.name)
    ? describe.skip
    : describe("Nft Marketplace test", function () {
          let nftMarketplace, basicNft, deployer, player;
          const PRICE = ethers.utils.parseEther("0.1");
          const TOKEN_ID = 0;

          beforeEach(async function () {
              let accounts = await ethers.getSigners();
              deployer = accounts[0];
              player = accounts[1];
              await deployments.fixture(["all"]);
              nftMarketplace = await ethers.getContract("NftMarketplace", deployer);
              basicNft = await ethers.getContract("BasicNft");
              await basicNft.mintNft();
              await basicNft.approve(nftMarketplace.address, TOKEN_ID);
          });

          it("lists and can be bought", async function () {
              await nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE);
              const playerConnectedNftMarketplace = nftMarketplace.connect(player);
              await playerConnectedNftMarketplace.buyItem(basicNft.address, TOKEN_ID, {
                  value: PRICE,
              });
              const newOwner = await basicNft.ownerOf(TOKEN_ID);
              const deployerProceeds = await nftMarketplace.getProceeds(deployer.address);
              assert(newOwner.toString() == player.address);
              assert(deployerProceeds.toString() == PRICE.toString());
          });

          it("cancel listed item", async () => {
              await nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE); //lists item
              await nftMarketplace.cancelListing(basicNft.address, TOKEN_ID); // cancelling listed item

              //try to buy not listed item - should revert with NotListed() error
              await expect(nftMarketplace.buyItem(basicNft.address, TOKEN_ID)).to.be.revertedWith(
                  "NftMarketplace__NotListed",
              );
          });

          describe("Withdraw", function () {
              it("cannot withdraw when there are no proceeds", async () => {
                  await expect(nftMarketplace.withdrawProceeds()).to.be.revertedWith(
                      "NftMarketplace__NoProceeds",
                  );
              });

              it("withdraw proceeds", async () => {
                  // account0 lists nft
                  // account1 buys it
                  // account0 withdraws
                  // account0's proceedings should now be 0
                  await nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE);
                  const playerConnectedNftMarketplace = nftMarketplace.connect(player);
                  await playerConnectedNftMarketplace.buyItem(basicNft.address, TOKEN_ID, {
                      value: PRICE,
                  });
                  await nftMarketplace.withdrawProceeds();
                  const account0Proceeds = await nftMarketplace.getProceeds(deployer.address);
                  assert(account0Proceeds == 0);
              });
          });
      });
