import { describe, expect, it } from "vitest";
import { csvFilename, toCsv, UTF8_BOM } from "./csv";

describe("toCsv", () => {
  it("writes a header and rows", () => {
    const csv = toCsv(["Name", "Amount"], [["Amit", "1000.00"]]);
    expect(csv).toBe(`${UTF8_BOM}Name,Amount\r\nAmit,1000.00\r\n`);
  });

  it("starts with a BOM, so Excel reads Marathi correctly", () => {
    const csv = toCsv(["नाव"], [["अमित पाटील"]]);
    expect(csv.startsWith(UTF8_BOM)).toBe(true);
    expect(csv).toContain("अमित पाटील");
  });

  it("quotes values containing commas, quotes or newlines", () => {
    const csv = toCsv(["Note"], [['Paid, late']]);
    expect(csv).toContain('"Paid, late"');

    const quoted = toCsv(["Note"], [['He said "yes"']]);
    expect(quoted).toContain('"He said ""yes"""');

    const multiline = toCsv(["Note"], [["line one\nline two"]]);
    expect(multiline).toContain('"line one\nline two"');
  });

  it("neutralises values Excel would run as a formula", () => {
    // A member name or note starting with these would otherwise execute.
    for (const dangerous of ["=1+1", "+1", "-1", "@SUM(A1)"]) {
      const csv = toCsv(["Name"], [[dangerous]]);
      expect(csv).toContain(`'${dangerous}`);
    }
  });

  it("writes dates as plain calendar days and blanks for missing values", () => {
    const csv = toCsv(
      ["Date", "Phone"],
      [[new Date(Date.UTC(2026, 8, 17)), null], [new Date(Date.UTC(2026, 8, 18)), undefined]]
    );
    expect(csv).toContain("2026-09-17,");
    expect(csv).toContain("2026-09-18,");
  });

  it("handles an empty report", () => {
    expect(toCsv(["Name"], [])).toBe(`${UTF8_BOM}Name\r\n`);
  });
});

describe("csvFilename", () => {
  it("builds a safe filename from the group name and date", () => {
    const name = csvFilename("MaitriNidhi", "members", new Date(Date.UTC(2026, 8, 17)));
    expect(name).toBe("maitrinidhi-members-2026-09-17.csv");
  });

  it("strips characters that are unsafe in a filename", () => {
    const name = csvFilename('Shivneri / "Mitra" Mandal', "ledger", new Date(Date.UTC(2026, 0, 2)));
    expect(name).toBe("shivneri-mitra-mandal-ledger-2026-01-02.csv");
  });

  it("falls back when the name has nothing usable left", () => {
    const name = csvFilename("मैत्री", "fines", new Date(Date.UTC(2026, 0, 2)));
    expect(name).toBe("bhishibook-fines-2026-01-02.csv");
  });
});
