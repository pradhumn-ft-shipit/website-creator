# Malformed ruleset (fixture)

Deliberately broken to prove the linter fails. Defects:
- prohibited_terms[0] is missing `severity`
- prohibited_terms[0] cites `missing_source` (not in citations)
- required_elements[0] is missing `placement`
- manifest references a non-existent CA overlay file
- manifest is `approved: true` with only one reviewer (§5.7 violation)
- footer-standard.md is missing the Form CRS link
