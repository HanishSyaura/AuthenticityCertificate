# Debug Session: ios-video-playback
- **Status**: [OPEN]
- **Issue**: Video upload appears on landing page but still cannot play on iOS.
- **Debug Server**: Pending startup
- **Log File**: .dbg/trae-debug-log-ios-video-playback.ndjson

## Reproduction Steps
1. Upload a video in CMS Landing Page builder.
2. Publish/save and open the landing page on iPhone/iPad Safari.
3. Tap the video area and attempt playback.
4. Observe whether metadata loads, controls appear, and playback starts.

## Hypotheses & Verification
| ID | Hypothesis | Likelihood | Effort | Evidence |
|----|------------|------------|--------|----------|
| A | Uploaded asset is still not iOS-compatible after processing, so Safari refuses to decode it. | High | Med | Pending |
| B | The video element reaches the page, but Safari never gets enough media state or attach info to start playback. | High | Low | Pending |
| C | The `/uploads/...` response or range behavior differs on iOS/Safari and prevents streaming. | Med | Med | Pending |
| D | The page is still pointing to an older incompatible uploaded asset rather than a newly processed file. | Med | Low | Pending |

## Log Evidence
- Live desktop inspection on production shows landing-page video assets currently resolving to 8K sources (`7680x4320`) and at least one file is still `82.2 MB`, which is far above the intended mobile-friendly transcode target.
- Production asset headers are healthy for byte-range (`206 Partial Content`, `Accept-Ranges: bytes`), so network range support is likely not the primary blocker.
- Browser-side instrumentation updated to session `ios-video-playback` for follow-up runtime evidence if needed.

## Verification Conclusion
Current strongest evidence points to incompatible or unprocessed legacy assets still being referenced by the published CMS layout, not a missing range-header issue.
