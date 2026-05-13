const fs = require("fs");
const path = require("path");
const { parse } = require("csv-parse/sync");
const { stringify } = require("csv-stringify/sync");

const CSV_HEADERS = [
  "id",
  "name",
  "email",
  "passwordHash",
  "role",
  "createdAt",
  "lastLoginAt",
  "isActive"
];

function ensureCsvFile(filePath) {
  const absolutePath = path.resolve(filePath);
  const dir = path.dirname(absolutePath);

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  if (!fs.existsSync(absolutePath)) {
    const csv = stringify([CSV_HEADERS]);
    fs.writeFileSync(absolutePath, csv, { encoding: "utf8", mode: 0o600 });
  }
}

function readCsv(filePath) {
  ensureCsvFile(filePath);
  const content = fs.readFileSync(path.resolve(filePath), "utf8");
  return parse(content, {
    columns: true,
    skip_empty_lines: true,
    trim: true
  });
}

function writeCsv(filePath, rows) {
  ensureCsvFile(filePath);
  const csv = stringify(rows, {
    header: true,
    columns: CSV_HEADERS
  });

  fs.writeFileSync(path.resolve(filePath), csv, {
    encoding: "utf8",
    mode: 0o600
  });
}

module.exports = { readCsv, writeCsv };
