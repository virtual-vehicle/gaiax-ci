const fs = require('fs');
const path = require('path')

/**
 * Extracts all parameter names from a function as an array of strings
 * 
 * @param {Function} func the function to investigate 
 * @returns {string[]}
 */
function getParamNames(func) {
    const STRIP_COMMENTS = /((\/\/.*$)|(\/\*[\s\S]*?\*\/))/mg;
    const ARGUMENT_NAMES = /([^\s,]+)/g;

    let fnStr = func.toString().replace(STRIP_COMMENTS, '');
    let result = fnStr.slice(fnStr.indexOf('(')+1, fnStr.indexOf(')')).match(ARGUMENT_NAMES);

    return result !== null ? result : [];
}

/**
 * @param {string} moduleUri 
 * @param {string} functionToRun 
 * @param {string[]} functionArgumentNames 
 * @param {string[]} argumentContents
 * @param {string[]} argumentTypes 
 * @param {string} stmdFolderPath 
 * @param {object} metadata 
 * @param {boolean} [wrapToReslog=true]
 * @returns {string}
 */
exports.wrapper = (moduleUri, functionToRun, functionArgumentNames, argumentContents, argumentTypes, stmdFolderPath, metadata, wrapToReslog = true) => {
    let allProcessedArguments = [];

    // const stmdFolderPath = process.env["STMDFOLDERPATH"];
    const modulePath =  path.resolve(stmdFolderPath, moduleUri);
    const moduleToImport = require(modulePath);

    const functionParameters = getParamNames(moduleToImport[functionToRun]);

    for (let parameterName of functionParameters) {
        let requiredArgumentIdx = functionArgumentNames.findIndex(farg => farg == parameterName);
        if (requiredArgumentIdx == -1)
            throw(`Error: For test ${metadata.id} of metric ${functionToRun} the required function parameter ${parameterName} is missing!`);

        let argumentProcessed;
        if (argumentTypes[requiredArgumentIdx] == "file")
            argumentProcessed = fs.readFileSync(path.resolve(stmdFolderPath, String(argumentContents[requiredArgumentIdx])), "utf-8");
        else if (argumentTypes[requiredArgumentIdx] == "path")
            argumentProcessed = path.resolve(stmdFolderPath, String(argumentContents[requiredArgumentIdx]));
        else // method == "inline"
        argumentProcessed = String(argumentContents[requiredArgumentIdx]);
        
        allProcessedArguments.push(argumentProcessed);
    }  
    
    let res;

    try {
        res = moduleToImport[functionToRun](...allProcessedArguments);
    } catch (e) {
        if (wrapToReslog) {
            res = {
                "result":false,
                "log": e.toString()
            };
        }
        else {
            res = e.toString();
        }
    }

    if (wrapToReslog) {
        res = {...res, ...metadata}
    }

    return res;
}