# Skill: TDD

**When to use:** Before implementing any non-trivial business logic, validation, calculation, state transition, or any code path you cannot trivially eyeball as correct.

**When NOT to use:** Pure layout/CSS, throwaway prototypes, scripts you'll run once.

---

## The cycle

### 1. Red
Write a single failing test that describes the next bit of behavior. The test must reference a module, function, or behavior that doesn't yet exist OR doesn't yet work.

Run the test. **Confirm it fails — and confirm it fails for the right reason.** A test that fails because of a missing import or typo doesn't count as red. The failure message must point at the missing behavior.

### 2. Green
Write the **minimum** code needed to pass the test. Not the elegant version. Not the version that handles future cases. The minimum.

Run the test. Confirm it passes. Then run the full test suite. Confirm nothing else broke.

### 3. Refactor
Now improve the code — extract, rename, deduplicate — without changing behavior. Run the tests after each refactor step. They must stay green.

---

## Rules that stop cheating

- **One test at a time.** Do not write five tests, then implement. Write one, make it pass, then write the next.
- **No test changes during green.** Once a test is written, do not modify it to make the implementation easier. If the test was wrong, throw it away and write a fresh one.
- **No skipping or marking pending.** If a test is failing, fix the code or delete the test. Never mark it `.skip` to "come back to."
- **Mock at the seam, not the implementation.** Mock external services (network, time, randomness). Do not mock the module you are testing or its internal collaborators.
- **Run the full suite, not just the new test.** Green on one file ≠ green on the project.

---

## When you finish a TDD ticket

State explicitly:
- How many tests were added
- What behavior each one pins down
- Anything you noticed that should be tested but isn't, and why you didn't
