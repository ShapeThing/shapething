# @shapething/shacl-manager

[![Unit tests](https://img.shields.io/endpoint?url=https://raw.githubusercontent.com/ShapeThing/shapething/badges/test-shacl-manager-unit.json)](https://github.com/ShapeThing/shapething/actions/workflows/test-shacl-manager.yml)

This react component should be given a graph similar to how a SHACL renderer receives a data graph.
This graph is a set of triples. The idea behind this component is that it is a complete solution for managing SHACL shapes and OWL ontologies.
This component starts from `owl:Ontology` and `sh:ShapesGraph`. One denotes an OWL ontology and the other a SHACL shapes graph.
`owl:Ontology` has been used in the past also denote a SHACL shapes graph, so that is also supported.
