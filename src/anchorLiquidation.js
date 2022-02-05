const { fabricateLiquidationQueueSubmitBid } = require('@anchor-protocol/anchor.js');
const { buildExecuteMsg, sendMsg } = require('./utils');

class Anchor {
	constructor(client, owner, wallet, liquidationQueueAddress, collateralTokenAddress, anchorAddressProvider) {
		this.client = client;
		this.owner = owner;
		this.wallet = wallet;
		this.liquidationQueueAddress = liquidationQueueAddress;
		this.collateralTokenAddress = collateralTokenAddress;
		this.anchorAddressProvider = anchorAddressProvider; // TODO: Deprecate fabricators and remove this
	}
	
	submitBidMsg(amount, premiumSlot) {
		return fabricateLiquidationQueueSubmitBid({
			address: this.owner.accAddress,
			collateral_token: this.collateralTokenAddress, // Should be bLUNA or bETH contract address
			premium_slot: premiumSlot, // Bid for a 4% discount
			amount: amount, // Amount to bid
			denom: 'uusd'
		})(this.anchorAddressProvider)
	}
	
	async queryUserBids() {
		return await this.client.wasm.contractQuery(
			this.liquidationQueueAddress,
			{
			  "bids_by_user": {
				"collateral_token": this.collateralTokenAddress, // TODO: Set to a variable
				"bidder": this.owner.accAddress,
			  }
			}
		);
	}
	
	async getCoinBalance(denom) {
		const balances = await this.client.bank.balance(this.owner.accAddress);
		try {
			const balance = balances[0]["_coins"][denom]["amount"];
			return balance;
		} catch {
			return "0";
		}
	}
	
	async enterLiquidationQueue(minimumUusdBalance, premiumSlot) {
		const uusdBalance = await this.getCoinBalance('uusd');
		if(parseInt(uusdBalance) > minimumUusdBalance) { // If our wallet has at least 100 UST
			const parsedUSTBalance = (parseInt(uusdBalance) / 1_000_000).toString();
			const bidMsg = await this.submitBidMsg(parsedUSTBalance, premiumSlot);
			const bidTx = await sendMsg(this.client, this.wallet, bidMsg);
			return bidTx;
		}
		return "Not enough UST, no new bids";
	}
	
	async activateBids() {
		const userBids = await this.queryUserBids();
		const currentTime = Math.floor(Date.now() / 1000);
		if(userBids.bids.length > 0) {
			for(let i = 0; i < userBids.bids.length; i++) {
				if((userBids.bids[i].wait_end != 0 && userBids.bids[i].wait_end != null) && userBids.bids[i].wait_end < currentTime) {
					await buildExecuteMsg(this.owner.accAddress, this.liquidationQueueAddress, {
						  "activate_bids": {
							"collateral_token": this.collateralTokenAddress,
						  }
						})
					.then((activateBidsMsg) => {sendMsg(this.client, this.wallet, activateBidsMsg)
						.then((txReceipt) => {
							console.log(txReceipt)
						}
					)})
					break;
				}
			}
		}
	}
	
	async claimLiquidations() {
		const userBids = await this.queryUserBids();
		for(let i = 0; i < userBids.bids.length; i++) {
			if(userBids.bids[i].pending_liquidated_collateral > 0) {
				const claimLiquidationsActions = {
				  "claim_liquidations": {
					"collateral_token": this.collateralTokenAddress,
				  }
				}
				await buildExecuteMsg(this.owner.accAddress, this.liquidationQueueAddress, claimLiquidationsActions)
				.then(
					(claimLiquidationsMsg) => {sendMsg(this.client, this.wallet, claimLiquidationsMsg)
						.then((claimLiquidationsTxReceipt) => {
							console.log(claimLiquidationsTxReceipt)
						}
					)
				})
				break;
			}
		}
	}
}

module.exports = { Anchor };