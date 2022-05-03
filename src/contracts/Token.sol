// SPDX-License-Identifier: Apache-2.0
pragma solidity >=0.7.0 <0.9.0;
 
import "./hip-206/HederaTokenService.sol";
import "./hip-206/HederaResponseCodes.sol";
import "./SafeMathInt64.sol";

contract Token is HederaTokenService {

    using SafeMath for int64;

    //variables
    address exchangeAddress;
    address tokenAddress;
    int64 public totalSupply;

    mapping(address => int64) public balanceOf;

    // Events
    event Transfer(address indexed sender, address indexed receiver, int64 amount);
    event Association(address indexed spender, address indexed token);

    constructor(address _tokenAddress) {
        tokenAddress = _tokenAddress;
        totalSupply = 1000000;
        balanceOf[msg.sender] = totalSupply;
        HederaTokenService.associateToken(address(this), tokenAddress);
    }

    function associate(address _spender) external {
        int response = HederaTokenService.associateToken(_spender, tokenAddress);
        if (response != HederaResponseCodes.SUCCESS) {
            revert ("Associate Failed");
        }
        emit Association(_spender, tokenAddress);
    }
    
    function transfer(address _receiver, int64 _amount) public returns (bool success) {
        require(balanceOf[msg.sender] >= _amount);
        _transfer(msg.sender, _receiver, _amount);
        return true;
    }

     function _transfer(address _sender, address _receiver, int64 _amount) internal {
        require(_receiver != address(0));
        balanceOf[_sender] = balanceOf[_sender].sub(_amount);
        balanceOf[_receiver] = balanceOf[_receiver].add(_amount);
        int response = HederaTokenService.transferToken(tokenAddress, _sender, _receiver, _amount);
        if (response != HederaResponseCodes.SUCCESS) {
            revert ("Transfer Failed");
        }
        emit Transfer(_sender, _receiver, _amount);
    }

    function transferCurrency(address _token, address _sender, address _receiver, int64 _amount) public returns (bool success) {
        require(_receiver != address(0));
        HederaTokenService.transferToken(_token, _sender, _receiver, _amount);
        return true;
    }
}
