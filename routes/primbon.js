import { Router } from "express";
import axios from "axios";
import * as cheerio from "cheerio";
import { validate, unifiedHandler } from "../utils/validation.js";

const router = Router();

async function scrapeArtiNama(nama) {
  const response = await axios.get(
    `https://primbon.com/arti_nama.php?nama1=${encodeURIComponent(nama)}&proses=+Submit%21+`,
    { timeout: 30000, headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" } }
  );
  
  const $ = cheerio.load(response.data);
  const fetchText = $("#body").text();

  try {
    return {
      nama,
      arti: fetchText.split("memiliki arti: ")[1].split("Nama:")[0].trim(),
      catatan: "Gunakan juga aplikasi numerologi Kecocokan Nama, untuk melihat sejauh mana keselarasan nama anda dengan diri anda."
    };
  } catch (e) {
    return { status: false, message: `Tidak ditemukan arti nama "${nama}". Cari dengan kata kunci yang lain.` };
  }
}

async function scrapeKecocokanNamaPasangan(nama1, nama2) {
  const response = await axios.get(
    `https://primbon.com/kecocokan_nama_pasangan.php?nama1=${encodeURIComponent(nama1)}&nama2=${encodeURIComponent(nama2)}&proses=+Submit%21+`,
    { timeout: 30000, headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" } }
  );
  
  const $ = cheerio.load(response.data);
  const fetchText = $("#body").text();

  try {
    return {
      nama_anda: nama1,
      nama_pasangan: nama2,
      sisi_positif: fetchText.split("Sisi Positif Anda: ")[1].split("Sisi Negatif Anda: ")[0].trim(),
      sisi_negatif: fetchText.split("Sisi Negatif Anda: ")[1].split("< Hitung Kembali")[0].trim(),
      gambar: "https://primbon.com/ramalan_kecocokan_cinta2.png",
      catatan: "Untuk melihat kecocokan jodoh dengan pasangan, dapat dikombinasikan dengan primbon Ramalan Jodoh (Jawa), Ramalan Jodoh (Bali), numerologi Kecocokan Cinta, Ramalan Perjalanan Hidup Suami Istri, dan makna dari Tanggal Jadian/Pernikahan."
    };
  } catch (e) {
    return { status: false, message: "Error, Mungkin Input Yang Anda Masukkan Salah" };
  }
}

async function scrapeNomorHoki(phoneNumber) {
  const response = await axios.post(
    "https://www.primbon.com/no_hoki_bagua_shuzi.php",
    `nomer=${encodeURIComponent(phoneNumber)}&submit=+Submit%21+`,
    { headers: { "content-type": "application/x-www-form-urlencoded", "user-agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36" }, timeout: 10000 }
  );

  const $ = cheerio.load(response.data);
  const extractNumber = (text) => { const matches = text.match(/\d+(\.\d+)?/); return matches ? parseFloat(matches[0]) : 0; };

  const nomorHPElement = $("b:contains(\"No. HP\")");
  const nomorHP = nomorHPElement.text().replace("No. HP : ", "");
  const baguaShuziText = $("b:contains(\"% Angka Bagua Shuzi\")").text();

  if (!nomorHP || !baguaShuziText) throw new Error("Failed to extract basic information from response");

  const result = {
    nomor: nomorHP,
    angka_bagua_shuzi: { value: extractNumber(baguaShuziText), description: "Persentase Angka Bagua Shuzi menunjukkan tingkat kecocokan nomor dengan elemen karakter. Nilai minimal yang baik adalah 60%." },
    energi_positif: {
      total: extractNumber($("b:contains(\"%\")").first().text()),
      details: { kekayaan: extractNumber($("td:contains(\"Kekayaan =\")").text()), kesehatan: extractNumber($("td:contains(\"Kesehatan =\")").text()), cinta: extractNumber($("td:contains(\"Cinta/Relasi =\")").text()), kestabilan: extractNumber($("td:contains(\"Kestabilan =\")").text()) },
      description: "Energi positif mempengaruhi aspek kekayaan, kesehatan, cinta/relasi, dan kestabilan dalam hidup. Semakin tinggi nilainya, semakin baik."
    },
    energi_negatif: {
      total: extractNumber($("b:contains(\"%\")").last().text()),
      details: { perselisihan: extractNumber($("td:contains(\"Perselisihan =\")").text()), kehilangan: extractNumber($("td:contains(\"Kehilangan =\")").text()), malapetaka: extractNumber($("td:contains(\"Malapetaka =\")").text()), kehancuran: extractNumber($("td:contains(\"Kehancuran =\")").text()) },
      description: "Energi negatif menunjukkan potensi hambatan dalam aspek perselisihan, kehilangan, malapetaka, dan kehancuran. Semakin rendah nilainya, semakin baik."
    }
  };

  result.analisis = { status: result.energi_positif.total > 60 && result.angka_bagua_shuzi.value >= 60, description: "Nomor dianggap hoki jika persentase Energi Positif di atas 60% dan persentase Angka Bagua Shuzi minimal 60%" };
  return result;
}

async function scrapeCekPotensiPenyakit(tgl, bln, thn) {
  const { data } = await axios({ url: "https://primbon.com/cek_potensi_penyakit.php", method: "POST", headers: { "content-type": "application/x-www-form-urlencoded", "User-Agent": "Mozilla/5.0" }, data: new URLSearchParams({ tanggal: tgl, bulan: bln, tahun: thn, hitung: " Submit! " }), timeout: 30000 });
  const $ = cheerio.load(data);
  let fetchText = $("#body").text().replace(/\s{2,}/g, " ").replace(/[\n\r\t]+/g, " ").replace(/\(adsbygoogle\s*=\s*window\.adsbygoogle\s*\|\|\s*\[\]\)\.push\(\{\}\); /g, "").replace(/<<+\s*Kembali/g, "").trim();
  if (!fetchText.includes("CEK POTENSI PENYAKIT (METODE PITAGORAS)")) throw new Error("Data tidak ditemukan atau format tanggal tidak valid");
  return { analisa: fetchText.split("CEK POTENSI PENYAKIT (METODE PITAGORAS)")[1].split("Sektor yg dianalisa:")[0].trim(), sektor: fetchText.split("Sektor yg dianalisa:")[1].split("Anda tidak memiliki elemen")[0].trim(), elemen: "Anda tidak memiliki elemen " + fetchText.split("Anda tidak memiliki elemen")[1].split("*")[0].trim(), catatan: "Potensi penyakit harus dipandang secara positif." };
}

async function scrapeRamalanJodoh(nama1, tgl1, bln1, thn1, nama2, tgl2, bln2, thn2) {
  const response = await axios({ method: "post", url: "https://www.primbon.com/ramalan_jodoh.php", headers: { "content-type": "application/x-www-form-urlencoded", "user-agent": "Mozilla/5.0" }, data: new URLSearchParams({ nama1, tgl1, bln1, thn1, nama2, tgl2, bln2, thn2, submit: "  RAMALAN JODOH >>  " }), timeout: 10000 });
  const $ = cheerio.load(response.data);
  const extractPerson = (index) => { const elements = $("#body").contents().filter((_, el) => el.type === "tag" && (el.name === "b" || el.name === "i")); return { nama: elements.eq(index * 2).text().trim(), tanggal_lahir: elements.eq(index * 2 + 1).text().replace("Tgl. Lahir:", "").trim() }; };
  const cleanPredictions = () => { let text = $("#body").text().replace(/\(adsbygoogle.*\);/g, "").replace("RAMALAN JODOH", "").replace(/Konsultasi Hari Baik Akad Nikah >>>/g, ""); const start = text.indexOf("1. Berdasarkan neptu"); const end = text.indexOf("*Jangan mudah memutuskan"); if (start !== -1 && end !== -1) text = text.substring(start, end).trim(); return text.split(/\d+\.\s+/).filter(item => item.trim()).map(item => item.trim()); };
  const peringatanElement = $("#body i").filter((_, el) => $(el).text().includes("Jangan mudah memutuskan")).first();
  return { result: { orang_pertama: extractPerson(0), orang_kedua: extractPerson(1), deskripsi: "Hasil ramalan primbon perjodohan berdasarkan 6 petung dari kitab primbon Betaljemur Adammakna.", hasil_ramalan: cleanPredictions() }, peringatan: peringatanElement.length ? peringatanElement.text().split("Konsultasi")[0].trim() : "No specific warning found." };
}

async function scrapeRamalanJodohBali(nama1, tgl1, bln1, thn1, nama2, tgl2, bln2, thn2) {
  const response = await axios({ url: "https://www.primbon.com/ramalan_jodoh_bali.php", method: "POST", headers: { "content-type": "application/x-www-form-urlencoded", "User-Agent": "Mozilla/5.0" }, data: new URLSearchParams({ nama1, tgl1, bln1, thn1, nama2, tgl2, bln2, thn2, submit: " Submit! " }), timeout: 30000 });
  const $ = cheerio.load(response.data);
  const fetchText = $("#body").text();
  try { return { nama_anda: { nama: nama1, tgl_lahir: fetchText.split("Hari Lahir: ")[1].split("Nama")[0].trim() }, nama_pasangan: { nama: nama2, tgl_lahir: fetchText.split(nama2 + "Hari Lahir: ")[1].split("HASILNYA MENURUT PAL SRI SEDANAI")[0].trim() }, result: fetchText.split("HASILNYA MENURUT PAL SRI SEDANAI. ")[1].split("Konsultasi Hari Baik Akad Nikah >>>")[0].trim(), catatan: "Untuk melihat kecocokan jodoh, dapat dikombinasikan dengan Ramalan Jodoh (Jawa)." }; } catch (e) { return { status: false, message: "Error, Mungkin Input Yang Anda Masukkan Salah" }; }
}

async function scrapeRejekiHokiWeton(tgl, bln, thn) {
  const response = await axios({ url: "https://primbon.com/rejeki_hoki_weton.php", method: "POST", headers: { "content-type": "application/x-www-form-urlencoded", "User-Agent": "Mozilla/5.0" }, data: new URLSearchParams({ tgl, bln, thn, submit: " Submit! " }), timeout: 30000 });
  const $ = cheerio.load(response.data);
  const fetchText = $("#body").text();
  try { return { hari_lahir: fetchText.split("Hari Lahir: ")[1].split(thn)[0].trim(), rejeki: fetchText.split(thn)[1].split("< Hitung Kembali")[0].trim(), catatan: "Rejeki itu tentang usaha dan ikhtiar seseorang." }; } catch (e) { return { status: false, message: "Error, Mungkin Input Yang Anda Masukkan Salah" }; }
}

async function scrapeSifatUsahaBisnis(tgl, bln, thn) {
  const response = await axios({ url: "https://primbon.com/sifat_usaha_bisnis.php", method: "POST", headers: { "content-type": "application/x-www-form-urlencoded", "User-Agent": "Mozilla/5.0" }, data: new URLSearchParams({ tgl, bln, thn, submit: " Submit! " }), timeout: 30000 });
  const $ = cheerio.load(response.data);
  const fetchText = $("#body").text();
  try { return { hari_lahir: fetchText.split("Hari Lahir Anda: ")[1].split(thn)[0].trim(), usaha: fetchText.split(thn)[1].split("< Hitung Kembali")[0].trim(), catatan: "Memahami sifat bisnis membantu memperbaiki diri dan menjalin kerjasama." }; } catch (e) { return { status: false, message: "Error, Mungkin Input Yang Anda Masukkan Salah" }; }
}

async function scrapeTafsirMimpi(mimpi) {
  const response = await axios.get("https://www.primbon.com/tafsir_mimpi.php", { params: { mimpi, submit: "+Submit+" }, headers: { "User-Agent": "Mozilla/5.0" }, timeout: 10000 });
  const $ = cheerio.load(response.data);
  const results = [];
  const content = $("#body").text();
  const mimpiRegex = new RegExp(`Mimpi.*?${mimpi}.*?(?=Mimpi|$)`, "gi");
  const matches = content.match(mimpiRegex);
  if (matches) matches.forEach(match => { const parts = match.trim().replace(/\s+/g, " ").split("="); if (parts.length === 2) results.push({ mimpi: parts[0].trim().replace(/^Mimpi\s+/, ""), tafsir: parts[1].trim() }); });
  const solusiMatch = content.match(/Solusi.*?Amien\.\./s);
  return { keyword: mimpi, hasil: results, total: results.length, solusi: solusiMatch ? solusiMatch[0].trim() : null };
}

async function scrapeZodiak(zodiak) {
  const { data } = await axios.get(`https://primbon.com/zodiak/${encodeURIComponent(zodiak)}.htm`, { headers: { "User-Agent": "Mozilla/5.0" }, timeout: 10000 });
  const $ = cheerio.load(data);
  let fetchText = $("#body").text().replace(/\s{2,}/g, " ").replace(/[\n\r\t]+/g, " ").replace(/\(adsbygoogle\s*=\s*window\.adsbygoogle\s*\|\|\s*\[\]\)\.push\(\{\}\);/g, "").replace(/<<+\s*Kembali/g, "").trim();
  return { zodiak: fetchText.split("Nomor Keberuntungan:")[0].trim(), nomor_keberuntungan: fetchText.split("Nomor Keberuntungan: ")[1].split(" Aroma Keberuntungan:")[0].trim(), aroma_keberuntungan: fetchText.split("Aroma Keberuntungan: ")[1].split(" Planet Yang Mengitari:")[0].trim(), planet_yang_mengitari: fetchText.split("Planet Yang Mengitari: ")[1].split(" Bunga Keberuntungan:")[0].trim(), bunga_keberuntungan: fetchText.split("Bunga Keberuntungan: ")[1].split(" Warna Keberuntungan:")[0].trim(), warna_keberuntungan: fetchText.split("Warna Keberuntungan: ")[1].split(" Batu Keberuntungan:")[0].trim(), batu_keberuntungan: fetchText.split("Batu Keberuntungan: ")[1].split(" Elemen Keberuntungan:")[0].trim(), elemen_keberuntungan: fetchText.split("Elemen Keberuntungan: ")[1].split(" Pasangan Serasi:")[0].trim(), pasangan_zodiak: fetchText.split("Pasangan Serasi: ")[1].split("<<<< Kembali")[0].trim() };
}

router.all("/api/primbon/artinama", unifiedHandler(async (params, req, res) => {
  const { nama } = params;
  if (!validate.notEmpty(nama)) return res.status(200).json({ success: false, error: "Parameter 'nama' is required", errorType: "ValidationError" });
  const data = await scrapeArtiNama(nama.trim());
  res.json({ success: true, data });
}));

router.all("/api/primbon/kecocokan_nama_pasangan", unifiedHandler(async (params, req, res) => {
  const { nama1, nama2 } = params;
  if (!validate.notEmpty(nama1) || !validate.notEmpty(nama2)) return res.status(200).json({ success: false, error: "Parameters 'nama1' and 'nama2' are required", errorType: "ValidationError" });
  const data = await scrapeKecocokanNamaPasangan(nama1.trim(), nama2.trim());
  res.json({ success: true, data });
}));

router.all("/api/primbon/nomorhoki", unifiedHandler(async (params, req, res) => {
  const { phoneNumber } = params;
  if (!validate.notEmpty(phoneNumber) || !/^\d+$/.test(phoneNumber.trim())) return res.status(200).json({ success: false, error: "Valid phone number is required (numbers only)", errorType: "ValidationError" });
  if (phoneNumber.trim().length < 8 || phoneNumber.trim().length > 15) return res.status(200).json({ success: false, error: "Phone number must be between 8 and 15 digits", errorType: "ValidationError" });
  const data = await scrapeNomorHoki(phoneNumber.trim());
  res.json({ success: true, data });
}));

router.all("/api/primbon/cek_potensi_penyakit", unifiedHandler(async (params, req, res) => {
  const { tgl, bln, thn } = params;
  if (!tgl || !bln || !thn) return res.status(200).json({ success: false, error: "Parameters 'tgl', 'bln', and 'thn' are required", errorType: "ValidationError" });
  const data = await scrapeCekPotensiPenyakit(tgl.toString(), bln.toString(), thn.toString());
  res.json({ success: true, data });
}));

router.all("/api/primbon/ramalanjodoh", unifiedHandler(async (params, req, res) => {
  const { nama1, tgl1, bln1, thn1, nama2, tgl2, bln2, thn2 } = params;
  if (!nama1 || !tgl1 || !bln1 || !thn1 || !nama2 || !tgl2 || !bln2 || !thn2) return res.status(200).json({ success: false, error: "All parameters are required", errorType: "ValidationError" });
  const data = await scrapeRamalanJodoh(nama1, tgl1.toString(), bln1.toString(), thn1.toString(), nama2, tgl2.toString(), bln2.toString(), thn2.toString());
  res.json({ success: true, data });
}));

router.all("/api/primbon/ramalanjodohbali", unifiedHandler(async (params, req, res) => {
  const { nama1, tgl1, bln1, thn1, nama2, tgl2, bln2, thn2 } = params;
  if (!nama1 || !tgl1 || !bln1 || !thn1 || !nama2 || !tgl2 || !bln2 || !thn2) return res.status(200).json({ success: false, error: "All parameters are required", errorType: "ValidationError" });
  const data = await scrapeRamalanJodohBali(nama1, tgl1.toString(), bln1.toString(), thn1.toString(), nama2, tgl2.toString(), bln2.toString(), thn2.toString());
  res.json({ success: true, data });
}));

router.all("/api/primbon/rejeki_hoki_weton", unifiedHandler(async (params, req, res) => {
  const { tgl, bln, thn } = params;
  if (!tgl || !bln || !thn) return res.status(200).json({ success: false, error: "Parameters 'tgl', 'bln', and 'thn' are required", errorType: "ValidationError" });
  const data = await scrapeRejekiHokiWeton(tgl.toString(), bln.toString(), thn.toString());
  res.json({ success: true, data });
}));

router.all("/api/primbon/sifat_usaha_bisnis", unifiedHandler(async (params, req, res) => {
  const { tgl, bln, thn } = params;
  if (!tgl || !bln || !thn) return res.status(200).json({ success: false, error: "Parameters 'tgl', 'bln', and 'thn' are required", errorType: "ValidationError" });
  const data = await scrapeSifatUsahaBisnis(tgl.toString(), bln.toString(), thn.toString());
  res.json({ success: true, data });
}));

router.all("/api/primbon/tafsirmimpi", unifiedHandler(async (params, req, res) => {
  const { mimpi } = params;
  if (!validate.notEmpty(mimpi)) return res.status(200).json({ success: false, error: "Parameter 'mimpi' is required", errorType: "ValidationError" });
  const data = await scrapeTafsirMimpi(mimpi.trim());
  res.json({ success: true, data });
}));

router.all("/api/primbon/zodiak", unifiedHandler(async (params, req, res) => {
  const { zodiak } = params;
  const validZodiak = ['aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo', 'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces'];
  if (!validate.notEmpty(zodiak)) return res.status(200).json({ success: false, error: "Parameter 'zodiak' is required", errorType: "ValidationError" });
  if (!validZodiak.includes(zodiak.toLowerCase())) return res.status(200).json({ success: false, error: `Invalid zodiak. Valid options: ${validZodiak.join(', ')}`, errorType: "ValidationError" });
  const data = await scrapeZodiak(zodiak.toLowerCase().trim());
  res.json({ success: true, data });
}));

export const metadata = [
  { path: "/api/primbon/artinama", method: "GET, POST", name: "Arti Nama", description: "Mencari arti dari sebuah nama", category: "other", status: "free", params: [{ name: "nama", type: "text", required: true, description: "Nama yang ingin dicari artinya" }] },
  { path: "/api/primbon/kecocokan_nama_pasangan", method: "GET, POST", name: "Kecocokan Nama Pasangan", description: "Mengetahui kecocokan nama dengan pasangan", category: "other", status: "free", params: [{ name: "nama1", type: "text", required: true, description: "Nama pertama" }, { name: "nama2", type: "text", required: true, description: "Nama kedua" }] },
  { path: "/api/primbon/nomorhoki", method: "GET, POST", name: "Nomor Hoki", description: "Mengecek keberuntungan nomor telepon", category: "other", status: "free", params: [{ name: "phoneNumber", type: "text", required: true, description: "Nomor telepon (8-15 digit)" }] },
  { path: "/api/primbon/cek_potensi_penyakit", method: "GET, POST", name: "Cek Potensi Penyakit", description: "Mengecek potensi penyakit berdasarkan tanggal lahir", category: "other", status: "free", params: [{ name: "tgl", type: "number", required: true, description: "Tanggal lahir (1-31)" }, { name: "bln", type: "number", required: true, description: "Bulan lahir (1-12)" }, { name: "thn", type: "number", required: true, description: "Tahun lahir" }] },
  { path: "/api/primbon/ramalanjodoh", method: "GET, POST", name: "Ramalan Jodoh Jawa", description: "Ramalan perjodohan versi Jawa", category: "other", status: "free", params: [{ name: "nama1", type: "text", required: true }, { name: "tgl1", type: "number", required: true }, { name: "bln1", type: "number", required: true }, { name: "thn1", type: "number", required: true }, { name: "nama2", type: "text", required: true }, { name: "tgl2", type: "number", required: true }, { name: "bln2", type: "number", required: true }, { name: "thn2", type: "number", required: true }] },
  { path: "/api/primbon/ramalanjodohbali", method: "GET, POST", name: "Ramalan Jodoh Bali", description: "Ramalan perjodohan versi Bali", category: "other", status: "free", params: [{ name: "nama1", type: "text", required: true }, { name: "tgl1", type: "number", required: true }, { name: "bln1", type: "number", required: true }, { name: "thn1", type: "number", required: true }, { name: "nama2", type: "text", required: true }, { name: "tgl2", type: "number", required: true }, { name: "bln2", type: "number", required: true }, { name: "thn2", type: "number", required: true }] },
  { path: "/api/primbon/rejeki_hoki_weton", method: "GET, POST", name: "Rejeki Hoki Weton", description: "Mengetahui rejeki berdasarkan weton", category: "other", status: "free", params: [{ name: "tgl", type: "number", required: true }, { name: "bln", type: "number", required: true }, { name: "thn", type: "number", required: true }] },
  { path: "/api/primbon/sifat_usaha_bisnis", method: "GET, POST", name: "Sifat Usaha Bisnis", description: "Sifat usaha/bisnis berdasarkan tanggal lahir", category: "other", status: "free", params: [{ name: "tgl", type: "number", required: true }, { name: "bln", type: "number", required: true }, { name: "thn", type: "number", required: true }] },
  { path: "/api/primbon/tafsirmimpi", method: "GET, POST", name: "Tafsir Mimpi", description: "Mencari tafsir dari mimpi", category: "other", status: "free", params: [{ name: "mimpi", type: "text", required: true, description: "Kata kunci mimpi" }] },
  { path: "/api/primbon/zodiak", method: "GET, POST", name: "Zodiak", description: "Info zodiak dan keberuntungan", category: "other", status: "free", params: [{ name: "zodiak", type: "text", required: true, description: "Nama zodiak (aries, taurus, dll)" }] }
];

export default router;
