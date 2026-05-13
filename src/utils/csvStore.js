const fs = require("fs");
const path = require("path");
const { parse } = require("csv-parse/sync");
const { stringify } = require("csv-stringify/sync");

function ensureCsvFile(filePath, headers) {
  const absolutePath = path.resolve(filePath);
  const dir = path.dirname(absolutePath);

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  if (!fs.existsSync(absolutePath)) {
    const csv = stringify([], {
      header: true,
      columns: headers
    });

    fs.writeFileSync(absolutePath, csv, {
      encoding: "utf8",
      mode: 0o600
    });
  }
}

function readCsv(filePath, headers) {
  ensureCsvFile(filePath, headers);
  const content = fs.readFileSync(path.resolve(filePath), "utf8");

  return parse(content, {
    columns: true,
    skip_empty_lines: true,
    trim: true
  });
}

function writeCsv(filePath, rows, headers) {
  ensureCsvFile(filePath, headers);

  const csv = stringify(rows, {
    header: true,
    columns: headers
  });

  fs.writeFileSync(path.resolve(filePath), csv, {
    encoding: "utf8",
    mode: 0o600
  });
}

module.exports = {
  readCsv,
  writeCsv,
  ensureCsvFile
};
