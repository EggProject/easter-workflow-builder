-- A `graph_snapshot` sor beszúrás után soha nem módosulhat (SPEC-003 5.5
-- szekció, 2. pont). A trigger szó szerinti szintaxisa a
-- docs/research/2026-08-27-spec003-f1-nyitott-kerdesek.md O-6 szekciójában
-- ellenőrzött: az UPDATE SQLITE_CONSTRAINT_TRIGGER hibával elbukik, az
-- INSERT és a DELETE változatlanul sikeres marad.
CREATE TRIGGER graph_snapshot_no_update
BEFORE UPDATE ON graph_snapshot
BEGIN
  SELECT RAISE(ABORT, 'graph_snapshot is immutable');
END;
