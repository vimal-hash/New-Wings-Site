"use client";

import { useEffect, useState } from "react";
import { diagnosticsEnabled, loadingReport, traceMark } from "./loading-trace";

const seconds = (v: number | null | undefined) => v == null ? "waiting…" : `${(v / 1000).toFixed(2)} s`;
export default function LoadingDiagnostics() {
  const [report, setReport] = useState<ReturnType<typeof loadingReport>>(null);
  const [open, setOpen] = useState(true);
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    if (!diagnosticsEnabled()) return;
    traceMark("Application mounted");
    const update = () => setReport(loadingReport());
    update(); const timer = window.setInterval(update, 500);
    return () => window.clearInterval(timer);
  }, []);
  if (!report) return null;
  const marks = report.marks;
  const save = () => {
    const current = loadingReport();
    const url = URL.createObjectURL(new Blob([JSON.stringify(current, null, 2)], { type: "application/json" }));
    const link = document.createElement("a"); link.href = url; link.download = `loading-report-${Date.now()}.json`;
    document.body.appendChild(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 60000); setSaved(true);
  };
  return <aside className="loading-diagnostics" aria-label="Loading diagnosis">
    <button className="diagnosis-heading" onClick={() => setOpen(!open)} aria-expanded={open}>Loading diagnosis <span>{open ? "−" : "+"}</span></button>
    {open && <>
      <p>{marks["Opening loading card removed"] !== undefined ? "Opening ready — save this report." : `Measuring… ${seconds(report.elapsed)}`}</p>
      <dl>
        <div><dt>Server first response</dt><dd>{seconds(report.navigation?.responseStart)}</dd></div>
        <div><dt>App mounted</dt><dd>{seconds(marks["Application mounted"])}</dd></div>
        <div><dt>Canvas ready</dt><dd>{seconds(marks["Canvas created"])}</dd></div>
        <div><dt>Opening assets processed</dt><dd>{seconds(marks["Opening scene committed"])}</dd></div>
        <div><dt>Opening rendered¹</dt><dd>{seconds(marks["Opening paint opportunity"])}</dd></div>
        <div><dt>Loading card gone</dt><dd>{seconds(marks["Opening loading card removed"])}</dd></div>
        <div><dt>Opening camera settled</dt><dd>{seconds(marks["Opening camera settled"])}</dd></div>
        <div><dt>Observed opening transfer²</dt><dd>{(report.summary.openingObservedTransferBytes / 1000000).toFixed(2)} MB</dd></div>
        <div><dt>Errors captured</dt><dd>{report.errors.length}</dd></div>
        <div><dt>Pauses over 50 ms</dt><dd>{report.framePauses.length}</dd></div>
        <div><dt>Worst browser pause</dt><dd>{Math.max(0,...report.framePauses.map(f=>f.duration)).toFixed(0)} ms</dd></div>
      </dl>
      <button className="diagnosis-save" onClick={save}>Save report</button>
      {saved && <p role="status">Report download requested.</p>}
      <small>Times from navigation. ¹ Next-frame estimate. ² Browser-reported; cache affects this. Save once, reload, then save again.</small>
    </>}
  </aside>;
}
