const { StmdCrud } = require('./stmd-crud');
const {jsonToYaml, allToYaml} = require('./json_to_yaml.js')
const fs = require('fs');
const path = require('path')

// node ./workflow_utils/parse_to_yaml.js -f "./SimulationTask.stmd" -o ./.github/workflows/

let stmdString;
let stmdFolderPath;
let outputFolder;

// get STMD string, the STMD base path and the target output path from command line arguments
for (let i = 0; i < process.argv.length; i++) {
    if (process.argv[i] === "-s" || process.argv[i] === "--stmd") {
        stmdString = process.argv[i+1];
    }
    if (process.argv[i] === "-f") {
        stmdString = fs.readFileSync(process.argv[i+1]);
        stmdFolderPath=path.resolve(path.dirname(process.argv[i+1]));
    }
    if (process.argv[i] === "-o") {
        outputFolder = process.argv[i+1];
    }
}

if (stmdString === undefined)
    throw("STMD string must be given, use -s or --stmd")

// extract the locations of all <Rationale> elements in the STMD
// the locations are given as string arrays like
// ["stmd:SimulationTaskMetaData", "stmd:ImplementationPhase", "stmd:ImplementModel", "stc:Rationale"]
let stmdCrud = new StmdCrud(stmdString);
var stmdRationales = stmdCrud.findAllParticleLocation("stc:Rationale")

// create one workflow for each Rationale of a process phase
var count = 0;
var workflowNameList = [];

for (let rationale of stmdRationales) {
    let fileNameBase = rationale[1].split(":")[1]+"."+rationale[2].split(":")[1];
    let workflowName = `No_${count}_${fileNameBase}`.replace(".","_");

    console.log(workflowName);
    workflowNameList.push(workflowName);

    let outputFilename = `No.${count}.${fileNameBase}.cdkResult.json`;
    let workflowFilename = `${outputFolder}/No.${count}.${fileNameBase}.yaml`;
    let yamlContent = jsonToYaml(stmdCrud.getCdkElement(rationale), outputFilename, workflowName, stmdFolderPath);
    fs.writeFileSync(workflowFilename, yamlContent);

    count++;
}

let allYamlContent = allToYaml(workflowNameList)
fs.writeFileSync(outputFolder + "/all.yaml", allYamlContent);