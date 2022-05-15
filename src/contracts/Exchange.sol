// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.11;

import "./hip-206/HederaTokenService.sol";
import "./hip-206/HederaResponseCodes.sol";
import "./Token.sol";
import "./SafeMathInt64.sol";


contract Exchange is HederaTokenService {

    using SafeMath for int64;

    // Variables;
    address exchangeAddress;
    address tokenAddress;
    address public feeAccount; // the account that receives the exchange fees
    int64 public feePercent; // the fee %
    address constant HBAR = address(0); // store HBAR in tokens mapping with blank address
    mapping(address => mapping(address => int64)) public tokens;
    mapping(address => bool) tokenAssociated;
    mapping(int64 => _Order) public orders;
    int64 public orderCount;
    mapping(int64 => bool) public orderCancelled;
    mapping(int64 => bool) public orderFilled;
    Token ctToken;
    
    //Events
    event Deposit(address token, address user, int64 amount, int64 balance);
    event Withdraw(address token, address user, int64 amount, int64 balance);
    event Order(
        int64 id,
        address user,
        address tokenGet,
        int64 amountGet,
        address tokenGive,
        int64 amountGive,
        uint256 timestamp
    );
    event Cancel(
        int64 id,
        address user,
        address tokenGet,
        int64 amountGet,
        address tokenGive,
        int64 amountGive,
        uint256 timestamp
    );
    event Trade(
        int64 id,
        address user,
        address tokenGet,
        int64 amountGet,
        address tokenGive,
        int64 amountGive,
        address userFill,
        uint256 timestamp
    );

    // Strucks
    struct _Order {
        int64 id;
        address user;
        address tokenGet;
        int64 amountGet;
        address tokenGive;
        int64 amountGive;
        uint256 timestamp;
    }

    constructor (address _feeAccount, int64 _feePercent, address _tokenAddress, address _exchangeAddress) {
        feeAccount = _feeAccount;
        feePercent = _feePercent;
        HederaTokenService.associateToken(address(this), _tokenAddress);
        tokenAssociated[_tokenAddress] = true;
        tokenAddress = _tokenAddress;
        exchangeAddress = _exchangeAddress;
    }

    fallback() external {
        revert();
    }

    function depositToken(address _token, address _sender, int64 _amount) public {
        require(_token != HBAR);
        if(tokenAssociated[_token] != true) {
            HederaTokenService.associateToken(exchangeAddress, _token);
        }
        HederaTokenService.transferToken(_token, _sender, exchangeAddress, _amount);
        tokens[_token][_sender] = tokens[_token][_sender].add(_amount); 
        emit Deposit(_token, msg.sender, _amount, tokens[_token][_sender]);
    }

    function withdrawToken(address _token, address _receiver, int64 _amount) public {
        require(_token != HBAR); 
        require(tokens[_token][_receiver] >= _amount);
        tokens[_token][_receiver] = tokens[_token][_receiver].sub(_amount);
        HederaTokenService.transferToken(_token, exchangeAddress, _receiver, _amount);
        emit Withdraw(_token, msg.sender, _amount, tokens[_token][_receiver]);
    }

    function balanceOf(address _token, address _user) public view returns (int64) {
        return tokens[_token][_user];
    }

    function makeOrder(address _tokenGet, int64 _amountGet, address _tokenGive, int64 _amountGive, address _sender) public {
        orderCount = orderCount.add(1);
        orders[orderCount] = _Order(orderCount, _sender, _tokenGet, _amountGet, _tokenGive, _amountGive, block.timestamp);
        emit Order(orderCount, _sender, _tokenGet, _amountGet, _tokenGive, _amountGive, block.timestamp);
    }

    function cancelOrder(int64 _id, address _sender) public {
        _Order storage _order = orders[_id];
        require(address(_order.user) == _sender);
        require(_order.id == _id); // The order must exist
        orderCancelled[_id] = true;
        emit Cancel(_order.id, _sender, _order.tokenGet, _order.amountGet, _order.tokenGive, _order.amountGive, block.timestamp);
    }

    function fillOrder(int64 _id, address _sender) public {
        require(_id > 0 && _id <= orderCount);
        require(!orderFilled[_id]);
        require(!orderCancelled[_id]);
        _Order storage _order = orders[_id];
        _trade(_order.id, _order.user, _order.tokenGet, _order.amountGet, _order.tokenGive, _order.amountGive, _sender);
        orderFilled[_order.id] = true;
    }

    function _trade(int64 _orderId, address _user, address _tokenGet, int64 _amountGet, address _tokenGive, int64 _amountGive, address _sender) internal {
        int64 _feeAmount = _amountGive * (feePercent/100);
        int64 _amountDeduct = _feeAmount + _amountGet;
        tokens[_tokenGet][_sender] = tokens[_tokenGet][_sender].sub(_amountDeduct);
        tokens[_tokenGet][_user] = tokens[_tokenGet][_user].add(_amountGet);
        tokens[_tokenGet][feeAccount] = tokens[_tokenGet][feeAccount].add(_feeAmount);
        tokens[_tokenGive][_user] = tokens[_tokenGive][_user].sub(_amountGive);
        tokens[_tokenGive][_sender] = tokens[_tokenGive][_sender].add(_amountGet);
        emit Trade(_orderId, _user, _tokenGet, _amountGet, _tokenGive, _amountGive, _sender, block.timestamp);
    }
}



