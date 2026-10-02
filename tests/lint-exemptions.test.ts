import { assertEquals, assertThrows } from "@std/assert"
import { findingsOf, lintExemptionsOf, unmatchedExemptions } from "../src/lint-exemptions.ts"

const TWO_PASS = "deno lint --ignore=testing.ts && deno lint --rules-exclude=innis/no-type-assertions testing.ts"

Deno.test("a plain lint task holds no exemption", () => {
  assertEquals(lintExemptionsOf("deno lint"), [])
})

Deno.test("the second pass of the two-pass form is the exemption", () => {
  assertEquals(lintExemptionsOf(TWO_PASS), [{ rules: ["innis/no-type-assertions"], paths: ["testing.ts"] }])
})

Deno.test("every pass that excludes a rule is an exemption of its own", () => {
  assertEquals(
    lintExemptionsOf(
      "deno lint --ignore=a.ts,examples/ && deno lint --rules-exclude=innis/max-params a.ts b.ts && deno lint --rules-exclude=no-console examples/",
    ),
    [
      { rules: ["innis/max-params"], paths: ["a.ts", "b.ts"] },
      { rules: ["no-console"], paths: ["examples/"] },
    ],
  )
})

Deno.test("a comma-separated exclusion names each rule", () => {
  assertEquals(lintExemptionsOf("deno lint --rules-exclude=no-console,innis/max-params a.ts")[0]?.rules, [
    "no-console",
    "innis/max-params",
  ])
})

Deno.test("the space-separated flag form names the rule too", () => {
  assertEquals(lintExemptionsOf("deno lint --rules-exclude no-console a.ts"), [
    { rules: ["no-console"], paths: ["a.ts"] },
  ])
})

Deno.test("a lint task given as an object reads its command", () => {
  assertEquals(lintExemptionsOf({ command: TWO_PASS })[0]?.paths, ["testing.ts"])
})

Deno.test("anything but a task string or object holds no exemption", () => {
  assertEquals(lintExemptionsOf(undefined), [])
})

const exemption = { rules: ["no-console"], paths: ["a.ts", "examples/"] }

Deno.test("an exemption the rule still fires under is matched", () => {
  assertEquals(
    unmatchedExemptions([exemption], [
      { file: "a.ts", code: "no-console" },
      { file: "examples/demo.ts", code: "no-console" },
    ]),
    [],
  )
})

Deno.test("an exempted file the rule no longer fires in is reported", () => {
  assertEquals(unmatchedExemptions([exemption], [{ file: "examples/demo.ts", code: "no-console" }]), [
    "no-console in a.ts",
  ])
})

Deno.test("a different rule firing does not keep an exemption", () => {
  assertEquals(
    unmatchedExemptions([exemption], [
      { file: "a.ts", code: "innis/max-params" },
      { file: "examples/demo.ts", code: "no-console" },
    ]),
    ["no-console in a.ts"],
  )
})

Deno.test("a directory with no file the rule fires in is reported", () => {
  assertEquals(unmatchedExemptions([exemption], [{ file: "a.ts", code: "no-console" }]), [
    "no-console in examples/",
  ])
})

Deno.test("a file that only shares a directory name's prefix does not keep it", () => {
  assertEquals(
    unmatchedExemptions([{ rules: ["no-console"], paths: ["examples"] }], [
      { file: "examples-old/demo.ts", code: "no-console" },
    ]),
    ["no-console in examples"],
  )
})

Deno.test("a leading ./ on an exempted path is ignored", () => {
  assertEquals(
    unmatchedExemptions([{ rules: ["no-console"], paths: ["./a.ts"] }], [{ file: "a.ts", code: "no-console" }]),
    [],
  )
})

Deno.test("an exemption with no paths covers the whole package", () => {
  assertEquals(
    unmatchedExemptions([{ rules: ["no-console"], paths: [] }], [{ file: "src/a.ts", code: "no-console" }]),
    [],
  )
  assertEquals(unmatchedExemptions([{ rules: ["no-console"], paths: [] }], []), ["no-console in the package"])
})

const LINT_JSON = {
  version: 1,
  diagnostics: [{ filename: "file:///repo/src/a.ts", code: "no-console", message: "", range: {}, hint: null }],
  errors: [],
  checked_files: ["/repo/src/a.ts"],
}

Deno.test("deno lint --json output reads as repository-relative findings", () => {
  assertEquals(findingsOf(LINT_JSON, "/repo"), [{ file: "src/a.ts", code: "no-console" }])
})

Deno.test("output that is not deno lint --json is refused", () => {
  assertThrows(() => findingsOf({ diagnostics: "none" }, "/repo"), Error, "deno lint --json")
})

Deno.test("a lint run that reported errors is refused", () => {
  assertThrows(
    () => findingsOf({ ...LINT_JSON, errors: [{ file_path: "/repo/b.ts", message: "parse" }] }, "/repo"),
    Error,
    "parse",
  )
})
