# Sea Breeze Uzbekistan

A static, responsive editorial website with an opening scroll-controlled six-video journey.

## Preview

Run `python3 -m http.server 4173 --directory dist` from this directory, then visit http://localhost:4173.

## Content and assets

Project information comes from https://uz.seabreeze.az/, including the 25 August 2026 update. The latest parameters are 527 hectares, 7 km shoreline and a 190-hectare first stage containing a 100-hectare initial phase. Rendered imagery is labelled as conceptual; planned amenities are not represented as completed.

The opening sequence is firstframe → secondframeV2 → third → 5frame → 6frame → last. No new imagery or animation was generated. The original MP4s and renders remain untouched in the root and renders folder.

The web playback copies retain native resolution and use H.264 CRF 19, GOP 2 and no B-frames or audio to reduce seek latency. MP4 bytes are divided into 8 MiB chunks for static hosting and reconstructed in-memory as video blobs. The manifests include SHA-256 checksums. Desktop scroll uses frame-rate-independent exponential smoothing, coalesced seeking and nearby-clip prefetch. Phones preserve the complete landscape composition; no portrait footage is generated. Reduced-motion visitors see posters without loading the videos.

## Interactions

Chapter navigation, residence tabs (including arrow-key navigation), expandable masterplan, FAQ disclosures, responsive navigation and direct phone/email/contact links. Contact actions open the user's phone or email client; no enquiries are silently submitted.
