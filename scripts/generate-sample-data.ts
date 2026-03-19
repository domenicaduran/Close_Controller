import fs from "node:fs/promises";
import path from "node:path";

import * as XLSX from "xlsx";

async function main() {
  const sampleDir = path.join(process.cwd(), "sample-data");
  await fs.mkdir(sampleDir, { recursive: true });

  const closeChecklistCsv = [
    "Task,Description,Category,Owner,Due Day,Recurrence,Dependency,Notes,Priority",
    '"Reconcile operating cash","Tie bank activity to GL","Cash","Domenica","5","Monthly","","Need prior month workbook","Critical"',
    '"Review prepaid expenses","Analyze additions and amortization","Expenses","Reviewer","6","Monthly","Reconcile operating cash","","High"',
  ].join("\n");

  await fs.writeFile(path.join(sampleDir, "sample-close-checklist.csv"), closeChecklistCsv, "utf8");

  const pbcRows = [
    {
      "PBC #": "PBC-01",
      "Requested Item": "Bank reconciliations",
      "Owner/Contact": "Taylor Chen",
      "Requested Date": "2026-03-28",
      "Received Date": "",
      Status: "requested",
      Notes: "Needed for interim audit support",
    },
    {
      "PBC #": "PBC-02",
      "Requested Item": "Equity rollforward",
      "Owner/Contact": "Taylor Chen",
      "Requested Date": "2026-03-29",
      "Received Date": "2026-04-02",
      Status: "received",
      Notes: "",
    },
  ];

  const pbcWorkbook = XLSX.utils.book_new();
  const pbcSheet = XLSX.utils.json_to_sheet(pbcRows);
  XLSX.utils.book_append_sheet(pbcWorkbook, pbcSheet, "PBC");
  XLSX.writeFile(pbcWorkbook, path.join(sampleDir, "sample-pbc-list.xlsx"));

  const templateRows = [
    {
      Item: "Prepare AP accrual support",
      Category: "Accruals",
      "Assigned To": "Domenica",
      "Due Day": 4,
      Recurrence: "Monthly",
      Priority: "High",
    },
    {
      Item: "Review expense variance report",
      Category: "Review",
      "Assigned To": "Reviewer",
      "Due Day": 6,
      Recurrence: "Monthly",
      Priority: "Medium",
    },
  ];

  const templateWorkbook = XLSX.utils.book_new();
  const templateSheet = XLSX.utils.json_to_sheet(templateRows);
  XLSX.utils.book_append_sheet(templateWorkbook, templateSheet, "Template");
  XLSX.writeFile(templateWorkbook, path.join(sampleDir, "sample-template-import.xlsx"));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
