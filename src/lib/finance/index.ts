/**
 * The BhishiBook finance engine.
 *
 * Everything in here is a pure function over integer paise: no database, no
 * clock of its own, no I/O. That is deliberate. These are the calculations the
 * group's money depends on, so they are all directly unit-testable and every
 * caller has to pass in `asOf` rather than reaching for `new Date()`, which
 * keeps results reproducible.
 */

export * from "./dates";
export * from "./fines";
export * from "./loans";
export * from "./distribution";
