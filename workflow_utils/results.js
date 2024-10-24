const fs = require('fs');

let isSinglePhase = false;
let value;
let outputFilePath;

for (let i = 0; i < process.argv.length; i++) {
    if (process.argv[i] === "-p") {
        value = JSON.parse(process.argv[i + 1]);
        isSinglePhase = true;
    }
    if (process.argv[i] === "-s") { //summary, input as folder name
        value = "summary";
        isSinglePhase = false;
    }
    if (process.argv[i] === "-o") {
        outputFilePath = process.argv[i + 1];
    }
}

if (!value || !outputFilePath)
    throw ("Invalid input")

var valueOutput;

try {
    valueOutput = JSON.parse(fs.readFileSync(outputFilePath));
} catch (e) {
}

if (!valueOutput) {
    if (isSinglePhase) {
        valueOutput = [];
    }
}

if (isSinglePhase == true) {
    valueOutput.push(value);
    fs.writeFileSync(outputFilePath, JSON.stringify(valueOutput))
} else {
    valueOutput = "### [CDK Report](" + "https://github.com/" + process.env.GithubOwner + "/" + process.env.GithubRepoName + "/blob/" + process.env.GithubBranch + "/.github/outputs/allPhaseStepReport.csv" + ") :rocket: \n| Phase | Step | Test passed | Reached Level | Result | \n | ---- | ---- | ---- | ---- | ---- | \n"

    var allPhaseStepReportCSV = "Phase, Step, Test passed, Reached Level, Result \n";

    let allActionList = process.env.allActionList;

    let actionList = allActionList.split(",");
    let reportByPhase = {};

    for (let a in actionList) {
        if (actionList[a]) {
            let phaseName = actionList[a].split("_")[2];
            if (!reportByPhase[phaseName]) {
                reportByPhase[phaseName] = {
                    "phaseName": phaseName,
                    "reachedLevel": 4
                }
            }
            let stepName = actionList[a].split("_")[3];
            let rs = JSON.parse(process.env[actionList[a]]);
            let passedCount = 0;
            let rsFullObj = [];
            let minLevel = 4;
            let maxLevel = 0;

            for (let e in rs) {
                var rsobj = rs[e];
                if (typeof rs[e] == "string") {
                    rsobj = JSON.parse(rs[e]);
                }
                if (rsobj["result"] == true) {
                    passedCount++;
                    if (maxLevel < parseInt(rsobj["level"])) {
                        maxLevel = parseInt(rsobj["level"]);
                    }
                } else if (parseInt(rsobj["level"]) <= minLevel) {
                    minLevel = parseInt(rsobj["level"]) - 1;
                }
                rsFullObj.push(rsobj);
            }
            if (minLevel > maxLevel) {
                minLevel = maxLevel;
            }
            if (minLevel < reportByPhase[phaseName]["reachedLevel"]) {
                reportByPhase[phaseName]["reachedLevel"] = minLevel;
            }
            let fileName = actionList[a].replaceAll("_", ".");
            let fileURL = "https://github.com/" + process.env.GithubOwner + "/" + process.env.GithubRepoName + "/blob/" + process.env.GithubBranch + "/.github/outputs/" + fileName + ".json";

            valueOutput += "| " + phaseName + " | " + stepName + " | " + passedCount + "/" + rs.length + "|" + minLevel + " | [view](" + fileURL + ") | \n"
            allPhaseStepReportCSV += phaseName + "," + stepName + "," + passedCount + "/" + rs.length + "," + minLevel + "," + fileURL + " \n"

            fs.writeFileSync("./.github/outputs/" + fileName + ".json", JSON.stringify(rsFullObj, null, 4));
        }
    }
    fs.writeFileSync("./.github/outputs/allPhaseStepReport.csv", allPhaseStepReportCSV);

    var allPhaseReport = "Phase,Reached Level\n";

    valueOutput += "#### [Phase Report](" + "https://github.com/" + process.env.GithubOwner + "/" + process.env.GithubRepoName + "/blob/" + process.env.GithubBranch + "/.github/outputs/allPhaseReport.csv" + ") \n| Phase | Reached Level | \n | ---- | ---- | \n"
    for (let p in reportByPhase) {
        valueOutput += "|" + reportByPhase[p]["phaseName"] + "|" + reportByPhase[p]["reachedLevel"] + "| \n"
        allPhaseReport += reportByPhase[p]["phaseName"] + "," + reportByPhase[p]["reachedLevel"] + " \n"
    }

    fs.writeFileSync("./.github/outputs/allPhaseReport.csv", allPhaseReport);

    fs.writeFileSync(outputFilePath, valueOutput)
}

