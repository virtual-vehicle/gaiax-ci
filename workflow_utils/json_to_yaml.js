/**
 * creates a github-workflow (YAML file)
 */

const yaml = require('yaml');
const path = require('path');
const fs = require('fs');

// helper methods for arrays to make array unique
Array.prototype.unique = function () {
    return this.filter((val, i, self) => self.indexOf(val) === i);
}

const WORKFLOW_TEMPLATE = {
    "name": "process-phase-testing-pipelines",
    "on": {
        "workflow_run": {
            "workflows": ['create-workflows'],
            "types": ['completed']
            // "branches": ['thanh'] //delete it in main
        }
    },
    "jobs": {
        "run-all-workflows": {
            "runs-on": "ubuntu-20.04",
            "needs": [],
            "steps": [
                {
                    "name": "checkout simulation data",
                    "uses": "actions/checkout@v4",
                    "with": {
                        "submodules": true,
                        "token": "${{ secrets.WRITE_WORKFLOW }}"
                    }
                },
                {
                    "name": "install prerequisites",
                    "run": "npm install yaml --prefix ./workflow_utils\nnpm install ./workflow_utils/stmd-crud --prefix ./workflow_utils/stmd-crud\n"
                },
                {
                    "name": "make output folder",
                    "run": "mkdir -p ./.github/outputs"
                }
            ]
        }
    }
};
const FIXED_STEPS = {
    "checkout_repo": {
        "name": "checkout repo",
        "uses": "actions/checkout@v4",
        "with": {
            "submodules": true,
            "token": "${{ secrets.WRITE_WORKFLOW }}"
        }
    },
    "install_nvm": {
        "name": "install Node Version Manager nvm",
        "run": "curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.0/install.sh | bash"
    },
    "load_nvm": {
        "name": "load nvm",
        "run": 'export NVM_DIR="$HOME/.nvm" && [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh" && [ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"'
    },
    "install_pyenv": {
        "name": "install Python Version Management pyenv",
        "run": "curl https://pyenv.run | bash"
    },
    "load_pyenv": {
        "name": "load pyenv",
        "run": 'export PYENV_ROOT="$HOME/.pyenv" && [[ -d $PYENV_ROOT/bin ]] && export PATH="$PYENV_ROOT/bin:$PATH" && eval "$(pyenv init -)"'
    }
};

// paths relative to STMD location
const PATH_FCN_WRAPPER_PYTHON = "./workflow_utils/wrapper/fcnWrapperPython";
const PATH_FCN_WRAPPER_NODE = "./workflow_utils/wrapper/fcnWrapperNode";
const PATH_RESULTS_FILE = "./workflow_utils/results.js";

function jsonToYaml(cdkElements, outputFile, basename, stmdFolderPath) {
    let steps = [];

    // get required node and python versions to install
    // const nodeVersions = identifyNodeVersions(cdkElements.Evidence, cdkElements.Processing);
    // const pythonVersions = identifyPythonVersions(cdkElements.Evidence, cdkElements.Processing);

    // add steps to check out repo and set global vars
    steps = addStepsBasic(stmdFolderPath, steps);

    // install node requirements
    // steps = addStepsInstallNode(nodeVersions, steps);

    // install python version requirements
    // steps = addStepsInstallPython(pythonVersions, steps);

    // add processing steps
    steps = addStepsProcessing(cdkElements.Processing, stmdFolderPath, steps);

    // add evidence steps
    steps = addStepsEvidence(cdkElements.Evidence, outputFile, stmdFolderPath, steps);

    // create the structure for translating to YAML
    let yamlStruct = createStructForYaml("ubuntu-20.04", basename);

    // generate YAML string from the structure created above
    let yamlString = generateYamlString(yamlStruct, steps, basename, outputFile)

    return yamlString;
}

function allToYaml(workflowNameList) {
    var allWorkflows = WORKFLOW_TEMPLATE;

    // add essential steps to the workflow
    allWorkflows = addEnvStep(workflowNameList, allWorkflows);
    allWorkflows = addPushStep(allWorkflows);

    let yamlString = yaml.stringify(allWorkflows);

    return yamlString;
}

// -------------------- functions---------------------------------------------------------------------------------------

function addEnvStep(workflowNameList, workflow) {
    var envStep = {
        "env": {
            "GithubBranch": "${{github.ref_name}}",
            "GithubRepoName": "${{github.event.repository.name}}",
            "GithubOwner": "${{github.repository_owner}}"
        },
        "run": "node ./workflow_utils/results.js -s -o summary.md && cat summary.md >> $GITHUB_STEP_SUMMARY"
    }

    var allActionList = "";
    for (var i in workflowNameList) {
        if (typeof workflowNameList[i] === "string") {
            var fileName = workflowNameList[i].replaceAll("_", ".");

            workflow["jobs"][workflowNameList[i]] = {
                "uses": process.env.GithubOwner + "/" + process.env.GithubRepoName + "/.github/workflows/" + fileName + ".yaml@" + process.env.GithubBranch,
                "secrets": {
                    "WRITE_WORKFLOW": "${{secrets.WRITE_WORKFLOW}}"
                }
            }
            workflow["jobs"]["run-all-workflows"]["needs"].push(workflowNameList[i]);

            envStep["env"][workflowNameList[i]] = "${{needs." + workflowNameList[i] + ".outputs.summary}}"
            allActionList += workflowNameList[i] + ",";
        }
    }
    envStep["env"]["allActionList"] = allActionList;
    workflow["jobs"]["run-all-workflows"]["steps"].push(envStep);

    return workflow;
}

function addPushStep(workflow) {
    workflow["jobs"]["run-all-workflows"]["steps"].push({
        "name": "push results",
        "run": "git config --global user.name \"Add results\"\ngit config --global user.email \"setlabs@users.noreply.github.com\"\n\ngit add ./.github/outputs\ngit commit -m \"Add results [actions skip]\"\ngit push\n"
    });

    return workflow;
}

function addStepsBasic(stmdFolderPath, stepsBefore) {
    let stepsAfter = [...stepsBefore];

    // add checking out the repository
    stepsAfter.push(FIXED_STEPS.checkout_repo);

    // set the directory where the STMD is located
    stepsAfter.push({
        "name": "set STMD Folder path",
        "run": `echo 'STMDFOLDERPATH=${stmdFolderPath}' >> $GITHUB_ENV && echo $STMDFOLDERPATH`
    });

    return stepsAfter;
}

function addStepsEvidence(evidenceElements, outputFilePath, stmdFolderPath, stepsBefore) {
    let stepsAfter = [...stepsBefore];

    for (let element of evidenceElements) {
        let newSteps = translateEvidenceElement(element, outputFilePath, stmdFolderPath);
        stepsAfter.push(...newSteps);
    }

    return stepsAfter;
}

function addStepsProcessing(processingElements, stmdFolderPath, stepsBefore) {
    let stepsAfter = [...stepsBefore];

    for (let element of processingElements) {
        let newSteps = translateProcessingElement(element, stmdFolderPath);
        stepsAfter.push(...newSteps);
    }

    return stepsAfter;
}

function addStepsInstallPython(pythonVersions, stepsBefore) {
    let stepsAfter = [...stepsBefore];

    if (pythonVersions.length > 0) {
        // install python environment manager pyenv
        stepsAfter.push(FIXED_STEPS.install_pyenv);
        stepsAfter.push(FIXED_STEPS.load_pyenv);

        // install all required python versions and virtualenv via pyenv
        for (let pyVersion of pythonVersions) {
            stepsAfter.push({
                "name": "install python version " + pyVersion,
                "run": "pyenv install " + pyVersion
            });
            stepsAfter.push({
                "name": "install virtualenv for python version " + pyVersion,
                "run": "pyenv global " + pyVersion + " && pip install virtualenv"
            });
        }
    }

    return stepsAfter;
}

function addStepsInstallNode(nodeVersions, stepsBefore) {
    let stepsAfter = [...stepsBefore];

    if (nodeVersions.length > 0) {

        // install node version manager nvm
        stepsAfter.push(FIXED_STEPS.install_nvm);
        stepsAfter.push(FIXED_STEPS.load_nvm);

        // install all required node versions via nvm
        for (let nodeVersion of nodeVersions) {
            stepsAfter.push({
                "name": "install node version " + nodeVersion,
                "run": "nvm install " + nodeVersion
            });
        };
    }

    return stepsAfter;
}

function createStructForYaml(ubuntuIdentifier, baseName) {
    let yamlStruct = {
        "name": baseName,
        "on": {
            "workflow_call": {
                "outputs": {
                    "summary": {
                        "value": "${{jobs." + baseName + ".outputs.summary}}"
                    }
                },
                "secrets": {
                    "WRITE_WORKFLOW": {
                        "required": true
                    }
                }
            }
        },
        "jobs": {
        },
    };

    yamlStruct["jobs"][baseName] = {
        "runs-on": ubuntuIdentifier,
        "outputs": {
            "summary": "${{steps.outputStep.outputs.summary}}"
        },
        "steps": []
    };

    return yamlStruct;
}

function generateYamlString(yamlStruct, steps, basename, outputFilePath) {
    // using "step__x" and replacing it later with the actual string is a workaround 
    // to compensate for bugs in the yaml module (Bug: yaml module wraps long strings
    // to new lines)
    for (let i = 0; i < steps.length; i++) {
        yamlStruct.jobs[basename].steps.push({ ...steps[i] });

        if (steps[i].run !== undefined) {
            yamlStruct.jobs[basename].steps[i].run = "step__" + String(i);
        }
    }

    // add report and summary step
    yamlStruct.jobs[basename].steps.push({
        name: "show report",
        run: "cat " + outputFilePath
    });
    yamlStruct.jobs[basename].steps.push({
        name: "send to outputs",
        id: "outputStep",
        run: "echo \"summary=$(cat " + outputFilePath + ")\" >> $GITHUB_OUTPUT"
    });

    let yamlString = yaml.stringify(yamlStruct);

    // replace step__x with the run (see above!)
    for (let i = 0; i < steps.length; i++) {
        if (steps[i].run !== undefined) {
            yamlString = yamlString.replace('step__' + String(i), steps[i].run);
        }
    }

    return yamlString;
}

function translateProcessingElement(element, stmdFolderPath) {
    const wrapperPathNode = path.resolve(stmdFolderPath, PATH_FCN_WRAPPER_NODE);
    const wrapperPathPython = path.resolve(stmdFolderPath, PATH_FCN_WRAPPER_PYTHON);

    let steps = [];

    for (let prerequisite of element.Prerequisites) {
        var absolutePathSource = path.resolve(stmdFolderPath, prerequisite.attributes.source);
        steps.push({
            name: "install prerequisites",
            run: `sudo chmod +x ${absolutePathSource} && sudo ${absolutePathSource}`
        });
    }

    if (element.SimpleProcessing !== undefined) {
        var outputPath = path.resolve(stmdFolderPath, element.Outputs.Return.attributes.path);
        var outputFolderPath = path.dirname(outputPath);
        var metadata = { id: element.SimpleProcessing.attributes.id }
        let functionArg = parseFcnArguments(element.Inputs.FunctionArgument, stmdFolderPath);

        if (element.SimpleProcessing.attributes.interpreter == "nodejs") {
            // steps.push({
            //     name: `activate NodeJS version ${element.SimpleProcessing.attributes.interpreterVersion} at processing element for metric ${element.SimpleProcessing.attributes.module}/${element.SimpleProcessing.attributes.function}`,
            //     run: `nvm use ${element.SimpleProcessing.attributes.interpreterVersion}`
            // });

            steps.push({
                name: `activate NodeJS version ${element.SimpleProcessing.attributes.interpreterVersion} at processing element for metric ${element.SimpleProcessing.attributes.module}/${element.SimpleProcessing.attributes.function}`,
                uses: "actions/setup-node@v3",
                with: {
                    "node-version": element.SimpleProcessing.attributes.interpreterVersion
                }
            },{
                name: "Remove node_modules, reset libs",
                run: `|
                npm ls --parseable --depth=0 | tail -n +2 | awk -F'/' '{print $NF}' | xargs -r npm uninstall
                `
            });

            let nodeModulePath = path.resolve(stmdFolderPath, element.SimpleProcessing.attributes.module);
            steps.push({
                name: "install node module at processing element",
                run: `npm install --prefix ${nodeModulePath} ${nodeModulePath}`
            });

            // compose node command
            let nodeCmd = `const {wrapper} = require("${wrapperPathNode}"); let nodeResult = wrapper("${element.SimpleProcessing.attributes.module}", "${element.SimpleProcessing.attributes.function}", [${functionArg.names.join(",")}], [${functionArg.contents.join(",")}], [${functionArg.methods.join(",")}], "${stmdFolderPath}", ${JSON.stringify(metadata)}, false); process.stdout.write(JSON.stringify(nodeResult));`;
            let nodeBashCmd = `res=$(node -e '${nodeCmd}') && echo $res && mkdir -p ${outputFolderPath} && echo $res > ${outputPath}`;

            // add SimpleProcessing command
            steps.push({
                name: element.SimpleProcessing.attributes.id,
                run: nodeBashCmd
            });
        }
        else if (element.SimpleProcessing.attributes.interpreter == "python") {
            let pyModulePath = path.resolve(stmdFolderPath, element.SimpleProcessing.attributes.module) + ".py";
            let pyModuleDir = path.dirname(pyModulePath);

            ////////////////////////////  
            steps.push({
                name: "activate required python version at simple processing element",
                uses: "actions/setup-python@v4",
                with: {
                    "python-version": element.SimpleProcessing.attributes.interpreterVersion
                }
            },{
                name: "Create lib environment, reset all libs",
                run: `| 
                pip freeze | xargs -r pip uninstall -y
                `
            });

            steps.push({
                name: "install python requirements, if necessary",
                run: `| 
                [ -f ${pyModuleDir}/requirements.txt ] && pip install -r ${pyModuleDir}/requirements.txt
                `
            });
            ////////////////////////////  

            // steps.push({
            //     name: "activate required python version at simple processing element",
            //     run: `pyenv global ${element.SimpleProcessing.attributes.interpreterVersion}`
            // });
            // steps.push({
            //     name: `create virtual python environment for preprocessing with id ${element.SimpleProcessing.attributes.id}`,
            //     run: `python -m virtualenv env_${element.SimpleProcessing.attributes.id}`
            // });
            // steps.push({
            //     name: "activate virtual python environment at processing element",
            //     run: `source env_${element.SimpleProcessing.attributes.id}/bin/activate`
            // });
            // steps.push({
            //     name: "install python requirements, if necessary",
            //     run: `[[ -e ${pyModuleDir}/requirements.txt ]] && pip install -r ${pyModuleDir}/requirements.txt`
            // });

            // compose python command
            let pythonCmd = `import sys; sys.path.append("${path.dirname(wrapperPathPython)}"); from fcnWrapperPython import wrapper; result = wrapper("${element.SimpleProcessing.attributes.module}", "${element.SimpleProcessing.attributes.function}", [${functionArg.names.join(",")}], [${functionArg.contents.join(",")}], [${functionArg.methods.join(",")}], "${stmdFolderPath}", ${JSON.stringify(metadata)}, False); print(result)`;
            let pythonBashCmd = `res=$(python -c '${pythonCmd}') && echo $res && mkdir -p ${outputFolderPath} && echo $res > ${outputPath}`;

            steps.push({
                name: element.SimpleProcessing.attributes.id,
                run: pythonBashCmd
            });
        }
    }
    else if (element.ComplexProcessing !== undefined) {
        if (element.ComplexProcessing.attributes.method == "github-action") {
            // parse arguments
            let actionArgs = {};
            for (let input of element.Inputs.FunctionArgument) {
                actionArgs[input.attributes.name] = input.attributes.method == "inline" ? input.attributes.content : input.attributes.method == "path" ? path.resolve(stmdFolderPath, input.attributes.content) : input.attributes.content;
            }

            // compose step
            let step = {
                name: element.ComplexProcessing.attributes.id,
                uses: element.ComplexProcessing.attributes.source
            };

            // add "with" only if arguments are given
            if (element.Inputs.FunctionArgument.length > 0) {
                step["with"] = actionArgs;
            }

            steps.push(step);
        }

        if (element.ComplexProcessing.attributes.method == "nodejs") {
            var outputPath;
            try {
                var outputPath = path.resolve(stmdFolderPath, element.Outputs.Output[0].attributes.path)
            }
            catch (e) {
                outputPath = "";
            }

            // parse arguments
            let clArgs = parseCmdLineArguments(element.Inputs.CommandLineArgument, stmdFolderPath);

            let nodeCmd = `${path.resolve(stmdFolderPath, element.ComplexProcessing.attributes.source)} ${clArgs.join(" ")})`;
            let nodeBashCmd;

            if (outputPath) {
                var outputFolderPath = path.dirname(outputPath);
                nodeBashCmd = `res=$(node ${nodeCmd}) && echo $res && mkdir -p ${outputFolderPath} && echo $res > ${outputPath}`;
            }
            else {
                nodeBashCmd = `node ${nodeCmd}`;
            }

            steps.push({
                name: element.attributes.id,
                run: nodeBashCmd
            });
        }
        else if (element.ComplexProcessing.attributes.method == "python") {
            var outputPath;
            try {
                var outputPath = path.resolve(stmdFolderPath, element.Outputs.Output[0].attributes.path)
            }
            catch (e) {
                outputPath = "";
            }

            // parse arguments
            let clArgs = parseCmdLineArguments(element.Inputs.CommandLineArgument, stmdFolderPath);

            let pythonCmd = `${path.resolve(stmdFolderPath, element.ComplexProcessing.attributes.source)} ${clArgs.join(" ")})`;
            let pythonBashCmd;

            if (outputPath) {
                var outputFolderPath = path.dirname(outputPath);
                pythonBashCmd = `res=$(python ${pythonCmd}) && echo $res && mkdir -p ${outputFolderPath} && echo $res > ${outputPath}`;
            }
            else {
                pythonBashCmd = `python ${pythonCmd}`;
            }

            // steps.push({
            //     name: "activate required python version at processing complex",
            //     run: `pyenv global ${element.ComplexProcessing.attributes.interpreterVersion}`
            // });

            steps.push({
                name: "activate required python version at processing complex",
                uses: "actions/setup-python@v4",
                with: {
                    "python-version": element.ComplexProcessing.attributes.interpreterVersion
                }
            },{
                name: "Create lib environment, reset all libs",
                run: `| 
                pip freeze | xargs -r pip uninstall -y
                `
            });

            steps.push({
                name: element.attributes.id,
                run: pythonBashCmd
            });
        }
    }

    return steps;
}

function translateEvidenceElement(element, outputPath, stmdFolderPath) {
    let steps = [];

    const nodeMetrics = element.Metric.filter(metric => metric.attributes.interpreter == "nodejs");
    const pyMetrics = element.Metric.filter(metric => metric.attributes.interpreter == "python");
    const wrapperPathNode = path.resolve(stmdFolderPath, PATH_FCN_WRAPPER_NODE);
    const wrapperPathPython = path.resolve(stmdFolderPath, PATH_FCN_WRAPPER_PYTHON);
    const resultsFilePath = path.resolve(stmdFolderPath, PATH_RESULTS_FILE);

    // install required node modules
    // for (let metric of nodeMetrics) {
    //     let nodeModulePath = path.resolve(stmdFolderPath, metric.attributes.module);
    //     steps.push({
    //         name: "install node module",
    //         run: "npm install --prefix " + nodeModulePath + " " + nodeModulePath
    //     });
    // }

    // install required python modules
    // for (let metric of pyMetrics) {
    //     let pyModulePath =  path.resolve(stmdFolderPath, metric.attributes.module) + ".py";
    //     let pyModuleDir = path.dirname(pyModulePath);

    //     steps.push({
    //         name: "activate required python version at evidence",
    //         run: "pyenv global " + metric.attributes.interpreterVersion
    //     });
    //     steps.push({
    //         name: "create virtual python environment for metric",
    //         run: "python -m virtualenv " + metric.attributes.function
    //     });
    //     steps.push({
    //         name: "activate virtual python environment",
    //         run: "source " + metric.attributes.function + "/bin/activate"
    //     });
    //     steps.push({
    //         name: "install python requirements, if necessary",
    //         run: "[[ -e " + pyModuleDir + "/requirements.txt ]] && pip install -r " + pyModuleDir + "/requirements.txt"
    //     });
    //     steps.push({
    //         name: "deactivate virtual python environment",
    //         run: "[[ -n $VIRTUAL_ENV ]] && deactivate"
    //     });
    // }

    // process python metrics
    for (let metric of pyMetrics) {

        // steps.push({
        //     name: "activate required python version at evidence",
        //     run: "pyenv global " + metric.attributes.interpreterVersion
        // });

        let pyModulePath = path.resolve(stmdFolderPath, metric.attributes.module) + ".py";
        let pyModuleDir = path.dirname(pyModulePath);

        steps.push({
            name: `activate required python version ${metric.attributes.interpreterVersion} for metric ${metric.attributes.module}/${metric.attributes.function}`,
            uses: "actions/setup-python@v4",
            with: {
                "python-version": metric.attributes.interpreterVersion
            }
        },{
            name: "Create lib environment, reset all libs",
            run: `| 
            pip freeze | xargs -r pip uninstall -y
            `
        });

        steps.push({
            name: "install python requirements, if necessary",
            run: `| 
            [ -f ${pyModuleDir}/requirements.txt ] && pip install -r ${pyModuleDir}/requirements.txt
            `
        });

        for (let test of metric.Test) {
            let functionArg = parseFcnArguments(test.FunctionArgument, stmdFolderPath);

            // compose metadata
            var metadata = {
                level: element.attributes.level,
                id: test.attributes.id
            };

            // compose python command
            let pythonCmd = `import sys; sys.path.append("${path.dirname(wrapperPathPython)}"); from fcnWrapperPython import wrapper; result = wrapper("${metric.attributes.module}", "${metric.attributes.function}", [${functionArg.names.join(",")}], [${functionArg.contents.join(",")}], [${functionArg.methods.join(",")}], "${stmdFolderPath}", ${JSON.stringify(metadata)}); print(result)`;
            let pythonBashCmd = `res=$(python -c '${pythonCmd}') && echo $res && node ${resultsFilePath} -p "$res" -o ${outputPath}`;

            // if result shall be written to an output file, add this to the command
            if (test.Return) {
                var returnPath = path.resolve(stmdFolderPath, test.Return.path);
                pythonBashCmd += ` && echo $res > ${returnPath}`;
            }

            // steps.push({
            //     name: "activate virtual python environment for test " + test.attributes.id,
            //     run: "source " + metric.attributes.function + "/bin/activate"
            // })
            steps.push({
                name: "execute test " + test.attributes.id,
                run: pythonBashCmd
            });
            // steps.push({
            //     name: "deactivate virtual python environment for test " + test.attributes.id,
            //     run: "[[ -n $VIRTUAL_ENV ]] && deactivate"
            // });
        }
    }

    // process node metrics
    for (let metric of nodeMetrics) {
        // activate according node version
        // steps.push({
        //     name: `activate NodeJS version ${metric.attributes.interpreterVersion} for metric ${metric.attributes.module}/${metric.attributes.function}`,
        //     run: `nvm use ${metric.attributes.interpreterVersion}`
        // });

        steps.push({
            name: `activate NodeJS version ${metric.attributes.interpreterVersion} for metric ${metric.attributes.module}/${metric.attributes.function}`,
            uses: "actions/setup-node@v3",
            with: {
                "node-version": metric.attributes.interpreterVersion
            }
        },{
            name: "Remove node_modules, reset libs",
            run: `|
            npm ls --parseable --depth=0 | tail -n +2 | awk -F'/' '{print $NF}' | xargs -r npm uninstall
            `
        });

        let nodeModulePath = path.resolve(metric.attributes.module);

        steps.push({
            name: "install node module",
            run: "npm install --prefix " + nodeModulePath + " " + nodeModulePath
        });

        for (let test of metric.Test) {
            let functionArg = parseFcnArguments(test.FunctionArgument, stmdFolderPath);

            var metadata = {
                level: element.attributes.level,
                id: test.attributes.id
            };

            // compose node command
            let nodeCmd = `const {wrapper} = require("${wrapperPathNode}"); let nodeResult = wrapper("${metric.attributes.module}", "${metric.attributes.function}", [${functionArg.names.join(",")}], [${functionArg.contents.join(",")}], [${functionArg.methods.join(",")}], "${stmdFolderPath}", ${JSON.stringify(metadata)}); process.stdout.write(JSON.stringify(nodeResult));`;
            let nodeBashCmd = `res=$(node -e '${nodeCmd}') && echo $res && node ${resultsFilePath} -p "$res" -o ${outputPath}`;

            // if result shall be written to an output file, add this to the command
            if (test.Return) {
                var returnPath = path.resolve(stmdFolderPath, test.Return.path);
                nodeBashCmd += ` && echo $res > ${returnPath}`;
            }

            steps.push({
                name: test.attributes.id,
                run: nodeBashCmd
            });
        }
    }

    return steps;
}

function identifyNodeVersions(evidenceElements, processingElements) {
    let versions = [];

    versions.push(...identifyEvidenceNodeVersions(evidenceElements));
    versions.push(...identifyProcessingNodeVersions(processingElements));

    return versions.unique();
}

function identifyEvidenceNodeVersions(evidenceElements) {
    let versions = [];

    for (let evidence of evidenceElements) {
        for (let metric of evidence.Metric) {
            if (metric.attributes.interpreter == "nodejs") {
                versions.push(metric.attributes.interpreterVersion);
            }
        }
    }

    return versions.unique();
}

function identifyProcessingNodeVersions(processingElements) {
    let versions = [];

    for (let processing of processingElements) {
        if (processing.SimpleProcessing !== undefined) {
            if (processing.SimpleProcessing.attributes.interpreter == "nodejs") {
                versions.push(processing.SimpleProcessing.attributes.interpreterVersion);
            }
        }
        else if (processing.ComplexProcessing !== undefined) {
            if (processing.ComplexProcessing.attributes.interpreter == "nodejs") {
                versions.push(processing.ComplexProcessing.attributes.interpreterVersion);
            }
        }
    }

    return versions.unique();
}

function identifyPythonVersions(evidenceElements, processingElements) {
    let versions = [];

    versions.push(...identifyEvidencePythonVersions(evidenceElements));
    versions.push(...identifyProcessingPythonVersions(processingElements));

    return versions.unique();
}

function identifyEvidencePythonVersions(evidenceElements) {
    let versions = [];

    for (let evidence of evidenceElements) {
        for (let metric of evidence.Metric) {
            if (metric.attributes.interpreter == "python") {
                versions.push(metric.attributes.interpreterVersion);
            }
        }
    }

    return versions.unique();
}

function identifyProcessingPythonVersions(processingElements) {
    let versions = [];

    for (let processing of processingElements) {
        if (processing.SimpleProcessing !== undefined) {
            if (processing.SimpleProcessing.attributes.interpreter == "python") {
                versions.push(processing.SimpleProcessing.attributes.interpreterVersion);
            }
        }
        else if (processing.ComplexProcessing !== undefined) {
            if (processing.ComplexProcessing.attributes.interpreter == "python") {
                versions.push(processing.ComplexProcessing.attributes.interpreterVersion);
            }
        }
    }

    return versions.unique();
}

function parseFcnArguments(cdkFunctionArguments, stmdFolderPath) {
    let functionArgMethods = [];
    let functionArgNames = [];
    let functionArgContents = [];

    for (let arg of cdkFunctionArguments) {
        functionArgNames.push('"' + arg.attributes.name + '"');
        functionArgMethods.push('"' + arg.attributes.method + '"');
        if (arg.attributes.method == "file") {
            functionArgContents.push('"' + arg.attributes.content + '"');
        } else if (arg.attributes.method == "path") {
            functionArgContents.push('"' + path.resolve(stmdFolderPath, arg.attributes.content) + '"');
        } else {
            functionArgContents.push('"' + arg.attributes.content + '"')
        }
    }

    return {
        names: functionArgNames,
        methods: functionArgMethods,
        contents: functionArgContents
    };
}

function parseCmdLineArguments(inputElement, stmdFolderPath) {
    // parse arguments
    let clArgs = [];

    for (let arg of inputElement.CommandLineArgument) {
        clArgs.push(arg.attributes.flag);
        if (arg.attributes.argument !== undefined) {
            if (arg.attributes.type == "path") {
                var argPathLs = arg.attributes.argument.split(" ");
                for (var argi in argPathLs) {
                    if (typeof argPathLs[argi] === "string") {
                        var argPath = path.resolve(stmdFolderPath, argPathLs[argi]);
                        var argFolderPath = path.dirname(argPath);

                        if (!fs.existsSync(argFolderPath)) {
                            fs.mkdirSync(argFolderPath, { recursive: true });
                        }

                        clArgs.push(argPath);
                    }
                }
            }
            else {
                clArgs.push(arg.attributes.argument);
            }
        }
    }

    return clArgs;
}

module.exports = {
    jsonToYaml,
    allToYaml
}