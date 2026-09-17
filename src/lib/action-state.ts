/**
 * The shape every Server Action in BhishiBook returns.
 *
 * Shared so the ActionForm component can drive any action, and so success and
 * failure are reported the same way on every screen.
 */
export type ActionState = { error?: string; success?: string };
