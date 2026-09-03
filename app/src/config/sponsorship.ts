/**
 * Whether this build shows sponsor placements at all.
 *
 * The supporter entitlement logic is deliberately untouched by this switch:
 * `shouldShowSponsorContent` still answers exactly as before, so a purchased
 * licence keeps suppressing sponsor content on its own terms and every
 * contract test in SUPPORTER_LICENSE_INVARIANTS.md still applies. This only
 * decides whether the surrounding build ever asks in the first place.
 *
 * Set to `true` to restore the upstream behaviour.
 */
export const SPONSOR_CONTENT_ENABLED = false;
