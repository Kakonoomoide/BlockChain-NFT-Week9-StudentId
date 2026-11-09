const express = require("express");
const { ethers } = require("ethers");
const fs = require("node:fs");
const path = require("node:path");

// ===== KONFIGURASI (edit bagian ini saja) =====
const PORT = 3000;
const RPC_URL = "http://10.64.24.101:8585"; // server: 'http://10.64.24.101:8585'
const CHAIN_ID = 1912;
const CONTRACT_ADDRESS = "0xISI_ALAMAT_CONTRACT_DI_SINI"; // ubah dengan contarct address yang telah di deploy
const ABI_PATH = path.resolve("artifacts", "TicketNFT.json");
// ==============================================

try {
  process.loadEnvFile(".env");
} catch {}

if (!ethers.isAddress(CONTRACT_ADDRESS))
  throw new Error("CONTRACT_ADDRESS belum diisi di app.js");
if (!process.env.PRIVATE_KEY)
  throw new Error("PRIVATE_KEY belum diisi di .env");

const json = JSON.parse(fs.readFileSync(ABI_PATH, "utf8"));
const abi = Array.isArray(json) ? json : json.abi;

const provider = new ethers.JsonRpcProvider(RPC_URL, CHAIN_ID, {
  cacheTimeout: -1,
  staticNetwork: true,
});
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
const nft = new ethers.Contract(CONTRACT_ADDRESS, abi, wallet);

async function getDashboardData() {
  const [name, symbol, organizer, maxSupply, nextId] = await Promise.all([
    nft.name(),
    nft.symbol(),
    nft.organizer(),
    nft.maxSupply(),
    nft.nextId(),
  ]);

  const total = Number(nextId);

  const tickets = await Promise.all(
    Array.from({ length: total }, async (_, id) => {
      const [t, owner] = await Promise.all([
        nft.getTicket(id),
        nft.ownerOf(id),
      ]);

      return {
        id,
        event: t.eventName,
        seat: t.seat,
        used: t.used,
        owner,
      };
    }),
  );

  return {
    info: {
      name,
      symbol,
      organizer,
      maxSupply: Number(maxSupply),
      total,
      me: wallet.address,
    },
    tickets,
  };
}

const app = express();
app.set("view engine", "ejs");
app.use(express.urlencoded({ extended: false }));

// Bungkus aksi tulis: sukses atau gagal, redirect ke beranda dengan pesan
const act = (fn) => async (req, res) => {
  try {
    const msg = await fn(req);
    res.redirect("/?ok=" + encodeURIComponent(msg));
  } catch (e) {
    res.redirect(
      "/?err=" + encodeURIComponent(e.reason || e.shortMessage || e.message),
    );
  }
};

// Beranda: info contract + daftar tiket
app.get("/", async (req, res) => {
  try {
    const data = await getDashboardData();

    res.render("index", {
      ...data,
      ok: req.query.ok || null,
      err: req.query.err || null,
      query: null,
      verification: null,
    });
  } catch (e) {
    res
      .status(500)
      .send("Gagal membaca contract: " + (e.shortMessage || e.message));
  }
});

// Verifikasi keaslian tiket
app.get("/verify", async (req, res) => {
  try {
    const data = await getDashboardData();
    const id = Number(req.query.id);

    let verification = null;
    let err = null;

    if (!Number.isSafeInteger(id) || id < 0) {
      err = "ID tiket tidak valid";
    } else if (id >= data.info.total) {
      verification = {
        id,
        valid: false,
      };
    } else {
      const [ticket, owner] = await Promise.all([
        nft.getTicket(id),
        nft.ownerOf(id),
      ]);

      verification = {
        id,
        valid: true,
        event: ticket.eventName,
        seat: ticket.seat,
        owner,
        used: ticket.used,
      };
    }

    res.render("index", {
      ...data,
      query: req.query.id,
      verification,
      ok: null,
      err,
    });
  } catch (e) {
    res
      .status(500)
      .send("Gagal melakukan verifikasi: " + (e.shortMessage || e.message));
  }
});

app.post(
  "/mint",
  act(async (req) => {
    const { to, eventName, seat } = req.body;
    if (!ethers.isAddress(to)) throw new Error("Alamat penerima tidak valid");
    const tx = await nft.mint(to, eventName, seat);
    await tx.wait();
    return `Tiket berhasil dicetak untuk ${to}`;
  }),
);

app.post(
  "/checkin",
  act(async (req) => {
    const tx = await nft.checkIn(Number(req.body.id));
    await tx.wait();
    return `Tiket #${req.body.id} berhasil di-check-in`;
  }),
);

app.post(
  "/transfer",
  act(async (req) => {
    const id = Number(req.body.id);
    const { to } = req.body;
    if (!ethers.isAddress(to)) throw new Error("Alamat tujuan tidak valid");
    const from = await nft.ownerOf(id);
    const tx = await nft.transferFrom(from, to, id);
    await tx.wait();
    return `Tiket #${id} dipindahkan ke ${to}`;
  }),
);

app.listen(PORT, () => console.log(`dApp jalan di http://localhost:${PORT}`));
