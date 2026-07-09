// eval: naming_convention — SHOULD trigger (PascalCase filename)
// No expect_lint here — filename diagnostic fires at offset 0 which can't
// be annotated (expect_lint checks the NEXT line). Eval script checks
// that any kitbag_naming_convention fires for this file.
class ThisClassIsFine {}
