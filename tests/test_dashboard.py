"""Dashboard data builder: absence stays absence; a missing figure never becomes 0. Run: python3 -m unittest tests/test_dashboard.py"""
import json, pathlib, sys, tempfile, unittest
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent.parent / "scripts"))
import build_dashboard as b

LEDGER = """| ID | Lines | Requirement (verbatim gist) | Trust | Status | Check | Artifact or what it waits on |
|---|---|---|---|---|---|---|
| B-01 | 1-5 | choose a genre | trusted | partial | manual | Option 3 chosen |
| B-02 | 6-9 | assets | conditioned (F-2) | unserved | manual | nothing |
| B-15 | 57-58 | principle | trusted | n/a | manual | n/a |

| ID | Criterion (short) | Trust | Status | Check | Artifact or what it waits on |
|---|---|---|---|---|---|
| AC-S3 | straight | trusted | satisfied | unit | tests/physics.test.ts |
| AC-P1 | sourced carry | trusted | blocked | unit | waits on sources |
| PS-1..PS-5 | slice | x | satisfied then superseded by SH | unit |
"""

class T(unittest.TestCase):
    def test_ledger_rows_and_statuses(self):
        rows = {r["id"]: r for r in b.parse_ledger(LEDGER)}
        self.assertEqual(rows["B-01"]["status"], "partial"); self.assertEqual(rows["B-02"]["status"], "unserved"); self.assertEqual(rows["B-15"]["status"], "n/a")
        self.assertEqual(rows["AC-P1"]["status"], "blocked"); self.assertEqual(rows["AC-S3"]["check"], "unit")
        self.assertEqual(rows["B-02"]["trust"], "conditioned (F-2)")
    def test_header_and_separator_rows_are_not_data(self):
        self.assertNotIn("ID", [r["id"] for r in b.parse_ledger(LEDGER)]); self.assertEqual(len(b.parse_ledger(LEDGER)), 5)
    def test_rows_with_the_wrong_column_count_are_skipped_not_guessed(self):
        self.assertEqual([r["id"] for r in b.parse_ledger("| ID | Status |\n|---|---|\n| X | satisfied | extra |\n| Y | blocked |")], ["Y"])
    def test_missing_test_results_are_not_live_never_zero(self):
        m = b.tests(pathlib.Path(tempfile.mkdtemp()) / "nope.json")
        self.assertFalse(m["measured"]); self.assertIn("reason", m); self.assertNotIn("value", m)
    def test_measured_figures_carry_a_source(self):
        self.assertEqual(b.meas(3, "s"), {"measured": True, "value": 3, "source": "s"}); self.assertEqual(b.unmeas("why"), {"measured": False, "reason": "why"})
    def test_latency_logs_and_traces_are_not_live_in_a_fresh_build(self):
        d = b.build()
        for k in ("latency", "logs", "traces"): self.assertFalse(d[k]["measured"], k)
        self.assertFalse(d["cost"]["hosting"]["measured"])
if __name__ == "__main__": unittest.main()
