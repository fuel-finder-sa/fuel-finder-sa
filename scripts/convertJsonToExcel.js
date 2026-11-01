const XLSX = require("xlsx");
const fs = require("fs");

const stations = JSON.parse(
  fs.readFileSync("stations_firebase_backup.json", "utf8")
);

const worksheet = XLSX.utils.json_to_sheet(stations);
const workbook = XLSX.utils.book_new();

XLSX.utils.book_append_sheet(workbook, worksheet, "Stations");
XLSX.writeFile(workbook, "FuelFinder_Master_List.xlsx");

console.log(`Converted ${stations.length} stations to FuelFinder_Master_List.xlsx`);