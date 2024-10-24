# Changelog

- Changed CDK Schema:
    - MetricType: Deleted attribute `packageUri`, added attributes `module`, `interpreter`, `interpreterVersion`
    - SimpleProcessingType: Deleted attribute `packageUri`, added attributes `module`, `interpreter`, `interpreterVersion`. Changed `id` from optional to required.
    - ComplexProcessingType: Changed attribute name `method` to `interpreter`. Added `python` to selection for `interpreter`. Added attribute `interpreterVersion`. Changed `id` from optional to required.
    - Prerequisites: Deleted attribute name `method` --> only bash scripts allowed

- json_to_yaml.js:
    - added handling of python quality metrics and processing functions
    - added version management for NodeJS
    - added version management and virtual environments for python
    - refactored and commented everything

- wrappers:
    - added python wrapper
    - added internal function to allow correct allocation from function arguments (so they can occur in arbitrary order in the STMD)

- parse_to_yaml.js:
    - refactored