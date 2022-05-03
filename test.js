console.clear();

// this file will test all the functions on Token.sol 
// On Exchange.sol depositToken, withdrawToken and balanceOf
// excluding: makeOrder, cancelOrder fillOrder - for this we will need a second token
// I created 2 tokens and store them on my .env file in order to use the testExchange.js file.

require("dotenv").config();
const {
	Client,
	AccountId,
	PrivateKey,
	TokenCreateTransaction,
	FileCreateTransaction,
	FileAppendTransaction,
	ContractCreateTransaction,
	ContractFunctionParameters,
	TokenUpdateTransaction,
	ContractExecuteTransaction,
	TokenInfoQuery,
	AccountBalanceQuery,
	Hbar,
	ContractCallQuery,
} = require("@hashgraph/sdk");
const fs = require("fs");

const operatorId = AccountId.fromString(process.env.OPERATOR_ID);
const operatorKey = PrivateKey.fromString(process.env.OPERATOR_PVKEY);
const treasuryId = AccountId.fromString(process.env.TREASURY_ID);
const treasuryKey = PrivateKey.fromString(process.env.TREASURY_PVKEY);
const aliceId = AccountId.fromString(process.env.ALICE_ID);
const aliceKey = PrivateKey.fromString(process.env.ALICE_PVKEY);
const exchangeId = AccountId.fromString(process.env.EXCHANGE_ID);
const exchangeKey = PrivateKey.fromString(process.env.EXCHANGE_PVKEY);
const exchangeAddressSol = exchangeId.toSolidityAddress();


const client = Client.forTestnet().setOperator(operatorId, operatorKey);
client.setDefaultMaxTransactionFee(new Hbar(10));
client.setMaxQueryPayment(new Hbar(2));

async function main() {
	// STEP 1 ===================================
	console.log(`STEP 1 ===================================`);
	const bytecodeToken = fs.readFileSync("./src/contracts/Token_sol_Token.bin");
	console.log(`- bytecodeToken Done`);
	const bytecodeExchange = fs.readFileSync("./src/contracts/Exchange_sol_Exchange.bin");
	console.log(`- bytecodeExchange Done \n`);

	// STEP 2 ===================================
	console.log(`STEP 2 ===================================`);
	//Create a fungible token
	const tokenCreateTx = await new TokenCreateTransaction()
		.setTokenName("hdex")
		.setTokenSymbol("HDEX")
		.setDecimals(0)
		.setInitialSupply(1000000)
		.setTreasuryAccountId(treasuryId)
		.setAdminKey(treasuryKey)
		.setSupplyKey(treasuryKey)
		.freezeWith(client);
	const tokenCreateSign = await tokenCreateTx.sign(treasuryKey);
	const tokenCreateSubmit = await tokenCreateSign.execute(client);
	const tokenCreateRx = await tokenCreateSubmit.getReceipt(client);
	const tokenId = tokenCreateRx.tokenId;
	const tokenAddressSol = tokenId.toSolidityAddress();
	console.log(`- Token ID: ${tokenId}`);
	console.log(`- Token ID in Solidity format: ${tokenAddressSol}`);

	// Token query
	const query = new TokenInfoQuery()
		.setTokenId(tokenId);	

	const tokenSupply = (await query.execute(client)).totalSupply;
	console.log(`- The total supply of this token is ${tokenSupply}`);

	//Create a file on Hedera and store the contract bytecodeToken
	const fileCreateTx = new FileCreateTransaction().setKeys([treasuryKey]).freezeWith(client);
	const fileCreateSign = await fileCreateTx.sign(treasuryKey);
	const fileCreateSubmit = await fileCreateSign.execute(client);
	const fileCreateRx = await fileCreateSubmit.getReceipt(client);
	const bytecodeTokenFileId = fileCreateRx.fileId;
	console.log(`- The smart contract bytecodeToken file ID is ${bytecodeTokenFileId}`);

	// Append contents to the file
	const fileAppendTx = new FileAppendTransaction()
		.setFileId(bytecodeTokenFileId)
		.setContents(bytecodeToken)
		.setMaxChunks(10)
		.freezeWith(client);
	const fileAppendSign = await fileAppendTx.sign(treasuryKey);
	const fileAppendSubmit = await fileAppendSign.execute(client);
	const fileAppendRx = await fileAppendSubmit.getReceipt(client);
	console.log(`- Content added bytecodeToken: ${fileAppendRx.status} \n`);

	// STEP 3 ===================================
	console.log(`STEP 3 ===================================`);
	// Create the smart contract
	const contractInstantiateTx = new ContractCreateTransaction()
		.setBytecodeFileId(bytecodeTokenFileId)
		.setGas(3000000)
		.setConstructorParameters(new ContractFunctionParameters().addAddress(tokenAddressSol));
	const contractInstantiateSubmit = await contractInstantiateTx.execute(client);
	const contractInstantiateRx = await contractInstantiateSubmit.getReceipt(client);
	const contractId = contractInstantiateRx.contractId;
	const contractAddress = contractId.toSolidityAddress();
	console.log(`- The smart contract ID is: ${contractId}`);
	console.log(`- The smart contract ID in Solidity format is: ${contractAddress}`);

	// Update the fungible so the smart contract manages the supply
	const tokenUpdateTx = await new TokenUpdateTransaction()
		.setTokenId(tokenId)
		.setSupplyKey(contractId)
		.freezeWith(client)
		.sign(treasuryKey);
	const tokenUpdateSubmit = await tokenUpdateTx.execute(client);
	const tokenUpdateRx = await tokenUpdateSubmit.getReceipt(client);
	console.log(`- Token update status: ${tokenUpdateRx.status}`);

	// Token query 2.2
	const query2p2 = new TokenInfoQuery()
			.setTokenId(tokenId);				
	const tokenSupply2p2 = (await query2p2.execute(client)).totalSupply;
	console.log(`- The total supply of this token is  ${tokenSupply2p2} \n`);

	// STEP 4 ===================================
	console.log(`STEP 4 ===================================`);
	//Execute a contract function (associate Alice)
	const contractExecTx1 = await new ContractExecuteTransaction()
		.setContractId(contractId)
		.setGas(3000000)
		.setFunction("associate", new ContractFunctionParameters().addAddress(aliceId.toSolidityAddress()))
		.freezeWith(client);
	const contractExecSign1 = await contractExecTx1.sign(aliceKey);
	const contractExecSubmit1 = await contractExecSign1.execute(client);
	const contractExecRx1 = await contractExecSubmit1.getReceipt(client);
	console.log(`- Token association with Alice's account: ${contractExecRx1.status.toString()}`);

	//Execute a contract function (associate Exchange)
	const contractExecTx8 = await new ContractExecuteTransaction()
		.setContractId(contractId)
		.setGas(3000000)
		.setFunction("associate", new ContractFunctionParameters().addAddress(exchangeId.toSolidityAddress()))
		.freezeWith(client);
	const contractExecSign8 = await contractExecTx8.sign(exchangeKey);
	const contractExecSubmit8 = await contractExecSign8.execute(client);
	const contractExecRx8 = await contractExecSubmit8.getReceipt(client);
	console.log(`- Token association with Exchange's account: ${contractExecRx8.status.toString()}`);

	//Execute a contract function (transfer)
	const contractExecTx2 = await new ContractExecuteTransaction()
		.setContractId(contractId)
		.setGas(3000000)
		.setFunction(
			"transfer",
			new ContractFunctionParameters()
				.addAddress(aliceId.toSolidityAddress())
				.addInt64(1000)
		)
		.freezeWith(client);
	const contractExecSign2 = await contractExecTx2.sign(treasuryKey);
	const contractExecSubmit2 = await contractExecSign2.execute(client);
	const contractExecRx2 = await contractExecSubmit2.getReceipt(client);
	console.log(`- Token transfer from Treasury to Alice: ${contractExecRx2.status.toString()}`);

	//Execute a contract function (transfer)
	const contractExecTx4 = await new ContractExecuteTransaction()
		.setContractId(contractId)
		.setGas(3000000)
		.setFunction(
			"transfer",
			new ContractFunctionParameters()
				.addAddress(exchangeId.toSolidityAddress())
				.addInt64(500)
		)
		.freezeWith(client);
	const contractExecSign4 = await contractExecTx4.sign(treasuryKey);
	const contractExecSubmit4 = await contractExecSign4.execute(client);
	const contractExecRx4 = await contractExecSubmit4.getReceipt(client);
	console.log(`- Token transfer from Treasury to Exchange: ${contractExecRx4.status.toString()}`);

	//Execute a contract function (transfer)
	const contractExecTx5 = await new ContractExecuteTransaction()
		.setContractId(contractId)
		.setGas(3000000)
		.setFunction(
			"transferCurrency",
			new ContractFunctionParameters()
				.addAddress(tokenId.toSolidityAddress())
				.addAddress(aliceId.toSolidityAddress())
				.addAddress(exchangeAddressSol)
				.addInt64(100)
		)
		.freezeWith(client);
	const contractExecSign5 = await contractExecTx5.sign(aliceKey);
	const contractExecSubmit5 = await contractExecSign5.execute(client);
	const contractExecRx5 = await contractExecSubmit5.getReceipt(client);
	console.log(`- Token transferCurrency from Alice to Exchange: ${contractExecRx5.status.toString()} \n`);

	const tB = await bCheckerFcn(treasuryId);
	const aB = await bCheckerFcn(aliceId);
	const eB = await bCheckerFcn(exchangeId);
	console.log(`- Treasury balance: ${tB} units of token ${tokenId}`);
	console.log(`- Alice balance: ${aB} units of token ${tokenId}`);
	console.log(`- Exchange balance: ${eB} units of token ${tokenId} \n`);

	//Step 5 ===================================
	console.log(`STEP 5 ===================================`);
	//Create a file on Hedera and store the contract bytecodeExchange
	const fileCreateTx2 = new FileCreateTransaction().setKeys([treasuryKey]).freezeWith(client);
	const fileCreateSign2 = await fileCreateTx2.sign(treasuryKey);
	const fileCreateSubmit2 = await fileCreateSign2.execute(client);
	const fileCreateRx2 = await fileCreateSubmit2.getReceipt(client);
	const bytecodeExchangeFileId = fileCreateRx2.fileId;
	console.log(`- The smart contract bytecodeExchange file ID is ${bytecodeExchangeFileId}`);

	// Append contents to the file
	const fileAppendTxEx = new FileAppendTransaction()
		.setFileId(bytecodeExchangeFileId)
		.setContents(bytecodeExchange)
		//.setMaxChunks(20)
		.freezeWith(client);
	const fileAppendSignEx = await fileAppendTxEx.sign(treasuryKey);
	const fileAppendSubmitEx = await fileAppendSignEx.execute(client);
	const fileAppendRxEx = await fileAppendSubmitEx.getReceipt(client);
	console.log(`- Content added bytecodeExchange: ${fileAppendRxEx.status} \n`);

	// STEP 6 ===================================
	console.log(`STEP 6 ===================================`);
	// Create the smart contract
	const contractInstantiateTxEx = new ContractCreateTransaction()
		.setBytecodeFileId(bytecodeExchangeFileId)
		.setGas(3000000)
		.setConstructorParameters(new ContractFunctionParameters().addAddress(exchangeAddressSol).addInt64(10).addAddress(tokenAddressSol).addAddress(exchangeAddressSol));
	const contractInstantiateSubmitEx = await contractInstantiateTxEx.execute(client);
	const contractInstantiateRxEx = await contractInstantiateSubmitEx.getReceipt(client);
	const contractIdEx = contractInstantiateRxEx.contractId;
	const contractAddressEx = contractIdEx.toSolidityAddress();
	console.log(`- The smart contract ID is: ${contractIdEx}`);
	console.log(`- The smart contract ID in Solidity format is: ${contractAddressEx} \n`);

	// STEP 7 ===================================
	console.log(`STEP 7 ===================================`);
	
	const aC = await bCheckerFcn(aliceId);
	const eC = await bCheckerFcn(exchangeId);
	console.log(`- Alice balance: ${aC} units of ${tokenId.toString()} - before token deposit`);
	console.log(`- Exchange balance: ${eC} units of ${tokenId.toString()}  - before token deposit \n`);

	//Execute a contract function (deposit token)
	const contractExecTx1Ex = new ContractExecuteTransaction()
		.setContractId(contractIdEx)
		.setGas(3000000)
		.setFunction(
			"depositToken", 
			new ContractFunctionParameters()
				.addAddress(tokenId.toSolidityAddress())
				.addAddress(aliceId.toSolidityAddress())
				.addInt64(100)
		)
		.freezeWith(client);
	const contractExecSign1Ex = await contractExecTx1Ex.sign(aliceKey);
	const contractExecSubmit1Ex = await contractExecSign1Ex.execute(client);
	const contractExecRx1Ex = await contractExecSubmit1Ex.getReceipt(client);
	console.log(`- Token Deposit: ${contractExecRx1Ex.status.toString()}`);

	const aD = await bCheckerFcn(aliceId);
	const eD = await bCheckerFcn(exchangeId);
	console.log(`- Alice balance: ${aD} units of ${tokenId.toString()} - After depositing token`);
	console.log(`- Exchange balance: ${eD} units of ${tokenId.toString()} - After depositing token \n`);

	// Calls a function of the smart contract - balanceOf
	const contractQuery = await new ContractCallQuery()
		.setGas(100000)
		.setContractId(contractIdEx)
		.setFunction(
			"balanceOf",
			new ContractFunctionParameters()
				.addAddress(tokenId.toSolidityAddress())
				.addAddress(aliceId.toSolidityAddress())
		)
		.setQueryPayment(new Hbar(2));
	const getMessage = await contractQuery.execute(client);
	const message = getMessage.getInt64(0);
	console.log(`- balanceOf token: ${tokenId} amount: ${message} - before withdrawing token on exchange \n`);

    //Execute a contract function (withdraw token)
	const contractExecTx3Ex = new ContractExecuteTransaction()
		.setContractId(contractIdEx)
		.setGas(3000000)
		.setFunction(
			"withdrawToken", 
			new ContractFunctionParameters()
				.addAddress(tokenId.toSolidityAddress())
				.addAddress(aliceId.toSolidityAddress())
				.addInt64(50)
		)
		.freezeWith(client);
	const contractExecSign3Ex = await contractExecTx3Ex.sign(exchangeKey);
	const contractExecSubmit3Ex = await contractExecSign3Ex.execute(client);
	const contractExecRx3Ex = await contractExecSubmit3Ex.getReceipt(client);
	console.log(`- Token Withdrawn: ${contractExecRx3Ex.status.toString()}`);

	const aE = await bCheckerFcn(aliceId);
	const eE = await bCheckerFcn(exchangeId);
	const tE = await bCheckerFcn(treasuryId);
	console.log(`- Alice balance: ${aE} units of ${tokenId.toString()} - After withdrawing the token`);
	console.log(`- Exchange balance: ${eE} units of ${tokenId.toString()} - After withdrawing the token`);
	console.log(`- treasury balance: ${tE} units of ${tokenId.toString()} - After withdrawing the token \n`);

	// Calls a function of the smart contract - balanceOf
	const contractQuery2 = await new ContractCallQuery()
		.setGas(100000)
		.setContractId(contractIdEx)
		.setFunction(
			"balanceOf",
			new ContractFunctionParameters()
				.addAddress(tokenId.toSolidityAddress())
				.addAddress(aliceId.toSolidityAddress())
		)
		.setQueryPayment(new Hbar(2));
	const getMessage2 = await contractQuery2.execute(client);
	const message2 = getMessage2.getInt64(0);
	console.log(`- balanceOf token: ${tokenId} amount: ${message2} - After withdrawing the token on exchange \n`);

	// STEP 8 ===================================
	console.log(`STEP 8 Create and associate other token to use the exchange`);
	console.log(`================================================`)
	//Create a fungible token
	const tokenCreateTx2 = await new TokenCreateTransaction()
		.setTokenName("MOONDEX")
		.setTokenSymbol("MOON")
		.setDecimals(0)
		.setInitialSupply(1000000)
		.setTreasuryAccountId(treasuryId)
		.setAdminKey(treasuryKey)
		.setSupplyKey(treasuryKey)
		.freezeWith(client);
	const tokenCreateSign2 = await tokenCreateTx2.sign(treasuryKey);
	const tokenCreateSubmit2 = await tokenCreateSign2.execute(client);
	const tokenCreateRx2 = await tokenCreateSubmit2.getReceipt(client);
	const tokenId2 = tokenCreateRx2.tokenId;
	const tokenAddressSol2 = tokenId2.toSolidityAddress();
	console.log(`- Token ID: ${tokenId2}`);
	console.log(`- Token ID in Solidity format: ${tokenAddressSol2}`);

	// Token query
	const query2 = new TokenInfoQuery()
		.setTokenId(tokenId2);	

	const tokenSupply2 = (await query2.execute(client)).totalSupply;
	console.log(`- The total supply of this token is ${tokenSupply2}`);

	//Create a file on Hedera and store the contract bytecodeToken
	const fileCreateTx3 = new FileCreateTransaction().setKeys([treasuryKey]).freezeWith(client);
	const fileCreateSign3 = await fileCreateTx3.sign(treasuryKey);
	const fileCreateSubmit3 = await fileCreateSign3.execute(client);
	const fileCreateRx3 = await fileCreateSubmit3.getReceipt(client);
	const bytecodeTokenFileId3 = fileCreateRx3.fileId;
	console.log(`- The smart contract bytecodeToken file ID is ${bytecodeTokenFileId3}`);

	// Append contents to the file
	const fileAppendTx3 = new FileAppendTransaction()
		.setFileId(bytecodeTokenFileId3)
		.setContents(bytecodeToken)
		.setMaxChunks(10)
		.freezeWith(client);
	const fileAppendSign3 = await fileAppendTx3.sign(treasuryKey);
	const fileAppendSubmit3 = await fileAppendSign3.execute(client);
	const fileAppendRx3 = await fileAppendSubmit3.getReceipt(client);
	console.log(`- Content added bytecodeToken: ${fileAppendRx3.status} \n`);

	// Create the smart contract
	const contractInstantiateTx3 = new ContractCreateTransaction()
		.setBytecodeFileId(bytecodeTokenFileId3)
		.setGas(3000000)
		.setConstructorParameters(new ContractFunctionParameters().addAddress(tokenAddressSol2));
	const contractInstantiateSubmit3 = await contractInstantiateTx3.execute(client);
	const contractInstantiateRx3 = await contractInstantiateSubmit3.getReceipt(client);
	const contractId3 = contractInstantiateRx3.contractId;
	const contractAddress3 = contractId3.toSolidityAddress();
	console.log(`- The smart contract ID is: ${contractId3}`);
	console.log(`- The smart contract ID in Solidity format is: ${contractAddress3}`);

	// Update the fungible so the smart contract manages the supply
	const tokenUpdateTx3 = await new TokenUpdateTransaction()
		.setTokenId(tokenId2)
		.setSupplyKey(contractId3)
		.freezeWith(client)
		.sign(treasuryKey);
	const tokenUpdateSubmit3 = await tokenUpdateTx3.execute(client);
	const tokenUpdateRx3 = await tokenUpdateSubmit3.getReceipt(client);
	console.log(`- Token update status: ${tokenUpdateRx3.status}`);

	// Token query 2.2
	const query3p2 = new TokenInfoQuery()
			.setTokenId(tokenId2);				
	const tokenSupply3p2 = (await query3p2.execute(client)).totalSupply;
	console.log(`- The total supply of this token is  ${tokenSupply3p2} \n`);

	// STEP 9 ===================================
	console.log(`STEP 9 Associate new token and send initial balance - Alice`);
	console.log(`================================================`)
	//Execute a contract function (associate Alice)
	const contractExecTx10 = await new ContractExecuteTransaction()
		.setContractId(contractId3)
		.setGas(3000000)
		.setFunction("associate", new ContractFunctionParameters().addAddress(aliceId.toSolidityAddress()))
		.freezeWith(client);
	const contractExecSign10 = await contractExecTx10.sign(aliceKey);
	const contractExecSubmit10 = await contractExecSign10.execute(client);
	const contractExecRx10 = await contractExecSubmit10.getReceipt(client);
	console.log(`- Token association with Alice's account: ${contractExecRx10.status.toString()}`);

	//Execute a contract function (associate Exchange)
	const contractExecTx11 = await new ContractExecuteTransaction()
		.setContractId(contractId3)
		.setGas(3000000)
		.setFunction("associate", new ContractFunctionParameters().addAddress(exchangeId.toSolidityAddress()))
		.freezeWith(client);
	const contractExecSign11 = await contractExecTx11.sign(exchangeKey);
	const contractExecSubmit11 = await contractExecSign11.execute(client);
	const contractExecRx11 = await contractExecSubmit11.getReceipt(client);
	console.log(`- Token association with Exchange's account: ${contractExecRx11.status.toString()}`);

	//Execute a contract function (transfer)
	const contractExecTx12 = await new ContractExecuteTransaction()
		.setContractId(contractId3)
		.setGas(3000000)
		.setFunction(
			"transfer",
			new ContractFunctionParameters()
				.addAddress(aliceId.toSolidityAddress())
				.addInt64(5000)
		)
		.freezeWith(client);
	const contractExecSign12 = await contractExecTx12.sign(treasuryKey);
	const contractExecSubmit12 = await contractExecSign12.execute(client);
	const contractExecRx12 = await contractExecSubmit12.getReceipt(client);
	console.log(`- Token transfer from Treasury to Alice: ${contractExecRx12.status.toString()} \n`);

	// STEP 10 ===================================
	console.log(`STEP 10 Deposit the new token and start testing the orders`);
	console.log(`================================================`)
    //Execute a contract function (deposit token)
	const contractExecTx13Ex = new ContractExecuteTransaction()
		.setContractId(contractIdEx)
		.setGas(3000000)
		.setFunction(
			"depositToken", 
			new ContractFunctionParameters()
				.addAddress(tokenId2.toSolidityAddress())
				.addAddress(aliceId.toSolidityAddress())
				.addInt64(100)
		)
		.freezeWith(client);
	const contractExecSign13Ex = await contractExecTx13Ex.sign(aliceKey);
	const contractExecSubmit13Ex = await contractExecSign13Ex.execute(client);
	const contractExecRx13Ex = await contractExecSubmit13Ex.getReceipt(client);
	console.log(`- Token Deposit: ${contractExecRx13Ex.status.toString()} \n`);

	const aE1 = await tCheckerFcn(aliceId, tokenId);
	const eE1 = await tCheckerFcn(exchangeId, tokenId);
	console.log(`- Alice balance: ${aE1} units of ${tokenId.toString()} - HDEX token`);
	console.log(`- Exchange balance: ${eE1} units of ${tokenId.toString()} - HDEX token \n`);
	
	const aE2 = await tCheckerFcn(aliceId, tokenId2);
	const eE2 = await tCheckerFcn(exchangeId, tokenId2);
	console.log(`- Alice balance: ${aE2} units of ${tokenId2.toString()} - MOON token`);
	console.log(`- Exchange balance: ${eE2} units of ${tokenId2.toString()} - MOON token \n`);

	// STEP 11 ===================================
	console.log(`STEP 11 testing orders`);
	console.log(`================================================`)
    //Execute a contract function (make order)
	const contractExecTx14Ex = new ContractExecuteTransaction()
		.setContractId(contractIdEx)
		.setGas(3000000)
		.setFunction(
			"makeOrder", //(address _tokenGet, int64 _amountGet, address _tokenGive, int64 _amountGive) 
			new ContractFunctionParameters()
				.addAddress(tokenId.toSolidityAddress())
				.addInt64(2)
				.addAddress(tokenId2.toSolidityAddress())
				.addInt64(10)
		)
		.freezeWith(client);
	const contractExecSign14Ex = await contractExecTx14Ex.sign(aliceKey);
	const contractExecSubmit14Ex = await contractExecSign14Ex.execute(client);
	const contractExecRx14Ex = await contractExecSubmit14Ex.getReceipt(client);
	console.log(`- Make Order: ${contractExecRx14Ex.status.toString()} \n`);

	//Execute a contract function (make order)
	const contractExecTx15Ex = new ContractExecuteTransaction()
		.setContractId(contractIdEx)
		.setGas(3000000)
		.setFunction(
			"fillOrder", //(address _tokenGet, int64 _amountGet, address _tokenGive, int64 _amountGive) 
			new ContractFunctionParameters()
				.addInt64(1)
		)
		.freezeWith(client);
	const contractExecSign15Ex = await contractExecTx15Ex.sign(aliceKey);
	const contractExecSubmit15Ex = await contractExecSign15Ex.execute(client);
	const contractExecRx15Ex = await contractExecSubmit15Ex.getReceipt(client);
	console.log(`- Fill Order: ${contractExecRx15Ex.status.toString()} \n`);

	// Calls a function of the smart contract - balanceOf
	const contractQuery16 = await new ContractCallQuery()
		.setGas(100000)
		.setContractId(contractIdEx)
		.setFunction(
			"balanceOf",
			new ContractFunctionParameters()
				.addAddress(tokenId2.toSolidityAddress())
				.addAddress(aliceId.toSolidityAddress())
		)
		.setQueryPayment(new Hbar(2));
	const getMessage16 = await contractQuery16.execute(client);
	const message16 = getMessage16.getInt64(0);
	console.log(`- balanceOf MOON token: ${tokenId2} amount: ${message16} - before withdrawing the token on exchange \n`);

	//Execute a contract function (withdraw token)
	const contractExecTx17Ex = new ContractExecuteTransaction()
		.setContractId(contractIdEx)
		.setGas(3000000)
		.setFunction(
			"withdrawToken", 
			new ContractFunctionParameters()
				.addAddress(tokenId2.toSolidityAddress())
				.addAddress(aliceId.toSolidityAddress())
				.addInt64(52) //AQUI
		)
		.freezeWith(client);
	const contractExecSign17Ex = await contractExecTx17Ex.sign(aliceKey);
	const contractExecSubmit17Ex = await contractExecSign17Ex.execute(client);
	const contractExecRx17Ex = await contractExecSubmit17Ex.getReceipt(client);
	console.log(`- Token2 Withdrawn: ${contractExecRx17Ex.status.toString()} \n`);

    // Calls a function of the smart contract - balanceOf
	const contractQuery18 = await new ContractCallQuery()
		.setGas(100000)
		.setContractId(contractIdEx)
		.setFunction(
			"balanceOf",
			new ContractFunctionParameters()
				.addAddress(tokenId2.toSolidityAddress())
				.addAddress(aliceId.toSolidityAddress())
		)
		.setQueryPayment(new Hbar(2));
	const getMessage18 = await contractQuery18.execute(client);
	const message18 = getMessage18.getInt64(0);
	console.log(`- balanceOf MOON token: ${tokenId2} amount: ${message18} - After withdrawing the token on exchange \n`);

	const aE3 = await tCheckerFcn(aliceId, tokenId);
	const eE3 = await tCheckerFcn(exchangeId, tokenId);
	console.log(`- Alice balance: ${aE3} units of ${tokenId.toString()} - HDEX token`);
	console.log(`- Exchange balance: ${eE3} units of ${tokenId.toString()} - HDEX token \n`);
	
	const aE4 = await tCheckerFcn(aliceId, tokenId2);
	const eE4 = await tCheckerFcn(exchangeId, tokenId2);
	console.log(`- Alice balance: ${aE4} units of ${tokenId2.toString()} - MOON token`);
	console.log(`- Exchange balance: ${eE4} units of ${tokenId2.toString()} - MOON token \n`);


	// ========================================
	// FUNCTIONS
	async function bCheckerFcn(aId) {
		let balanceCheckTx = await new AccountBalanceQuery().setAccountId(aId).execute(client);
		return balanceCheckTx.tokens._map.get(tokenId.toString());
	}

	async function tCheckerFcn(aId, _tokenId) {
		let balanceCheckTx = await new AccountBalanceQuery().setAccountId(aId).execute(client);
		return balanceCheckTx.tokens._map.get(_tokenId.toString());
	}
}
main();