const {
  loadFixture,
  time,
} = require("@nomicfoundation/hardhat-network-helpers");
const { expect } = require("chai");
const { BigNumber, Contract } = require("ethers");
const { ethers } = require("hardhat");

describe("SimpleVoting", function () {
  async function deploy() {
    const Contract = await ethers.getContractFactory("SimpleVoting");
    const contract = await Contract.deploy();
    await contract.deployed();
    return { contract };
  }

  describe("Creating a ballot", function () {
    it("should create a ballot", async function () {
      const { contract } = await loadFixture(deploy);
      const startTime = (await time.latest()) + 60; // start the ballot in 60 seconds
      const duration = 300; // the ballot will be open for 300 seconds
      const question = "Who is the greatest rapper of all time?";
      const options = [
        "Tupac Shakur",
        "The Notorious B.I.G.",
        "Eminem",
        "Jay-Z",
      ];
      await contract.createBallot(question, options, startTime, duration);
      expect(await contract.getBallotByIndex(0)).to.deep.eq([
        question,
        options,
        BigNumber.from(startTime), // convert from uint
        BigNumber.from(duration), // convert from uint
      ]);
    });
    it("should revert if the ballot has less than 2 options", async function () {
      const { contract } = await loadFixture(deploy);
      const startTime = (await time.latest()) + 60; // start the ballot in 60 seconds
      const duration = 300; // the ballot will be open for 300 seconds
      const question = "Who is the greatest rapper of all time?";
      const options = [
        "Tupac Shakur",
        // "The Notorious B.I.G.",
        // "Eminem",
        // "Jay-Z"
      ];
      await expect(
        contract.createBallot(question, options, startTime, duration)
      ).to.be.revertedWith("Provide at minimum two options");
    });
    it("should revert if the start time is less than the current time", async function () {
      const { contract } = await loadFixture(deploy);
      const startTime = (await time.latest()) - 60; // start the ballot 60 seconds before the current time
      const duration = 300; // the ballot will be open for 300 seconds
      const question = "Who is the greatest rapper of all time?";
      const options = [
        "Tupac Shakur",
        "The Notorious B.I.G.",
        "Eminem",
        "Jay-Z",
      ];
      await expect(
        contract.createBallot(question, options, startTime, duration)
      ).to.be.revertedWith("Start time must be in the future");
    });
    it("should revert if the duration is less than 1", async function () {
      const { contract } = await loadFixture(deploy);
      const startTime = (await time.latest()) + 60; // start the ballot in 60 seconds
      const duration = 0; // the ballot will never be open
      const question = "Who is the greatest rapper of all time?";
      const options = [
        "Tupac Shakur",
        "The Notorious B.I.G.",
        "Eminem",
        "Jay-Z",
      ];
      await expect(
        contract.createBallot(question, options, startTime, duration)
      ).to.be.revertedWith("Duration must be greater than 0");
    });
  });
  describe("Casting a vote", function () {
    let contract;
    const duration = 300; // the ballot will be open for 300 seconds

    beforeEach(async function () {
      const fixture = ({ contract } = await loadFixture(deploy));
      const startTime = (await time.latest()) + 60; // start the ballot in 60 seconds
      const question = "Who is the greatest rapper of all time?";
      const options = [
        "Tupac Shakur",
        "The Notorious B.I.G.",
        "Eminem",
        "Jay-Z",
      ];
      await contract.createBallot(question, options, startTime, duration);
    });

    it("should be able to vote", async function () {
      const [signer] = await ethers.getSigners();
      await time.increase(61); // make sure its ballot is open
      await contract.cast(0, 0);
      expect(await contract.hasVoted(0, signer.address)).to.eq(true);
      expect(await contract.getTally(0, 0)).to.eq(1);
    });
    it("should revert if the user tries to vote before the start time", async function () {
      await expect(contract.cast(0, 0)).to.be.revertedWith(
        "Can't cast before start time"
      );
    });
    it("should revert if the user tries to vote after the end time", async function () {
      await time.increase(2000);
      await expect(contract.cast(0, 0)).to.be.revertedWith(
        "Can't cast after end time"
      );
    });
    it("should revert if the user tries to vote multiple times", async function () {
      await time.increase(61); // make sure its ballot is open
      await contract.cast(0, 0);
      await expect(contract.cast(0, 1)).to.be.revertedWith(
        "Address already casted a vote for ballot"
      );
    });
  });
  describe("Tallying votes", function () {
    let contract;
    const duration = 300; // the ballot will be open for 300 seconds

    beforeEach(async function () {
      const fixture = ({ contract } = await loadFixture(deploy));
      const startTime = (await time.latest()) + 60; // start the ballot in 60 seconds
      const question = "Who is the greatest rapper of all time?";
      const options = [
        "Tupac Shakur",
        "The Notorious B.I.G.",
        "Eminem",
        "Jay-Z",
      ];
      await contract.createBallot(question, options, startTime, duration);
      await time.increase(200);
      const signers = await ethers.getSigners();
      await contract.cast(0, 0);
      await contract.connect(signers[1]).cast(0, 0);
      await contract.connect(signers[2]).cast(0, 1);
      await contract.connect(signers[3]).cast(0, 2);
    });

    it("should return the results for every option", async function () {
      await time.increase(2000);
      expect(await contract.results(0)).to.deep.eq([
        BigNumber.from(2),
        BigNumber.from(1),
        BigNumber.from(1),
        BigNumber.from(0),
      ]);
    });
    it("should return the winner for a ballot", async function () {
      await time.increase(2000);
      expect(await contract.winners(0)).to.deep.eq([true, false, false, false]);
    });
    it("should return multiple winners for a tied ballot", async function () {
      const signers = await ethers.getSigners();
      await contract.connect(signers[4]).cast(0, 2);
      await time.increase(2000);
      expect(await contract.winners(0)).to.deep.eq([true, false, true, false]);
    });
  });
});
