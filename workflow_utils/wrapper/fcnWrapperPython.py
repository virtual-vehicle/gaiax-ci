from pathlib import PurePath
import re
import json
import sys

def get_param_names(module, function_name, stmd_folder_path):
    module_path = str(PurePath(stmd_folder_path, module)) + ".py"
    f = open(module_path, "r")
    pyModuleString = f.read()
    f.close()

    regexp = rf"{function_name}*\((.*?)\)"
    params_raw = re.findall(regexp, pyModuleString)[0].split(",")

    params = []
    for param_raw in params_raw:
        param_processed = param_raw.strip()
        if param_processed != "":
            params.append(param_processed)

    return params

def include_metadata(result, metadata):
    result_dict = json.loads(result)
    metadata_dict = json.loads(metadata)
    result_dict.update(metadata_dict)

    return json.dumps(result_dict)

def wrapper(module, function_to_run, function_arguments, argument_contents, argument_types, stmd_folder_path, metadata, wrap_to_reslog = True):
    """
     Parameters
     -------------------------
     module : str
         The path of the module, relative to stmd_folder_path, without .py 
         suffix
     function_to_run : str 
         The name of the function to run
     function_arguments : list
         The list of all names of the arguments, that must be passed to
         function_to_run and will be given in "argument_content"
     argument_contents : list
         The list of all argument contents that will be passed to
         function_to_run to be interpreted by its type, given accordingly in
         argument_types
     argument_types : list
         The list of all types of arguments (file, path, or inline), adhering
         to the order of function_arguments.
         If "file" is given, then the according element in function_arguments
         will be interpreted as a path to the file whose content must be passed
         as function argument.
         If "path" is given, then the according element in function_arguments
         will be interpreted as a path and this path is passed to the function,
         contrary to its content (as in file).
         If "inline" is given, then the according element in function_arguments
         is interpreted to be passed as it is to function_to_run.
     stmd_folder_path : str
         The base bath to the module path
     metadata : dict
         Arbitrary metadata, given as stringified JSON
     wrap_to_reslog : bool
         If set to true, the result will be wrapped in a JSON structure

     Returns
     -------------------------
     The output of function_to_run in combination with the given arguments
    """
    module_path = PurePath(str(PurePath(stmd_folder_path, module)) + ".py")
    module_dir = str(module_path.parent)
    module_name = module_path.stem

    all_processed_arguments = []
    function_parameters = get_param_names(module, function_to_run, stmd_folder_path)    

    for param in function_parameters:
        try:
            index_required_arg = function_arguments.index(param)
        except:
            raise Exception("Error: For test ${} of metric ${} the required function parameter ${} is missing!".format(metadata["id"], function_to_run, param))
        
        if argument_types[index_required_arg] == "file":
            file_location = str(PurePath(stmd_folder_path, argument_contents[index_required_arg]))
            f = open(file_location, "r")
            argument_processed = f.read()
            f.close()
        elif argument_types[index_required_arg] == "path":
            argument_processed = str(PurePath(stmd_folder_path, argument_contents[index_required_arg]))
        else:
            argument_processed = str(argument_contents[index_required_arg])
        
        all_processed_arguments.append('"' + argument_processed + '"')

    try:
        sys.path.append(module_dir)
        module = __import__(module_name)
        result = eval("module." + function_to_run + "(" + ",".join(all_processed_arguments) + ")")
    except Exception as error:
        if wrap_to_reslog:
            result = '{"result": false, "log": "' + str(error) + '"}'
        else:
            result = str(error)
    
    if wrap_to_reslog:
        result = include_metadata(result, json.dumps(metadata))

    return result