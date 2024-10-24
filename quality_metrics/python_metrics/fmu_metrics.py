def check_model_description(fmu_path):
    from fmpy.validation import validate_fmu
    import json
    
    problems = validate_fmu(fmu_path)

    if len(problems) == 0:
        reslog = { "result": True, "log": "The modelDescription of the FMU is error-free." }
    else:
        logs = " // next error: ".join(problems)
        reslog = { "result": False, "log": logs}

    return json.dumps(reslog)