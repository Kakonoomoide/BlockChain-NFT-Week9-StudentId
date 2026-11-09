// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract TicketNFT {
    struct Ticket {
        string eventName;
        string seat;
        bool used;
        uint256 mintedAt;
    }

    string public name;
    string public symbol;
    address public organizer;
    uint256 public maxSupply;
    uint256 public nextId;

    mapping(uint256 => address) private _owners;
    mapping(address => uint256) private _balances;
    mapping(uint256 => address) private _approved;
    mapping(uint256 => Ticket) private _tickets;

    event Transfer(
        address indexed from,
        address indexed to,
        uint256 indexed tokenId
    );
    event Approval(
        address indexed owner,
        address indexed approved,
        uint256 indexed tokenId
    );
    event CheckedIn(uint256 indexed tokenId, address indexed holder);

    modifier onlyOrganizer() {
        require(msg.sender == organizer, "Hanya panitia");
        _;
    }

    modifier exists(uint256 id) {
        require(_owners[id] != address(0), "Tiket tidak ada");
        _;
    }

    constructor(
        string memory _name,
        string memory _symbol,
        uint256 _maxSupply
    ) {
        require(_maxSupply > 0, "maxSupply harus > 0");
        name = _name;
        symbol = _symbol;
        maxSupply = _maxSupply;
        organizer = msg.sender;
    }

    // MINT: hanya panitia, dibatasi maxSupply
    function mint(
        address to,
        string calldata eventName,
        string calldata seat
    ) external onlyOrganizer returns (uint256 id) {
        require(to != address(0), "Alamat tujuan tidak valid");
        require(nextId < maxSupply, "Kuota tiket habis");
        require(
            bytes(eventName).length > 0 && bytes(eventName).length <= 100,
            "Nama event 1-100 karakter"
        );
        require(bytes(seat).length <= 20, "Kursi max 20 karakter");

        id = nextId++;
        _owners[id] = to;
        _balances[to]++;
        _tickets[id] = Ticket(eventName, seat, false, block.timestamp);
        emit Transfer(address(0), to, id);
    }

    // READ
    function ownerOf(uint256 id) external view exists(id) returns (address) {
        return _owners[id];
    }

    function balanceOf(address holder) external view returns (uint256) {
        require(holder != address(0), "Alamat tidak valid");
        return _balances[holder];
    }

    function getTicket(
        uint256 id
    ) external view exists(id) returns (Ticket memory) {
        return _tickets[id];
    }

    function getApproved(
        uint256 id
    ) external view exists(id) returns (address) {
        return _approved[id];
    }

    // Verifikasi keaslian: ada dan belum dipakai
    function isValid(uint256 id) external view returns (bool) {
        return _owners[id] != address(0) && !_tickets[id].used;
    }

    // APPROVE: izinkan alamat lain memindahkan tiket ini
    function approve(address to, uint256 id) external exists(id) {
        require(msg.sender == _owners[id], "Bukan pemilik tiket");
        require(!_tickets[id].used, "Tiket sudah dipakai");
        _approved[id] = to;
        emit Approval(msg.sender, to, id);
    }

    // TRANSFER: pemilik atau alamat yang di-approve; tiket terpakai tidak bisa dipindah
    function transferFrom(
        address from,
        address to,
        uint256 id
    ) external exists(id) {
        address holder = _owners[id];
        require(from == holder, "From bukan pemilik");
        require(to != address(0), "Alamat tujuan tidak valid");
        require(
            msg.sender == holder || msg.sender == _approved[id],
            "Tidak berhak transfer"
        );
        require(!_tickets[id].used, "Tiket sudah dipakai");

        delete _approved[id];
        _balances[from]--;
        _balances[to]++;
        _owners[id] = to;
        emit Transfer(from, to, id);
    }

    // CHECK-IN: panitia menandai tiket terpakai (anti-double-use)
    function checkIn(uint256 id) external onlyOrganizer exists(id) {
        require(!_tickets[id].used, "Tiket sudah dipakai");
        _tickets[id].used = true;
        delete _approved[id];
        emit CheckedIn(id, _owners[id]);
    }
}
