import React, { useState, useMemo, useCallback, useRef } from "react";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  Legend,
  AreaChart,
  Area,
} from "recharts";
import {
  Upload,
  Wrench,
  Users,
  Car,
  HardHat,
  TrendingUp,
  Award,
  Gauge,
  RefreshCw,
  Download,
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
  FileSpreadsheet,
  FileText,
  X,
  CheckCircle2,
  Activity,
  Eye,
  Phone,
  MapPin,
  Mail,
} from "lucide-react";

// ===== Brand =====
const BRAND = {
  red: "#C8102E",
  redDark: "#9A0E26",
  redLight: "#E63946",
  navy: "#0F1B2D",
  navyMid: "#1F2D43",
  cream: "#FAF7F2",
  white: "#FFFFFF",
  border: "#E8E5E0",
  borderDark: "#D4D0C8",
  gold: "#D4A017",
  text: "#1A2332",
  textMute: "#6B7280",
};

const COMPANY = {
  legalName: "Gulf Way Auto Service LLC",
  brand: "Gulf Way Auto Services",
  address: "5 4a St, Ras Al Khor Industrial Area 1, Dubai, UAE",
  phone: "+971 50 605 0030",
  hotline: "800 GULFWAY",
  email: "enquiry@gwauto.ae",
  website: "gwauto.ae",
  hours: "Mon – Sat: 8:00 AM – 7:00 PM",
};

// ===== Utils =====
function normalizeRow(row) {
  const tokenNo = row.id || row.ID || row.Token || row.token || "";
  const businessId = row.business_id || row.Business_ID || "";
  const customer = row.custom_field_1 || row.customer || row.Customer || "";
  const vehicle = row.custom_field_2 || row.vehicle || row.Vehicle || "";
  const crew = row.custom_field_3 || row.crew || row.Crew || "";
  const reading = row.custom_field_4 || row.reading || row.Reading || "";

  const clean = (v) =>
    v === null ||
    v === undefined ||
    v === "NULL" ||
    v === "null" ||
    String(v).trim() === ""
      ? ""
      : String(v).trim();

  return {
    tokenNo: clean(tokenNo),
    businessId: clean(businessId),
    customer: clean(customer),
    vehicle: clean(vehicle),
    crew: clean(crew),
    reading: clean(reading),
  };
}

const fmt = (n) =>
  n == null || n === "" ? "—" : Number(n).toLocaleString("en-US");

function downloadXLSX(filename, sheets) {
  const wb = XLSX.utils.book_new();
  sheets.forEach(({ name, data }) => {
    if (!data || !data.length) return;
    const ws = Array.isArray(data[0])
      ? XLSX.utils.aoa_to_sheet(data)
      : XLSX.utils.json_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, name.slice(0, 31));
  });
  XLSX.writeFile(wb, filename);
}

const MILEAGE_BUCKETS = [
  { key: "0-25k", label: "0 – 25,000 km", min: 0, max: 25000 },
  { key: "25-50k", label: "25,000 – 50,000 km", min: 25000, max: 50000 },
  { key: "50-75k", label: "50,000 – 75,000 km", min: 50000, max: 75000 },
  { key: "75-100k", label: "75,000 – 100,000 km", min: 75000, max: 100000 },
  { key: "100k+", label: "Above 100,000 km", min: 100000, max: Infinity },
];

function bucketForReading(r) {
  return MILEAGE_BUCKETS.find((b) => r >= b.min && r < b.max) || null;
}

function buildVehicleIndex(rows) {
  const map = new Map();
  rows.forEach((r) => {
    if (!r.vehicle) return;
    const reading = parseFloat(r.reading) || 0;
    const existing = map.get(r.vehicle);
    if (!existing) {
      map.set(r.vehicle, {
        vehicle: r.vehicle,
        maxReading: reading,
        latestRecord: r,
        visits: 1,
        customers: new Set(r.customer ? [r.customer] : []),
        crews: new Set(r.crew ? [r.crew] : []),
        history: [r],
      });
    } else {
      existing.visits += 1;
      if (r.customer) existing.customers.add(r.customer);
      if (r.crew) existing.crews.add(r.crew);
      existing.history.push(r);
      if (reading > existing.maxReading) {
        existing.maxReading = reading;
        existing.latestRecord = r;
      }
    }
  });
  return Array.from(map.values()).map((v) => ({
    ...v,
    customers: Array.from(v.customers),
    crews: Array.from(v.crews),
  }));
}

function computeKpis(rows) {
  const valid = rows.filter(
    (r) => r.customer || r.vehicle || r.crew || r.reading
  );
  const totalTokens = valid.length;

  const customers = valid.map((r) => r.customer).filter(Boolean);
  const vehicles = valid.map((r) => r.vehicle).filter(Boolean);
  const crews = valid.map((r) => r.crew).filter(Boolean);

  const uniqueCustomers = new Set(customers).size;
  const uniqueVehicles = new Set(vehicles).size;
  const activeCrew = new Set(crews).size;

  const crewCounts = {};
  crews.forEach((c) => (crewCounts[c] = (crewCounts[c] || 0) + 1));
  const crewSorted = Object.entries(crewCounts).sort((a, b) => b[1] - a[1]);
  const topCrew = crewSorted[0] || ["—", 0];

  const custCounts = {};
  customers.forEach((c) => (custCounts[c] = (custCounts[c] || 0) + 1));
  const custSorted = Object.entries(custCounts).sort((a, b) => b[1] - a[1]);
  const topCustomer = custSorted[0] || ["—", 0];

  const readings = valid
    .map((r) => parseFloat(r.reading))
    .filter((n) => !isNaN(n) && n > 0);
  const avgReading = readings.length
    ? Math.round(readings.reduce((a, b) => a + b, 0) / readings.length)
    : 0;
  const maxReading = readings.length ? Math.max(...readings) : 0;
  const completionRate = totalTokens
    ? Math.round((readings.length / totalTokens) * 1000) / 10
    : 0;

  const repeatCustomers = Object.values(custCounts).filter((c) => c > 1).length;
  const repeatRate = uniqueCustomers
    ? Math.round((repeatCustomers / uniqueCustomers) * 1000) / 10
    : 0;

  const vIndex = buildVehicleIndex(valid);
  const buckets = MILEAGE_BUCKETS.map((b) => ({
    ...b,
    vehicles: vIndex.filter(
      (v) => v.maxReading >= b.min && v.maxReading < b.max
    ),
  }));

  const numericTokens = valid
    .map((r) => parseInt(r.tokenNo))
    .filter((n) => !isNaN(n))
    .sort((a, b) => a - b);
  const timeline = [];
  if (numericTokens.length) {
    const minT = numericTokens[0];
    const maxT = numericTokens[numericTokens.length - 1];
    const span = maxT - minT || 1;
    const seg = span / 12;
    for (let i = 0; i < 12; i++) {
      const lo = minT + seg * i;
      const hi = minT + seg * (i + 1);
      const count = numericTokens.filter(
        (t) => t >= lo && (i === 11 ? t <= hi : t < hi)
      ).length;
      timeline.push({
        period: `P${i + 1}`,
        range: `${Math.round(lo)}–${Math.round(hi)}`,
        jobs: count,
      });
    }
  }

  return {
    totalTokens,
    uniqueCustomers,
    uniqueVehicles,
    activeCrew,
    topCrew,
    topCustomer,
    avgReading,
    maxReading,
    completionRate,
    repeatRate,
    crewSorted,
    custSorted,
    crewCounts,
    custCounts,
    buckets,
    timeline,
    valid,
    vIndex,
    readings,
  };
}

function dateStr() {
  return new Date().toISOString().slice(0, 10);
}
function safeFile(s) {
  return String(s).replace(/[^a-z0-9]/gi, "_").slice(0, 30);
}

// ===== PDF letterhead generator =====
function generateVehiclePDF(vehicle, history) {
  const w = window.open("", "_blank", "width=900,height=1100");
  if (!w) {
    alert("Please allow pop-ups to download the PDF report.");
    return;
  }
  const today = new Date().toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
  const sortedHist = [...history].sort(
    (a, b) => parseInt(a.tokenNo) - parseInt(b.tokenNo)
  );
  const customers = Array.from(
    new Set(history.map((h) => h.customer).filter(Boolean))
  );
  const crews = Array.from(
    new Set(history.map((h) => h.crew).filter(Boolean))
  );
  const readings = history
    .map((h) => parseFloat(h.reading))
    .filter((n) => !isNaN(n) && n > 0);
  const minR = readings.length ? Math.min(...readings) : null;
  const maxR = readings.length ? Math.max(...readings) : null;
  const distance =
    minR !== null && maxR !== null && maxR > minR ? maxR - minR : null;

  const rowsHTML = sortedHist
    .map(
      (h, i) => `
      <tr>
        <td>${i + 1}</td>
        <td class="mono"><b style="color:${BRAND.red};">#${h.tokenNo || "—"}</b></td>
        <td>${h.customer || '<span style="color:#9CA3AF;">Not Recorded</span>'}</td>
        <td>${h.crew ? `<span class="crew-tag">${h.crew}</span>` : "—"}</td>
        <td class="mono r"><b>${h.reading ? fmt(parseInt(h.reading)) : "—"}</b></td>
      </tr>`
    )
    .join("");

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"/>
<title>Service History – Vehicle ${vehicle}</title>
<style>
  @page { size: A4; margin: 0; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Helvetica Neue', Arial, sans-serif; color: #1A2332; background: #fff; }
  .page { width: 210mm; min-height: 297mm; padding: 18mm 16mm; position: relative; background: #fff; }
  .lh-top { display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 14px; border-bottom: 4px solid ${BRAND.red}; position: relative; }
  .lh-top::after { content: ''; position: absolute; left: 0; right: 0; bottom: -10px; height: 2px; background: ${BRAND.navy}; }
  .lh-brand { display: flex; align-items: center; gap: 14px; }
  .lh-mark { width: 64px; height: 64px; background: ${BRAND.red}; color: #fff; display: flex; align-items: center; justify-content: center; font-family: 'Georgia', serif; font-weight: 900; font-size: 30px; letter-spacing: -1px; box-shadow: 4px 4px 0 ${BRAND.navy}; }
  .lh-name { font-family: 'Georgia', serif; font-size: 22px; font-weight: 900; color: ${BRAND.navy}; letter-spacing: 0.5px; line-height: 1.05; }
  .lh-tag { font-size: 10px; letter-spacing: 3px; color: ${BRAND.red}; text-transform: uppercase; margin-top: 4px; font-weight: 700; }
  .lh-contact { text-align: right; font-size: 10.5px; color: #4B5563; line-height: 1.6; }
  .lh-contact b { color: ${BRAND.navy}; }
  .doc-title { margin-top: 28px; padding: 14px 18px; background: ${BRAND.navy}; color: #fff; display: flex; justify-content: space-between; align-items: center; }
  .doc-title h1 { font-size: 16px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase; }
  .doc-title .docno { font-size: 10px; color: #FAD9DF; letter-spacing: 1px; }
  .vehicle-banner { margin-top: 18px; padding: 18px 20px; background: linear-gradient(90deg, ${BRAND.cream} 0%, #fff 100%); border: 1px solid ${BRAND.border}; border-left: 6px solid ${BRAND.red}; display: flex; justify-content: space-between; align-items: center; }
  .vb-label { font-size: 10px; letter-spacing: 2px; color: #6B7280; text-transform: uppercase; }
  .vb-num { font-family: 'Courier New', monospace; font-size: 32px; font-weight: 900; color: ${BRAND.navy}; letter-spacing: 2px; margin-top: 2px; }
  .vb-stats { display: flex; gap: 36px; }
  .vb-stat-val { font-family: 'Courier New', monospace; font-size: 22px; font-weight: 900; color: ${BRAND.red}; }
  .info-grid { margin-top: 16px; display: grid; grid-template-columns: 1fr 1fr; gap: 0; border: 1px solid ${BRAND.border}; }
  .info-cell { padding: 12px 16px; border-right: 1px solid ${BRAND.border}; border-bottom: 1px solid ${BRAND.border}; }
  .info-cell:nth-child(2n) { border-right: none; }
  .info-cell:nth-last-child(-n+2) { border-bottom: none; }
  .info-label { font-size: 9px; letter-spacing: 1.5px; color: #6B7280; text-transform: uppercase; margin-bottom: 4px; }
  .info-value { font-size: 12px; color: ${BRAND.navy}; font-weight: 600; }
  .section-h { margin-top: 22px; padding-bottom: 6px; border-bottom: 2px solid ${BRAND.red}; font-size: 12px; letter-spacing: 2px; color: ${BRAND.navy}; text-transform: uppercase; font-weight: 700; }
  table.history { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 11px; }
  table.history thead th { background: ${BRAND.navy}; color: #fff; text-align: left; padding: 9px 10px; font-size: 9.5px; letter-spacing: 1.2px; text-transform: uppercase; font-weight: 700; }
  table.history thead th.r { text-align: right; }
  table.history tbody td { padding: 8px 10px; border-bottom: 1px solid ${BRAND.border}; color: ${BRAND.text}; }
  table.history tbody td.mono { font-family: 'Courier New', monospace; }
  table.history tbody td.r { text-align: right; }
  table.history tbody tr:nth-child(even) td { background: ${BRAND.cream}; }
  .crew-tag { display: inline-block; padding: 1px 6px; background: #FFEAEC; color: ${BRAND.redDark}; font-family: 'Courier New', monospace; font-size: 10px; font-weight: 700; }
  .footer-note { margin-top: 14px; padding: 10px 12px; background: ${BRAND.cream}; border-left: 3px solid ${BRAND.gold}; font-size: 10px; color: #6B5A2C; line-height: 1.6; }
  .footer { margin-top: 24px; border-top: 2px solid ${BRAND.red}; padding-top: 10px; display: flex; justify-content: space-between; font-size: 9px; color: #6B7280; }
  .footer .ic { color: ${BRAND.red}; font-weight: 700; }
  @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } .no-print { display: none !important; } }
  .print-bar { position: fixed; top: 16px; right: 16px; z-index: 100; display: flex; gap: 8px; }
  .print-bar button { padding: 10px 16px; border: none; cursor: pointer; font-size: 12px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; }
  .btn-print { background: ${BRAND.red}; color: #fff; }
  .btn-close { background: ${BRAND.navy}; color: #fff; }
</style></head>
<body>
<div class="print-bar no-print">
  <button class="btn-print" onclick="window.print()">⬇ Save as PDF</button>
  <button class="btn-close" onclick="window.close()">✕ Close</button>
</div>
<div class="page">
  <div class="lh-top">
    <div class="lh-brand">
      <div class="lh-mark">GW</div>
      <div>
        <div class="lh-name">${COMPANY.legalName}</div>
        <div class="lh-tag">Trusted Vehicle &amp; Bike Repair Services</div>
      </div>
    </div>
    <div class="lh-contact">
      <b>${COMPANY.address}</b><br/>
      Tel: <b>${COMPANY.phone}</b> &nbsp;|&nbsp; Hotline: <b>${COMPANY.hotline}</b><br/>
      ${COMPANY.email} &nbsp;|&nbsp; ${COMPANY.website}<br/>
      <span style="color:${BRAND.red};">${COMPANY.hours}</span>
    </div>
  </div>
  <div class="doc-title">
    <h1>Vehicle Service History Report</h1>
    <div class="docno">REF: GWAS-VHR-${vehicle} &nbsp;·&nbsp; ${today}</div>
  </div>
  <div class="vehicle-banner">
    <div>
      <div class="vb-label">Vehicle / Bike Number</div>
      <div class="vb-num">${vehicle}</div>
    </div>
    <div class="vb-stats">
      <div>
        <div class="vb-label">Total Visits</div>
        <div class="vb-stat-val">${history.length}</div>
      </div>
      <div>
        <div class="vb-label">Last Reading</div>
        <div class="vb-stat-val">${maxR ? fmt(maxR) : "—"} <span style="font-size:11px; color:#6B7280;">km</span></div>
      </div>
      ${
        distance !== null
          ? `<div>
        <div class="vb-label">Distance Covered</div>
        <div class="vb-stat-val">${fmt(distance)} <span style="font-size:11px; color:#6B7280;">km</span></div>
      </div>`
          : ""
      }
    </div>
  </div>
  <div class="info-grid">
    <div class="info-cell">
      <div class="info-label">Registered Customer(s)</div>
      <div class="info-value">${customers.length ? customers.join(", ") : "Not Recorded"}</div>
    </div>
    <div class="info-cell">
      <div class="info-label">Servicing Crew</div>
      <div class="info-value">${crews.length ? crews.join(", ") : "Not Recorded"}</div>
    </div>
    <div class="info-cell">
      <div class="info-label">First Service Token</div>
      <div class="info-value">#${sortedHist[0]?.tokenNo || "—"}</div>
    </div>
    <div class="info-cell">
      <div class="info-label">Latest Service Token</div>
      <div class="info-value">#${sortedHist[sortedHist.length - 1]?.tokenNo || "—"}</div>
    </div>
  </div>
  <div class="section-h">Service Log</div>
  <table class="history">
    <thead>
      <tr>
        <th style="width:40px;">#</th>
        <th>Token No</th>
        <th>Customer Name</th>
        <th>Crew</th>
        <th class="r">Odometer (km)</th>
      </tr>
    </thead>
    <tbody>${rowsHTML}</tbody>
  </table>
  <div class="footer-note">
    <b>Disclaimer:</b> This report is generated from internal service records of ${COMPANY.legalName} and reflects all service tokens issued for the above vehicle. Odometer readings are recorded at the time of each visit. For verification or queries, contact us at ${COMPANY.phone} or ${COMPANY.email}.
  </div>
  <div class="footer">
    <div><span class="ic">●</span> ${COMPANY.legalName} &nbsp;·&nbsp; ${COMPANY.website}</div>
    <div>Generated ${today} &nbsp;·&nbsp; Page 1 of 1</div>
  </div>
</div>
</body></html>`;
  w.document.open();
  w.document.write(html);
  w.document.close();
}

// ===== Component =====
export default function GarageDashboard() {
  const [rows, setRows] = useState([]);
  const [fileName, setFileName] = useState("");
  const [loading, setLoading] = useState(false);
  const [parseError, setParseError] = useState("");
  const [search, setSearch] = useState("");
  const [crewFilter, setCrewFilter] = useState("ALL");
  const [page, setPage] = useState(1);
  const [pageSize] = useState(15);
  const [dragActive, setDragActive] = useState(false);
  const [vehiclePanel, setVehiclePanel] = useState(null);
  const fileInputRef = useRef(null);

  const handleFile = useCallback((file) => {
    if (!file) return;
    setLoading(true);
    setParseError("");
    setFileName(file.name);

    const tryParse = (delimiter) =>
      new Promise((resolve, reject) => {
        Papa.parse(file, {
          header: true,
          delimiter,
          skipEmptyLines: true,
          transformHeader: (h) => h.trim().toLowerCase(),
          complete: (res) => resolve(res),
          error: (err) => reject(err),
        });
      });

    tryParse(";")
      .then((res) => {
        let parsed = res.data;
        if (
          !parsed.length ||
          (parsed[0] && Object.keys(parsed[0]).length < 2)
        ) {
          return tryParse(",").then((r2) => r2.data);
        }
        return parsed;
      })
      .then((parsed) => {
        const normalized = parsed.map(normalizeRow);
        setRows(normalized);
        setPage(1);
        setLoading(false);
      })
      .catch((err) => {
        setParseError(err.message || "Failed to parse CSV");
        setLoading(false);
      });
  }, []);

  const onDrop = useCallback(
    (e) => {
      e.preventDefault();
      setDragActive(false);
      if (e.dataTransfer.files?.[0]) handleFile(e.dataTransfer.files[0]);
    },
    [handleFile]
  );

  const kpis = useMemo(() => computeKpis(rows), [rows]);

  const crewOptions = useMemo(() => {
    const s = new Set(rows.map((r) => r.crew).filter(Boolean));
    return ["ALL", ...Array.from(s).sort()];
  }, [rows]);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (crewFilter !== "ALL" && r.crew !== crewFilter) return false;
      if (!q) return true;
      return (
        r.tokenNo.toLowerCase().includes(q) ||
        r.customer.toLowerCase().includes(q) ||
        r.vehicle.toLowerCase().includes(q) ||
        r.crew.toLowerCase().includes(q) ||
        r.reading.toLowerCase().includes(q)
      );
    });
  }, [rows, search, crewFilter]);

  const pageCount = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const pagedRows = filteredRows.slice((page - 1) * pageSize, page * pageSize);

  const reset = () => {
    setRows([]);
    setFileName("");
    setSearch("");
    setCrewFilter("ALL");
    setPage(1);
    setVehiclePanel(null);
  };

  const recordsForRow = (r) => ({
    "Token No": r.tokenNo,
    Customer: r.customer,
    "Vehicle / Bike No": r.vehicle,
    Crew: r.crew,
    "Reading (km)": r.reading ? parseInt(r.reading) : "",
  });

  // ----- Per-KPI exports -----
  const exportAll = () =>
    downloadXLSX(`Gulfway_All_Records_${dateStr()}.xlsx`, [
      { name: "Service Records", data: kpis.valid.map(recordsForRow) },
    ]);

  const exportCustomers = () =>
    downloadXLSX(`Gulfway_Customer_Master_${dateStr()}.xlsx`, [
      {
        name: "Customer Master",
        data: kpis.custSorted.map(([name, count], i) => ({
          Rank: i + 1,
          "Customer Name": name,
          "Total Visits": count,
          Status: count > 1 ? "Repeat Customer" : "First-time",
        })),
      },
    ]);

  const exportVehicles = () =>
    downloadXLSX(`Gulfway_Vehicle_Master_${dateStr()}.xlsx`, [
      {
        name: "Vehicle Master",
        data: kpis.vIndex
          .slice()
          .sort((a, b) => b.maxReading - a.maxReading)
          .map((v, i) => ({
            Rank: i + 1,
            "Vehicle / Bike No": v.vehicle,
            "Total Visits": v.visits,
            "Latest Reading (km)": v.maxReading || "",
            "Mileage Bucket": bucketForReading(v.maxReading)?.label || "Unread",
            Customer: v.customers.join(", "),
            "Crew(s)": v.crews.join(", "),
          })),
      },
    ]);

  const exportCrew = () =>
    downloadXLSX(`Gulfway_Crew_Performance_${dateStr()}.xlsx`, [
      {
        name: "Crew Performance",
        data: kpis.crewSorted.map(([name, count], i) => ({
          Rank: i + 1,
          "Crew Code": name,
          "Jobs Handled": count,
          "Share of Total %":
            Math.round((count / kpis.totalTokens) * 10000) / 100,
        })),
      },
    ]);

  const exportTopCrewJobs = () => {
    const code = kpis.topCrew[0];
    const list = kpis.valid.filter((r) => r.crew === code);
    downloadXLSX(`Gulfway_Crew_${safeFile(code)}_Jobs_${dateStr()}.xlsx`, [
      { name: `${code} Jobs`.slice(0, 31), data: list.map(recordsForRow) },
    ]);
  };

  const exportTopCustomerJobs = () => {
    const name = kpis.topCustomer[0];
    const list = kpis.valid.filter((r) => r.customer === name);
    downloadXLSX(`Gulfway_VIP_${safeFile(name)}_${dateStr()}.xlsx`, [
      { name: "VIP Visits", data: list.map(recordsForRow) },
    ]);
  };

  const exportReadings = () =>
    downloadXLSX(`Gulfway_Readings_${dateStr()}.xlsx`, [
      {
        name: "Reading Stats",
        data: [
          ["Metric", "Value"],
          ["Records with Reading", kpis.readings.length],
          ["Average Reading (km)", kpis.avgReading],
          ["Maximum Reading (km)", kpis.maxReading],
          [
            "Minimum Reading (km)",
            kpis.readings.length ? Math.min(...kpis.readings) : 0,
          ],
        ],
      },
      {
        name: "All Readings",
        data: kpis.valid
          .filter((r) => r.reading && !isNaN(parseFloat(r.reading)))
          .map(recordsForRow),
      },
    ]);

  const exportCompletion = () => {
    const withReading = kpis.valid.filter(
      (r) => r.reading && !isNaN(parseFloat(r.reading))
    );
    const without = kpis.valid.filter(
      (r) => !r.reading || isNaN(parseFloat(r.reading))
    );
    downloadXLSX(`Gulfway_Data_Quality_${dateStr()}.xlsx`, [
      {
        name: "Summary",
        data: [
          ["Total Records", kpis.totalTokens],
          ["With Reading", withReading.length],
          ["Without Reading", without.length],
          ["Completion %", kpis.completionRate],
        ],
      },
      { name: "With Reading", data: withReading.map(recordsForRow) },
      { name: "Missing Reading", data: without.map(recordsForRow) },
    ]);
  };

  const exportBucket = (bucket) => {
    const sorted = [...bucket.vehicles].sort(
      (a, b) => b.maxReading - a.maxReading
    );
    downloadXLSX(`Gulfway_Mileage_${bucket.key}_${dateStr()}.xlsx`, [
      {
        name: bucket.key,
        data: sorted.map((v, i) => ({
          "S.No": i + 1,
          "Vehicle / Bike No": v.vehicle,
          "Latest Reading (km)": v.maxReading,
          "Total Visits": v.visits,
          "Customer Name": v.customers.join(", "),
          "Servicing Crew": v.crews.join(", "),
          "Latest Token No": v.latestRecord.tokenNo,
        })),
      },
    ]);
  };

  const exportVehicleHistory = (vehicle) => {
    const history = rows.filter((r) => r.vehicle === vehicle);
    const sorted = [...history].sort(
      (a, b) => parseInt(a.tokenNo) - parseInt(b.tokenNo)
    );
    const readings = history
      .map((h) => parseFloat(h.reading))
      .filter((n) => !isNaN(n) && n > 0);
    downloadXLSX(`Gulfway_Vehicle_${safeFile(vehicle)}_${dateStr()}.xlsx`, [
      {
        name: "Summary",
        data: [
          ["Vehicle / Bike No", vehicle],
          ["Total Visits", history.length],
          ["First Token", sorted[0]?.tokenNo || ""],
          ["Latest Token", sorted[sorted.length - 1]?.tokenNo || ""],
          ["Latest Reading (km)", readings.length ? Math.max(...readings) : ""],
          [
            "Distance Covered (km)",
            readings.length > 1
              ? Math.max(...readings) - Math.min(...readings)
              : "",
          ],
          [
            "Customer(s)",
            Array.from(
              new Set(history.map((h) => h.customer).filter(Boolean))
            ).join(", "),
          ],
          [
            "Servicing Crew",
            Array.from(
              new Set(history.map((h) => h.crew).filter(Boolean))
            ).join(", "),
          ],
        ],
      },
      {
        name: "Service Log",
        data: sorted.map((h, i) => ({
          "S.No": i + 1,
          "Token No": h.tokenNo,
          Customer: h.customer,
          Crew: h.crew,
          "Reading (km)": h.reading ? parseInt(h.reading) : "",
        })),
      },
    ]);
  };

  const openVehiclePDF = (vehicle) => {
    const history = rows.filter((r) => r.vehicle === vehicle);
    if (history.length) generateVehiclePDF(vehicle, history);
  };

  const showVehicleQuick = (vehicle) => {
    const history = rows.filter((r) => r.vehicle === vehicle);
    setVehiclePanel({ vehicle, history });
  };

  const exportMaster = () => {
    const sheets = [
      { name: "Service Records", data: kpis.valid.map(recordsForRow) },
      {
        name: "KPI Summary",
        data: [
          ["Metric", "Value"],
          ["Total Service Tokens", kpis.totalTokens],
          ["Unique Customers", kpis.uniqueCustomers],
          ["Unique Vehicles", kpis.uniqueVehicles],
          ["Active Crew", kpis.activeCrew],
          ["Top Crew", `${kpis.topCrew[0]} (${kpis.topCrew[1]} jobs)`],
          [
            "VIP Customer",
            `${kpis.topCustomer[0]} (${kpis.topCustomer[1]} visits)`,
          ],
          ["Average Reading (km)", kpis.avgReading],
          ["Max Reading (km)", kpis.maxReading],
          ["Reading Completion %", kpis.completionRate],
          ["Repeat Customer Rate %", kpis.repeatRate],
        ],
      },
      {
        name: "Crew Leaderboard",
        data: kpis.crewSorted.map(([name, count], i) => ({
          Rank: i + 1,
          "Crew Code": name,
          "Jobs Handled": count,
        })),
      },
      {
        name: "Customer Leaderboard",
        data: kpis.custSorted.map(([name, count], i) => ({
          Rank: i + 1,
          Customer: name,
          Visits: count,
        })),
      },
      {
        name: "Vehicle Master",
        data: kpis.vIndex
          .slice()
          .sort((a, b) => b.maxReading - a.maxReading)
          .map((v, i) => ({
            Rank: i + 1,
            "Vehicle No": v.vehicle,
            "Latest Reading (km)": v.maxReading,
            "Total Visits": v.visits,
            "Mileage Bucket": bucketForReading(v.maxReading)?.label || "—",
          })),
      },
    ];
    kpis.buckets.forEach((b) => {
      sheets.push({
        name: `Mileage ${b.key}`,
        data: [...b.vehicles]
          .sort((a, b) => b.maxReading - a.maxReading)
          .map((v, i) => ({
            "S.No": i + 1,
            "Vehicle / Bike No": v.vehicle,
            "Latest Reading (km)": v.maxReading,
            "Total Visits": v.visits,
            "Customer Name": v.customers.join(", "),
            "Servicing Crew": v.crews.join(", "),
          })),
      });
    });
    downloadXLSX(`Gulfway_Master_Report_${dateStr()}.xlsx`, sheets);
  };

  const hasData = rows.length > 0;

  return (
    <div
      className="min-h-screen"
      style={{ background: BRAND.cream, color: BRAND.text }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;700&display=swap');
        .font-display { font-family: 'Playfair Display', serif; }
        .font-body { font-family: 'Inter', sans-serif; }
        .font-mono-data { font-family: 'JetBrains Mono', monospace; font-feature-settings: 'tnum'; }
        .gw-shadow { box-shadow: 0 1px 0 rgba(15,27,45,0.04), 0 4px 12px rgba(15,27,45,0.05); }
        .gw-shadow-md { box-shadow: 0 2px 0 rgba(15,27,45,0.06), 0 8px 24px rgba(15,27,45,0.07); }
        .gw-link { color: ${BRAND.red}; text-decoration: none; border-bottom: 1px dashed transparent; transition: all 0.15s ease; cursor: pointer; background: none; padding: 0; font: inherit; }
        .gw-link:hover { border-bottom-color: ${BRAND.red}; background: #FFF5F5; }
        .download-pill { display: inline-flex; align-items: center; gap: 4px; padding: 3px 8px; background: #FFF5F5; color: ${BRAND.red}; border: 1px solid #FCE0E4; cursor: pointer; font-size: 10px; font-weight: 600; letter-spacing: 0.5px; transition: all 0.15s ease; }
        .download-pill:hover { background: ${BRAND.red}; color: #fff; border-color: ${BRAND.red}; }
        .stripe-bar { background: repeating-linear-gradient(90deg, ${BRAND.red} 0, ${BRAND.red} 24px, ${BRAND.navy} 24px, ${BRAND.navy} 28px); }
      `}</style>

      <div className="font-body">
        {/* Header */}
        <header
          className="border-b sticky top-0 z-30"
          style={{ background: BRAND.white, borderColor: BRAND.border }}
        >
          <div className="stripe-bar h-1.5" />
          <div className="max-w-[1600px] mx-auto px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div
                className="w-14 h-14 flex items-center justify-center font-display font-black text-2xl"
                style={{
                  background: BRAND.red,
                  color: BRAND.white,
                  boxShadow: `4px 4px 0 ${BRAND.navy}`,
                }}
              >
                GW
              </div>
              <div>
                <div
                  className="font-display font-black text-2xl leading-none"
                  style={{ color: BRAND.navy }}
                >
                  {COMPANY.legalName}
                </div>
                <div
                  className="text-[10px] uppercase tracking-[0.25em] mt-1.5 font-semibold"
                  style={{ color: BRAND.red }}
                >
                  Service Analytics &amp; Fleet Intelligence
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {hasData && (
                <>
                  <div
                    className="hidden md:flex items-center gap-2 px-3 py-2 text-xs font-mono-data"
                    style={{
                      background: "#F0F9F4",
                      border: "1px solid #BFE5CB",
                      color: "#0F6B2F",
                    }}
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    {fileName}
                  </div>
                  <button
                    onClick={exportMaster}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-bold transition-colors"
                    style={{ background: BRAND.red, color: BRAND.white }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.background = BRAND.redDark)
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.background = BRAND.red)
                    }
                  >
                    <FileSpreadsheet className="w-4 h-4" />
                    Master Report
                  </button>
                  <button
                    onClick={reset}
                    className="p-2 transition-colors"
                    style={{ color: BRAND.textMute }}
                    title="Reset"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                </>
              )}
            </div>
          </div>
        </header>

        <main className="max-w-[1600px] mx-auto px-6 py-8">
          {!hasData && (
            <div
              onDragEnter={(e) => {
                e.preventDefault();
                setDragActive(true);
              }}
              onDragLeave={() => setDragActive(false)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={onDrop}
              onClick={() => fileInputRef.current?.click()}
              className="cursor-pointer transition-all gw-shadow-md p-16"
              style={{
                background: BRAND.white,
                border: `2px ${dragActive ? "solid" : "dashed"} ${
                  dragActive ? BRAND.red : BRAND.borderDark
                }`,
                borderTop: `4px solid ${BRAND.red}`,
              }}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={(e) => handleFile(e.target.files?.[0])}
              />
              <div className="text-center max-w-xl mx-auto">
                <div
                  className="w-20 h-20 mx-auto mb-6 flex items-center justify-center"
                  style={{
                    background: BRAND.red,
                    boxShadow: `4px 4px 0 ${BRAND.navy}`,
                  }}
                >
                  <Upload className="w-9 h-9 text-white" />
                </div>
                <div
                  className="font-display font-black text-4xl mb-3"
                  style={{ color: BRAND.navy }}
                >
                  Upload Your Service Log
                </div>
                <p className="mb-6" style={{ color: BRAND.textMute }}>
                  Drop your garage CSV export — token register, customer
                  database, vehicle master, crew performance, mileage fleet
                  registry &amp; branded PDF reports will be generated
                  instantly.
                </p>
                <div
                  className="inline-flex items-center gap-3 px-5 py-3 text-sm font-mono-data"
                  style={{
                    background: BRAND.cream,
                    border: `1px solid ${BRAND.border}`,
                    color: BRAND.text,
                  }}
                >
                  <span style={{ color: BRAND.red, fontWeight: 700 }}>
                    .CSV
                  </span>
                  <span style={{ color: BRAND.borderDark }}>|</span>
                  <span>Auto-detects ; or ,</span>
                  <span style={{ color: BRAND.borderDark }}>|</span>
                  <span>Up to 50k rows</span>
                </div>
                {loading && (
                  <div
                    className="mt-6 font-mono-data text-sm animate-pulse font-bold"
                    style={{ color: BRAND.red }}
                  >
                    PARSING…
                  </div>
                )}
                {parseError && (
                  <div
                    className="mt-6 font-mono-data text-sm"
                    style={{ color: BRAND.red }}
                  >
                    {parseError}
                  </div>
                )}
              </div>
            </div>
          )}

          {hasData && (
            <>
              <SectionTitle
                eyebrow="01 · Performance Indicators"
                title="At-a-Glance KPIs"
                subtitle="Click the download tag on any metric to export the underlying records."
              />

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                <KpiCard
                  icon={<Wrench className="w-5 h-5" />}
                  label="Service Tokens"
                  value={fmt(kpis.totalTokens)}
                  sub="Total jobs logged"
                  accent
                  onExport={exportAll}
                  exportLabel="Records"
                />
                <KpiCard
                  icon={<Users className="w-5 h-5" />}
                  label="Unique Customers"
                  value={fmt(kpis.uniqueCustomers)}
                  sub={`${kpis.repeatRate}% repeat rate`}
                  onExport={exportCustomers}
                  exportLabel="Customers"
                />
                <KpiCard
                  icon={<Car className="w-5 h-5" />}
                  label="Vehicles Serviced"
                  value={fmt(kpis.uniqueVehicles)}
                  sub="Distinct units"
                  onExport={exportVehicles}
                  exportLabel="Fleet"
                />
                <KpiCard
                  icon={<HardHat className="w-5 h-5" />}
                  label="Active Crew"
                  value={fmt(kpis.activeCrew)}
                  sub={`Top: ${kpis.topCrew[0]}`}
                  onExport={exportCrew}
                  exportLabel="Crew"
                />
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-12">
                <KpiCard
                  icon={<Award className="w-5 h-5" />}
                  label="Top Crew Output"
                  value={fmt(kpis.topCrew[1])}
                  sub={`${kpis.topCrew[0]} · jobs`}
                  onExport={exportTopCrewJobs}
                  exportLabel="Top Crew Jobs"
                />
                <KpiCard
                  icon={<TrendingUp className="w-5 h-5" />}
                  label="VIP Customer"
                  value={fmt(kpis.topCustomer[1])}
                  sub={`${kpis.topCustomer[0]} · visits`}
                  onExport={exportTopCustomerJobs}
                  exportLabel="VIP Visits"
                />
                <KpiCard
                  icon={<Gauge className="w-5 h-5" />}
                  label="Avg Reading"
                  value={fmt(kpis.avgReading)}
                  sub="km · across logs"
                  onExport={exportReadings}
                  exportLabel="Readings"
                />
                <KpiCard
                  icon={<Activity className="w-5 h-5" />}
                  label="Data Quality"
                  value={`${kpis.completionRate}%`}
                  sub="Reading completion"
                  onExport={exportCompletion}
                  exportLabel="Quality"
                />
              </div>

              {/* Mileage Fleet Registry */}
              <SectionTitle
                eyebrow="02 · Mileage Fleet Registry"
                title="Vehicles by Kilometers Driven"
                subtitle="Each unique vehicle (no duplicates) appears in exactly one bucket based on its latest odometer reading. Download per bucket as XLSX."
              />

              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-12">
                {kpis.buckets.map((b, i) => (
                  <BucketCard
                    key={b.key}
                    bucket={b}
                    color={
                      ["#0F6B2F", "#1F6FA8", BRAND.gold, "#D86A1F", BRAND.red][
                        i
                      ]
                    }
                    onExport={() => exportBucket(b)}
                    onPickVehicle={(v) => showVehicleQuick(v)}
                  />
                ))}
              </div>

              {/* Charts */}
              <SectionTitle
                eyebrow="03 · Visual Analytics"
                title="Crew & Workload Distribution"
              />

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
                <Panel className="lg:col-span-2">
                  <ChartHeader
                    title="Crew Leaderboard"
                    subtitle="Top 10 crew members by jobs handled"
                    onExport={exportCrew}
                  />
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart
                      data={kpis.crewSorted
                        .slice(0, 10)
                        .map(([name, count]) => ({ name, jobs: count }))}
                      margin={{ top: 8, right: 16, left: 0, bottom: 0 }}
                    >
                      <CartesianGrid
                        stroke={BRAND.border}
                        strokeDasharray="3 3"
                      />
                      <XAxis
                        dataKey="name"
                        tick={{ fill: BRAND.textMute, fontSize: 11 }}
                        stroke={BRAND.borderDark}
                      />
                      <YAxis
                        tick={{ fill: BRAND.textMute, fontSize: 11 }}
                        stroke={BRAND.borderDark}
                      />
                      <Tooltip
                        contentStyle={{
                          background: BRAND.white,
                          border: `2px solid ${BRAND.red}`,
                          borderRadius: 0,
                          color: BRAND.text,
                        }}
                        cursor={{ fill: "rgba(200, 16, 46, 0.06)" }}
                      />
                      <Bar
                        dataKey="jobs"
                        fill={BRAND.red}
                        radius={[2, 2, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </Panel>

                <Panel>
                  <ChartHeader
                    title="Workload Share"
                    subtitle="Distribution across crew"
                  />
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={(() => {
                          const top = kpis.crewSorted.slice(0, 7);
                          const rest = kpis.crewSorted.slice(7);
                          const restSum = rest.reduce(
                            (s, [_, c]) => s + c,
                            0
                          );
                          return [
                            ...top.map(([n, c]) => ({ name: n, value: c })),
                            ...(restSum
                              ? [{ name: "Others", value: restSum }]
                              : []),
                          ];
                        })()}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={95}
                        paddingAngle={2}
                      >
                        {[
                          BRAND.red,
                          BRAND.navy,
                          BRAND.gold,
                          BRAND.redDark,
                          "#1F6FA8",
                          "#0F6B2F",
                          "#D86A1F",
                          BRAND.navyMid,
                        ].map((c, i) => (
                          <Cell key={i} fill={c} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          background: BRAND.white,
                          border: `2px solid ${BRAND.red}`,
                          borderRadius: 0,
                          color: BRAND.text,
                        }}
                      />
                      <Legend
                        wrapperStyle={{ fontSize: 11, color: BRAND.text }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </Panel>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-12">
                <Panel>
                  <ChartHeader
                    title="Mileage Buckets"
                    subtitle="Vehicles per band (deduplicated)"
                  />
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart
                      data={kpis.buckets.map((b) => ({
                        range: b.label.replace(",000", "k"),
                        count: b.vehicles.length,
                      }))}
                    >
                      <CartesianGrid
                        stroke={BRAND.border}
                        strokeDasharray="3 3"
                      />
                      <XAxis
                        dataKey="range"
                        tick={{ fill: BRAND.textMute, fontSize: 9 }}
                        stroke={BRAND.borderDark}
                      />
                      <YAxis
                        tick={{ fill: BRAND.textMute, fontSize: 11 }}
                        stroke={BRAND.borderDark}
                      />
                      <Tooltip
                        contentStyle={{
                          background: BRAND.white,
                          border: `2px solid ${BRAND.red}`,
                          borderRadius: 0,
                          color: BRAND.text,
                        }}
                        cursor={{ fill: "rgba(200, 16, 46, 0.06)" }}
                      />
                      <Bar
                        dataKey="count"
                        fill={BRAND.navy}
                        radius={[2, 2, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </Panel>

                <Panel className="lg:col-span-2">
                  <ChartHeader
                    title="Job Volume Timeline"
                    subtitle="Tokens grouped into 12 chronological periods"
                  />
                  <ResponsiveContainer width="100%" height={260}>
                    <AreaChart data={kpis.timeline}>
                      <defs>
                        <linearGradient
                          id="redGrad"
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop
                            offset="0%"
                            stopColor={BRAND.red}
                            stopOpacity={0.4}
                          />
                          <stop
                            offset="100%"
                            stopColor={BRAND.red}
                            stopOpacity={0}
                          />
                        </linearGradient>
                      </defs>
                      <CartesianGrid
                        stroke={BRAND.border}
                        strokeDasharray="3 3"
                      />
                      <XAxis
                        dataKey="period"
                        tick={{ fill: BRAND.textMute, fontSize: 11 }}
                        stroke={BRAND.borderDark}
                      />
                      <YAxis
                        tick={{ fill: BRAND.textMute, fontSize: 11 }}
                        stroke={BRAND.borderDark}
                      />
                      <Tooltip
                        contentStyle={{
                          background: BRAND.white,
                          border: `2px solid ${BRAND.red}`,
                          borderRadius: 0,
                          color: BRAND.text,
                        }}
                        labelFormatter={(label, payload) =>
                          payload?.[0]
                            ? `Tokens ${payload[0].payload.range}`
                            : label
                        }
                      />
                      <Area
                        type="monotone"
                        dataKey="jobs"
                        stroke={BRAND.red}
                        strokeWidth={2.5}
                        fill="url(#redGrad)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </Panel>
              </div>

              {/* Service Log Table */}
              <SectionTitle
                eyebrow="04 · Service Register"
                title="Token-Level Service Log"
                subtitle="Click a vehicle number for the branded PDF report. Use row icons for per-vehicle XLSX history."
              />

              <Panel className="!p-0">
                <div
                  className="p-6 border-b flex flex-col md:flex-row md:items-center gap-4"
                  style={{ borderColor: BRAND.border }}
                >
                  <div className="flex-1">
                    <div
                      className="font-display font-black text-xl"
                      style={{ color: BRAND.navy }}
                    >
                      Service Log
                    </div>
                    <div
                      className="text-[10px] uppercase tracking-[0.2em] mt-1 font-semibold"
                      style={{ color: BRAND.red }}
                    >
                      {fmt(filteredRows.length)} of {fmt(rows.length)} records
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-wrap">
                    <div className="relative">
                      <Search
                        className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2"
                        style={{ color: BRAND.textMute }}
                      />
                      <input
                        value={search}
                        onChange={(e) => {
                          setSearch(e.target.value);
                          setPage(1);
                        }}
                        placeholder="Search token, customer, vehicle…"
                        className="pl-9 pr-3 py-2 text-sm font-mono-data w-72 focus:outline-none"
                        style={{
                          background: BRAND.cream,
                          border: `1px solid ${BRAND.border}`,
                          color: BRAND.text,
                        }}
                      />
                    </div>
                    <div className="relative">
                      <Filter
                        className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2"
                        style={{ color: BRAND.textMute }}
                      />
                      <select
                        value={crewFilter}
                        onChange={(e) => {
                          setCrewFilter(e.target.value);
                          setPage(1);
                        }}
                        className="pl-9 pr-3 py-2 text-sm font-mono-data appearance-none cursor-pointer focus:outline-none"
                        style={{
                          background: BRAND.cream,
                          border: `1px solid ${BRAND.border}`,
                          color: BRAND.text,
                        }}
                      >
                        {crewOptions.map((c) => (
                          <option key={c} value={c}>
                            {c === "ALL" ? "All Crew" : c}
                          </option>
                        ))}
                      </select>
                    </div>
                    {(search || crewFilter !== "ALL") && (
                      <button
                        onClick={() => {
                          setSearch("");
                          setCrewFilter("ALL");
                        }}
                        className="p-2"
                        style={{ color: BRAND.textMute }}
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr style={{ background: BRAND.navy }}>
                        <Th>Token</Th>
                        <Th>Customer</Th>
                        <Th>Vehicle / Bike No</Th>
                        <Th>Crew</Th>
                        <Th align="right">Reading (km)</Th>
                        <Th align="center">Reports</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {pagedRows.map((r, i) => (
                        <tr
                          key={i}
                          className="border-b transition-colors"
                          style={{
                            borderColor: BRAND.border,
                            background:
                              i % 2 === 0 ? BRAND.white : BRAND.cream,
                          }}
                        >
                          <td
                            className="px-6 py-3 font-mono-data font-bold"
                            style={{ color: BRAND.red }}
                          >
                            #{r.tokenNo || "—"}
                          </td>
                          <td
                            className="px-6 py-3"
                            style={{ color: BRAND.text }}
                          >
                            {r.customer || (
                              <span style={{ color: BRAND.textMute }}>—</span>
                            )}
                          </td>
                          <td className="px-6 py-3">
                            {r.vehicle ? (
                              <button
                                onClick={() => openVehiclePDF(r.vehicle)}
                                className="gw-link font-mono-data font-bold"
                                title={`Open PDF letterhead for vehicle ${r.vehicle}`}
                              >
                                {r.vehicle}
                              </button>
                            ) : (
                              <span style={{ color: BRAND.textMute }}>—</span>
                            )}
                          </td>
                          <td className="px-6 py-3">
                            {r.crew ? (
                              <span
                                className="inline-block px-2 py-0.5 font-mono-data text-xs font-bold"
                                style={{
                                  background: "#FFEAEC",
                                  color: BRAND.redDark,
                                  border: `1px solid ${BRAND.red}33`,
                                }}
                              >
                                {r.crew}
                              </span>
                            ) : (
                              <span style={{ color: BRAND.textMute }}>—</span>
                            )}
                          </td>
                          <td
                            className="px-6 py-3 font-mono-data text-right"
                            style={{ color: BRAND.text }}
                          >
                            {r.reading ? (
                              <b>{fmt(parseInt(r.reading))}</b>
                            ) : (
                              <span style={{ color: BRAND.textMute }}>—</span>
                            )}
                          </td>
                          <td className="px-6 py-3">
                            {r.vehicle && (
                              <div className="flex items-center justify-center gap-2">
                                <RowIcon
                                  onClick={() =>
                                    exportVehicleHistory(r.vehicle)
                                  }
                                  title="Download vehicle history XLSX"
                                  bg="#0F6B2F"
                                >
                                  <FileSpreadsheet className="w-3.5 h-3.5" />
                                </RowIcon>
                                <RowIcon
                                  onClick={() => openVehiclePDF(r.vehicle)}
                                  title="Generate PDF letterhead report"
                                  bg={BRAND.red}
                                >
                                  <FileText className="w-3.5 h-3.5" />
                                </RowIcon>
                                <RowIcon
                                  onClick={() => showVehicleQuick(r.vehicle)}
                                  title="Quick history preview"
                                  bg={BRAND.navy}
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                </RowIcon>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                      {pagedRows.length === 0 && (
                        <tr>
                          <td
                            colSpan={6}
                            className="px-6 py-12 text-center"
                            style={{ color: BRAND.textMute }}
                          >
                            No matching records.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                <div
                  className="p-4 border-t flex items-center justify-between"
                  style={{
                    borderColor: BRAND.border,
                    background: BRAND.cream,
                  }}
                >
                  <div
                    className="text-xs font-mono-data uppercase tracking-widest"
                    style={{ color: BRAND.textMute }}
                  >
                    Page {page} of {pageCount}
                  </div>
                  <div className="flex items-center gap-2">
                    <PagerButton
                      disabled={page === 1}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </PagerButton>
                    <PagerButton
                      disabled={page === pageCount}
                      onClick={() =>
                        setPage((p) => Math.min(pageCount, p + 1))
                      }
                    >
                      <ChevronRight className="w-4 h-4" />
                    </PagerButton>
                  </div>
                </div>
              </Panel>

              <div
                className="mt-12 p-8 flex items-center justify-between flex-wrap gap-4 gw-shadow-md"
                style={{
                  background: `linear-gradient(135deg, ${BRAND.navy} 0%, ${BRAND.navyMid} 100%)`,
                  borderTop: `4px solid ${BRAND.red}`,
                }}
              >
                <div>
                  <div className="font-display font-black text-2xl text-white">
                    Master Report Package
                  </div>
                  <p className="text-sm mt-1" style={{ color: "#9CA3AF" }}>
                    Multi-sheet Excel: records · KPI summary · crew leaderboard
                    · customer master · vehicle master · 5 mileage bucket
                    sheets.
                  </p>
                </div>
                <button
                  onClick={exportMaster}
                  className="flex items-center gap-2 px-6 py-3 font-bold transition-colors"
                  style={{ background: BRAND.red, color: BRAND.white }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.background = BRAND.redLight)
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.background = BRAND.red)
                  }
                >
                  <Download className="w-4 h-4" />
                  Download Master .xlsx
                </button>
              </div>
            </>
          )}
        </main>

        {vehiclePanel && (
          <VehicleHistoryModal
            data={vehiclePanel}
            onClose={() => setVehiclePanel(null)}
            onPDF={() => openVehiclePDF(vehiclePanel.vehicle)}
            onXLSX={() => exportVehicleHistory(vehiclePanel.vehicle)}
          />
        )}

        <footer
          className="border-t mt-16 py-8"
          style={{ borderColor: BRAND.border, background: BRAND.white }}
        >
          <div className="max-w-[1600px] mx-auto px-6 grid grid-cols-1 md:grid-cols-4 gap-6 text-sm">
            <div>
              <div
                className="font-display font-black text-lg"
                style={{ color: BRAND.navy }}
              >
                {COMPANY.legalName}
              </div>
              <p className="mt-2 text-xs" style={{ color: BRAND.textMute }}>
                Trusted vehicle &amp; bike repair services since 2019.
              </p>
            </div>
            <FooterCol
              icon={<MapPin className="w-3.5 h-3.5" />}
              title="Location"
            >
              {COMPANY.address}
            </FooterCol>
            <FooterCol
              icon={<Phone className="w-3.5 h-3.5" />}
              title="Contact"
            >
              {COMPANY.phone}
              <br />
              {COMPANY.hotline}
            </FooterCol>
            <FooterCol
              icon={<Mail className="w-3.5 h-3.5" />}
              title="Online"
            >
              {COMPANY.email}
              <br />
              {COMPANY.website}
            </FooterCol>
          </div>
          <div className="stripe-bar h-1 mt-8" />
        </footer>
      </div>
    </div>
  );
}

// ===== Sub-components =====
function SectionTitle({ eyebrow, title, subtitle }) {
  return (
    <div className="mb-5">
      <div
        className="text-[10px] uppercase tracking-[0.3em] font-bold"
        style={{ color: BRAND.red }}
      >
        {eyebrow}
      </div>
      <div
        className="font-display font-black text-3xl mt-1"
        style={{ color: BRAND.navy }}
      >
        {title}
      </div>
      {subtitle && (
        <p
          className="text-sm mt-1.5 max-w-3xl"
          style={{ color: BRAND.textMute }}
        >
          {subtitle}
        </p>
      )}
    </div>
  );
}

function Panel({ children, className = "" }) {
  return (
    <div
      className={`gw-shadow p-6 ${className}`}
      style={{
        background: BRAND.white,
        border: `1px solid ${BRAND.border}`,
        borderTop: `3px solid ${BRAND.red}`,
      }}
    >
      {children}
    </div>
  );
}

function KpiCard({ icon, label, value, sub, accent, onExport, exportLabel }) {
  return (
    <div
      className="gw-shadow p-5 relative"
      style={{
        background: BRAND.white,
        border: `1px solid ${BRAND.border}`,
        borderTop: `3px solid ${accent ? BRAND.red : BRAND.navy}`,
      }}
    >
      <div className="flex items-center justify-between mb-3">
        <div
          className="text-[10px] uppercase tracking-[0.2em] font-bold"
          style={{ color: BRAND.textMute }}
        >
          {label}
        </div>
        <div style={{ color: accent ? BRAND.red : BRAND.navy }}>{icon}</div>
      </div>
      <div
        className="font-display font-black text-4xl mb-1"
        style={{ color: accent ? BRAND.red : BRAND.navy }}
      >
        {value}
      </div>
      <div className="flex items-center justify-between gap-2">
        <div
          className="text-xs truncate flex-1"
          style={{ color: BRAND.textMute }}
        >
          {sub}
        </div>
        {onExport && (
          <button
            onClick={onExport}
            className="download-pill"
            title="Download XLSX"
          >
            <Download className="w-3 h-3" />
            {exportLabel || "XLSX"}
          </button>
        )}
      </div>
    </div>
  );
}

function BucketCard({ bucket, color, onExport, onPickVehicle }) {
  const [showAll, setShowAll] = useState(false);
  const top = bucket.vehicles.slice(0, showAll ? 50 : 5);
  return (
    <div
      className="gw-shadow flex flex-col"
      style={{
        background: BRAND.white,
        border: `1px solid ${BRAND.border}`,
        borderTop: `3px solid ${color}`,
      }}
    >
      <div className="p-5 pb-3">
        <div
          className="text-[9px] uppercase tracking-[0.2em] font-bold"
          style={{ color }}
        >
          {bucket.label}
        </div>
        <div className="flex items-baseline justify-between mt-2">
          <div
            className="font-display font-black text-3xl"
            style={{ color: BRAND.navy }}
          >
            {fmt(bucket.vehicles.length)}
          </div>
          <div
            className="text-[10px] uppercase tracking-wider font-semibold"
            style={{ color: BRAND.textMute }}
          >
            unique bikes
          </div>
        </div>
      </div>
      <div
        className="px-5 py-3 flex-1 border-t"
        style={{ background: BRAND.cream, borderColor: BRAND.border }}
      >
        <div
          className="text-[9px] uppercase tracking-wider font-bold mb-2"
          style={{ color: BRAND.textMute }}
        >
          Top bikes
        </div>
        <div className="space-y-1.5 max-h-48 overflow-y-auto">
          {top.length === 0 && (
            <div className="text-xs italic" style={{ color: BRAND.textMute }}>
              No vehicles in this band.
            </div>
          )}
          {top.map((v) => (
            <button
              key={v.vehicle}
              onClick={() => onPickVehicle(v.vehicle)}
              className="w-full flex items-center justify-between text-left px-2 py-1 transition-colors text-xs hover:bg-white"
              style={{ background: "transparent" }}
              title={`${v.visits} visits · click to view`}
            >
              <span
                className="font-mono-data font-bold"
                style={{ color: BRAND.navy }}
              >
                {v.vehicle}
              </span>
              <span className="font-mono-data" style={{ color }}>
                {fmt(v.maxReading)} km
              </span>
            </button>
          ))}
        </div>
        {bucket.vehicles.length > 5 && !showAll && (
          <button
            onClick={() => setShowAll(true)}
            className="mt-2 text-[10px] font-bold uppercase tracking-wider"
            style={{ color }}
          >
            + {bucket.vehicles.length - 5} more
          </button>
        )}
      </div>
      <button
        onClick={onExport}
        className="flex items-center justify-center gap-2 py-3 text-xs font-bold uppercase tracking-wider transition-colors"
        style={{ background: color, color: BRAND.white }}
      >
        <FileSpreadsheet className="w-3.5 h-3.5" />
        Download .xlsx
      </button>
    </div>
  );
}

function ChartHeader({ title, subtitle, onExport }) {
  return (
    <div
      className="mb-4 pb-3 flex items-start justify-between"
      style={{ borderBottom: `2px solid ${BRAND.red}` }}
    >
      <div>
        <div
          className="font-display font-black text-xl"
          style={{ color: BRAND.navy }}
        >
          {title}
        </div>
        <div
          className="text-[10px] uppercase tracking-[0.2em] mt-1 font-semibold"
          style={{ color: BRAND.textMute }}
        >
          {subtitle}
        </div>
      </div>
      {onExport && (
        <button
          onClick={onExport}
          className="download-pill"
          title="Download XLSX"
        >
          <Download className="w-3 h-3" />
          XLSX
        </button>
      )}
    </div>
  );
}

function Th({ children, align = "left" }) {
  return (
    <th
      className={`px-6 py-3 text-${align} text-[10px] uppercase tracking-[0.18em] font-bold`}
      style={{ color: BRAND.white }}
    >
      {children}
    </th>
  );
}

function PagerButton({ children, disabled, onClick }) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      className="p-2 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
      style={{
        border: `1px solid ${BRAND.border}`,
        color: BRAND.text,
        background: BRAND.white,
      }}
    >
      {children}
    </button>
  );
}

function RowIcon({ children, onClick, title, bg }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="w-7 h-7 flex items-center justify-center transition-transform hover:scale-110"
      style={{ background: bg, color: BRAND.white }}
    >
      {children}
    </button>
  );
}

function FooterCol({ icon, title, children }) {
  return (
    <div>
      <div
        className="flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] font-bold mb-2"
        style={{ color: BRAND.red }}
      >
        {icon}
        {title}
      </div>
      <div className="text-xs" style={{ color: BRAND.text }}>
        {children}
      </div>
    </div>
  );
}

function VehicleHistoryModal({ data, onClose, onPDF, onXLSX }) {
  const { vehicle, history } = data;
  const sorted = [...history].sort(
    (a, b) => parseInt(a.tokenNo) - parseInt(b.tokenNo)
  );
  const readings = history
    .map((h) => parseFloat(h.reading))
    .filter((n) => !isNaN(n) && n > 0);
  const maxR = readings.length ? Math.max(...readings) : null;
  const minR = readings.length ? Math.min(...readings) : null;
  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center p-4"
      style={{ background: "rgba(15, 27, 45, 0.7)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl max-h-[85vh] flex flex-col"
        style={{
          background: BRAND.white,
          border: `1px solid ${BRAND.border}`,
          borderTop: `4px solid ${BRAND.red}`,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="p-5 flex items-center justify-between border-b"
          style={{ borderColor: BRAND.border }}
        >
          <div>
            <div
              className="text-[10px] uppercase tracking-[0.2em] font-bold"
              style={{ color: BRAND.red }}
            >
              Vehicle History
            </div>
            <div
              className="font-display font-black text-2xl mt-0.5"
              style={{ color: BRAND.navy }}
            >
              <span className="font-mono-data">{vehicle}</span>
            </div>
            <div className="text-xs mt-1" style={{ color: BRAND.textMute }}>
              {history.length} visits
              {maxR !== null && ` · Latest reading ${fmt(maxR)} km`}
              {minR !== null &&
                maxR > minR &&
                ` · Distance ${fmt(maxR - minR)} km`}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ color: BRAND.textMute }}
            className="p-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 overflow-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: BRAND.navy }}>
                <Th>S.No</Th>
                <Th>Token</Th>
                <Th>Customer</Th>
                <Th>Crew</Th>
                <Th align="right">Reading (km)</Th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((h, i) => (
                <tr
                  key={i}
                  style={{
                    background: i % 2 === 0 ? BRAND.white : BRAND.cream,
                    borderBottom: `1px solid ${BRAND.border}`,
                  }}
                >
                  <td
                    className="px-6 py-2.5 font-mono-data"
                    style={{ color: BRAND.textMute }}
                  >
                    {i + 1}
                  </td>
                  <td
                    className="px-6 py-2.5 font-mono-data font-bold"
                    style={{ color: BRAND.red }}
                  >
                    #{h.tokenNo}
                  </td>
                  <td className="px-6 py-2.5">{h.customer || "—"}</td>
                  <td className="px-6 py-2.5">
                    {h.crew && (
                      <span
                        className="inline-block px-2 py-0.5 font-mono-data text-xs font-bold"
                        style={{
                          background: "#FFEAEC",
                          color: BRAND.redDark,
                        }}
                      >
                        {h.crew}
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-2.5 font-mono-data text-right font-bold">
                    {h.reading ? fmt(parseInt(h.reading)) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div
          className="p-5 flex items-center justify-end gap-3 border-t"
          style={{ borderColor: BRAND.border, background: BRAND.cream }}
        >
          <button
            onClick={onXLSX}
            className="flex items-center gap-2 px-4 py-2 text-xs font-bold uppercase tracking-wider"
            style={{ background: "#0F6B2F", color: BRAND.white }}
          >
            <FileSpreadsheet className="w-4 h-4" />
            History XLSX
          </button>
          <button
            onClick={onPDF}
            className="flex items-center gap-2 px-4 py-2 text-xs font-bold uppercase tracking-wider"
            style={{ background: BRAND.red, color: BRAND.white }}
          >
            <FileText className="w-4 h-4" />
            PDF Letterhead
          </button>
        </div>
      </div>
    </div>
  );
}
