def join_sort_unique(array1, array2):
    import numpy as np
    import json

    arr1 = np.array(json.loads(array1))
    arr2 = np.array(json.loads(array2))
    arr12 = np.concatenate((arr1, arr2))
    
    return np.array_str(np.unique(np.sort(arr12)))