/**
 * Render flags the e2e suite can turn off from the URL. DEV-only, like the test bridge, so a
 * production build always renders the full diorama and no query string can strip it.
 *
 * `?fx=off` drops the post-processing stack. Fast-forwarding a wave of 25 bugs through depth
 * of field and bloom on a software rasteriser is what makes the headless suite slow, and the
 * tests that use it are asserting on simulation and scene-graph state, not on the grade. The
 * specs that do judge render output — scene and instancing — deliberately leave it on, and so
 * does `npm run dev`, which is how the diorama's look is actually reviewed.
 */
export const EFFECTS_ENABLED = !(
  import.meta.env.DEV &&
  new URLSearchParams(window.location.search).get('fx') === 'off'
);
