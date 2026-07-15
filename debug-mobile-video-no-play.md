# Debug Session: mobile-video-no-play
- **Status**: [OPEN]
- **Issue**: Localhost plays uploaded videos, but production playback fails on both Android and iOS.
- **Debug Server**: Use backend collector `/api/__debug/video-event` (requires `DEBUG_EVENT_TOKEN`)
- **Log File**: .dbg/trae-debug-log-mobile-video-no-play.ndjson

## Reproduction Steps
1. Upload a video via CMS builder and publish.
2. Open the public verify page on Android Chrome and iOS Safari.
3. Attempt to play the video.

## Hypotheses & Verification
| ID | Hypothesis | Likelihood | Effort | Evidence |
|----|------------|------------|--------|----------|
| A | Production upload pipeline is not transcoding (ffmpeg missing / failing), so assets remain huge or codec-incompatible for mobile. | High | Med | Pending |
| B | Published CMS layout still references old cached assets (immutable cache), so devices keep getting an incompatible version even after upload. | High | Low | Pending |
| C | Production HTTP delivery differs from localhost (Range / Content-Type / redirects / auth fallback), causing mobile players to fail. | Med | Med | Pending |
| D | CSS/layout differences in production on mobile (transform/overlay) break video rendering on both Android/iOS. | Med | Med | Pending |
| E | Mixed content / CSP / cross-origin URL resolution causes the video src to be blocked on mobile. | Low | Low | Pending |

## Log Evidence
Pending instrumentation.

## Verification Conclusion
Pending.
