# Skill: Deep Modules

**When to use:** Before creating new files for a feature. When proposing how to split or merge existing code. When reviewing AI-generated code that "smells" fragmented.

Based on John Ousterhout, *A Philosophy of Software Design*. A **deep module** has a small, simple interface and hides substantial functionality behind it. A **shallow module** has an interface roughly as complex as what it does — small wrappers, thin abstractions, files that exist for their own sake.

Shallow modules look organized but are bad. They:
- Force callers to understand many pieces to do anything useful.
- Have no good test boundary (mock everything? test in big groups?).
- Multiply when AI is left unaided.

---

## How to assess depth

For each proposed or existing module, answer:

1. **What does the interface look like?** List the exported names and their signatures.
2. **What does the module hide?** List the meaningful behavior, state, or invariants behind the interface.
3. **Ratio check.** If the interface is roughly as wide as the internals, the module is shallow.

If shallow, decide: merge into a caller, merge with a sibling, or fold internals up.

---

## How to draw test boundaries

Test at the deep module's interface, not inside it.

- A deep module → one test file that exercises its public interface through many scenarios.
- Internal helpers → not tested directly. They are exercised through the public interface.
- External seams (network, DB, time) → mocked at the module's edge, not inside its internals.

If you cannot test a module's behavior through its interface alone, the interface is wrong.

---

## When proposing new files

Before writing code, output a **module map**:

```
<module-name>
  exports: <names + brief signatures>
  hides: <internals / state / invariants>
  depends on: <other modules>
  test boundary: <what the test file will exercise>
```

Do this for every new module in the slice. If two modules in the map look thin or look like they should be one, merge them before writing the code.

---

## Refactoring an existing shallow area

1. Map the current files and their exports.
2. Identify clusters of files that move together when the feature changes.
3. Propose a consolidation: which files merge, which interface survives, what the new test boundary is.
4. Confirm with me before refactoring.
5. Refactor with tests staying green throughout.
