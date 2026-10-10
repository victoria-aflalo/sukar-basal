# October 9 revision QA

## Actual tests
- Real Tesseract image OCR on the sample image, not a stub: completed.
- Real PDF first-page rasterization and OCR: completed with reading errors. A hidden-tab run stalled after a WhatsApp popup took focus; foreground repeat completed.
- Image sample produced 15 rated entries, with one cornflakes entry after fixing adjacent-priced-line false duplication.
- Receipt prices retained by analyzing raw lines before normalization.
- Actual share button trusted mouse input: WhatsApp opened. Hebrew textual rating labels preserve the exact generated 2,980-character analysis. No recipient selected or send performed.
- Approved-swap checks: no returned alternative has higher/missing carbohydrates; six hot lunches exist.
- Photo gate: approved addition passes; missing-photo addition fails. CI is local, not deployed or branch-protected.
- Image assets are bundled locally, with 525 included products and 701 unresolved products. All selected source photographs were visually reviewed. Search and detail phone samples display correctly.

## Limitations
- Hosted preview OCR cannot load the external Tesseract worker. The preview says so. Standalone source engine tests are separate.
- Receipt matching is approximate. PDF reading mistakes remain and can cause wrong quantities/prices or product matching; not a perfect identification claim.
- Route pixels were inspected at 320/390/1280 for home, search, results, baskets and meals. Sample bread, actual Osem petit-beurre, lentil flour and missing-photo yogurt details were inspected. This is not a review of all 1,226 product nutrition/identity records. No full end-to-end release pass is claimed.
- Full-photo coverage is incomplete. No production deployment permitted at this state under the conditional owner instruction.
- Original image-host 429s were not retried. Official alternate AWS dataset supplied additional exact-folder candidates.

## Additional completed checks
- Keyboard Enter opens menu and Escape closes it. Invalid weight and missing profile selections rejected. Valid profile, edit preservation, empty search, unmatched receipt and malformed-image error checked.
- Hosted owner preview: actual petit-beurre search/detail/back, lentil-flour neutral missing-data state, home/meals and profile calculation checked with trusted UI clicks. Profile is memory-only in the isolated preview, not persisted there.
- Suppressed inherited unsupported product assurances; missing-data food cards/search/share display neutral ? instead of green. Receipt summary separately counts missing-data products.
- Quarantined the invalid USDA record attached to rusks barcode 7290010259991. Affected meal totals are now withheld. Its inherited water classification was removed. Cleaning-gel item 7290013268891 corrected to non-food.
- New photo admission includes blocked-public-rights rejection. Locally tested missing photo fails and a reviewed OFF addition passes.

## Remaining release gates
- 701 photos missing; 162 retailer photos have no verified reuse permission. 363 selected OFF photos have CC BY-SA provenance, which does not independently clear all packaging rights.
- Catalog-wide classification and nutrition reconciliation is unfinished. The discovered rusks/water mismatch shows inherited records cannot all be called verified.
- OCR PDF recognition/price errors remain; isolated hosted OCR worker unavailable.
- Hosted browser back/forward, direct route and all expansion/source-link paths not exhaustively verified.
- Admission CI not pushed or branch-protected; production untouched; GitHub login not attempted.
- Cloudflare account setup began after the owner selected the free option. Analytics is parked pending verified email; no site/token/script exists and production is untouched.

## October 10 safety regression pass
- Thirteen clear toiletry/hygiene records are now non-food with no food swaps. Non-food details omit nutrition/portion panels.
- Rule/fallback food classifications no longer yield green/yellow/red ratings or approved swaps. They remain unidentified pending source reconciliation, not silently reassigned to new categories.
- Category-only receipt fallback is disabled. Exact barcode-only receipt lines are retained for matching.
- Rusks barcode 7290010259991 matched deliberately: unknown summary count, share label, explanation and receipt price all tested. Gray summary contrast corrected after visual inspection at desktop and 390px.
- Conflicted yogurt/tahini nutrition entries withheld, preserving old values in excluded_facts rather than deleting their audit trail.
- Unmatched receipt text is HTML-escaped. Regression checks use synthetic hostile markup solely to test escaping.
- Profile, keyboard menu, empty search, unmatched receipt and malformed-image tests rerun. Full release QA remains blocked, not green.

- Latest hosted draft 01M4HN4R7FPX639HSMPBYNG3SA visually checked at 390px: corrected Dove non-food detail, Alpro neutral/quarantine detail, home/search/detail/back and meals navigation, first hot-lunch shopping disclosure. Six hot-lunch disclosures confirmed. External snacks, CDC plate, MOH labels, portion-size and Fooducate links resolve to intended pages.
- Follow-on fix: any inherited meal containing a quarantined catalog record also withholds total macros. This closes the separate meal panel bypass; local regression added. This edit follows the hosted draft checked above and requires a fresh hosted revision check.

## October 10 approved retailer-photo exclusion
Owner approved removal at 09:31:35. Removed 162 retailer assets, 162 item image references and 99 swap image references. Public photo evidence now includes only 363 OFF records; excluded retailer audit retained privately, not in the published tree. 863 catalog products now have no selected photo. Prior counts above describe historical checkpoints. Safety logic unchanged. Full release QA remains incomplete; this is the explicitly approved limited safety update.
