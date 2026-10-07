pragma solidity ^0.5.16;

contract RentalAgreement {

    enum Status { Created, Accepted, Active, EndRequested, Disputed, Settled, Closed }

    address payable public landlord;
    address payable public tenant;

    string  public propertyAddress;
    uint256 public monthlyRent;
    uint256 public depositAmount;
    uint256 public leaseDuration;
    uint256 public leaseStart;
    uint256 public depositBalance;

    Status  public status;

    uint256 public disputedDeduction;
    string  public disputeReason;

    uint256 public endRequestedAt;
    uint256 constant DISPUTE_TIMEOUT = 7 days;

    struct RentPayment {
        uint256 amount;
        uint256 timestamp;
    }
    RentPayment[] public rentPayments;

    event AgreementCreated(address indexed landlord, string property, uint256 rent, uint256 deposit, uint256 durationMonths);
    event AgreementAccepted(address indexed tenant, uint256 timestamp);
    event DepositPaid(address indexed tenant, uint256 amount);
    event RentPaid(address indexed tenant, uint256 amount, uint256 timestamp);
    event LeaseEndRequested(address indexed tenant, uint256 timestamp);
    event DisputeRaised(address indexed landlord, uint256 deduction, string reason);
    event DeductionAccepted(address indexed tenant, uint256 deductedAmount, uint256 refundAmount);
    event DepositReturned(address indexed tenant, uint256 amount);
    event AgreementClosed(uint256 timestamp);

    modifier onlyLandlord() { require(msg.sender == landlord, "Only landlord"); _; }
    modifier onlyTenant()   { require(msg.sender == tenant,   "Only tenant");   _; }
    modifier inStatus(Status s) { require(status == s, "Invalid status"); _; }

    constructor(
        string memory _propertyAddress,
        uint256 _monthlyRent,
        uint256 _depositAmount,
        uint256 _leaseDuration
    ) public {
        landlord        = msg.sender;
        propertyAddress = _propertyAddress;
        monthlyRent     = _monthlyRent;
        depositAmount   = _depositAmount;
        leaseDuration   = _leaseDuration;
        status          = Status.Created;
        emit AgreementCreated(landlord, propertyAddress, monthlyRent, depositAmount, leaseDuration);
    }

    function acceptAgreement() external inStatus(Status.Created) {
        require(msg.sender != landlord, "Landlord cannot be tenant");
        tenant = msg.sender;
        status = Status.Accepted;
        emit AgreementAccepted(tenant, now);
    }

    function payDeposit() external payable onlyTenant inStatus(Status.Accepted) {
        require(msg.value == depositAmount, "Send exact deposit amount");
        depositBalance = msg.value;
        status         = Status.Active;
        leaseStart     = now;
        emit DepositPaid(tenant, msg.value);
    }

    function payRent() external payable onlyTenant inStatus(Status.Active) {
        require(msg.value == monthlyRent, "Send exact rent amount");
        landlord.transfer(msg.value);
        rentPayments.push(RentPayment({ amount: msg.value, timestamp: now }));
        emit RentPaid(tenant, msg.value, now);
    }

    function requestLeaseEnd() external onlyTenant inStatus(Status.Active) {
        status         = Status.EndRequested;
        endRequestedAt = now;
        emit LeaseEndRequested(tenant, now);
    }

    function approveDepositReturn() external onlyLandlord inStatus(Status.EndRequested) {
        uint256 refund = depositBalance;
        depositBalance = 0;
        status         = Status.Settled;
        tenant.transfer(refund);
        emit DepositReturned(tenant, refund);
        _close();
    }

    function raiseDispute(uint256 deduction, string calldata reason) external onlyLandlord inStatus(Status.EndRequested) {
        require(deduction > 0 && deduction <= depositBalance, "Invalid deduction");
        disputedDeduction = deduction;
        disputeReason     = reason;
        status            = Status.Disputed;
        emit DisputeRaised(landlord, deduction, reason);
    }

    function acceptDeduction() external onlyTenant inStatus(Status.Disputed) {
        uint256 deduction = disputedDeduction;
        uint256 refund    = depositBalance - deduction;
        depositBalance    = 0;
        disputedDeduction = 0;
        status            = Status.Settled;
        if (deduction > 0) landlord.transfer(deduction);
        if (refund > 0)    tenant.transfer(refund);
        emit DeductionAccepted(tenant, deduction, refund);
        _close();
    }

    function claimDepositAfterTimeout() external onlyTenant {
        require(status == Status.EndRequested || status == Status.Disputed, "Invalid state");
        require(now >= endRequestedAt + DISPUTE_TIMEOUT, "Timeout not passed");
        uint256 refund = depositBalance;
        depositBalance = 0;
        status         = Status.Settled;
        tenant.transfer(refund);
        emit DepositReturned(tenant, refund);
        _close();
    }

    function _close() internal {
        status = Status.Closed;
        emit AgreementClosed(now);
    }

    function getRentPaymentCount() external view returns (uint256) {
        return rentPayments.length;
    }

    function getRentPayment(uint256 i) external view returns (uint256 amount, uint256 timestamp) {
        require(i < rentPayments.length, "Index out of range");
        return (rentPayments[i].amount, rentPayments[i].timestamp);
    }

    function getStatusString() external view returns (string memory) {
        if (status == Status.Created)      return "Created";
        if (status == Status.Accepted)     return "Accepted";
        if (status == Status.Active)       return "Active";
        if (status == Status.EndRequested) return "End Requested";
        if (status == Status.Disputed)     return "Disputed";
        if (status == Status.Settled)      return "Settled";
        if (status == Status.Closed)       return "Closed";
        return "Unknown";
    }

    function getSummary() external view returns (
        address _landlord,
        address _tenant,
        string memory _property,
        uint256 _rent,
        uint256 _deposit,
        uint256 _duration,
        uint256 _leaseStart,
        uint256 _depositBalance,
        string memory _status,
        uint256 _paymentCount
    ) {
        return (
            landlord, tenant, propertyAddress,
            monthlyRent, depositAmount, leaseDuration,
            leaseStart, depositBalance,
            this.getStatusString(),
            rentPayments.length
        );
    }
}
