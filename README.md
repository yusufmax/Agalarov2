# Sea Breeze Uzbekistan

A static, responsive editorial website with an opening scroll-controlled eight-video journey, available in English, Russian and Uzbek.

## Preview

Run `python3 -m http.server 4173 --directory dist` from this directory, then visit http://localhost:4173.

## Content and assets

Project information comes from https://uz.seabreeze.az/, including the 25 August 2026 update. The latest parameters are 527 hectares, 7 km shoreline and a 190-hectare first stage containing a 100-hectare initial phase. Rendered imagery is labelled as conceptual; planned amenities are not represented as completed.

The opening sequence is firstframe → secondframeV2 → third → afterinterior → walking_out → 5frame → parkingtolot → lastfin. Seams were checked frame-to-frame with the scroll-world method: each clip’s first frame matches the previous clip’s last frame in composition (the walking_out clip opens on the same promenade the afterinterior clip ends on, and closes on the same aerial the 5frame clip opens with). No new imagery or animation was generated. The original MP4s and renders remain untouched in the root and renders folder.

The web playback copies retain native resolution and use H.264 CRF 19, GOP 2 and no B-frames or audio to reduce seek latency. MP4 bytes are divided into 8 MiB chunks for static hosting and reconstructed in-memory as video blobs. The manifests include SHA-256 checksums. Desktop scroll uses frame-rate-independent exponential smoothing, coalesced seeking and nearby-clip prefetch. Chapters have weighted scroll shares (the opening flyover and the finale dwell longer) and a mild mid-scene linger on the first and last clips, following the scroll-world pacing guidance; seam frames are untouched. Phones preserve the complete landscape composition; no portrait footage is generated. Reduced-motion visitors see posters without loading the videos.

## Interactions

Chapter navigation, residence tabs (including arrow-key navigation), expandable masterplan, FAQ disclosures, responsive navigation and direct phone/email/contact links. Contact actions open the user's phone or email client; no enquiries are silently submitted.

## Taste redesign

Uses the installed `design-taste-frontend` and `redesign-existing-projects` skills. `dist/taste.css` contains the redesign layer; `dist/fonts.css` self-hosts Manrope. The visual system uses an architectural sans-serif display, one lake-blue accent, responsive asymmetric composition and system-aware dark mode. Entry animations run once and respect reduced motion. The original scroll engine remains isolated and coalesces decoder seeks.

The illustrative space planner describes user preferences, not official stock or dimensioned floor plans. The enquiry form validates fields, builds a reviewable message addressed to sales@seabreeze.az and hands it to the visitor's email client. It does not claim delivery or transmit/store lead information automatically. Automatic email or CRM delivery requires a configured backend service.

## Languages

`dist/i18n.js` holds a single dictionary for English, Russian and Uzbek (Latin) with key parity enforced across the three. Static markup carries the English strings; elements tagged `data-i18n`, `data-i18n-html` (br/em fragments only) and `data-i18n-attr` are rewritten on switch, and the engine re-renders its own strings (journey chapters, residence collections, space planner, form messages and the prepared email). The language is chosen from `?lang=`, then the visitor’s saved choice, then the browser language, and is remembered locally. Switchers sit in the header, the mobile menu and the footer.

## Polish layer

`dist/polish.css` applies the `uiux-designer` (UI/UX Pro Max) pass on top of the taste redesign: section wayfinding labels that mirror the navigation, a chapter counter and per-chapter progress rail in the journey, an SVG icon set instead of typographic arrows, stat counters, blur-settling reveals, smooth FAQ disclosures, residence tab transitions, a scroll-linked parallax on the two full-bleed photographs, hover feedback without layout shift and a footer section map. All motion respects `prefers-reduced-motion` and runs once.

## Preloader

On entry a full-screen loader streams all eight chapters (about 206 MB of chunked H.264) before the page becomes scrollable, so the journey never waits on the network mid-scroll. Progress is counted in received bytes against the sizes recorded in `dist/assets/videos.json`; the opening chapter is fetched first and each chapter name lights up as it lands. A skip control appears after six seconds for slow connections, in which case chapters keep loading in the background and posters stand in until they arrive. Reduced-motion visitors skip the loader entirely (posters only).

## Deployment

The site is published from `dist/` by the GitHub Actions workflow in `.github/workflows/pages.yml` (GitHub Pages, source "GitHub Actions"). Every push to `main` redeploys. All asset paths are relative, so the site works under the repository sub-path.
