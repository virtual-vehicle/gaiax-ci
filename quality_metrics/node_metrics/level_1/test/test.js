const metrics = require("..");
const fs = require("fs");

const es = fs.readFileSync("./expertStatement.json", "utf-8");
const x509 = fs.readFileSync("./cert_ahmann.crt");

console.log(x509)

console.log(metrics.checkSingleSemantic(es, x509));